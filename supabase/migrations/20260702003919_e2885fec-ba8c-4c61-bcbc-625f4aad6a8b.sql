
-- 1) View with security_invoker
DROP VIEW IF EXISTS public.booked_dates;
CREATE VIEW public.booked_dates
WITH (security_invoker = true) AS
SELECT event_date, status FROM public.bookings WHERE status IN ('pending','confirmed');
GRANT SELECT ON public.booked_dates TO anon, authenticated;

-- 2) Tighten booking insert policy (basic validation)
DROP POLICY IF EXISTS "anyone can create booking" ON public.bookings;
CREATE POLICY "anyone can create booking" ON public.bookings
FOR INSERT
WITH CHECK (
  length(customer_name) BETWEEN 2 AND 100
  AND length(phone) BETWEEN 5 AND 30
  AND event_date >= CURRENT_DATE
  AND status = 'pending'
);

-- 3) Restrict SECURITY DEFINER function execution to authenticated users only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
