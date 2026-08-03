import { createBoxService, type BoxScanMode, type TypedSupabaseClient } from '@ironcloud/db';

import { supabase } from '../../../lib/supabase';
import { getRiderId } from './job-utils';

const boxes = () => createBoxService(supabase as unknown as TypedSupabaseClient);

export async function resolveBoxScan(
  boxCode: string,
  options: { orderId: string; mode: BoxScanMode },
) {
  return boxes().resolveBoxScan(boxCode, options);
}

export async function attachBoxToOrder(orderId: string, boxCode: string) {
  const riderId = await getRiderId();
  if (!riderId) throw new Error('Rider not authenticated');
  return boxes().attachBox(orderId, boxCode, riderId);
}

export async function releaseBoxFromOrder(orderId: string, boxCode: string) {
  const riderId = await getRiderId();
  if (!riderId) throw new Error('Rider not authenticated');
  return boxes().releaseBox(orderId, boxCode, riderId);
}

export async function getOrderBoxes(orderId: string, activeOnly = true) {
  return boxes().getOrderBoxes(orderId, activeOnly);
}

export async function countActiveOrderBoxes(orderId: string) {
  return boxes().countActiveOrderBoxes(orderId);
}
