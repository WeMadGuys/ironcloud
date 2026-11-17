-- Notify every admin when a customer opens a ticket or sends a later message
-- on an open ticket. Admin replies and the ticket's first message do not notify.

create or replace function public.notify_admins_of_new_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer text;
begin
  select coalesce(nullif(btrim(full_name), ''), 'A customer')
    into v_customer
  from public.profiles
  where id = new.customer_id;

  insert into public.admin_notifications (
    recipient_id, type, title, body, entity_type, entity_id
  )
  select
    p.id,
    'support_ticket',
    'New support ticket',
    v_customer || ' opened a ' || regexp_replace(new.category, '_', ' ', 'g') || ' request',
    'support_ticket',
    new.id
  from public.profiles p
  where p.role in ('ops_admin', 'super_admin');

  return new;
end;
$$;

create or replace function public.notify_admins_of_support_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.support_tickets%rowtype;
  v_customer text;
  v_message_count integer;
begin
  select * into v_ticket
  from public.support_tickets
  where id = new.ticket_id;

  if not found then
    return new;
  end if;

  if v_ticket.status not in ('open', 'in_progress', 'escalated') then
    return new;
  end if;

  -- Admin replies should not ping the bell.
  if new.sender_id is distinct from v_ticket.customer_id then
    return new;
  end if;

  -- The opening message is covered by the new-ticket notification.
  select count(*) into v_message_count
  from public.ticket_messages
  where ticket_id = new.ticket_id;

  if v_message_count <= 1 then
    return new;
  end if;

  select coalesce(nullif(btrim(full_name), ''), 'A customer')
    into v_customer
  from public.profiles
  where id = v_ticket.customer_id;

  insert into public.admin_notifications (
    recipient_id, type, title, body, entity_type, entity_id
  )
  select
    p.id,
    'support_message',
    'New support message',
    v_customer || ': ' || left(new.message, 120),
    'support_ticket',
    v_ticket.id
  from public.profiles p
  where p.role in ('ops_admin', 'super_admin');

  return new;
end;
$$;

drop trigger if exists support_ticket_admin_notify on public.support_tickets;
create trigger support_ticket_admin_notify
  after insert on public.support_tickets
  for each row execute function public.notify_admins_of_new_support_ticket();

drop trigger if exists support_message_admin_notify on public.ticket_messages;
create trigger support_message_admin_notify
  after insert on public.ticket_messages
  for each row execute function public.notify_admins_of_support_message();
