'use client';

import Image from 'next/image';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import Icon from '@mdi/react';
import { mdiApple, mdiGooglePlay } from '@mdi/js';

import { APP_STORE_URL, GET_APP_PATH, PLAY_STORE_URL, SITE_NAME } from '@/constants/marketing';

import styles from './DownloadAppSection.module.css';

export function DownloadAppSection() {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // High error correction so the centred logo doesn't break scanning.
    QRCode.toDataURL(`${window.location.origin}${GET_APP_PATH}?src=qr`, {
      width: 360,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: { dark: '#0e2a4a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className={styles.section} aria-labelledby="download-heading">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Download the app</p>
          <h2 id="download-heading" className={styles.title}>
            Book your next pickup in seconds
          </h2>
          <p className={styles.desc}>
            Get the {SITE_NAME} app on iPhone or Android. Scan the QR code with your phone camera,
            or tap a store below.
          </p>
          <div className={styles.actions}>
            <a href={APP_STORE_URL} className={styles.storeBtn} target="_blank" rel="noopener noreferrer">
              <Icon path={mdiApple} size={1.25} />
              <span className={styles.storeText}>
                <small>Download on the</small>
                App Store
              </span>
            </a>
            <a href={PLAY_STORE_URL} className={styles.storeBtn} target="_blank" rel="noopener noreferrer">
              <Icon path={mdiGooglePlay} size={1.15} />
              <span className={styles.storeText}>
                <small>Get it on</small>
                Google Play
              </span>
            </a>
          </div>
        </div>

        <div className={styles.qrCard}>
          <div className={styles.qrFrame}>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt={`QR code to download the ${SITE_NAME} app`} className={styles.qrImage} />
            ) : (
              <div className={styles.qrPlaceholder} aria-hidden="true" />
            )}
            <span className={styles.qrLogo}>
              <Image src="/logo-mark.png" alt="" width={40} height={40} />
            </span>
          </div>
          <p className={styles.qrCaption}>
            <Icon path={mdiApple} size={0.8} />
            <Icon path={mdiGooglePlay} size={0.75} />
            Scan to download
          </p>
        </div>
      </div>
    </section>
  );
}
