'use client';

import Icon from '@mdi/react';
import { mdiBell, mdiThemeLightDark } from '@mdi/js';
import { useEffect, useRef, useState } from 'react';

import { useTheme } from '@/contexts/ThemeContext';
import { useAdminRole } from '@/features/auth/hooks/useAdminRole';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { signOut } from '@/features/auth/services/auth.service';
import { ADMIN_ROUTES } from '@/constants/routes';
import { getSupabase } from '@/lib/supabase';
import { getInitials } from '@/utils/format';
import { SearchInput } from '@/components/SearchInput/SearchInput';
import { GlobalSearch } from '@/features/search/components/GlobalSearch';

import styles from './TopNav.module.css';

type TopNavProps = {
  title: string;
  subtitle?: string;
};

export const TopNav = ({ title, subtitle }: TopNavProps) => {
  const { toggleTheme } = useTheme();
  const { user } = useAuth();
  const { profile } = useAdminRole();
  const [notifCount, setNotifCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    const supabase = getSupabase();
    void supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
      .eq('recipient_id', user.id)
      .then(({ count }) => setNotifCount(count ?? 0));
  }, [user?.id]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setMenuOpen(false);
    await signOut();
    // Hard navigation so middleware sees cleared auth cookies
    window.location.assign(ADMIN_ROUTES.login);
  };

  return (
    <>
      <header className={styles.topnav}>
        <div className={styles.left}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        <div className={styles.right}>
          <SearchInput
            placeholder="Search (Ctrl+K)"
            onFocus={() => setSearchOpen(true)}
            readOnly
          />
          <button type="button" className={styles.iconButton} aria-label="Notifications">
            <Icon path={mdiBell} size={0.85} />
            {notifCount > 0 && <span className={styles.badge}>{notifCount}</span>}
          </button>
          <button type="button" className={styles.iconButton} onClick={toggleTheme} aria-label="Toggle theme">
            <Icon path={mdiThemeLightDark} size={0.85} />
          </button>
          <div className={styles.profileMenu} ref={menuRef}>
            <button
              type="button"
              className={styles.avatar}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Profile menu"
              aria-expanded={menuOpen}
            >
              {getInitials(profile?.full_name)}
            </button>
            {menuOpen && (
              <div className={styles.dropdown} role="menu">
                <button type="button" className={styles.dropdownItem} role="menuitem" onClick={toggleTheme}>
                  Toggle theme
                </button>
                <button
                  type="button"
                  className={styles.dropdownItem}
                  role="menuitem"
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  {loggingOut ? 'Signing out…' : 'Logout'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
};
