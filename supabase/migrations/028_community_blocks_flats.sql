-- Optional per-community block/flat catalog for customer address pickers.

alter table public.communities
  add column if not exists blocks_enabled boolean not null default false;

comment on column public.communities.blocks_enabled is
  'When true, customers pick Block then Flat from community_blocks/community_flats; when false, free-text tower/flat.';

create table if not exists public.community_blocks (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint community_blocks_name_nonempty check (length(trim(name)) > 0)
);

create unique index if not exists community_blocks_community_name_uidx
  on public.community_blocks (community_id, lower(trim(name)));

create index if not exists community_blocks_community_idx
  on public.community_blocks (community_id, sort_order, name);

comment on table public.community_blocks is
  'Named blocks/towers for a community when blocks_enabled is true.';

create table if not exists public.community_flats (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.community_blocks(id) on delete cascade,
  flat_number text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint community_flats_number_nonempty check (length(trim(flat_number)) > 0)
);

create unique index if not exists community_flats_block_number_uidx
  on public.community_flats (block_id, lower(trim(flat_number)));

create index if not exists community_flats_block_idx
  on public.community_flats (block_id, sort_order, flat_number);

comment on table public.community_flats is
  'Flat numbers belonging to a community block.';

alter table public.community_blocks enable row level security;
alter table public.community_flats enable row level security;

-- Customers: active blocks for active communities
drop policy if exists "authenticated reads active community blocks"
  on public.community_blocks;
create policy "authenticated reads active community blocks"
  on public.community_blocks
  for select
  to authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.communities c
      where c.id = community_id
        and c.status = 'active'
    )
  );

-- Customers: active flats under active blocks of active communities
drop policy if exists "authenticated reads active community flats"
  on public.community_flats;
create policy "authenticated reads active community flats"
  on public.community_flats
  for select
  to authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.community_blocks b
      join public.communities c on c.id = b.community_id
      where b.id = block_id
        and b.is_active = true
        and c.status = 'active'
    )
  );

-- Admins: read all (writes go through service-role tRPC)
drop policy if exists "admin reads community blocks"
  on public.community_blocks;
create policy "admin reads community blocks"
  on public.community_blocks
  for select
  using (public.current_role() in ('ops_admin', 'super_admin', 'community_admin'));

drop policy if exists "admin reads community flats"
  on public.community_flats;
create policy "admin reads community flats"
  on public.community_flats
  for select
  using (public.current_role() in ('ops_admin', 'super_admin', 'community_admin'));
