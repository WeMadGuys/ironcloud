import {
  listGarmentCategoryTabs,
  listServiceLineChoices,
  normalizeGarmentCategory,
  normalizeServiceLine,
  serviceLineLabel,
} from '@ironcloud/db';

export type ShareGarmentLine = {
  name: string;
  quantity: number;
  serviceLine: string;
  garmentCategory: string;
};

const RULE = '————————';

/** Grouped pickup counts for the system share sheet. */
export function formatPickupShareText(input: {
  orderNumber: string;
  flat: string;
  customerName: string | null;
  lines: ShareGarmentLine[];
}): string {
  const counted = input.lines.filter((line) => line.quantity > 0);
  const total = counted.reduce((sum, line) => sum + line.quantity, 0);
  const serviceIds = listServiceLineChoices(
    counted.map((line) => line.serviceLine),
    false,
  );

  const blocks = serviceIds.map((serviceLine) => {
    const inLine = counted.filter(
      (line) => normalizeServiceLine(line.serviceLine) === serviceLine,
    );
    const text = [
      `${serviceLineLabel(serviceLine)} · ${inLine.reduce((sum, line) => sum + line.quantity, 0)}`,
    ];
    const categories = listGarmentCategoryTabs(
      inLine.map((line) => line.garmentCategory),
      false,
    );
    categories.forEach((category, index) => {
      const inCategory = inLine.filter(
        (line) => normalizeGarmentCategory(line.garmentCategory) === category,
      );
      if (index > 0) text.push('');
      text.push(
        `${category} · ${inCategory.reduce((sum, line) => sum + line.quantity, 0)}`,
      );
      const merged = new Map<string, number>();
      for (const line of inCategory) {
        merged.set(line.name, (merged.get(line.name) ?? 0) + line.quantity);
      }
      for (const [name, quantity] of [...merged.entries()].sort((a, b) =>
        a[0].localeCompare(b[0]),
      )) {
        text.push(`${name} × ${quantity}`);
      }
    });
    return text.join('\n');
  });

  const who = [input.flat ? `Flat ${input.flat}` : '', input.customerName?.trim() ?? '']
    .filter(Boolean)
    .join(' · ');
  const head = [`Order #${input.orderNumber || '—'}`];
  if (who) head.push(who);

  return [...head, '', blocks.join(`\n\n${RULE}\n`), '', RULE, `Total · ${total}`].join('\n');
}
