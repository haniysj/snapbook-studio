import { createServerFn } from "@tanstack/react-start";

// Face ID / Touch ID / fingerprint sign-in with WebAuthn passkeys.
// A supervisor first signs in with their PIN, then turns it on for that device.
// The passkey is stored on the device (secure enclave) and identifies the account by itself.

const RP_NAME = "Seven Photography";
const CHALLENGE_TTL = "5 minutes";

async function rp() {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const host = (getRequestHeader("x-forwarded-host") ?? getRequestHeader("host") ?? "").split(",")[0].trim();
  const hostname = host.replace(/:\d+$/, "");
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  const proto = (getRequestHeader("x-forwarded-proto") ?? (local ? "http" : "https")).split(",")[0].trim();
  if (!hostname) throw new Error("Unknown host");
  return { rpID: hostname, origin: `${proto}://${host}` };
}

const b64u = (u8: Uint8Array) =>
  btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/** Take a challenge out of the store (one-time use). */
async function consumeChallenge(clientDataJSON: string, purpose: "register" | "login") {
  const { q, tbl } = await import("./server/db");
  let challenge = "";
  try {
    challenge = JSON.parse(new TextDecoder().decode(fromB64u(clientDataJSON))).challenge ?? "";
  } catch { /* invalid */ }
  await q(`delete from ${tbl("webauthn_challenges")} where expires_at < now()`);
  const rows = await q<{ challenge: string; admin_id: string | null }>(
    `delete from ${tbl("webauthn_challenges")} where challenge = $1 and purpose = $2
       returning challenge, admin_id::text as admin_id`,
    [challenge, purpose],
  );
  if (!rows[0]) throw new Error("expired");
  return rows[0];
}

/* ---------- register (signed in) ---------- */
export const passkeyRegisterOptions = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin } = await import("./server/session");
  const { q, tbl } = await import("./server/db");
  const { generateRegistrationOptions } = await import("@simplewebauthn/server");
  const me = await requireAdmin();
  const { rpID } = await rp();
  const existing = await q<{ id: string; transports: string }>(
    `select id, transports from ${tbl("passkeys")} where admin_id::text = $1`,
    [me.id],
  );
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: me.display_name,
    userDisplayName: me.display_name,
    userID: new TextEncoder().encode(me.id),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({ id: c.id, transports: (c.transports ? c.transports.split(",") : undefined) as any })),
    authenticatorSelection: { residentKey: "required", userVerification: "required", authenticatorAttachment: "platform" },
    preferredAuthenticatorType: "localDevice", // use this phone's own Face ID / fingerprint, not a QR code or security key
    timeout: 120_000,
  });
  await q(
    `insert into ${tbl("webauthn_challenges")} (challenge, admin_id, purpose, expires_at)
       values ($1, $2, 'register', now() + interval '${CHALLENGE_TTL}')`,
    [options.challenge, me.id],
  );
  return options;
});

export const passkeyRegisterVerify = createServerFn({ method: "POST" })
  .inputValidator((d: { response: any; deviceName?: string }) => d)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./server/session");
    const { q, tbl } = await import("./server/db");
    const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
    const me = await requireAdmin();
    const { rpID, origin } = await rp();
    const ch = await consumeChallenge(String(data.response?.response?.clientDataJSON ?? ""), "register");
    if (ch.admin_id !== me.id) throw new Error("expired");
    const v = await verifyRegistrationResponse({
      response: data.response,
      expectedChallenge: ch.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!v.verified || !v.registrationInfo) throw new Error("Verification failed");
    const c = v.registrationInfo.credential;
    await q(
      `insert into ${tbl("passkeys")} (id, admin_id, public_key, counter, transports, device_name)
         values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update set admin_id = excluded.admin_id, public_key = excluded.public_key,
         counter = excluded.counter, transports = excluded.transports, device_name = excluded.device_name`,
      [c.id, me.id, b64u(c.publicKey), c.counter, (c.transports ?? []).join(","), String(data.deviceName ?? "").slice(0, 60)],
    );
    return { ok: true, id: c.id };
  });

/* ---------- sign in ---------- */
export const passkeyLoginOptions = createServerFn({ method: "POST" }).handler(async () => {
  const { q, tbl } = await import("./server/db");
  const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
  const { rpID } = await rp();
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required", timeout: 120_000 });
  await q(`delete from ${tbl("webauthn_challenges")} where expires_at < now()`);
  await q(
    `insert into ${tbl("webauthn_challenges")} (challenge, purpose, expires_at) values ($1, 'login', now() + interval '${CHALLENGE_TTL}')`,
    [options.challenge],
  );
  return options;
});

export const passkeyLoginVerify = createServerFn({ method: "POST" })
  .inputValidator((d: { response: any }) => d)
  .handler(async ({ data }) => {
    const { q, tbl } = await import("./server/db");
    const { startSession } = await import("./server/session");
    const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
    const fail = (message: string) => ({ user: null, error: { message } });
    try {
      const { rpID, origin } = await rp();
      const ch = await consumeChallenge(String(data.response?.response?.clientDataJSON ?? ""), "login");
      const rows = await q<{ id: string; admin_id: string; public_key: string; counter: string; transports: string; display_name: string; is_super: boolean }>(
        `select p.id, p.admin_id::text as admin_id, p.public_key, p.counter::text as counter, p.transports,
                a.display_name, a.is_super
           from ${tbl("passkeys")} p join ${tbl("admin_users")} a on a.id = p.admin_id
          where p.id = $1`,
        [String(data.response?.id ?? "")],
      );
      const pk = rows[0];
      if (!pk) return fail("unknown");
      const v = await verifyAuthenticationResponse({
        response: data.response,
        expectedChallenge: ch.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: {
          id: pk.id,
          publicKey: fromB64u(pk.public_key),
          counter: Number(pk.counter),
          transports: (pk.transports ? pk.transports.split(",") : undefined) as any,
        },
      });
      if (!v.verified) return fail("invalid");
      await q(`update ${tbl("passkeys")} set counter = $1, last_used_at = now() where id = $2`, [v.authenticationInfo.newCounter, pk.id]);
      await startSession(pk.admin_id);
      return { user: { id: pk.admin_id, display_name: pk.display_name, is_super: pk.is_super }, error: null };
    } catch (e: any) {
      console.error("passkeyLogin", e?.message);
      return fail(e?.message === "expired" ? "expired" : "invalid");
    }
  });

/* ---------- manage ---------- */
export const passkeyList = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./server/session");
  const { q, tbl } = await import("./server/db");
  const me = await requireAdmin();
  return await q<{ id: string; device_name: string; created_at: string; last_used_at: string | null }>(
    `select id, device_name, to_char(created_at, 'YYYY-MM-DD') as created_at, to_char(last_used_at, 'YYYY-MM-DD') as last_used_at
       from ${tbl("passkeys")} where admin_id::text = $1 order by created_at desc`,
    [me.id],
  );
});

export const passkeyDelete = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./server/session");
    const { q, tbl } = await import("./server/db");
    const me = await requireAdmin();
    await q(`delete from ${tbl("passkeys")} where id = $1 and admin_id::text = $2`, [data.id, me.id]);
    return { ok: true };
  });
