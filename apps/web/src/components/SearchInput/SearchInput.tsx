'use client';

import Icon from '@mdi/react';
import { mdiClose, mdiMagnify } from '@mdi/js';
import type { InputHTMLAttributes, KeyboardEvent } from 'react';

import styles from './SearchInput.module.css';

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  onClear?: () => void;
};

export const SearchInput = ({
  className,
  onKeyDown,
  onClear,
  value,
  ...props
}: SearchInputProps) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Prevent Enter from submitting a parent form / reloading the page
    if (e.key === 'Enter') e.preventDefault();
    onKeyDown?.(e);
  };

  const showClear = Boolean(onClear) && String(value ?? '').length > 0;

  return (
    <div className={`${styles.wrapper} ${className ?? ''}`}>
      <span className={styles.icon} aria-hidden="true">
        <Icon path={mdiMagnify} size={0.7} />
      </span>
      <input
        type="text"
        role="searchbox"
        className={`${styles.input} ${showClear ? styles.inputWithClear : ''}`}
        value={value}
        {...props}
        onKeyDown={handleKeyDown}
      />
      {showClear ? (
        <button
          type="button"
          className={styles.clear}
          aria-label="Clear search"
          onClick={onClear}
        >
          <Icon path={mdiClose} size={0.65} />
        </button>
      ) : null}
    </div>
  );
};
