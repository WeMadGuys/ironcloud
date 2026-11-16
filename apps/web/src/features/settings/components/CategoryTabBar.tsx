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
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Icon from '@mdi/react';
import { mdiDragVertical } from '@mdi/js';
import { useState } from 'react';

import styles from './CategoryTabBar.module.css';

type Props = {
  tabs: string[];
  active: string;
  onSelect: (tab: string) => void;
  onReorder: (orderedNames: string[]) => void;
};

function SortableTab({
  name,
  active,
  onSelect,
}: {
  name: string;
  active: boolean;
  onSelect: (tab: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: name,
  });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.tab} ${active ? styles.active : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
      }}
    >
      <button
        type="button"
        className={styles.handle}
        aria-label={`Reorder ${name}`}
        {...attributes}
        {...listeners}
      >
        <Icon path={mdiDragVertical} size={0.7} />
      </button>
      <button type="button" className={styles.label} onClick={() => onSelect(name)}>
        {name}
      </button>
    </div>
  );
}

export function CategoryTabBar({ tabs, active, onSelect, onReorder }: Props) {
  const [dragging, setDragging] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;
    const oldIndex = tabs.indexOf(String(dragged.id));
    const newIndex = tabs.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(tabs, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      onDragStart={(event) => setDragging(String(event.active.id))}
      onDragCancel={() => setDragging(null)}
      onDragEnd={(event) => {
        setDragging(null);
        handleDragEnd(event);
      }}
    >
      <SortableContext items={tabs} strategy={horizontalListSortingStrategy}>
        {tabs.map((tab) => (
          <SortableTab key={tab} name={tab} active={tab === active} onSelect={onSelect} />
        ))}
      </SortableContext>
      <DragOverlay>
        {dragging ? <div className={styles.overlay}>{dragging}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}
