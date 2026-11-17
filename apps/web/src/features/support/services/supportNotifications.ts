import { getSupabase } from '@/lib/supabase';

/** Clear unread bell items for one ticket for the signed-in admin. */
export async function markSupportTicketNotificationsRead(ticketId: string): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('admin_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', user.id)
    .eq('entity_type', 'support_ticket')
    .eq('entity_id', ticketId)
    .is('read_at', null);

  if (error) {
    console.warn('[support notifications] mark read', error.message);
  }
}
