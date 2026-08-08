import { Footer } from '@/components/landing/Footer';
import { Navbar } from '@/components/landing/Navbar';

import styles from './marketing.module.css';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <Navbar />
      <main id="main-content" className={styles.main}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
