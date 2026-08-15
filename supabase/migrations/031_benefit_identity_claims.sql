-- Durable once-per-phone claims for referrals and coupons.
-- Survives profile/auth delete so the same number cannot reclaim after re-signup.
-- No FK to profiles: rows must outlive the customer account.

create table if not exists public.benefit_identity_claims (
  id uuid primary key default gen_random_uuid(),
  phone_digits text not null
    check (phone_digits ~ '^[0-9]{10}$'),
  benefit_type text not null
    check (benefit_type in ('referral', 'coupon')),
  benefit_id text not null,
  claimed_by uuid null,
  created_at timestamptz not null default now(),
  unique (phone_digits, benefit_type, benefit_id)
);

create index if not exists idx_benefit_identity_claims_type_id
  on public.benefit_identity_claims (benefit_type, benefit_id);

alter table public.benefit_identity_claims enable row level security;

revoke all on public.benefit_identity_claims from anon, authenticated;
grant all on public.benefit_identity_claims to service_role;

-- Backfill from current accounts (deleted numbers cannot be recovered).
insert into public.benefit_identity_claims (
  phone_digits,
  benefit_type,
  benefit_id,
  claimed_by
)
select
  right(regexp_replace(p.phone, '\D', '', 'g'), 10),
  'referral',
  'welcome',
  a.referee_id
from public.referral_attributions a
join public.profiles p on p.id = a.referee_id
where p.phone is not null
  and length(right(regexp_replace(p.phone, '\D', '', 'g'), 10)) = 10
on conflict (phone_digits, benefit_type, benefit_id) do nothing;

insert into public.benefit_identity_claims (
  phone_digits,
  benefit_type,
  benefit_id,
  claimed_by
)
select
  right(regexp_replace(p.phone, '\D', '', 'g'), 10),
  'coupon',
  r.coupon_id::text,
  r.customer_id
from public.coupon_redemptions r
join public.profiles p on p.id = r.customer_id
where p.phone is not null
  and length(right(regexp_replace(p.phone, '\D', '', 'g'), 10)) = 10
on conflict (phone_digits, benefit_type, benefit_id) do nothing;
