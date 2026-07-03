
ALTER VIEW public.booked_dates SET (security_invoker = false);
GRANT SELECT ON public.booked_dates TO anon, authenticated;

ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS discounted_price numeric,
  ADD COLUMN IF NOT EXISTS offer_expiry_date timestamptz;
