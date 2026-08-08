import Image from 'next/image';
import Link from 'next/link';

import {
  BUSINESS_ADDRESS,
  ENTERPRISE_NAME,
  SITE_NAME,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  SUPPORT_PHONE_TEL,
  UDYAM_NUMBER,
} from '@/constants/marketing';
import { createPageMetadata, getLocalBusinessJsonLd } from '@/lib/seo';

import styles from '@/components/landing/HomePage.module.css';

export const metadata = createPageMetadata({
  title: `${SITE_NAME} · Doorstep Ironing`,
  description:
    'Iron Cloud provides doorstep laundry ironing pickup and delivery. Contact us or review our policies.',
  path: '/',
  absolute: true,
});

export default function HomePage() {
  const jsonLd = getLocalBusinessJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className={styles.hero} aria-labelledby="hero-heading">
        <div className={styles.inner}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>{SITE_NAME}</p>
            <h1 id="hero-heading" className={styles.title}>
              Doorstep ironing pickup &amp; delivery
            </h1>
            <p className={styles.subtitle}>
              We collect garments from your apartment, professionally steam-iron them, and return
              them to your doorstep. Book and pay through the Iron Cloud mobile app.
            </p>
            <div className={styles.actions}>
              <Link href="/contact" className={styles.primaryBtn}>
                Contact us
              </Link>
              <Link href="/privacy-policy" className={styles.secondaryBtn}>
                Privacy Policy
              </Link>
            </div>
          </div>
          <div className={styles.visual}>
            <div className={styles.imageFrame}>
              <Image
                src="/hero-shirts.png"
                alt="Freshly pressed shirts"
                width={480}
                height={540}
                priority
                className={styles.image}
                sizes="(max-width: 900px) 100vw, 40vw"
              />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.info} aria-labelledby="business-heading">
        <div className={styles.infoInner}>
          <h2 id="business-heading" className={styles.infoTitle}>
            Business information
          </h2>
          <dl className={styles.dl}>
            <div>
              <dt>Enterprise</dt>
              <dd>{ENTERPRISE_NAME}</dd>
            </div>
            <div>
              <dt>UDYAM</dt>
              <dd>{UDYAM_NUMBER}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{BUSINESS_ADDRESS}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              </dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>
                <a href={`tel:${SUPPORT_PHONE_TEL}`}>{SUPPORT_PHONE}</a>
              </dd>
            </div>
          </dl>
          <p className={styles.policies}>
            <Link href="/terms-and-conditions">Terms</Link>
            {' · '}
            <Link href="/privacy-policy">Privacy</Link>
            {' · '}
            <Link href="/refund-policy">Refunds</Link>
            {' · '}
            <Link href="/shipping-policy">Shipping</Link>
            {' · '}
            <Link href="/pricing">Pricing</Link>
          </p>
        </div>
      </section>
    </>
  );
}
