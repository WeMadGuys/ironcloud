-- ============================================================
-- Admin portal: Google login email allowlist
-- Only emails in this table may access apps/web as admins.
-- ============================================================

create table if not exists public.admin_allowed_emails (
  email text primary key,
  role user_role not null default 'ops_admin',
  created_at timestamptz default now(),
  constraint admin_allowed_emails_role_check
    check (role in ('ops_admin', 'super_admin'))
);

-- Normalize to lowercase on write
create or replace function public.admin_allowed_emails_normalize()
returns trigger as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$ language plpgsql;

drop trigger if exists admin_allowed_emails_normalize_trg on public.admin_allowed_emails;
create trigger admin_allowed_emails_normalize_trg
  before insert or update of email on public.admin_allowed_emails
  for each row execute function public.admin_allowed_emails_normalize();

alter table public.admin_allowed_emails enable row level security;

-- No client policies: reads/writes use service role only (API / auth callback).

comment on table public.admin_allowed_emails is
  'Gmail addresses permitted to sign into the admin web app via Google OAuth.';

-- Replace with your real admin Gmail before first login.
insert into public.admin_allowed_emails (email, role)
values ('your.admin@gmail.com', 'ops_admin')
on conflict (email) do nothing;
