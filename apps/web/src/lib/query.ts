import type { Database } from '@ironcloud/db';

import { getSupabase } from './supabase';

type PublicTable = keyof Database['public']['Tables'];

/** Typed table accessor for hand-maintained Database types with join selects */
export const fromTable = <T extends PublicTable>(table: T) =>
  getSupabase().from(table);

export const castRows = <T>(data: unknown): T[] => (Array.isArray(data) ? data : []) as T[];
