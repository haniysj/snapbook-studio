import { supabase } from "@/integrations/supabase/client";

export function whatsappUrl(number: string, message?: string): string {
  const clean = (number || "").replace(/[^\d]/g, "");
  const base = `https://wa.me/${clean}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@sevenphoto.local`;
}

export function publicMediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return data.publicUrl;
}
