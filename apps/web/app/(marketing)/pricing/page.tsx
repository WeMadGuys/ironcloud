import Link from 'next/link';

import { PageIntro } from '@/components/landing';
import { createPageMetadata } from '@/lib/seo';

import styles from './pricing.module.css';

export const metadata = createPageMetadata({
  title: 'Pricing',
  description:
    'Iron Cloud service prices are shown in the mobile app before you confirm an order.',
  path: '/pricing',
});

export default function PricingPage() {
  return (
    <>
      <PageIntro
        eyebrow="Pricing"
        title="Transparent pricing in the app"
        description="Iron Cloud charges for ironing pickup and delivery based on your order. Final prices are always shown in the Iron Cloud mobile app before you confirm."
      />
      <div className={styles.content}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>How pricing works</h2>
          <ul className={styles.list}>
            <li>Service rates depend on garment type and your community coverage.</li>
            <li>Subscription and pay-per-order options may be offered where available.</li>
            <li>You see the estimated and payable amount in the app before payment.</li>
            <li>Digital payments (including wallet top-ups via Razorpay) are processed securely.</li>
          </ul>
          <p className={styles.note}>
            For billing questions, see our{' '}
            <Link href="/refund-policy">Cancellation &amp; Refund Policy</Link> or{' '}
            <Link href="/contact">contact us</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
