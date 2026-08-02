'use client';

import Icon from '@mdi/react';
import { mdiChevronLeft, mdiChevronRight, mdiLogout } from '@mdi/js';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV_ITEMS } from '@/constants/routes';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAdminRole } from '@/features/auth/hooks/useAdminRole';
import { signOut } from '@/features/auth/services/auth.service';
import { getInitials } from '@/utils/format';
import { getNavIcon } from '@/utils/icons';

import styles from './Sidebar.module.css';

export const Sidebar = () => {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed } = useSidebar();
  const { profile, role } = useAdminRole();

  const handleLogout = async () => {
    await signOut();
    // Hard navigation so middleware sees cleared auth cookies
    window.location.assign('/admin/login');
  };

  return (
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}
      aria-label="Main navigation"
    >
      <button
        type="button"
        className={styles.toggle}
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <Icon path={collapsed ? mdiChevronRight : mdiChevronLeft} size={0.6} />
      </button>

      <div className={styles.logo}>
        <img
          src="/logo-mark.png"
          alt="IronCloud"
          className={styles.logoIcon}
          width={36}
          height={36}
        />
        {!collapsed && <span className={styles.logoText}>IRON CLOUD ADMIN</span>}
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <span className={styles.navIcon}>
                <Icon path={getNavIcon(item.icon)} size={0.75} />
              </span>
              {!collapsed && item.label}
            </Link>
          );
        })}
        <button type="button" className={styles.logout} onClick={handleLogout}>
          <span className={styles.navIcon}>
            <Icon path={mdiLogout} size={0.75} />
          </span>
          {!collapsed && 'Logout'}
        </button>
      </nav>

      {!collapsed && profile && (
        <div className={styles.user}>
          <div className={styles.userCard}>
            <div className={styles.avatar}>{getInitials(profile.full_name)}</div>
            <div>
              <div className={styles.userName}>{profile.full_name ?? 'Admin'}</div>
              <div className={styles.userRole}>{role?.replace('_', ' ')}</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
