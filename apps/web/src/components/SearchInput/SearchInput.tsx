'use client';

import Icon from '@mdi/react';
import { mdiMagnify } from '@mdi/js';
import type { InputHTMLAttributes, KeyboardEvent } from 'react';

import styles from './SearchInput.module.css';

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const SearchInput = ({ className, onKeyDown, ...props }: SearchInputProps) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Prevent Enter from submitting a parent form / reloading the page
    if (e.key === 'Enter') e.preventDefault();
    onKeyDown?.(e);
  };

  return (
    <div className={`${styles.wrapper} ${className ?? ''}`}>
      <span className={styles.icon} aria-hidden="true">
        <Icon path={mdiMagnify} size={0.7} />
      </span>
      <input
        type="text"
        role="searchbox"
        className={styles.input}
        {...props}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
};
