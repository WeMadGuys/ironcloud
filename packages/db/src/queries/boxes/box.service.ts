import type { TypedSupabaseClient } from '../../client';
import type { BoxStatus, Json } from '../../types';

export type BoxScanMode = 'lookup' | 'pickup' | 'delivery';

export type BoxScanResult = {
  ok: boolean;
  error: string | null;
  action: 'attach' | 'release' | 'none';
  canAct: boolean;
  linkedToOrder: boolean;
  box: {
    id: string;
    boxCode: string;
    status: BoxStatus;
    isActive: boolean;
    communityId: string;
    communityName: string | null;
    currentOrderId: string | null;
    lastUsedAt: string | null;
  } | null;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    communityId: string;
    customerName: string | null;
    customerPhone: string | null;
    tower: string | null;
    flatNumber: string | null;
  } | null;
};

export type BoxListFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  communityId?: string;
  status?: BoxStatus | 'ALL';
  activeOnly?: boolean;
};

export type OrderBoxRow = {
  id: string;
  boxId: string;
  boxCode: string;
  status: BoxStatus;
  assignedAt: string;
  releasedAt: string | null;
};

function asScanResult(raw: Json | null): BoxScanResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      error: 'Invalid scan response',
      action: 'none',
      canAct: false,
      linkedToOrder: false,
      box: null,
      order: null,
    };
  }

  const data = raw as Record<string, unknown>;
  const box = data.box as Record<string, unknown> | null | undefined;
  const order = data.order as Record<string, unknown> | null | undefined;
  const actionRaw = data.action;
  const action =
    actionRaw === 'attach' || actionRaw === 'release' ? actionRaw : 'none';

  return {
    ok: Boolean(data.ok),
    error: typeof data.error === 'string' ? data.error : data.error == null ? null : String(data.error),
    action,
    canAct: Boolean(data.canAct),
    linkedToOrder: Boolean(data.linkedToOrder),
    box: box
      ? {
          id: String(box.id),
          boxCode: String(box.boxCode),
          status: box.status as BoxStatus,
          isActive: Boolean(box.isActive),
          communityId: String(box.communityId),
          communityName: (box.communityName as string | null) ?? null,
          currentOrderId: (box.currentOrderId as string | null) ?? null,
          lastUsedAt: (box.lastUsedAt as string | null) ?? null,
        }
      : null,
    order: order
      ? {
          id: String(order.id),
          orderNumber: String(order.orderNumber),
          status: String(order.status),
          communityId: String(order.communityId),
          customerName: (order.customerName as string | null) ?? null,
          customerPhone: (order.customerPhone as string | null) ?? null,
          tower: (order.tower as string | null) ?? null,
          flatNumber: (order.flatNumber as string | null) ?? null,
        }
      : null,
  };
}

