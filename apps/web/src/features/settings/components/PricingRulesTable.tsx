'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import Icon from '@mdi/react';
import { mdiClockOutline, mdiDragVertical } from '@mdi/js';
import { useState } from 'react';

import { Button } from '@/components';
import tableStyles from '@/components/Table/Table.module.css';
import { formatCurrency } from '@/utils/format';
import { formatReadyIn, normalizeGarmentCategory } from '@ironcloud/db';

import dragStyles from './PricingRulesTable.module.css';

type ServiceJoin = {
  name: string;
  garment_category?: string | null;
  sort_order?: number | null;
} | null;

export type PricingRuleRow = {
  id: string;
  service_id: string;
  scope?: string | null;
  community_id?: string | null;
  city?: string | null;
  user_id?: string | null;
  base_price?: number | null;
  discount_price?: number | null;
  estimated_days?: number | null;
  express_multiplier?: number | null;
  services: ServiceJoin;
  communities?: { name: string } | null;
  profiles?: { full_name: string; phone: string | null } | null;
};

type Props = {
  rows: PricingRuleRow[];
  scopeLabel: (scope: string | null | undefined) => string;
  targetLabel: (row: PricingRuleRow) => string;
  onEdit: (row: PricingRuleRow) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  canReorder?: boolean;
};

function discountCell(row: PricingRuleRow) {
  const discount = Number(row.discount_price);
  const base = Number(row.base_price);
  if (!Number.isFinite(discount) || discount <= 0 || !Number.isFinite(base) || discount >= base) {
    return '—';
  }
  const percent = Math.round(((base - discount) / base) * 100);
  return (
    <span className={dragStyles.priceQuote}>
      <span className={dragStyles.now}>{formatCurrency(discount)}</span>
      <span className={dragStyles.struck}>{formatCurrency(base)}</span>
      {percent > 0 ? <span className={dragStyles.off}>{percent}% off</span> : null}
    </span>
  );
}

function readyCell(row: PricingRuleRow) {
  const days = Number(row.estimated_days);
  if (!Number.isInteger(days) || days < 1) return '—';
  return (
    <span className={dragStyles.ready}>
      <Icon path={mdiClockOutline} size={0.55} />
      {formatReadyIn(days)}
    </span>
  );
}

function groupRows(rows: PricingRuleRow[]): { serviceId: string; rows: PricingRuleRow[] }[] {
  const groups: { serviceId: string; rows: PricingRuleRow[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.serviceId === row.service_id) {
      last.rows.push(row);
    } else {
      groups.push({ serviceId: row.service_id, rows: [row] });
    }
  }
  return groups;
}

function SortableGroup({
  serviceId,
  rows,
  rowOffset,
  scopeLabel,
  targetLabel,
  onEdit,
  onDelete,
  canReorder,
}: {
  serviceId: string;
  rows: PricingRuleRow[];
  rowOffset: number;
  scopeLabel: Props['scopeLabel'];
  targetLabel: Props['targetLabel'];
  onEdit: Props['onEdit'];
  onDelete: Props['onDelete'];
  canReorder: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: serviceId,
    disabled: !canReorder,
  });
  const name = rows[0]?.services?.name ?? 'service';

  return (
    <tbody ref={setNodeRef} style={{ opacity: isDragging ? 0.45 : 1 }}>
      {rows.map((row, index) => (
        <tr key={row.id} className={(rowOffset + index) % 2 === 1 ? dragStyles.alt : undefined}>
          <td className={dragStyles.handleCell}>
            {index === 0 && canReorder ? (
              <button
                type="button"
                className={dragStyles.handle}
                aria-label={`Reorder ${name}`}
                {...attributes}
                {...listeners}
              >
                <Icon path={mdiDragVertical} size={0.8} />
              </button>
            ) : null}
          </td>
          <td>{row.services?.name ?? '—'}</td>
          <td>{normalizeGarmentCategory(row.services?.garment_category)}</td>
          <td>{scopeLabel(row.scope ?? (row.community_id ? 'community' : 'all'))}</td>
          <td>{targetLabel(row)}</td>
          <td>{formatCurrency(Number(row.base_price))}</td>
          <td>{discountCell(row)}</td>
          <td>{readyCell(row)}</td>
          <td>{String(row.express_multiplier ?? 1.5)}</td>
          <td>
            <div className={dragStyles.actions}>
              <Button variant="secondary" size="sm" onClick={() => onEdit(row)}>
                Edit
              </Button>
              <Button variant="danger" size="sm" onClick={() => onDelete(row.id)}>
                Delete
              </Button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  );
}

export function PricingRulesTable({
  rows,
  scopeLabel,
  targetLabel,
  onEdit,
  onDelete,
  onReorder,
  canReorder = true,
}: Props) {
  const groups = groupRows(rows);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = groups.map((group) => group.serviceId);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  };

  let offset = 0;
  const activeGroup = groups.find((group) => group.serviceId === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={(event) => setActiveId(String(event.active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={(event) => {
        setActiveId(null);
        handleDragEnd(event);
      }}
    >
      <div className={tableStyles.container}>
        <table className={dragStyles.table}>
          <thead>
            <tr>
              <th className={dragStyles.handleCell} aria-label="Reorder" />
              <th>Service</th>
              <th>Category</th>
              <th>Scope</th>
              <th>Target</th>
              <th>Base Price</th>
              <th>Discount</th>
              <th>Ready in</th>
              <th>Express ×</th>
              <th>Actions</th>
            </tr>
          </thead>
          <SortableContext items={groups.map((group) => group.serviceId)} strategy={verticalListSortingStrategy}>
            {groups.map((group) => {
              const rowOffset = offset;
              offset += group.rows.length;
              return (
                <SortableGroup
                  key={group.serviceId}
                  serviceId={group.serviceId}
                  rows={group.rows}
                  rowOffset={rowOffset}
                  scopeLabel={scopeLabel}
                  targetLabel={targetLabel}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  canReorder={canReorder}
                />
              );
            })}
          </SortableContext>
        </table>
      </div>
      <DragOverlay>
        {activeGroup ? (
          <div className={dragStyles.overlay}>
            {activeGroup.rows[0]?.services?.name ?? 'Service'}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
