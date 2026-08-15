export const MAX_PIECE_QUANTITY = 50;
export const MAX_KG_QUANTITY = 20;

export function isWeightService(opts: {
  unit?: string | null;
  name?: string | null;
}): boolean {
  const unit = (opts.unit ?? '').trim().toLowerCase();
  if (unit === 'kg' || unit === 'kilogram' || unit === 'kilograms') return true;
  const name = (opts.name ?? '').toLowerCase();
  return name.includes('wash') && name.includes('fold');
}

export function maxQuantityForService(opts: {
  unit?: string | null;
  name?: string | null;
}): number {
  return isWeightService(opts) ? MAX_KG_QUANTITY : MAX_PIECE_QUANTITY;
}

export function clampServiceQuantity(
  quantity: number,
  opts: { unit?: string | null; name?: string | null },
): number {
  const max = maxQuantityForService(opts);
  if (!Number.isFinite(quantity)) return 0;
  return Math.min(max, Math.max(0, Math.floor(quantity)));
}

export function serviceQuantityError(
  item: { name?: string | null; unit?: string | null; quantity: number },
): string | null {
  const max = maxQuantityForService(item);
  if (item.quantity <= max) return null;
  const label = item.name?.trim() || 'This item';
  return isWeightService(item)
    ? `${label} cannot exceed ${max} kg`
    : `${label} cannot exceed ${max}`;
}

export function assertServiceQuantities(
  items: { name?: string | null; unit?: string | null; quantity: number }[],
): void {
  for (const item of items) {
    const error = serviceQuantityError(item);
    if (error) throw new Error(error);
  }
}
