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
import { CSS } from '@dnd-kit/utilities';
import Icon from '@mdi/react';
import { mdiDragVertical } from '@mdi/js';
import { useState, type CSSProperties } from 'react';

import { Button } from '@/components';
import tableStyles from '@/components/Table/Table.module.css';
import { formatCurrency } from '@/utils/format';
import { normalizeGarmentCategory } from '@ironcloud/db';

import dragStyles from './PricingRulesTable.module.css';
import formStyles from '@/styles/form.module.css';

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
};

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
}: {
  serviceId: string;
  rows: PricingRuleRow[];
  rowOffset: number;
  scopeLabel: Props['scopeLabel'];
  targetLabel: Props['targetLabel'];
  onEdit: Props['onEdit'];
  onDelete: Props['onDelete'];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: serviceId,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  };
  const name = rows[0]?.services?.name ?? 'service';

  return (
    <div ref={setNodeRef} style={style}>
      {rows.map((row, index) => {
        const zebra = (rowOffset + index) % 2 === 1;
        const cell = `${tableStyles.td} ${zebra ? dragStyles.altCell : ''}`;
        return (
          <div key={row.id} className={dragStyles.row}>
            <div className={cell}>
              {index === 0 ? (
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
            </div>
            <div className={cell}>{row.services?.name ?? '—'}</div>
            <div className={cell}>
              {normalizeGarmentCategory(row.services?.garment_category)}
            </div>
            <div className={cell}>
              {scopeLabel(row.scope ?? (row.community_id ? 'community' : 'all'))}
            </div>
            <div className={cell}>{targetLabel(row)}</div>
            <div className={cell}>{formatCurrency(Number(row.base_price))}</div>
            <div className={cell}>{String(row.express_multiplier ?? 1.5)}</div>
            <div className={cell}>
              <div className={formStyles.rowActions}>
                <Button variant="secondary" size="sm" onClick={() => onEdit(row)}>
                  Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => onDelete(row.id)}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PricingRulesTable({
  rows,
  scopeLabel,
  targetLabel,
  onEdit,
  onDelete,
  onReorder,
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
        <div className={dragStyles.sheet}>
          <div className={dragStyles.head}>
            <div className={tableStyles.th} aria-label="Reorder" />
            <div className={tableStyles.th}>Service</div>
            <div className={tableStyles.th}>Category</div>
            <div className={tableStyles.th}>Scope</div>
            <div className={tableStyles.th}>Target</div>
            <div className={tableStyles.th}>Base Price</div>
            <div className={tableStyles.th}>Express ×</div>
            <div className={tableStyles.th}>Actions</div>
          </div>
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
                />
              );
            })}
          </SortableContext>
        </div>
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
