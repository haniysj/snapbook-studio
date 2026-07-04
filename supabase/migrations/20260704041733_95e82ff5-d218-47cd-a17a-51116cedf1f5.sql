
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS instagram_url TEXT;
