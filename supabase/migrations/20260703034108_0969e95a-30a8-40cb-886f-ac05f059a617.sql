
-- Restore view to safe invoker mode (will be empty for anon; we replace access with a function)
ALTER VIEW public.booked_dates SET (security_invoker = true);

-- Function returning only the booked event dates, safe to expose publicly
CREATE OR REPLACE FUNCTION public.get_booked_dates()
RETURNS TABLE(event_date date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT event_date FROM public.bookings
  WHERE status IN ('pending','confirmed') AND event_date IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_booked_dates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booked_dates() TO anon, authenticated;
