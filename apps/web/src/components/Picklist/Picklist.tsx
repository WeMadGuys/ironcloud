'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import styles from './Picklist.module.css';

export type PicklistOption = {
  value: string;
  label: string;
};

type PicklistBase = {
  options: PicklistOption[];
  emptyLabel: string;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
};

type SinglePicklistProps = PicklistBase & {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
};

type MultiPicklistProps = PicklistBase & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
};

export type PicklistProps = SinglePicklistProps | MultiPicklistProps;

export function Picklist(props: PicklistProps) {
  const {
    options,
    emptyLabel,
    placeholder = 'Search…',
    ariaLabel,
    disabled = false,
  } = props;
  const multiple = props.multiple === true;
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedValues = useMemo(() => {
    if (multiple) return props.value;
    return props.value ? [props.value] : [];
  }, [multiple, props.value]);

  const selectedSet = useMemo(
    () => new Set(selectedValues),
    [selectedValues],
  );

  const selectedLabel = useMemo(() => {
    if (selectedValues.length === 0) return emptyLabel;
    if (selectedValues.length === 1) {
      return (
        options.find((o) => o.value === selectedValues[0])?.label ?? emptyLabel
      );
    }
    return `${selectedValues.length} selected`;
  }, [selectedValues, options, emptyLabel]);

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

  const selectSingle = (next: string) => {
    if (multiple) return;
    props.onChange(next);
    setOpen(false);
    setQuery('');
  };

  const toggleMulti = (next: string) => {
    if (!multiple) return;
    const exists = selectedSet.has(next);
    const updated = exists
      ? props.value.filter((v) => v !== next)
      : [...props.value, next];
    props.onChange(updated);
  };

  const clearAll = () => {
    if (multiple) {
      props.onChange([]);
    } else {
      props.onChange('');
      setOpen(false);
      setQuery('');
    }
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
        <div
          className={styles.menu}
          role="listbox"
          id={listId}
          aria-multiselectable={multiple || undefined}
        >
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
            aria-selected={selectedValues.length === 0}
            className={`${styles.option} ${selectedValues.length === 0 ? styles.optionActive : ''}`}
            onClick={clearAll}
          >
            {emptyLabel}
          </button>
          {filtered.length === 0 ? (
            <div className={styles.empty}>No matches</div>
          ) : multiple ? (
            filtered.map((opt) => {
              const checked = selectedSet.has(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`${styles.option} ${styles.optionCheck} ${checked ? styles.optionActive : ''}`}
                >
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={checked}
                    onChange={() => toggleMulti(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={selectedSet.has(opt.value)}
                className={`${styles.option} ${selectedSet.has(opt.value) ? styles.optionActive : ''}`}
                onClick={() => selectSingle(opt.value)}
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
