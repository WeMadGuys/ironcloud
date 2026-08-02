'use client';

import Icon from '@mdi/react';
import {
  mdiChartBar,
  mdiGoogle,
  mdiHandshake,
  mdiShieldCheckOutline,
  mdiViewDashboard,
} from '@mdi/js';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ADMIN_ROUTES } from '@/constants/routes';
import { isSupabaseConfigured } from '@/lib/supabase';
import { signInWithGoogle } from '../services/auth.service';

import styles from './LoginForm.module.css';

const FEATURES = [
  { icon: mdiViewDashboard, label: 'Live\nDashboard' },
  { icon: mdiHandshake, label: 'Partner\nOps' },
  { icon: mdiChartBar, label: 'Business\nAnalytics' },
  { icon: mdiShieldCheckOutline, label: 'Secure\nAccess' },
];

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: 'Access denied. Your Google account is not authorized for admin access.',
  oauth: 'Google sign-in failed. Please try again.',
  config: 'Supabase is not configured. Add credentials to .env and restart the dev server.',
};

export const LoginForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const supabaseConfigured = isSupabaseConfigured();
  const configMissing = !supabaseConfigured;
  const redirectPath = searchParams.get('redirect') ?? ADMIN_ROUTES.dashboard;

  useEffect(() => {
    if (!supabaseConfigured || searchParams.get('config') !== 'missing') return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('config');
    const query = nextParams.toString();
    router.replace(query ? `${ADMIN_ROUTES.login}?${query}` : ADMIN_ROUTES.login);
  }, [router, searchParams, supabaseConfigured]);

  useEffect(() => {
    const code = searchParams.get('error');
    if (!code) return;
    setError(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.oauth);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('error');
    const query = nextParams.toString();
    router.replace(query ? `${ADMIN_ROUTES.login}?${query}` : ADMIN_ROUTES.login);
  }, [router, searchParams]);

  const handleGoogleSignIn = async () => {
    if (!supabaseConfigured) {
      setError(ERROR_MESSAGES.config);
      return;
    }

    setLoading(true);
    setError('');
    const result = await signInWithGoogle(redirectPath);
    if (result.error) {
      setLoading(false);
      setError(result.error.message);
      return;
    }

    window.location.assign(result.data.url);
  };

  return (
    <div className={styles.page}>
      <div className={styles.cloudTop} aria-hidden />
      <div className={styles.cloudBottom} aria-hidden />

      <div className={styles.inner}>
        <header className={styles.header}>
          <img
            src="/logo-mark.png"
            alt="IronCloud"
            className={styles.brandLogo}
            width={120}
            height={120}
          />
          <div className={styles.brandRow}>
            <span className={styles.brandIron}>IRON</span>
            <span className={styles.brandCloud}> CLOUD</span>
          </div>
          <div className={styles.brandDivider} />
          <span className={styles.adminBadge}>ADMIN</span>
        </header>

        <div className={styles.heroCopy}>
          <h1 className={styles.headline}>Command the cloud.</h1>
          <p className={styles.subheadline}>
            Operations, partners, riders — all in one place.
          </p>
        </div>

        <div className={styles.heroImageWrap} aria-hidden>
          <img
            src="/hero-shirts.png"
            alt=""
            className={styles.heroShirts}
            width={168}
            height={116}
          />
        </div>

        {configMissing && (
          <div className={styles.configBanner} role="alert">
            <strong>Supabase not configured.</strong> Add credentials to your root <code>.env</code>{' '}
            and restart <code>npm run web:dev</code>.
          </div>
        )}

        <div className={styles.formSection}>
          {error && (
            <p className={styles.errorText} role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            className={styles.continueButton}
            onClick={handleGoogleSignIn}
            disabled={loading || !supabaseConfigured}
          >
            {!loading && <Icon path={mdiGoogle} size={0.9} color="var(--ic-brand-on-primary)" />}
            <span className={styles.continueText}>
              {loading ? 'Redirecting...' : 'Continue with Google'}
            </span>
          </button>

          <div className={styles.trustRow}>
            <div className={styles.trustIconWrap}>
              <Icon path={mdiShieldCheckOutline} size={0.75} color="var(--ic-brand-accent)" />
            </div>
            <div className={styles.trustCopy}>
              <p className={styles.trustTitle}>Secure. Private. Trusted.</p>
              <p className={styles.trustSubtitle}>
                Sign in with an authorized Google account only.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.featuresRow}>
          {FEATURES.map((feature) => (
            <div key={feature.label} className={styles.featureItem}>
              <div className={styles.featureIconWrap}>
                <Icon path={feature.icon} size={0.9} color="var(--ic-text-primary)" />
              </div>
              <span className={styles.featureLabel}>{feature.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
