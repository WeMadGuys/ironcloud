-- Customer-app Send OTP failures. Inserted server-side with the service role.

create table if not exists public.otp_send_failures (
  id uuid primary key default gen_random_uuid(),
  phone text not null check (phone ~ '^[0-9]{10}$'),
  message text not null check (char_length(message) between 1 and 200),
  created_at timestamptz not null default now()
);

create index if not exists idx_otp_send_failures_created
  on public.otp_send_failures (created_at desc);

create index if not exists idx_otp_send_failures_phone_created
  on public.otp_send_failures (phone, created_at desc);

comment on table public.otp_send_failures is
  'Customer-app Send OTP failures. Inserted server-side with the service role.';

alter table public.otp_send_failures enable row level security;

drop policy if exists "admin reads otp send failures" on public.otp_send_failures;
create policy "admin reads otp send failures"
  on public.otp_send_failures
  for select
  using (public.current_role() in ('ops_admin', 'super_admin'));
