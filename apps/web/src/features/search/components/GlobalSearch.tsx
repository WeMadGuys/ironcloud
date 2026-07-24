'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { globalSearch, type SearchResult } from '../services/search.service';

import styles from './GlobalSearch.module.css';

type GlobalSearchProps = {
  open: boolean;
  onClose: () => void;
};

export const GlobalSearch = ({ open, onClose }: GlobalSearchProps) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const data = await globalSearch(q);
    setResults(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSelect = (href: string) => {
    router.push(href);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-label="Global search">
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <input
          type="search"
          className={styles.input}
          placeholder="Search customers, orders, communities..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          aria-label="Search query"
        />
        <div className={styles.results}>
          {loading && <div className={styles.empty}>Searching...</div>}
          {!loading && results.length === 0 && query.length >= 2 && (
            <div className={styles.empty}>No results found</div>
          )}
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              type="button"
              className={styles.result}
              onClick={() => handleSelect(r.href)}
            >
              <span className={styles.type}>{r.type}</span>
              <div>
                <div>{r.title}</div>
                {r.subtitle && <small>{r.subtitle}</small>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
