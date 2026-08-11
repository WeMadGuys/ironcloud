-- Recurring campaign schedule config (once / daily / weekly).
-- scheduled_at remains the next fire time (UTC).

alter table public.campaigns
  add column if not exists schedule jsonb;

comment on column public.campaigns.schedule is
  'Push schedule: { frequency: once|daily|weekly, time: HH:mm, days?: number[] (0=Sun..6=Sat), timezone?: string, once_date?: YYYY-MM-DD }';
