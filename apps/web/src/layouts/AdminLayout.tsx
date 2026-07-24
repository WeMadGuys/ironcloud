'use client';

import { useSidebar } from '@/contexts/SidebarContext';

import styles from './AdminLayout.module.css';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';

type AdminLayoutProps = {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
};

export const AdminLayout = ({ children, title, subtitle }: AdminLayoutProps) => {
  const { collapsed } = useSidebar();

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={`${styles.main} ${collapsed ? styles.mainCollapsed : ''}`}>
        <TopNav title={title} subtitle={subtitle} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
};
