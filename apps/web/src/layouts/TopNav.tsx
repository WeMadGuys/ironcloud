'use client';

import Icon from '@mdi/react';
import { mdiBell, mdiMenu, mdiThemeLightDark } from '@mdi/js';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useSidebar } from '@/contexts/SidebarContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAdminRole } from '@/features/auth/hooks/useAdminRole';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { signOut } from '@/features/auth/services/auth.service';
import { markSupportTicketNotificationsRead } from '@/features/support/services/supportNotifications';
import { ADMIN_ROUTES } from '@/constants/routes';
import { getSupabase } from '@/lib/supabase';
import { formatRelativeTime, getInitials } from '@/utils/format';
import { SearchInput } from '@/components/SearchInput/SearchInput';
import { GlobalSearch } from '@/features/search/components/GlobalSearch';

import styles from './TopNav.module.css';

type TopNavProps = {
  title: string;
  subtitle?: string;
};

type AdminNotification = {
  id: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

export const TopNav = ({ title, subtitle }: TopNavProps) => {
  const router = useRouter();
  const { toggleTheme } = useTheme();
  const { mobileOpen, toggleMobile } = useSidebar();
  const { user } = useAuth();
  const { profile } = useAdminRole();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [notifCount, setNotifCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    const supabase = getSupabase();
    const { data, count, error } = await supabase
      .from('admin_notifications')
      .select('id, title, body, entity_type, entity_id, created_at', { count: 'exact' })
      .is('read_at', null)
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.warn('[admin notifications]', error.message);
      return;
    }

    setNotifications((data ?? []) as AdminNotification[]);
    setNotifCount(count ?? data?.length ?? 0);
  }, [user?.id]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!user?.id) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`admin-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          void loadNotifications();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, loadNotifications]);

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
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const openNotification = async (item: AdminNotification) => {
    setNotifOpen(false);
    if (item.entity_type !== 'support_ticket' || !item.entity_id) return;

    const removed = notifications.filter((n) => n.entity_id === item.entity_id).length;
    setNotifications((prev) => prev.filter((n) => n.entity_id !== item.entity_id));
    setNotifCount((count) => Math.max(0, count - removed));
    await markSupportTicketNotificationsRead(item.entity_id);
    router.push(`${ADMIN_ROUTES.support}/${item.entity_id}`);
  };

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
          <button
            type="button"
            className={`${styles.iconButton} ${styles.menuButton}`}
            onClick={toggleMobile}
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileOpen}
          >
            <Icon path={mdiMenu} size={0.9} />
          </button>
          <div className={styles.heading}>
            <h1 className={styles.title}>{title}</h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
        </div>
        <div className={styles.right}>
          <SearchInput
            placeholder="Search (Ctrl+K)"
            onFocus={() => setSearchOpen(true)}
            readOnly
          />
          <div className={styles.notifMenu} ref={notifRef}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Notifications"
              aria-expanded={notifOpen}
              onClick={() => {
                setNotifOpen((open) => !open);
                setMenuOpen(false);
              }}
            >
              <Icon path={mdiBell} size={0.85} />
              {notifCount > 0 && (
                <span className={styles.badge}>{notifCount > 99 ? '99+' : notifCount}</span>
              )}
            </button>
            {notifOpen && (
              <div className={styles.notifPopup} role="menu" aria-label="Notifications">
                {notifications.length === 0 ? (
                  <p className={styles.notifEmpty}>No new notifications</p>
                ) : (
                  notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={styles.notifItem}
                      role="menuitem"
                      onClick={() => void openNotification(item)}
                    >
                      <span className={styles.notifTitle}>{item.title}</span>
                      {item.body ? <span className={styles.notifBody}>{item.body}</span> : null}
                      <span className={styles.notifTime}>{formatRelativeTime(item.created_at)}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
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
