import { PageIntro } from '@/components/landing';
import { LandingLinkButton } from '@/components/landing/LandingLinkButton';
import { createPageMetadata } from '@/lib/seo';

import styles from './about.module.css';

export const metadata = createPageMetadata({
  title: 'About',
  description:
    'Iron Cloud provides doorstep ironing pickup and delivery for apartment communities.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <>
      <PageIntro
        eyebrow="About"
        title="Iron Cloud"
        description="Doorstep ironing pickup and delivery through our mobile apps."
      />
      <div className={styles.content}>
        <div className={styles.prose}>
          <p>
            Iron Cloud collects garments from your apartment, professionally steam-irons them, and
            returns them to your doorstep. Booking, tracking, and payments are handled in the Iron
            Cloud customer app.
          </p>
        </div>
        <div className={styles.actions}>
          <LandingLinkButton href="/contact">Contact us</LandingLinkButton>
          <LandingLinkButton href="/privacy-policy" variant="secondary">
            Privacy Policy
          </LandingLinkButton>
        </div>
      </div>
    </>
  );
}
