-- Minimum store version for the customer app.
-- Raise min_version when an older install must update before it can be used.
-- Current 1.0.0 installs stay allowed until this value is set higher.

create table if not exists public.app_version_policy (
  platform text primary key check (platform in ('ios', 'android')),
  min_version text not null,
  store_url text not null,
  title text not null default 'Update required',
  message text not null,
  updated_at timestamptz not null default now()
);

comment on table public.app_version_policy is
  'Store-version gate for the customer app. Clients may only read it.';

insert into public.app_version_policy (platform, min_version, store_url, message)
values
  (
    'android',
    '1.0.0',
    'https://play.google.com/store/apps/details?id=com.ironcloud.app',
    'A new version of IronCloud is ready. Update the app to continue.'
  ),
  (
    'ios',
    '1.0.0',
    'https://apps.apple.com/search?term=IronCloud',
    'A new version of IronCloud is ready. Update the app to continue.'
  )
on conflict (platform) do nothing;

alter table public.app_version_policy enable row level security;

drop policy if exists "anyone reads app version policy" on public.app_version_policy;
create policy "anyone reads app version policy"
  on public.app_version_policy
  for select
  to anon, authenticated
  using (true);

grant select on public.app_version_policy to anon, authenticated;
