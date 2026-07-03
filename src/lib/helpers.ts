import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export function whatsappUrl(number: string, message?: string): string {
  const clean = (number || "").replace(/[^\d]/g, "");
  const base = `https://wa.me/${clean}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@sevenphoto.local`;
}

export function emailToUsername(email: string | null | undefined): string {
  if (!email) return "";
  return email.split("@")[0];
}

/** Kept for legacy imports — returns the public URL (works only if bucket is public). */
export function publicMediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return data.publicUrl;
}

/** Async signed URL for private media bucket. */
export async function signedMediaUrl(
  path: string | null | undefined,
  expiresIn = 60 * 60,
): Promise<string> {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from("media").createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? "";
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
