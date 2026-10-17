-- Community CRM: lead-to-active pipeline, contacts, next steps, structured address.

alter table public.communities
  add column if not exists stage text not null default 'lead',
  add column if not exists stage_updated_at timestamptz not null default now(),
  add column if not exists address_line text,
  add column if not exists locality text,
  add column if not exists pincode text,
  add column if not exists state text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

update public.communities
set stage = case status
  when 'active' then 'active'
  when 'suspended' then 'paused'
  else 'lead'
end;

alter table public.communities
  drop constraint if exists communities_stage_check;
alter table public.communities
  add constraint communities_stage_check check (stage in (
    'lead', 'contacted', 'meeting_scheduled', 'approved',
    'onboarding', 'active', 'paused', 'lost'
  ));

alter table public.communities
  drop constraint if exists communities_pincode_check;
alter table public.communities
  add constraint communities_pincode_check check (pincode is null or pincode ~ '^[0-9]{6}$');

alter table public.communities
  drop constraint if exists communities_coordinates_check;
alter table public.communities
  add constraint communities_coordinates_check check (
    (latitude is null or latitude between -90 and 90)
    and (longitude is null or longitude between -180 and 180)
  );

create index if not exists communities_pincode_idx on public.communities (pincode);
create index if not exists communities_stage_idx on public.communities (stage);

comment on column public.communities.stage is
  'CRM pipeline stage. Drives status: active -> active, paused/lost -> suspended, otherwise pending.';

-- Customer visibility still keys off status, so keep it derived from stage.
create or replace function public.communities_sync_status_from_stage()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.status := case
      when new.stage = 'active' then 'active'
      when new.stage in ('paused', 'lost') then 'suspended'
      else 'pending'
    end;
    new.stage_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists communities_sync_status_from_stage on public.communities;
create trigger communities_sync_status_from_stage
  before insert or update on public.communities
  for each row execute function public.communities_sync_status_from_stage();

create table if not exists public.community_stage_history (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  note text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists community_stage_history_community_idx
  on public.community_stage_history (community_id, created_at desc);

create table if not exists public.community_contacts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  position text,
  phone text,
  email text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint community_contacts_name_nonempty check (length(trim(name)) > 0)
);

create index if not exists community_contacts_community_idx
  on public.community_contacts (community_id, created_at);

create unique index if not exists community_contacts_one_primary_uidx
  on public.community_contacts (community_id) where is_primary;

create table if not exists public.community_next_steps (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  body text not null,
  due_date date,
  is_done boolean not null default false,
  done_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint community_next_steps_body_nonempty check (length(trim(body)) > 0)
);

create index if not exists community_next_steps_community_idx
  on public.community_next_steps (community_id, is_done, due_date);

alter table public.community_stage_history enable row level security;
alter table public.community_contacts enable row level security;
alter table public.community_next_steps enable row level security;

-- Admins: read all (writes go through service-role tRPC)
drop policy if exists "admin reads community stage history"
  on public.community_stage_history;
create policy "admin reads community stage history"
  on public.community_stage_history
  for select
  using (public.current_role() in ('ops_admin', 'super_admin', 'community_admin'));

drop policy if exists "admin reads community contacts"
  on public.community_contacts;
create policy "admin reads community contacts"
  on public.community_contacts
  for select
  using (public.current_role() in ('ops_admin', 'super_admin', 'community_admin'));

drop policy if exists "admin reads community next steps"
  on public.community_next_steps;
create policy "admin reads community next steps"
  on public.community_next_steps
  for select
  using (public.current_role() in ('ops_admin', 'super_admin', 'community_admin'));

-- Seed history so existing communities show their starting stage.
insert into public.community_stage_history (community_id, from_stage, to_stage, note, created_at)
select c.id, null, c.stage, 'Initial stage', c.created_at
from public.communities c
where not exists (
  select 1 from public.community_stage_history h where h.community_id = c.id
);
