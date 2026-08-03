'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

import {
  Badge,
  Button,
  ConfirmationDialog,
  CreateEntityModal,
  EmptyState,
  Loader,
  Modal,
  Pagination,
  SearchInput,
  Table,
} from '@/components';
import { useToast } from '@/components/Toast/ToastProvider';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { trpc } from '@/lib/trpc';
import { fetchCommunityOptions, type CommunityOption } from '@/features/communities/services/communities.service';

import { fetchBoxes, type BoxListRow } from '../services/boxes.service';

import formStyles from '@/styles/form.module.css';
import pageStyles from '@/styles/pages.module.css';
import styles from './BoxesListPage.module.css';

const emptyForm = () => ({
  boxCode: '',
  communityId: '',
});

export const BoxesListPage = () => {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [communityId, setCommunityId] = useState('');
  const [status, setStatus] = useState<'ALL' | 'AVAILABLE' | 'OCCUPIED'>('ALL');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [data, setData] = useState<BoxListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BoxListRow | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [qrBox, setQrBox] = useState<BoxListRow | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const pageSize = 25;

  const createMutation = trpc.boxes.create.useMutation();
  const updateMutation = trpc.boxes.update.useMutation();
  const deactivateMutation = trpc.boxes.deactivate.useMutation();

  const load = useCallback(() => {
    if (hasLoadedRef.current) setRefreshing(true);
    else setLoading(true);

    fetchBoxes({
      page,
      pageSize,
      search: debouncedSearch || undefined,
      communityId: communityId || undefined,
      status,
      includeInactive,
    }).then((res) => {
      setData(res.data);
      setTotal(res.total);
      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }).catch((err: Error) => {
      toast(err.message || 'Failed to load boxes', 'error');
      setLoading(false);
      setRefreshing(false);
    });
  }, [page, debouncedSearch, communityId, status, includeInactive, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchCommunityOptions().then(setCommunities);
  }, []);

  useEffect(() => {
    if (!qrBox) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(qrBox.boxCode, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: 'M',
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    }).catch(() => {
      if (!cancelled) setQrDataUrl(null);
    });
    return () => {
      cancelled = true;
    };
  }, [qrBox]);

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm());
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (row: BoxListRow) => {
    setEditing(row);
    setForm({
      boxCode: row.boxCode,
      communityId: row.communityId,
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.boxCode.trim() || !form.communityId) {
      toast('Box code and community are required', 'error');
      return;
    }

    if (editing) {
      updateMutation.mutate(
        {
          id: editing.id,
          boxCode: form.boxCode.trim().toUpperCase(),
          communityId: form.communityId,
        },
        {
          onSuccess: () => {
            toast('Box updated', 'success');
            closeModal();
            load();
          },
          onError: (err) => toast(err.message, 'error'),
        },
      );
      return;
    }

    createMutation.mutate(
      {
        boxCode: form.boxCode.trim().toUpperCase(),
        communityId: form.communityId,
      },
      {
        onSuccess: () => {
          toast('Box created', 'success');
          closeModal();
          load();
        },
        onError: (err) => toast(err.message, 'error'),
      },
    );
  };

  const handleDeactivate = () => {
    if (!deactivateId) return;
    deactivateMutation.mutate(
      { id: deactivateId },
      {
        onSuccess: () => {
          toast('Box deactivated', 'success');
          setDeactivateId(null);
          load();
        },
        onError: (err) => toast(err.message, 'error'),
      },
    );
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  if (loading) return <Loader fullPage />;

  return (
    <div>
      <div className={pageStyles.filters}>
        <SearchInput
          placeholder="Search by box code..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={styles.select}
          value={communityId}
          onChange={(e) => {
            setCommunityId(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by community"
        >
          <option value="">All communities</option>
          {communities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <option value="ALL">All statuses</option>
          <option value="AVAILABLE">Available</option>
          <option value="OCCUPIED">Occupied</option>
        </select>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => {
              setIncludeInactive(e.target.checked);
              setPage(1);
            }}
          />
          Show inactive
        </label>
        <div className={pageStyles.filtersAction}>
          <Button onClick={openCreate}>Add Box</Button>
        </div>
      </div>

      <div className={refreshing ? pageStyles.listRefreshing : undefined} aria-busy={refreshing}>
        {data.length === 0 ? (
          <EmptyState title="No boxes found" />
        ) : (
          <>
            <Table
              columns={[
                { key: 'boxCode', header: 'Box Code', render: (row) => row.boxCode },
                {
                  key: 'community',
                  header: 'Community',
                  render: (row) => row.communityName ?? '—',
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => (
                    <span className={styles.statusCell}>
                      <Badge
                        variant={row.status === 'AVAILABLE' ? 'success' : 'warning'}
                      >
                        {row.status}
                      </Badge>
                      {!row.isActive ? <Badge variant="default">INACTIVE</Badge> : null}
                    </span>
                  ),
                },
                {
                  key: 'order',
                  header: 'Current Order',
                  render: (row) =>
                    row.currentOrderId && row.currentOrderNumber ? (
                      <a href={`/admin/orders/${row.currentOrderId}`}>{row.currentOrderNumber}</a>
                    ) : (
                      '—'
                    ),
                },
                {
                  key: 'lastUsed',
                  header: 'Last Used',
                  render: (row) =>
                    row.lastUsedAt
                      ? new Date(row.lastUsedAt).toLocaleString()
                      : '—',
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (row) => (
                    <div className={styles.actions}>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setQrBox(row)}>
                        Generate QR
                      </Button>
                      {row.isActive ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeactivateId(row.id)}
                        >
                          Deactivate
                        </Button>
                      ) : null}
                    </div>
                  ),
                },
              ]}
              data={data}
              keyExtractor={(row) => row.id}
            />
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={Math.max(1, Math.ceil(total / pageSize))}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <CreateEntityModal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Box' : 'Add Box'}
        onSubmit={handleSave}
        submitLabel={editing ? 'Save' : 'Create'}
        submitting={saving}
        submitDisabled={saving}
      >
        <div className={formStyles.field}>
          <label htmlFor="boxCode">Box code</label>
          <input
            id="boxCode"
            className={formStyles.input}
            value={form.boxCode}
            onChange={(e) => setForm((f) => ({ ...f, boxCode: e.target.value.toUpperCase() }))}
            placeholder="AH-001"
            autoComplete="off"
          />
        </div>
        <div className={formStyles.field}>
          <label htmlFor="boxCommunity">Community</label>
          <select
            id="boxCommunity"
            className={formStyles.input}
            value={form.communityId}
            onChange={(e) => setForm((f) => ({ ...f, communityId: e.target.value }))}
          >
            <option value="">Select community</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </CreateEntityModal>

      <ConfirmationDialog
        open={Boolean(deactivateId)}
        onClose={() => setDeactivateId(null)}
        onConfirm={handleDeactivate}
        title="Deactivate box?"
        confirmLabel="Deactivate"
        danger
        message="This box will no longer be available for attach. Occupied boxes cannot be deactivated."
      />

      <Modal
        open={Boolean(qrBox)}
        onClose={() => setQrBox(null)}
        title={qrBox ? `QR — ${qrBox.boxCode}` : 'QR'}
        footer={
          qrDataUrl ? (
            <a
              className={styles.download}
              href={qrDataUrl}
              download={`${qrBox?.boxCode ?? 'box'}-qr.png`}
            >
              Download PNG
            </a>
          ) : null
        }
      >
        <div className={styles.qrBody}>
          <p className={styles.qrHint}>
            QR encodes only the box code. Print and attach to the physical box.
          </p>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={`QR for ${qrBox?.boxCode}`} className={styles.qrImage} />
          ) : (
            <Loader />
          )}
          <p className={styles.qrCode}>{qrBox?.boxCode}</p>
        </div>
      </Modal>
    </div>
  );
};
