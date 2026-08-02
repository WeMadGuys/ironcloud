'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import styles from './Picklist.module.css';

export type PicklistOption = {
  value: string;
  label: string;
};

type PicklistProps = {
  value: string;
  options: PicklistOption[];
  onChange: (value: string) => void;
  /** Shown when value is empty */
  emptyLabel: string;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
};

export function Picklist({
  value,
  options,
  onChange,
  emptyLabel,
  placeholder = 'Search…',
  ariaLabel,
  disabled = false,
}: PicklistProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedLabel = useMemo(() => {
    if (!value) return emptyLabel;
    return options.find((o) => o.value === value)?.label ?? emptyLabel;
  }, [value, options, emptyLabel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.triggerLabel}>{selectedLabel}</span>
        <span className={styles.chevron} aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className={styles.menu} role="listbox" id={listId}>
          <input
            className={styles.search}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            aria-label={`Search ${ariaLabel}`}
            autoFocus
          />
          <button
            type="button"
            role="option"
            aria-selected={!value}
            className={`${styles.option} ${!value ? styles.optionActive : ''}`}
            onClick={() => select('')}
          >
            {emptyLabel}
          </button>
          {filtered.length === 0 ? (
            <div className={styles.empty}>No matches</div>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={value === opt.value}
                className={`${styles.option} ${value === opt.value ? styles.optionActive : ''}`}
                onClick={() => select(opt.value)}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
