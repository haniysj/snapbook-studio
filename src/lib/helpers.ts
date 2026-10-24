import { useEffect, useState } from "react";
import { supabase, mediaSrc } from "@/integrations/supabase/client";
import type { Session } from "@/integrations/supabase/client";

export function whatsappUrl(number: string, message?: string): string {
  let clean = (number || "").replace(/[^\d]/g, "").replace(/^00/, "");
  // Local Omani mobile/landline numbers (8 digits) → add the 968 country code
  if (/^[2479]\d{7}$/.test(clean)) clean = `968${clean}`;
  // api.whatsapp.com/send opens both WhatsApp and WhatsApp Business (and WhatsApp Web on computers);
  // the wa.me short link fails on some phones.
  const base = `https://api.whatsapp.com/send?phone=${clean}`;
  return message ? `${base}&text=${encodeURIComponent(message)}` : base;
}

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@sevenphoto.local`;
}

export function emailToUsername(email: string | null | undefined): string {
  if (!email) return "";
  return email.split("@")[0];
}

/** Browser-usable URL for a stored media file (private Blob files are served via /api/media). */
export function publicMediaUrl(path: string | null | undefined): string {
  return mediaSrc(path);
}

/** Kept async for existing callers. */
export async function signedMediaUrl(path: string | null | undefined): Promise<string> {
  return mediaSrc(path);
}

/** Simple session hook. */
export function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return session;
}
