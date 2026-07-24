import type { TypedSupabaseClient } from '@ironcloud/db';

type AuditParams = {
  supabase: TypedSupabaseClient;
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

export const writeAuditLog = async ({
  supabase,
  actorId,
  action,
  entityType,
  entityId,
  before,
  after,
}: AuditParams): Promise<void> => {
  await supabase.from('audit_logs').insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    before: before ?? null,
    after: after ?? null,
  });
};

export const createAdminNotification = async (
  supabase: TypedSupabaseClient,
  params: {
    recipientId: string;
    type: string;
    title: string;
    body?: string;
    entityType?: string;
    entityId?: string;
  },
): Promise<void> => {
  await supabase.from('admin_notifications').insert({
    recipient_id: params.recipientId,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
  });
};
