GRANT INSERT ON public.bookings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

DROP POLICY IF EXISTS "anyone can create booking" ON public.bookings;

CREATE POLICY "Guests and users can create pending bookings"
ON public.bookings
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'pending'::booking_status
  AND length(trim(customer_name)) BETWEEN 2 AND 100
  AND length(trim(phone)) BETWEEN 5 AND 30
  AND event_date >= CURRENT_DATE
);