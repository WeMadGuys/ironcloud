import { ContactForm, PageIntro } from '@/components/landing';
import {
  BUSINESS_ADDRESS,
  ENTERPRISE_NAME,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  SUPPORT_PHONE_TEL,
  UDYAM_NUMBER,
} from '@/constants/marketing';
import { createPageMetadata } from '@/lib/seo';

import styles from './contact.module.css';

export const metadata = createPageMetadata({
  title: 'Contact',
  description:
    'Contact Iron Cloud support or join the waiting list for premium doorstep ironing in your community.',
  path: '/contact',
});

export default function ContactPage() {
  return (
    <>
      <PageIntro
        eyebrow="Contact"
        title="Join the waiting list"
        description="Tell us about your community or ask a question. We will get back to you soon."
      />
      <div className={styles.content}>
        <div className={styles.details}>
          <h2 className={styles.detailsTitle}>Business details</h2>
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
        </div>

        <div className={styles.card}>
          <p className={styles.support}>Send us a message and we will reply by email.</p>
          <ContactForm />
        </div>
      </div>
    </>
  );
}
