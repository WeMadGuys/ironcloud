'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Icon from '@mdi/react';
import { mdiApple, mdiGooglePlay } from '@mdi/js';

import { APP_STORE_URL, PLAY_STORE_URL, SITE_NAME, SITE_TAGLINE } from '@/constants/marketing';

import styles from './GetAppView.module.css';

type TrackEvent = {
  eventType: 'visit' | 'app_store_click' | 'play_store_click';
  platform: 'ios' | 'android' | 'desktop';
  source: string | null;
};

const track = (event: TrackEvent) => {
  const body = JSON.stringify(event);
  if (navigator.sendBeacon?.('/api/app-download/track', body)) return;
  void fetch('/api/app-download/track', { method: 'POST', body, keepalive: true }).catch(() => {});
};

/** iPadOS 13+ sends a desktop Safari user agent, so it can only be detected client-side. */
const isIpadOs = () => navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

export function GetAppView({ source }: { source: string | null }) {
  const tracked = useRef(false);
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    if (isIpadOs()) {
      setRedirecting(true);
      track({ eventType: 'visit', platform: 'ios', source });
      window.location.replace(APP_STORE_URL);
      return;
    }
    track({ eventType: 'visit', platform: 'desktop', source });
  }, [source]);

  return (
    <main className={styles.shell}>
      <div className={styles.card}>
        <Link href="/" className={styles.brand} aria-label={`${SITE_NAME} home`}>
          <Image src="/logo-mark.png" alt="" width={64} height={64} priority />
          <span>{SITE_NAME}</span>
        </Link>

        <h1 className={styles.title}>Get the {SITE_NAME} app</h1>
        <p className={styles.subtitle}>
          {redirecting ? 'Taking you to the App Store…' : `${SITE_TAGLINE}. Book pickups, track orders and pay in one place.`}
        </p>

        <div className={styles.actions}>
          <a
            href={APP_STORE_URL}
            className={styles.storeBtn}
            onClick={() => track({ eventType: 'app_store_click', platform: 'desktop', source })}
          >
            <Icon path={mdiApple} size={1.25} />
            <span className={styles.storeText}>
              <small>Download on the</small>
              App Store
            </span>
          </a>
          <a
            href={PLAY_STORE_URL}
            className={styles.storeBtn}
            onClick={() => track({ eventType: 'play_store_click', platform: 'desktop', source })}
          >
            <Icon path={mdiGooglePlay} size={1.15} />
            <span className={styles.storeText}>
              <small>Get it on</small>
              Google Play
            </span>
          </a>
        </div>

        <p className={styles.hint}>On your phone? Open this page there and we’ll take you straight to your store.</p>
      </div>
    </main>
  );
}
