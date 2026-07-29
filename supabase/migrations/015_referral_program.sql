-- Refer & Earn: configurable programs + attributions
-- Legacy public.referrals table remains for historical/admin seed data.

alter table public.profiles
  add column if not exists referral_code text;

create unique index if not exists profiles_referral_code_uidx
  on public.profiles (referral_code)
  where referral_code is not null;

create table if not exists public.referral_programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  referrer_reward_amount numeric(10,2) not null default 0,
  referee_reward_amount numeric(10,2) not null default 0,
  min_referee_topup_amount numeric(10,2) not null default 0,
  valid_from timestamptz,
  valid_to timestamptz,
  community_ids uuid[],
  cities text[],
  max_referrals_per_referrer int,
  share_message_template text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists set_referral_programs_updated_at on public.referral_programs;
create trigger set_referral_programs_updated_at
  before update on public.referral_programs
  for each row execute function public.set_updated_at();

create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.referral_programs(id),
  referrer_id uuid not null references public.profiles(id),
  referee_id uuid not null references public.profiles(id),
  referral_code text not null,
  status text not null default 'pending'
    check (status in ('pending', 'rewarded', 'expired', 'cancelled')),
  qualifying_topup_amount numeric(10,2),
  referrer_wallet_txn_id uuid references public.wallet_transactions(id),
  referee_wallet_txn_id uuid references public.wallet_transactions(id),
  rewarded_at timestamptz,
  created_at timestamptz default now(),
  unique (referee_id)
);

create index if not exists idx_referral_attributions_referrer
  on public.referral_attributions (referrer_id, created_at desc);

create index if not exists idx_referral_attributions_status
  on public.referral_attributions (status);

alter table public.referral_programs enable row level security;
alter table public.referral_attributions enable row level security;

-- Customers can read active programs (eligibility refined in API).
drop policy if exists "customer reads active referral programs" on public.referral_programs;
create policy "customer reads active referral programs"
  on public.referral_programs
  for select
  using (
    public.current_role() = 'customer'
    and is_active = true
    and (valid_from is null or valid_from <= now())
    and (valid_to is null or valid_to >= now())
  );

drop policy if exists "admin reads referral programs" on public.referral_programs;
create policy "admin reads referral programs"
  on public.referral_programs
  for select
  using (public.current_role() in ('ops_admin', 'super_admin'));

drop policy if exists "admin writes referral programs" on public.referral_programs;
create policy "admin writes referral programs"
  on public.referral_programs
  for all
  using (public.current_role() in ('ops_admin', 'super_admin'))
  with check (public.current_role() in ('ops_admin', 'super_admin'));

-- Customers read attributions where they are referrer or referee.
drop policy if exists "customer reads own referral attributions" on public.referral_attributions;
create policy "customer reads own referral attributions"
  on public.referral_attributions
  for select
  using (
    referrer_id = auth.uid()
    or referee_id = auth.uid()
  );

drop policy if exists "admin reads referral attributions" on public.referral_attributions;
create policy "admin reads referral attributions"
  on public.referral_attributions
  for select
  using (public.current_role() in ('ops_admin', 'super_admin'));

-- Seed a default active program (idempotent by name for first install).
insert into public.referral_programs (
  name,
  is_active,
  referrer_reward_amount,
  referee_reward_amount,
  min_referee_topup_amount,
  valid_from,
  share_message_template
)
select
  'Refer & Earn',
  true,
  100,
  50,
  299,
  now(),
  'Join IronCloud with my code {{code}} and get ₹{{referee_reward}} after your first wallet recharge of ₹{{min_topup}}+!'
where not exists (
  select 1 from public.referral_programs where name = 'Refer & Earn'
);
