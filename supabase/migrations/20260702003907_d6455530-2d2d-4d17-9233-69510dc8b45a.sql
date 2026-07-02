
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'super_admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('admin','super_admin')) $$;

CREATE POLICY "roles readable by self" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- ============ ADMIN PROFILES ============
CREATE TABLE public.admin_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_profiles TO authenticated;
GRANT ALL ON public.admin_profiles TO service_role;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read profiles" ON public.admin_profiles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admins update profiles" ON public.admin_profiles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- ============ SETTINGS ============
CREATE TABLE public.settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  site_name TEXT NOT NULL DEFAULT 'Seven Photography',
  logo_url TEXT,
  whatsapp_number TEXT NOT NULL DEFAULT '+96896763697',
  bank_details TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "admins write settings" ON public.settings FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
INSERT INTO public.settings (id, site_name, whatsapp_number, bank_details) VALUES (1, 'Seven Photography', '+96896763697', 'يرجى إيداع المبلغ على الحساب البنكي التالي:\nاسم البنك: —\nاسم المستفيد: —\nرقم الحساب / IBAN: —') ON CONFLICT (id) DO NOTHING;

-- ============ PACKAGES ============
CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  description_ar TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'OMR',
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.packages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read packages" ON public.packages FOR SELECT USING (active = true OR public.is_admin(auth.uid()));
CREATE POLICY "admins write packages" ON public.packages FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.packages (name_ar, name_en, description_ar, price, sort_order) VALUES
('باقة الأساسية', 'Basic', 'تغطية مناسبة (٢ ساعة) + ٣٠ صورة معدلة', 80, 1),
('باقة الفضية', 'Silver', 'تغطية (٤ ساعات) + ٧٠ صورة معدلة + فيديو قصير', 150, 2),
('باقة الذهبية', 'Gold', 'تغطية كاملة + ألبوم مطبوع + فيديو احترافي', 280, 3);

-- ============ GALLERY ============
CREATE TABLE public.gallery_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.gallery_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gallery_categories TO authenticated;
GRANT ALL ON public.gallery_categories TO service_role;
ALTER TABLE public.gallery_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read categories" ON public.gallery_categories FOR SELECT USING (true);
CREATE POLICY "admins write categories" ON public.gallery_categories FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.gallery_categories (name_ar, name_en, sort_order) VALUES
('أعراس', 'Weddings', 1), ('مناسبات', 'Events', 2), ('بورتريه', 'Portrait', 3);

CREATE TABLE public.gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  title_ar TEXT DEFAULT '',
  category_id UUID REFERENCES public.gallery_categories(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gallery_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gallery_images TO authenticated;
GRANT ALL ON public.gallery_images TO service_role;
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read images" ON public.gallery_images FOR SELECT USING (active = true OR public.is_admin(auth.uid()));
CREATE POLICY "admins write images" ON public.gallery_images FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ BOOKINGS ============
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'cancelled');

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  event_location_url TEXT DEFAULT '',
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.bookings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
-- Public can insert bookings (guest checkout)
CREATE POLICY "anyone can create booking" ON public.bookings FOR INSERT WITH CHECK (true);
-- Public can read confirmed/pending dates only (limited columns via view below)
CREATE POLICY "admins read bookings" ON public.bookings FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admins update bookings" ON public.bookings FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admins delete bookings" ON public.bookings FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Public view exposing only occupied dates (no PII)
CREATE OR REPLACE VIEW public.booked_dates AS
SELECT event_date, status FROM public.bookings WHERE status IN ('pending','confirmed');
GRANT SELECT ON public.booked_dates TO anon, authenticated;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_admin_profiles_updated BEFORE UPDATE ON public.admin_profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
