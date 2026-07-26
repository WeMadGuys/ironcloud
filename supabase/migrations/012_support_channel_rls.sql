-- Customer can create their own support tickets (open only).
drop policy if exists "customer creates own tickets" on public.support_tickets;
create policy "customer creates own tickets" on public.support_tickets
  for insert with check (
    customer_id = auth.uid()
    and status = 'open'
  );

-- Admins can read all ticket messages (needed for Customer Support inbox).
drop policy if exists "admin reads ticket messages" on public.ticket_messages;
create policy "admin reads ticket messages" on public.ticket_messages
  for select using (
    public.current_role() in ('ops_admin', 'super_admin')
  );
