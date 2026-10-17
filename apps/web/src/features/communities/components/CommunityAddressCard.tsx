'use client';

import { useState } from 'react';

import { Button, Card } from '@/components';
import { useToast } from '@/components/Toast/ToastProvider';
import { trpc } from '@/lib/trpc';

import assignStyles from './CommunityDetailPage.module.css';
import styles from './CommunityCrmCards.module.css';

type Address = {
  name: string;
  city: string;
  address_line: string | null;
  locality: string | null;
  pincode: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
};

type Props = {
  communityId: string;
  community: Address;
  onSaved: () => void;
};

const toForm = (community: Address) => ({
  addressLine: community.address_line ?? '',
  locality: community.locality ?? '',
  pincode: community.pincode ?? '',
  state: community.state ?? '',
  latitude: community.latitude != null ? String(community.latitude) : '',
  longitude: community.longitude != null ? String(community.longitude) : '',
});

const parseCoordinate = (value: string) => (value.trim() === '' ? null : Number(value));

const mapsUrl = (community: Address) => {
  if (community.latitude != null && community.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${community.latitude},${community.longitude}`;
  }
  const query = [
    community.name,
    community.address_line,
    community.locality,
    community.city,
    community.state,
    community.pincode,
  ]
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

export const CommunityAddressCard = ({ communityId, community, onSaved }: Props) => {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => toForm(community));

  const updateMutation = trpc.communities.updateAddress.useMutation({
    onSuccess: () => {
      toast('Address saved', 'success');
      setEditing(false);
      onSaved();
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const latitude = parseCoordinate(form.latitude);
  const longitude = parseCoordinate(form.longitude);
  const pincodeInvalid = form.pincode.trim() !== '' && !/^\d{6}$/.test(form.pincode.trim());
  const latitudeInvalid =
    latitude !== null && (Number.isNaN(latitude) || latitude < -90 || latitude > 90);
  const longitudeInvalid =
    longitude !== null && (Number.isNaN(longitude) || longitude < -180 || longitude > 180);
  const formInvalid = pincodeInvalid || latitudeInvalid || longitudeInvalid;

  const hasAddress = Boolean(
    community.address_line || community.locality || community.pincode || community.state,
  );
  const hasCoordinates = community.latitude != null && community.longitude != null;

  const handleSave = () => {
    if (formInvalid) return;
    updateMutation.mutate({
      id: communityId,
      addressLine: form.addressLine,
      locality: form.locality,
      pincode: form.pincode.trim(),
      state: form.state,
      latitude,
      longitude,
    });
  };

  return (
    <Card
      title="Address"
      subtitle={community.pincode ? `Pincode ${community.pincode}` : 'Used for the community map'}
    >
      <div className={assignStyles.assignPanel}>
        {editing ? (
          <div className={styles.form}>
            <input
              className={assignStyles.assignSelect}
              value={form.addressLine}
              onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))}
              placeholder="Street / road"
              aria-label="Address"
            />
            <div className={styles.formRow}>
              <input
                className={assignStyles.assignSelect}
                value={form.locality}
                onChange={(e) => setForm((f) => ({ ...f, locality: e.target.value }))}
                placeholder="Locality / area"
                aria-label="Locality"
              />
              <input
                className={assignStyles.assignSelect}
                value={form.pincode}
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                placeholder="Pincode"
                aria-label="Pincode"
              />
            </div>
            <input
              className={assignStyles.assignSelect}
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              placeholder="State"
              aria-label="State"
            />
            <div className={styles.formRow}>
              <input
                className={assignStyles.assignSelect}
                value={form.latitude}
                inputMode="decimal"
                onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                placeholder="Latitude (optional)"
                aria-label="Latitude"
              />
              <input
                className={assignStyles.assignSelect}
                value={form.longitude}
                inputMode="decimal"
                onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                placeholder="Longitude (optional)"
                aria-label="Longitude"
              />
            </div>
            {pincodeInvalid ? (
              <p className={assignStyles.statusLine}>Pincode must be 6 digits.</p>
            ) : null}
            {latitudeInvalid || longitudeInvalid ? (
              <p className={assignStyles.statusLine}>
                Latitude must be between -90 and 90, longitude between -180 and 180.
              </p>
            ) : null}
            <div className={styles.formActions}>
              <Button onClick={handleSave} disabled={formInvalid || updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving…' : 'Save address'}
              </Button>
              <Button
                variant="secondary"
                disabled={updateMutation.isPending}
                onClick={() => {
                  setForm(toForm(community));
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {hasAddress || hasCoordinates ? (
              <p className={styles.addressLines}>
                {community.address_line ? (
                  <>
                    {community.address_line}
                    <br />
                  </>
                ) : null}
                {[community.locality, community.city].filter(Boolean).join(', ')}
                <br />
                {[community.state, community.pincode].filter(Boolean).join(' – ')}
                {hasCoordinates ? (
                  <>
                    <br />
                    {community.latitude}, {community.longitude}
                  </>
                ) : null}
              </p>
            ) : (
              <div className={assignStyles.emptyBox}>
                <p className={assignStyles.emptyTitle}>No address yet</p>
                <p className={assignStyles.emptyHint}>
                  Add a pincode so this community can appear on the map later.
                </p>
              </div>
            )}
            <div className={styles.formActions}>
              <Button
                variant="secondary"
                onClick={() => {
                  setForm(toForm(community));
                  setEditing(true);
                }}
              >
                {hasAddress ? 'Edit address' : 'Add address'}
              </Button>
              {hasAddress || hasCoordinates ? (
                <a
                  className={styles.link}
                  href={mapsUrl(community)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Google Maps
                </a>
              ) : null}
            </div>
          </>
        )}
      </div>
    </Card>
  );
};
