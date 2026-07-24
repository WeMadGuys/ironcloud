-- ============================================================
-- Iron Cloud — Database Schema (Supabase / Postgres)
-- Companion to iron-cloud-technical-architecture.md
-- Run in Supabase SQL Editor, top to bottom.
--
-- Safe to re-run: skips objects that already exist (42710 / 42P07).
-- If you see "type user_role already exists", the base schema is
-- already applied — you can skip this file and run 003 + seed only.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'customer','rider','warehouse_staff','support_agent',
    'community_admin','ops_admin','super_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'draft','booked','pickup_assigned','pickup_in_progress','picked_up',
    'warehouse_received','sorting','ironing','quality_check','packed',
    'ready_for_delivery','delivery_assigned','out_for_delivery','delivered',
    'completed','rated','cancelled','refund_initiated','refund_completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN CREATE TYPE job_type AS ENUM ('pickup','delivery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE job_status AS ENUM ('assigned','in_progress','completed','failed','reassigned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE wallet_txn_type AS ENUM ('recharge','debit','refund','cashback','expiry');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE notification_channel AS ENUM ('push','sms','whatsapp','email','in_app');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE ticket_status AS ENUM ('open','in_progress','escalated','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE slot_type AS ENUM ('pickup','delivery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE payment_method AS ENUM ('wallet','razorpay_direct');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- IDENTITY & ACCESS
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'customer',
  full_name text,
  phone text unique,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- WAREHOUSES (define before orders/communities reference them)
-- ============================================================

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- COMMUNITY & SERVICE AREA
-- ============================================================

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  geo_boundary jsonb,              -- polygon for geofencing
  pricing_tier text default 'standard',
  status text default 'pending',   -- pending / active / suspended
  created_at timestamptz default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) not null,
  community_id uuid references public.communities(id) not null,
  tower text,
  flat_number text not null,
  is_default boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.service_slots (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities(id) not null,
  slot_type slot_type not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  capacity int not null default 50,
  booked_count int not null default 0,
  created_at timestamptz default now(),
  unique (community_id, slot_type, window_start)
);

-- ============================================================
-- RIDERS
-- ============================================================

create table if not exists public.riders (
  id uuid primary key references public.profiles(id),
  vehicle_number text,
  kyc_status text default 'pending',
  current_lat double precision,
  current_lng double precision,
  rating_avg numeric(2,1) default 5.0,
  created_at timestamptz default now()
);

-- Proper many-to-many instead of an unenforced array
create table if not exists public.rider_communities (
  rider_id uuid references public.riders(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  primary key (rider_id, community_id)
);

-- ============================================================
-- CATALOG & PRICING (Phase 2+ ready — new service lines are rows, not migrations)
-- ============================================================

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'ironing', -- ironing/laundry/dry_cleaning/shoe_cleaning/repair
  name text not null,
  unit text default 'piece',
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services(id) not null,
  community_id uuid references public.communities(id), -- null = platform default
  base_price numeric(10,2) not null,
  express_multiplier numeric(3,2) default 1.5,
  effective_from timestamptz default now(),
  effective_to timestamptz
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_type text not null, -- flat / percentage
  discount_value numeric(10,2) not null,
  max_discount numeric(10,2),
  usage_limit int,
  used_count int default 0,
  valid_from timestamptz,
  valid_to timestamptz,
  community_ids uuid[],  -- simple array; fine for a read-mostly, low-stakes many-to-many
  created_at timestamptz default now()
);

-- ============================================================
-- ORDERS (core)
-- ============================================================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,        -- e.g. IC-20260719-0001, generated by API layer
  customer_id uuid references public.profiles(id) not null,
  address_id uuid references public.addresses(id) not null,
  community_id uuid references public.communities(id) not null,
  warehouse_id uuid references public.warehouses(id),
  status order_status not null default 'draft',
  pickup_slot_id uuid references public.service_slots(id),
  delivery_slot_id uuid references public.service_slots(id),
  is_express boolean default false,
  special_instructions text,
  subtotal numeric(10,2) default 0,
  discount numeric(10,2) default 0,
  total_amount numeric(10,2) default 0,
  coupon_id uuid references public.coupons(id),
  payment_method payment_method default 'wallet',
  qr_code text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade not null,
  service_id uuid references public.services(id) not null,
  quantity int default 1,
  unit_price numeric(10,2) not null,
  before_photo_url text,
  after_photo_url text,
  issue text,                      -- damaged / stained / missing button etc
  qc_status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade not null,
  status order_status not null,
  actor_id uuid references public.profiles(id),
  metadata jsonb default '{}',
  note text,
  created_at timestamptz default now()
);
create index if not exists idx_order_events_order on public.order_events (order_id, created_at);

create table if not exists public.rider_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) not null,
  rider_id uuid references public.riders(id),
  job_type job_type not null,
  status job_status not null default 'assigned',
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  route_sequence int,
  proof_photo_url text,
  proof_signature_url text,
  failure_reason text,
  created_at timestamptz default now(),
  completed_at timestamptz
);
create index if not exists idx_rider_jobs_rider on public.rider_jobs (rider_id, status);

