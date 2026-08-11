-- Expo push tokens + campaign send tracking for scheduled push campaigns.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  platform text,
  promotions_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_tokens_token_unique unique (expo_push_token)
);

create index if not exists idx_push_tokens_user on public.push_tokens (user_id);
create index if not exists idx_push_tokens_promotions
  on public.push_tokens (promotions_enabled)
  where promotions_enabled = true;

comment on table public.push_tokens is
  'Expo push tokens registered by customer devices for remote notifications.';

alter table public.campaigns
  add column if not exists sent_count int not null default 0;

alter table public.campaigns
  add column if not exists sent_at timestamptz;

comment on column public.campaigns.sent_count is
  'Number of Expo push receipts accepted for the last send.';
comment on column public.campaigns.sent_at is
  'When the campaign was last sent (completed).';

-- Target shape (jsonb): { community_ids?: uuid[], cities?: string[], user_ids?: uuid[] }
-- Payload shape (jsonb): { title: string, body: string, path?: string }

alter table public.push_tokens enable row level security;

drop policy if exists "users manage own push tokens" on public.push_tokens;
create policy "users manage own push tokens"
  on public.push_tokens
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "admin reads push tokens" on public.push_tokens;
create policy "admin reads push tokens"
  on public.push_tokens
  for select
  using (public.current_role() in ('ops_admin', 'super_admin'));
