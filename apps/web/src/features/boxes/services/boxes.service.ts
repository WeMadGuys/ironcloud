import { getSupabase } from '@/lib/supabase';
import { createBoxService, type BoxStatus, type TypedSupabaseClient } from '@ironcloud/db';

export type BoxListRow = {
  id: string;
  boxCode: string;
  qrCode: string;
  communityId: string;
  communityName: string | null;
  status: BoxStatus;
  currentOrderId: string | null;
  currentOrderNumber: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const fetchBoxes = async (params: {
  page?: number;
  pageSize?: number;
  search?: string;
  communityId?: string;
  status?: BoxStatus | 'ALL';
  includeInactive?: boolean;
}) => {
  const boxes = createBoxService(getSupabase() as unknown as TypedSupabaseClient);
  return boxes.listBoxes({
    page: params.page,
    pageSize: params.pageSize,
    search: params.search,
    communityId: params.communityId,
    status: params.status,
    activeOnly: !params.includeInactive,
  });
};