export function createBoxService(supabase: TypedSupabaseClient) {
  return {
    async resolveBoxScan(
      boxCode: string,
      options?: { orderId?: string | null; mode?: BoxScanMode },
    ): Promise<BoxScanResult> {
      const { data, error } = await supabase.rpc('resolve_box_scan', {
        p_box_code: boxCode.trim(),
        p_order_id: options?.orderId ?? null,
        p_mode: options?.mode ?? 'lookup',
      });

      if (error) {
        return {
          ok: false,
          error: error.message,
          action: 'none',
          canAct: false,
          linkedToOrder: false,
          box: null,
          order: null,
        };
      }

      return asScanResult(data as Json);
    },

    async attachBox(orderId: string, boxCode: string, riderId: string) {
      const { data, error } = await supabase.rpc('attach_box_to_order', {
        p_order_id: orderId,
        p_box_code: boxCode.trim(),
        p_rider_id: riderId,
      });
      if (error) throw new Error(error.message);
      return data as { ok: boolean; boxId: string; boxCode: string; alreadyAttached?: boolean };
    },

    async releaseBox(orderId: string, boxCode: string, riderId: string) {
      const { data, error } = await supabase.rpc('release_box_from_order', {
        p_order_id: orderId,
        p_box_code: boxCode.trim(),
        p_rider_id: riderId,
      });
      if (error) throw new Error(error.message);
      return data as { ok: boolean; boxId: string; boxCode: string };
    },

    async countActiveOrderBoxes(orderId: string): Promise<number> {
      const { data, error } = await supabase.rpc('count_active_order_boxes', {
        p_order_id: orderId,
      });
      if (error) throw new Error(error.message);
      return Number(data ?? 0);
    },

    async getOrderBoxes(orderId: string, activeOnly = true): Promise<OrderBoxRow[]> {
      let query = supabase
        .from('order_boxes')
        .select('id, box_id, assigned_at, released_at, box:box_id (box_code, status)')
        .eq('order_id', orderId)
        .order('assigned_at', { ascending: true });

      if (activeOnly) {
        query = query.is('released_at', null);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return ((data as unknown as {
        id: string;
        box_id: string;
        assigned_at: string;
        released_at: string | null;
        box: { box_code: string; status: BoxStatus } | null;
      }[]) ?? []).map((row) => ({
        id: row.id,
        boxId: row.box_id,
        boxCode: row.box?.box_code ?? '',
        status: row.box?.status ?? 'AVAILABLE',
        assignedAt: row.assigned_at,
        releasedAt: row.released_at,
      }));
    },

    async getAvailableBoxes(communityId: string) {
      const { data, error } = await supabase
        .from('boxes')
        .select('id, box_code, status, community_id, last_used_at')
        .eq('community_id', communityId)
        .eq('status', 'AVAILABLE')
        .eq('is_active', true)
        .order('box_code', { ascending: true });

      if (error) throw new Error(error.message);
      return data ?? [];
    },

    async listBoxes(filters: BoxListFilters = {}) {
      const page = filters.page ?? 1;
      const pageSize = filters.pageSize ?? 25;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('boxes')
        .select(
          'id, box_code, qr_code, community_id, status, current_order_id, is_active, last_used_at, created_at, updated_at, community:community_id (name), order:current_order_id (order_number)',
          { count: 'exact' },
        );

      if (filters.search?.trim()) {
        query = query.ilike('box_code', `%${filters.search.trim()}%`);
      }
      if (filters.communityId) {
        query = query.eq('community_id', filters.communityId);
      }
      if (filters.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }
      if (filters.activeOnly !== false) {
        query = query.eq('is_active', true);
      }

      const { data, count, error } = await query
        .order('box_code', { ascending: true })
        .range(from, to);

      if (error) throw new Error(error.message);

      return {
        data: (data ?? []).map((row) => {
          const r = row as unknown as {
            id: string;
            box_code: string;
            qr_code: string;
            community_id: string;
            status: BoxStatus;
            current_order_id: string | null;
            is_active: boolean;
            last_used_at: string | null;
            created_at: string;
            updated_at: string;
            community: { name: string } | null;
            order: { order_number: string } | null;
          };
          return {
            id: r.id,
            boxCode: r.box_code,
            qrCode: r.qr_code,
            communityId: r.community_id,
            communityName: r.community?.name ?? null,
            status: r.status,
            currentOrderId: r.current_order_id,
            currentOrderNumber: r.order?.order_number ?? null,
            isActive: r.is_active,
            lastUsedAt: r.last_used_at,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          };
        }),
        total: count ?? 0,
      };
    },

    async createBox(input: { boxCode: string; communityId: string }) {
      const code = input.boxCode.trim().toUpperCase();
      if (!code) throw new Error('Box code is required');

      const { data, error } = await supabase
        .from('boxes')
        .insert({
          box_code: code,
          qr_code: code,
          community_id: input.communityId,
          status: 'AVAILABLE',
          is_active: true,
        })
        .select('id, box_code')
        .single();

      if (error) throw new Error(error.message);
      return data;
    },

    async updateBox(input: {
      id: string;
      boxCode?: string;
      communityId?: string;
      isActive?: boolean;
    }) {
      const updates: {
        box_code?: string;
        qr_code?: string;
        community_id?: string;
        is_active?: boolean;
      } = {};

      if (input.boxCode !== undefined) {
        const code = input.boxCode.trim().toUpperCase();
        updates.box_code = code;
        updates.qr_code = code;
      }
      if (input.communityId !== undefined) updates.community_id = input.communityId;
      if (input.isActive !== undefined) updates.is_active = input.isActive;

      const { error } = await supabase.from('boxes').update(updates).eq('id', input.id);
      if (error) throw new Error(error.message);
    },

    async deactivateBox(id: string) {
      const { data: box, error: readError } = await supabase
        .from('boxes')
        .select('status')
        .eq('id', id)
        .single();

      if (readError) throw new Error(readError.message);
      if ((box as { status: BoxStatus } | null)?.status === 'OCCUPIED') {
        throw new Error('Cannot deactivate an occupied box. Release it first.');
      }

      const { error } = await supabase
        .from('boxes')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw new Error(error.message);
    },
  };
}

export type BoxService = ReturnType<typeof createBoxService>;
