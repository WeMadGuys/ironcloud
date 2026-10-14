'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

import { Button, Card, Loader, Modal, MultiLineChart, useToast } from '@/components';
import { GET_APP_PATH } from '@/constants/marketing';

import type { fetchAppDownloadStats } from '../services/analytics.service';

import styles from './AppDownloadsCard.module.css';
import pageStyles from '@/styles/pages.module.css';

type AppDownloadStats = Awaited<ReturnType<typeof fetchAppDownloadStats>>;

const SERIES = [
  { key: 'visits', label: 'Page visits', color: 'var(--ic-brand-primary)' },
  { key: 'appStore', label: 'App Store', color: 'var(--ic-brand-accent)' },
  { key: 'playStore', label: 'Google Play', color: 'var(--ic-status-success)' },
];

export const AppDownloadsCard = ({ stats }: { stats: AppDownloadStats }) => {
  const { toast } = useToast();
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLink, setQrLink] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!qrOpen) return;
    const link = `${window.location.origin}${GET_APP_PATH}?src=qr`;
    setQrLink(link);
    let cancelled = false;
    QRCode.toDataURL(link, { width: 320, margin: 2, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [qrOpen]);

  const copyLink = () => {
    navigator.clipboard
      .writeText(qrLink)
      .then(() => toast('Link copied', 'success'))
      .catch(() => toast('Could not copy link', 'error'));
  };

  const { totals } = stats;

  return (
    <>
      <Card
        title="App Downloads (30d)"
        subtitle="Visits to /get-app and traffic sent to each store"
        action={{ label: 'View QR', onClick: () => setQrOpen(true) }}
        className={styles.card}
      >
        <div className={pageStyles.statsGrid}>
          <div className={pageStyles.statBox}>
            <div className={pageStyles.statValue}>{totals.visits}</div>
            <div className={pageStyles.statLabel}>Page Visits</div>
          </div>
          <div className={pageStyles.statBox}>
            <div className={pageStyles.statValue}>{totals.appStore}</div>
            <div className={pageStyles.statLabel}>To App Store</div>
          </div>
          <div className={pageStyles.statBox}>
            <div className={pageStyles.statValue}>{totals.playStore}</div>
            <div className={pageStyles.statLabel}>To Google Play</div>
          </div>
          <div className={pageStyles.statBox}>
            <div className={pageStyles.statValue}>{totals.qrVisits}</div>
            <div className={pageStyles.statLabel}>QR Scans</div>
          </div>
        </div>
        <MultiLineChart data={stats.trend} series={SERIES} />
      </Card>

      <Modal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        title="Get App QR"
        footer={
          <>
            <Button variant="secondary" onClick={copyLink} disabled={!qrLink}>
              Copy link
            </Button>
            {qrDataUrl ? (
              <a className={styles.download} href={qrDataUrl} download="ironcloud-get-app-qr.png">
                Download PNG
              </a>
            ) : null}
          </>
        }
      >
        <div className={styles.qrBody}>
          <p className={styles.qrHint}>
            Scanning opens {GET_APP_PATH}, which sends iPhone users to the App Store and Android
            users to Google Play.
          </p>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="QR code for the Get App link" className={styles.qrImage} />
          ) : (
            <Loader />
          )}
          <p className={styles.qrLink}>{qrLink}</p>
        </div>
      </Modal>
    </>
  );
};
