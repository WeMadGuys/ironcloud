-- ============================================================
-- Iron Cloud — Admin Portal Schema Extensions
-- Partners, Finance, Promotions, Subscriptions, Settings
-- ============================================================

-- Partners
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  city text,
  kyc_status text default 'pending',
  verification_status text default 'pending',
  working_hours jsonb default '{}',
  capacity int default 50,
  rating_avg numeric(2,1) default 5.0,
  settlement_cycle text default 'weekly',
  bank_details jsonb default '{}',
  documents jsonb default '[]',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.partner_communities (
  partner_id uuid references public.partners(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  primary key (partner_id, community_id)
);

create table public.partner_orders (
  partner_id uuid references public.partners(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  assigned_at timestamptz default now(),
  primary key (partner_id, order_id)
);

-- Order extensions
alter table public.orders add column if not exists partner_id uuid references public.partners(id);
alter table public.orders add column if not exists admin_notes text;

-- Finance
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partners(id),
  rider_id uuid references public.riders(id),
  period_start timestamptz not null,
  period_end timestamptz not null,
  amount numeric(10,2) not null,
  status text default 'pending',
  paid_at timestamptz,
  created_at timestamptz default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id),
  invoice_number text unique not null,
  subtotal numeric(10,2) not null,
  gst_amount numeric(10,2) default 0,
  total numeric(10,2) not null,
  pdf_url text,
  issued_at timestamptz default now()
);

-- Promotions
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  channel notification_channel not null,
  target jsonb default '{}',
  payload jsonb default '{}',
  status text default 'draft',
  scheduled_at timestamptz,
  created_at timestamptz default now()
);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text,
  link text,
  community_ids uuid[],
  position text default 'home',
  active_from timestamptz,
  active_to timestamptz,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references public.profiles(id) not null,
  referee_id uuid references public.profiles(id),
  code text unique not null,
  reward_amount numeric(10,2) default 0,
  status text default 'pending',
  created_at timestamptz default now()
);

-- Subscriptions
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) not null,
  plan_name text not null,
  amount numeric(10,2) not null,
  billing_cycle text default 'monthly',
  status text default 'active',
  next_billing_at timestamptz,
  created_at timestamptz default now()
);

-- Settings & Permissions
create table public.system_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz default now()
);

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role user_role not null,
  resource text not null,
  action text not null,
  unique (role, resource, action)
);

create table public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) not null,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz default now()
);

create index idx_admin_notifications_recipient on public.admin_notifications (recipient_id, created_at desc);
create index idx_partner_orders_partner on public.partner_orders (partner_id);
create index idx_settlements_status on public.settlements (status);
create index idx_subscriptions_customer on public.subscriptions (customer_id);

-- Triggers
create trigger set_partners_updated_at
  before update on public.partners
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS — Admin read policies
-- ============================================================

alter table public.partners enable row level security;
alter table public.partner_communities enable row level security;
alter table public.partner_orders enable row level security;
alter table public.settlements enable row level security;
alter table public.invoices enable row level security;
alter table public.campaigns enable row level security;
alter table public.banners enable row level security;
alter table public.referrals enable row level security;
alter table public.subscriptions enable row level security;
alter table public.system_settings enable row level security;
alter table public.role_permissions enable row level security;
alter table public.admin_notifications enable row level security;

-- Admin read on existing tables
alter table public.communities enable row level security;
alter table public.addresses enable row level security;
alter table public.riders enable row level security;
alter table public.rider_communities enable row level security;
alter table public.notifications enable row level security;
alter table public.ratings enable row level security;
alter table public.coupons enable row level security;
alter table public.services enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.warehouses enable row level security;

create policy "admin reads communities" on public.communities
  for select using (public.current_role() in ('ops_admin','super_admin','community_admin'));

create policy "admin reads addresses" on public.addresses
  for select using (public.current_role() in ('ops_admin','super_admin','community_admin'));

create policy "admin reads riders" on public.riders
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads rider communities" on public.rider_communities
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads notifications" on public.notifications
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads ratings" on public.ratings
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads coupons" on public.coupons
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads services" on public.services
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads pricing rules" on public.pricing_rules
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads warehouses" on public.warehouses
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads all profiles" on public.profiles
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads all wallets" on public.wallets
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads all wallet txns" on public.wallet_transactions
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads order events" on public.order_events
  for select using (public.current_role() in ('ops_admin','super_admin','support_agent'));

create policy "admin reads rider jobs" on public.rider_jobs
  for select using (public.current_role() in ('ops_admin','super_admin'));

-- New table policies
create policy "admin reads partners" on public.partners
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads partner communities" on public.partner_communities
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads partner orders" on public.partner_orders
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads settlements" on public.settlements
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads invoices" on public.invoices
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads campaigns" on public.campaigns
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads banners" on public.banners
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads referrals" on public.referrals
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads subscriptions" on public.subscriptions
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads system settings" on public.system_settings
  for select using (public.current_role() in ('ops_admin','super_admin'));

create policy "admin reads role permissions" on public.role_permissions
  for select using (public.current_role() in ('super_admin'));

create policy "admin reads own notifications" on public.admin_notifications
  for select using (recipient_id = auth.uid() or public.current_role() in ('ops_admin','super_admin'));

create policy "admin updates own notifications" on public.admin_notifications
  for update using (recipient_id = auth.uid());

-- Realtime publication
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.rider_jobs;
alter publication supabase_realtime add table public.admin_notifications;
alter publication supabase_realtime add table public.riders;
