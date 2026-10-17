-- Admin communities list: per-community contact and next-step summaries for filtering.
-- security_invoker keeps the underlying tables' RLS in force for whoever queries the view.

create or replace view public.community_list_view
with (security_invoker = true)
as
select
  c.*,
  pc.name as primary_contact_name,
  pc.position as primary_contact_position,
  pc.phone as primary_contact_phone,
  coalesce(cc.contacts_count, 0)::int as contacts_count,
  coalesce(ns.open_steps_count, 0)::int as open_steps_count,
  coalesce(ns.overdue_steps_count, 0)::int as overdue_steps_count,
  nx.body as next_step_body,
  nx.due_date as next_step_due
from public.communities c
left join lateral (
  select name, position, phone
  from public.community_contacts
  where community_id = c.id and is_primary
  limit 1
) pc on true
left join lateral (
  select count(*) as contacts_count
  from public.community_contacts
  where community_id = c.id
) cc on true
left join lateral (
  -- Due dates are local (India) calendar dates, so compare against IST today.
  select
    count(*) filter (where not is_done) as open_steps_count,
    count(*) filter (
      where not is_done and due_date < (now() at time zone 'Asia/Kolkata')::date
    ) as overdue_steps_count
  from public.community_next_steps
  where community_id = c.id
) ns on true
left join lateral (
  select body, due_date
  from public.community_next_steps
  where community_id = c.id and not is_done
  order by due_date asc nulls last, created_at desc
  limit 1
) nx on true;

grant select on public.community_list_view to authenticated;
