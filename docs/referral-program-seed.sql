-- Optional seed / override for Refer & Earn default program.
-- Migration 015 already inserts a program named "Refer & Earn" if missing.
-- Use this to reset amounts without recreating rows.

update public.referral_programs
set
  is_active = true,
  referrer_reward_amount = 100,
  referee_reward_amount = 50,
  min_referee_topup_amount = 299,
  valid_from = coalesce(valid_from, now()),
  valid_to = null,
  community_ids = null,
  cities = null,
  max_referrals_per_referrer = null,
  share_message_template =
    'Join IronCloud with my code {{code}} and get ₹{{referee_reward}} after your first wallet recharge of ₹{{min_topup}}+!',
  updated_at = now()
where name = 'Refer & Earn';

-- If somehow missing:
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
