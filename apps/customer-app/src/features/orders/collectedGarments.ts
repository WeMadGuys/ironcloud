import {
  listGarmentCategoryTabs,
  listServiceLineChoices,
  normalizeGarmentCategory,
  normalizeServiceLine,
  serviceLineLabel,
} from '@ironcloud/db';

export type CollectedItem = {
  id: string;
  garmentName: string;
  serviceLine: string;
  garmentCategory: string;
  quantity: number;
};

type ServiceEmbed = {
  name?: string | null;
  category?: string | null;
  garment_category?: string | null;
} | null;

export function mapGarmentFields(service: ServiceEmbed): {
  garmentName: string;
  serviceLine: string;
  garmentCategory: string;
} {
  const name = (service?.name || 'Garment').trim();
  return {
    garmentName: name || 'Garment',
    serviceLine: normalizeServiceLine(service?.category),
    garmentCategory: normalizeGarmentCategory(service?.garment_category),
  };
}

export type CollectedCategory = {
  name: string;
  count: number;
  items: { id: string; name: string; quantity: number }[];
};

export type CollectedServiceGroup = {
  serviceLine: string;
  label: string;
  count: number;
  categories: CollectedCategory[];
};

export function groupCollectedGarments(items: CollectedItem[]): {
  total: number;
  groups: CollectedServiceGroup[];
} {
  const counted = items.filter((item) => item.quantity > 0);
  const total = counted.reduce((sum, item) => sum + item.quantity, 0);
  const lines = listServiceLineChoices(
    counted.map((item) => item.serviceLine),
    false,
  );

  const groups = lines
    .map((line) => {
      const inLine = counted.filter(
        (item) => normalizeServiceLine(item.serviceLine) === line,
      );
      const categories = listGarmentCategoryTabs(
        inLine.map((item) => item.garmentCategory),
        false,
      ).map((category) => {
        const inCategory = inLine.filter(
          (item) => normalizeGarmentCategory(item.garmentCategory) === category,
        );
        const merged = new Map<string, { id: string; name: string; quantity: number }>();
        for (const item of inCategory) {
          const existing = merged.get(item.garmentName);
          if (existing) {
            existing.quantity += item.quantity;
            continue;
          }
          merged.set(item.garmentName, {
            id: item.id,
            name: item.garmentName,
            quantity: item.quantity,
          });
        }
        return {
          name: category,
          count: inCategory.reduce((sum, item) => sum + item.quantity, 0),
          items: [...merged.values()].sort((a, b) => a.name.localeCompare(b.name)),
        };
      });

      return {
        serviceLine: line,
        label: serviceLineLabel(line),
        count: inLine.reduce((sum, item) => sum + item.quantity, 0),
        categories,
      };
    })
    .filter((group) => group.count > 0);

  return { total, groups };
}

const SERVICE_RULE = '————————';

/** Plain text matching the on-screen groups, for the system share sheet. */
export function formatCollectedShareText(
  orderNumber: string,
  items: CollectedItem[],
): string {
  const { total, groups } = groupCollectedGarments(items);
  const blocks = groups.map((group) => {
    const lines = [`${group.label} · ${group.count}`];
    group.categories.forEach((category, index) => {
      if (index > 0) lines.push('');
      lines.push(`${category.name} · ${category.count}`);
      for (const item of category.items) {
        lines.push(`${item.name} × ${item.quantity}`);
      }
    });
    return lines.join('\n');
  });

  return [`Order #${orderNumber}`, '', blocks.join(`\n\n${SERVICE_RULE}\n`), '', SERVICE_RULE, `Total · ${total}`].join(
    '\n',
  );
}
