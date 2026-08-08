import Image from 'next/image';
import Link from 'next/link';
import Icon from '@mdi/react';

import {
  BENEFITS,
  BUSINESS_ADDRESS,
  ENTERPRISE_NAME,
  HOW_IT_WORKS,
  SITE_NAME,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  SUPPORT_PHONE_TEL,
  UDYAM_NUMBER,
} from '@/constants/marketing';
import { createPageMetadata, getLocalBusinessJsonLd } from '@/lib/seo';

import { ScreenshotCarousel } from '@/components/landing/ScreenshotCarousel';
import styles from '@/components/landing/HomePage.module.css';

export const metadata = createPageMetadata({
  title: `${SITE_NAME} · Doorstep Ironing`,
  description:
    'Iron Cloud doorstep ironing pickup and delivery. Schedule in the app, we collect, press, and return.',
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
              Premium ironing, delivered to your doorstep
            </h1>
            <p className={styles.subtitle}>
              Schedule a pickup in the Iron Cloud app. We collect your clothes, steam-iron them
              professionally, and return them to your apartment — typically within 24 hours.
            </p>
            <div className={styles.actions}>
              <Link href="/contact" className={styles.primaryBtn}>
                Contact us
              </Link>
              <Link href="/about" className={styles.secondaryBtn}>
                About us
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

      <section className={styles.band} aria-labelledby="how-heading">
        <div className={styles.bandInner}>
          <header className={styles.bandHeader}>
            <p className={styles.eyebrow}>How it works</p>
            <h2 id="how-heading" className={styles.bandTitle}>
              Three simple steps
            </h2>
            <p className={styles.bandDesc}>
              From booking to delivery, the flow is designed for apartment living.
            </p>
          </header>
          <div className={styles.cardGrid3}>
            {HOW_IT_WORKS.map((step, index) => (
              <article key={step.title} className={styles.card}>
                <div className={styles.iconWrap} aria-hidden="true">
                  <Icon path={step.icon} size={1.1} />
                </div>
                <p className={styles.stepLabel}>Step {index + 1}</p>
                <h3 className={styles.cardTitle}>{step.title}</h3>
                <p className={styles.cardBody}>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ScreenshotCarousel />

      <section className={styles.bandAlt} aria-labelledby="why-heading">
        <div className={styles.bandInner}>
          <header className={styles.bandHeader}>
            <p className={styles.eyebrow}>Why Iron Cloud</p>
            <h2 id="why-heading" className={styles.bandTitle}>
              Built for busy homes
            </h2>
            <p className={styles.bandDesc}>
              Reliable pickup, careful finishing, and clear digital payments.
            </p>
          </header>
          <div className={styles.cardGrid3}>
            {BENEFITS.map((item) => (
              <article key={item.title} className={styles.card}>
                <div className={styles.iconWrap} aria-hidden="true">
                  <Icon path={item.icon} size={1.05} />
                </div>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <p className={styles.cardBody}>{item.description}</p>
              </article>
            ))}
          </div>
          <div className={styles.bandActions}>
            <Link href="/pricing" className={styles.secondaryBtn}>
              View pricing
            </Link>
            <Link href="/contact" className={styles.primaryBtn}>
              Get in touch
            </Link>
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
          </p>
        </div>
      </section>
    </>
  );
}
