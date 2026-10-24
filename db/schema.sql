-- Seven Studio — Neon schema (replaces the deleted Lovable Cloud / Supabase database).
-- Safe to re-run: everything is IF NOT EXISTS / ON CONFLICT DO NOTHING.
create schema if not exists seven;

do $$ begin
  create type seven.booking_status as enum ('pending', 'confirmed', 'cancelled');
exception when duplicate_object then null; end $$;

-- Admin accounts sign in with a PIN only (no username). is_super = المشرف العام.
create table if not exists seven.admin_users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  pin_hash text not null,
  is_super boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Failed PIN attempts, used to block brute-force guessing.
create table if not exists seven.login_attempts (
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists login_attempts_ip_at_idx on seven.login_attempts (ip, at);

create table if not exists seven.settings (
  id int primary key default 1 check (id = 1),
  site_name text not null default 'Seven Photography',
  logo_url text,
  whatsapp_number text not null default '+96896763697',
  bank_details text default '',
  instagram_url text,
  updated_at timestamptz not null default now()
);

create table if not exists seven.packages (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null default '',
  description_ar text default '',
  description_en text default '',
  price numeric(10,2) not null default 0,
  discounted_price numeric,
  offer_expiry_date timestamptz,
  currency text not null default 'OMR',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists seven.gallery_categories (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text default '',
  sort_order int not null default 0
);

create table if not exists seven.gallery_images (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  title_ar text default '',
  category_id uuid references seven.gallery_categories(id) on delete set null,
  sort_order int not null default 0,
  active boolean not null default true,
  media_type text not null default 'image',
  created_at timestamptz not null default now()
);

create table if not exists seven.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  event_location_url text default '',
  event_date date not null,
  event_time time not null,
  package_id uuid references seven.packages(id) on delete set null,
  status seven.booking_status not null default 'pending',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bookings_event_date_idx on seven.bookings (event_date);

-- Default content (same as the original Lovable seed)
insert into seven.settings (id, site_name, whatsapp_number, bank_details)
values (1, 'Seven Photography', '+96896763697',
  E'يرجى إيداع المبلغ على الحساب البنكي التالي:\nاسم البنك: —\nاسم المستفيد: —\nرقم الحساب / IBAN: —')
on conflict (id) do nothing;

insert into seven.packages (name_ar, name_en, description_ar, price, sort_order)
select * from (values
  ('باقة الأساسية', 'Basic', 'تغطية مناسبة (٢ ساعة) + ٣٠ صورة معدلة', 80, 1),
  ('باقة الفضية', 'Silver', 'تغطية (٤ ساعات) + ٧٠ صورة معدلة + فيديو قصير', 150, 2),
  ('باقة الذهبية', 'Gold', 'تغطية كاملة + ألبوم مطبوع + فيديو احترافي', 280, 3)
) v where not exists (select 1 from seven.packages);

insert into seven.gallery_categories (name_ar, name_en, sort_order)
select * from (values ('أعراس', 'Weddings', 1), ('مناسبات', 'Events', 2), ('بورتريه', 'Portrait', 3)) v
where not exists (select 1 from seven.gallery_categories);

-- ===== v2: site themes + booking notifications =====
alter table seven.settings add column if not exists theme text not null default 'sage';
alter table seven.settings alter column theme set default 'sage';
-- per-supervisor "seen" marker for the notification bell
alter table seven.admin_users add column if not exists last_seen_bookings_at timestamptz not null default now();
-- phone/browser push subscriptions (one row per device)
create table if not exists seven.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references seven.admin_users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_admin_idx on seven.push_subscriptions (admin_id);
create index if not exists bookings_created_at_idx on seven.bookings (created_at);
