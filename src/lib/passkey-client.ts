// Browser side of Face ID / fingerprint sign-in.
import { supabase } from "@/integrations/supabase/client";
import {
  passkeyLoginOptions,
  passkeyLoginVerify,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
} from "@/lib/passkey.functions";

const FLAG = "seven-passkey"; // credential id registered on this device

export function deviceFlag(): string | null {
  try { return localStorage.getItem(FLAG); } catch { return null; }
}
export function setDeviceFlag(id: string | null) {
  try { id ? localStorage.setItem(FLAG, id) : localStorage.removeItem(FLAG); } catch { /* ignore */ }
}

export async function biometricsAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Face ID on iPhone/iPad, Touch ID on Mac, fingerprint elsewhere. */
export function biometricKind(): "face" | "touch" | "finger" {
  if (typeof navigator === "undefined") return "finger";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "face";
  if (/Macintosh/.test(ua)) return "touch";
  return "finger";
}

export function biometricLabel(ar: boolean) {
  const k = biometricKind();
  if (k === "face") return ar ? "بصمة الوجه" : "Face ID";
  if (k === "touch") return ar ? "بصمة الإصبع" : "Touch ID";
  return ar ? "البصمة" : "Fingerprint";
}

export function deviceName() {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android phone" : "Android tablet";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  return "Device";
}

/** Returns "cancelled" when the person closes the Face ID / fingerprint prompt. */
export async function signInWithBiometrics(): Promise<"ok" | "cancelled" | "unknown" | "error"> {
  const { startAuthentication } = await import("@simplewebauthn/browser");
  const optionsJSON = await passkeyLoginOptions();
  let response;
  try {
    response = await startAuthentication({ optionsJSON });
  } catch (e: any) {
    if (e?.name === "NotAllowedError" || e?.name === "AbortError") return "cancelled";
    throw e;
  }
  const res = await passkeyLoginVerify({ data: { response } });
  if (!res.user) return res.error?.message === "unknown" ? "unknown" : "error";
  setDeviceFlag(response.id);
  supabase.auth.completeSignIn(res.user);
  return "ok";
}

export async function enableBiometrics(): Promise<"ok" | "cancelled" | "exists"> {
  const { startRegistration } = await import("@simplewebauthn/browser");
  const optionsJSON = await passkeyRegisterOptions();
  let response;
  try {
    response = await startRegistration({ optionsJSON });
  } catch (e: any) {
    if (e?.name === "InvalidStateError") return "exists"; // this device already has one for this account
    if (e?.name === "NotAllowedError" || e?.name === "AbortError") return "cancelled";
    throw e;
  }
  const r = await passkeyRegisterVerify({ data: { response, deviceName: deviceName() } });
  setDeviceFlag(r.id);
  return "ok";
}