-- ============================================================
-- WALLET (ledger pattern — balance is derived, never edited directly)
-- ============================================================

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) unique not null,
  balance numeric(10,2) default 0 not null,
  updated_at timestamptz default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid references public.wallets(id) not null,
  type wallet_txn_type not null,
  amount numeric(10,2) not null,          -- positive = credit, negative = debit
  balance_after numeric(10,2) not null,
  order_id uuid references public.orders(id),
  razorpay_payment_id text,
  description text,
  created_at timestamptz default now()
);
create index if not exists idx_wallet_txn_wallet on public.wallet_transactions (wallet_id, created_at);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) not null,
  channel notification_channel not null,
  template_key text not null,
  payload jsonb default '{}',
  status text default 'queued',   -- queued/sent/failed/delivered
  provider_message_id text,
  error text,
  created_at timestamptz default now(),
  sent_at timestamptz
);

-- ============================================================
-- SUPPORT
-- ============================================================

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) not null,
  order_id uuid references public.orders(id),
  category text not null,
  status ticket_status default 'open',
  assigned_agent_id uuid references public.profiles(id),
  sla_due_at timestamptz,
  resolution_note text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.support_tickets(id) on delete cascade not null,
  sender_id uuid references public.profiles(id),
  message text not null,
  attachment_url text,
  created_at timestamptz default now()
);

-- ============================================================
-- RATINGS & AUDIT
-- ============================================================

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) unique not null,
  customer_id uuid references public.profiles(id) not null,
  rider_rating int check (rider_rating between 1 and 5),
  quality_rating int check (quality_rating between 1 and 5),
  feedback text,
  created_at timestamptz default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create a profile row when a Supabase Auth user is created
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, phone, role)
  values (new.id, new.phone, 'customer');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-create a wallet for every new customer profile
create or replace function public.handle_new_customer_wallet()
returns trigger as $$
begin
  if new.role = 'customer' then
    insert into public.wallets (customer_id, balance) values (new.id, 0)
    on conflict (customer_id) do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_profile_created_wallet on public.profiles;
create trigger on_profile_created_wallet
  after insert on public.profiles
  for each row execute function public.handle_new_customer_wallet();

-- Generic updated_at maintainer — attach to any table that has the column
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- Pattern: deny-by-default. Reads governed by RLS below.
-- Writes to money/state tables (orders, order_items, wallets,
-- wallet_transactions, rider_jobs) have NO client insert/update
-- policy — all writes go through the API layer with the
-- service role key, so business rules can never be bypassed
-- by a modified client.
-- ============================================================

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.rider_jobs enable row level security;
alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.audit_logs enable row level security;

-- Helper: current user's role, without a client round-trip
create or replace function public.current_role()
returns user_role as $$
  select role from public.profiles where id = auth.uid();
$$ language sql stable security definer;

-- Profiles: read/update own row only
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles
  for select using (id = auth.uid());
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using (id = auth.uid());

-- Orders: customer sees own, rider sees assigned, staff/admin see all
drop policy if exists "customer reads own orders" on public.orders;
create policy "customer reads own orders" on public.orders
  for select using (customer_id = auth.uid());
drop policy if exists "rider reads assigned orders" on public.orders;
create policy "rider reads assigned orders" on public.orders
  for select using (id in (select order_id from public.rider_jobs where rider_id = auth.uid()));
drop policy if exists "staff and admin read all orders" on public.orders;
create policy "staff and admin read all orders" on public.orders
  for select using (public.current_role() in ('warehouse_staff','support_agent','ops_admin','super_admin'));

drop policy if exists "customer reads own order items" on public.order_items;
create policy "customer reads own order items" on public.order_items
  for select using (order_id in (select id from public.orders where customer_id = auth.uid()));

drop policy if exists "customer reads own order events" on public.order_events;
create policy "customer reads own order events" on public.order_events
  for select using (order_id in (select id from public.orders where customer_id = auth.uid()));

-- Wallets: owner reads only; all writes via API + service role
drop policy if exists "own wallet read" on public.wallets;
create policy "own wallet read" on public.wallets
  for select using (customer_id = auth.uid());
drop policy if exists "own wallet transactions read" on public.wallet_transactions;
create policy "own wallet transactions read" on public.wallet_transactions
  for select using (wallet_id in (select id from public.wallets where customer_id = auth.uid()));

-- Rider jobs: rider sees only their own assignments (updates go through the API,
-- since completing a job triggers an order status transition + notification)
drop policy if exists "rider reads own jobs" on public.rider_jobs;
create policy "rider reads own jobs" on public.rider_jobs
  for select using (rider_id = auth.uid());

-- Support: customer + assigned agent only
drop policy if exists "customer reads own tickets" on public.support_tickets;
create policy "customer reads own tickets" on public.support_tickets
  for select using (customer_id = auth.uid());
drop policy if exists "agent reads assigned tickets" on public.support_tickets;
create policy "agent reads assigned tickets" on public.support_tickets
  for select using (assigned_agent_id = auth.uid() or public.current_role() in ('ops_admin','super_admin'));

-- Ticket messages: safe for direct client insert (no side effects beyond the row)
drop policy if exists "read own ticket messages" on public.ticket_messages;
create policy "read own ticket messages" on public.ticket_messages
  for select using (
    ticket_id in (select id from public.support_tickets where customer_id = auth.uid())
    or sender_id = auth.uid()
  );
drop policy if exists "send own ticket message" on public.ticket_messages;
create policy "send own ticket message" on public.ticket_messages
  for insert with check (
    sender_id = auth.uid()
    and ticket_id in (select id from public.support_tickets where customer_id = auth.uid())
  );

-- Audit logs: admin-read only, never client-writable
drop policy if exists "admin reads audit logs" on public.audit_logs;
create policy "admin reads audit logs" on public.audit_logs
  for select using (public.current_role() in ('ops_admin','super_admin'));
