'use client';

import { useEffect, useState } from 'react';

import { Button, Card, ConfirmationDialog, Loader } from '@/components';
import { useToast } from '@/components/Toast/ToastProvider';
import { trpc } from '@/lib/trpc';
import { formatRelativeTime } from '@/utils/format';

import { fetchAppVersionPolicies } from '../services/settings.service';

import formStyles from '@/styles/form.module.css';

type Platform = 'android' | 'ios';

type PolicyForm = {
  platform: Platform;
  minVersion: string;
  storeUrl: string;
  title: string;
  message: string;
  updatedAt: string;
};

const PLATFORMS: Platform[] = ['android', 'ios'];
const VERSION_PATTERN = /^\d+(\.\d+){0,2}$/;

const platformLabel = (platform: Platform) => (platform === 'ios' ? 'iOS' : 'Android');

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  return 'Could not save the update policy';
}

export const AppUpdatePanel = () => {
  const { toast } = useToast();
  const updatePolicy = trpc.settings.updateAppVersionPolicy.useMutation();
  const [forms, setForms] = useState<PolicyForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, setPending] = useState<PolicyForm | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAppVersionPolicies()
      .then((rows) => {
        if (cancelled) return;
        const next = PLATFORMS.flatMap((platform) => {
          const row = rows.find((item) => item.platform === platform);
          if (!row) return [];
          return [{
            platform,
            minVersion: row.min_version,
            storeUrl: row.store_url,
            title: row.title,
            message: row.message,
            updatedAt: row.updated_at,
          }];
        });
        setForms(next);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateField = (platform: Platform, field: keyof PolicyForm, value: string) => {
    setFieldError(null);
    setForms((current) =>
      current.map((form) => (form.platform === platform ? { ...form, [field]: value } : form)),
    );
  };

  const requestSave = (form: PolicyForm) => {
    const minVersion = form.minVersion.trim();
    const storeUrl = form.storeUrl.trim();
    const message = form.message.trim();
    if (!VERSION_PATTERN.test(minVersion)) {
      setFieldError(`${platformLabel(form.platform)}: use a version like 1.2.0`);
      return;
    }
    if (!isHttpUrl(storeUrl)) {
      setFieldError(`${platformLabel(form.platform)}: store URL must start with http or https`);
      return;
    }
    if (!message) {
      setFieldError(`${platformLabel(form.platform)}: message is required`);
      return;
    }
    setFieldError(null);
    setPending({ ...form, minVersion, storeUrl, message, title: form.title.trim() });
  };

  const handleConfirm = async () => {
    if (!pending || updatePolicy.isPending) return;
    try {
      const saved = await updatePolicy.mutateAsync({
        platform: pending.platform,
        minVersion: pending.minVersion,
        storeUrl: pending.storeUrl,
        title: pending.title,
        message: pending.message,
      });
      setForms((current) =>
        current.map((form) =>
          form.platform === saved.platform
            ? {
                platform: saved.platform as Platform,
                minVersion: saved.min_version,
                storeUrl: saved.store_url,
                title: saved.title,
                message: saved.message,
                updatedAt: saved.updated_at,
              }
            : form,
        ),
      );
      setPending(null);
      toast(`${platformLabel(pending.platform)} update policy saved`, 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  if (loading) return <Loader />;
  if (loadError) return <p className={formStyles.error}>{loadError}</p>;

  return (
    <div className={formStyles.stack}>
      <p className={formStyles.hint}>
        Raise the minimum only when older installs must stop. A normal release can ship without changing it.
      </p>
      {fieldError && <p className={formStyles.error}>{fieldError}</p>}
      <div className={formStyles.row2}>
        {PLATFORMS.map((platform) => {
          const form = forms.find((item) => item.platform === platform);
          const label = platformLabel(platform);
          if (!form) {
            return (
              <Card key={platform} title={label}>
                <p className={formStyles.hint}>No version policy for this platform.</p>
              </Card>
            );
          }
          return (
            <Card
              key={platform}
              title={label}
              subtitle={form.updatedAt ? `Updated ${formatRelativeTime(form.updatedAt)}` : undefined}
            >
              <div className={formStyles.stack}>
                <div className={formStyles.field}>
                  <label className={formStyles.label} htmlFor={`${platform}-min-version`}>
                    Minimum version
                  </label>
                  <input
                    id={`${platform}-min-version`}
                    className={formStyles.input}
                    value={form.minVersion}
                    onChange={(event) => updateField(platform, 'minVersion', event.target.value)}
                    inputMode="decimal"
                    autoComplete="off"
                  />
                  <p className={formStyles.hint}>
                    Anyone on {label} below this version is blocked. Leave it unchanged for a normal release, and publish the store build before raising it.
                  </p>
                </div>
                <div className={formStyles.field}>
                  <label className={formStyles.label} htmlFor={`${platform}-store-url`}>
                    Store URL
                  </label>
                  <input
                    id={`${platform}-store-url`}
                    className={formStyles.input}
                    value={form.storeUrl}
                    onChange={(event) => updateField(platform, 'storeUrl', event.target.value)}
                    inputMode="url"
                    autoComplete="off"
                  />
                </div>
                <div className={formStyles.field}>
                  <label className={formStyles.label} htmlFor={`${platform}-title`}>
                    Title
                  </label>
                  <input
                    id={`${platform}-title`}
                    className={formStyles.input}
                    value={form.title}
                    onChange={(event) => updateField(platform, 'title', event.target.value)}
                    maxLength={120}
                  />
                </div>
                <div className={formStyles.field}>
                  <label className={formStyles.label} htmlFor={`${platform}-message`}>
                    Message
                  </label>
                  <textarea
                    id={`${platform}-message`}
                    className={formStyles.textarea}
                    value={form.message}
                    onChange={(event) => updateField(platform, 'message', event.target.value)}
                    maxLength={500}
                  />
                </div>
                <Button onClick={() => requestSave(form)}>Save {label}</Button>
              </div>
            </Card>
          );
        })}
      </div>
      <ConfirmationDialog
        open={Boolean(pending)}
        onClose={() => {
          if (!updatePolicy.isPending) setPending(null);
        }}
        onConfirm={() => {
          void handleConfirm();
        }}
        title={pending ? `Require this ${platformLabel(pending.platform)} version?` : 'Require this version?'}
        message={
          pending
            ? `Anyone on ${platformLabel(pending.platform)} below ${pending.minVersion} must update before the app opens.`
            : ''
        }
        confirmLabel={updatePolicy.isPending ? 'Saving...' : 'Save'}
      />
    </div>
  );
};
