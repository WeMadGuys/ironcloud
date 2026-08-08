import Link from 'next/link';

import { PageIntro } from '@/components/landing';
import { LandingLinkButton } from '@/components/landing/LandingLinkButton';
import { createPageMetadata } from '@/lib/seo';

import styles from './about.module.css';

export const metadata = createPageMetadata({
  title: 'About',
  description:
    'About Iron Cloud — doorstep ironing pickup and delivery for apartment communities.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <>
      <PageIntro
        eyebrow="About"
        title="Iron Cloud"
        description="Doorstep ironing built for modern apartment living."
      />
      <div className={styles.content}>
        <div className={styles.prose}>
          <p>
            Iron Cloud is a premium ironing pickup and delivery service. We collect garments from
            your flat, finish them with professional steam ironing, and return them to your
            doorstep — typically within 24 hours.
          </p>
          <p>
            Booking, live order tracking, and digital payments (including wallet top-ups) happen in
            the Iron Cloud mobile app. Our riders and partners follow community access rules so the
            experience stays reliable for residents.
          </p>
          <p>
            We operate as <strong>IRON CLOUD</strong> (UDYAM-TS-09-0264194) from Hyderabad, and we
            are expanding coverage community by community.
          </p>
        </div>

        <div className={styles.highlights}>
          <div className={styles.highlight}>
            <h2>What we offer</h2>
            <ul>
              <li>Doorstep pickup and delivery</li>
              <li>Professional steam ironing</li>
              <li>App-based booking and tracking</li>
              <li>Secure digital payments</li>
            </ul>
          </div>
          <div className={styles.highlight}>
            <h2>Policies</h2>
            <ul>
              <li>
                <Link href="/privacy-policy">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms-and-conditions">Terms of Service</Link>
              </li>
              <li>
                <Link href="/refund-policy">Cancellation &amp; Refunds</Link>
              </li>
              <li>
                <Link href="/shipping-policy">Shipping &amp; Delivery</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.actions}>
          <LandingLinkButton href="/contact">Contact us</LandingLinkButton>
          <LandingLinkButton href="/pricing" variant="secondary">
            Pricing
          </LandingLinkButton>
        </div>
      </div>
    </>
  );
}
