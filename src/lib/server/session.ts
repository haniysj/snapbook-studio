// Server-only: admin session cookie + password hashing (Web Crypto, runtime-agnostic).
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { q, tbl } from "./db";

const COOKIE = "seven_admin";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days
const enc = new TextEncoder();

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("Missing SESSION_SECRET environment variable (32+ chars).");
  return s;
}

const b64u = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* ---------------- passwords (PBKDF2-SHA256) ---------------- */
const ITER = 100_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER }, key, 256);
  return `pbkdf2$${ITER}$${b64u(salt)}$${b64u(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, iterStr, saltStr, hashStr] = stored.split("$");
  if (alg !== "pbkdf2") return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromB64u(saltStr), iterations: Number(iterStr) },
    key,
    256,
  );
  return safeEqual(b64u(bits), hashStr);
}

/* ---------------- session cookie ---------------- */
export type AdminUser = { id: string; display_name: string; is_super: boolean };

export async function startSession(userId: string) {
  const payload = b64u(enc.encode(JSON.stringify({ uid: userId, exp: Math.floor(Date.now() / 1000) + MAX_AGE })));
  const token = `${payload}.${await hmac(payload)}`;
  setCookie(COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: MAX_AGE });
}

export function endSession() {
  deleteCookie(COOKIE, { path: "/" });
}

/** Returns the signed-in admin, or null. Re-checks the user still exists. */
export async function currentAdmin(): Promise<AdminUser | null> {
  const token = getCookie(COOKIE);
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(await hmac(payload), sig)) return null;
  let data: { uid: string; exp: number };
  try {
    data = JSON.parse(new TextDecoder().decode(fromB64u(payload)));
  } catch {
    return null;
  }
  if (!data?.uid || data.exp < Date.now() / 1000) return null;
  const rows = await q<AdminUser>(
    `select id::text as id, display_name, is_super from ${tbl("admin_users")} where id::text = $1`,
    [data.uid],
  );
  return rows[0] ?? null;
}

export async function requireAdmin(): Promise<AdminUser> {
  const u = await currentAdmin();
  if (!u) throw new Error("Unauthorized");
  return u;
}

export async function requireSuper(): Promise<AdminUser> {
  const u = await requireAdmin();
  if (!u.is_super) throw new Error("Only the general supervisor can do this");
  return u;
}

/* ---------------- PINs ---------------- */
export const PIN_RE = /^\d{6,12}$/;

export function checkPinFormat(pin: string) {
  if (!PIN_RE.test(String(pin ?? ""))) throw new Error("PIN must be 6–12 digits");
}

/** Throws if another account already uses this PIN (PINs identify the account, so they must be unique). */
export async function assertPinUnique(pin: string, exceptId?: string) {
  const rows = await q<{ id: string; pin_hash: string }>(`select id::text as id, pin_hash from ${tbl("admin_users")}`);
  for (const r of rows) {
    if (r.id !== exceptId && (await verifyPassword(pin, r.pin_hash))) throw new Error("This PIN is already used by another account");
  }
}
