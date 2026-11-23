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

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Label image: apartment name, QR (box code only), then box code. */
function buildBoxQrLabel(qrUrl: string, apartment: string, boxCode: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const width = 360;
      const padX = 24;
      const padY = 20;
      const qrSize = 280;
      const gap = 12;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas unavailable'));
        return;
      }

      const fontFamily = getComputedStyle(document.body).fontFamily || 'sans-serif';
      ctx.font = `600 20px ${fontFamily}`;
      const nameLines = apartment
        ? wrapCanvasLines(ctx, apartment, width - padX * 2)
        : [];
      const nameLineHeight = 26;
      const codeLineHeight = 34;
      const nameBlock = nameLines.length * nameLineHeight;
      const height =
        padY +
        nameBlock +
        (nameLines.length ? gap : 0) +
        qrSize +
        gap +
        codeLineHeight +
        padY;

      canvas.width = width;
      canvas.height = height;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#101828';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = `600 20px ${fontFamily}`;
      nameLines.forEach((line, index) => {
        ctx.fillText(line, width / 2, padY + index * nameLineHeight);
      });

      const qrY = padY + nameBlock + (nameLines.length ? gap : 0);
      ctx.drawImage(img, (width - qrSize) / 2, qrY, qrSize, qrSize);
      ctx.font = `700 26px ${fontFamily}`;
      ctx.fillText(boxCode, width / 2, qrY + qrSize + gap);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('QR image failed'));
    img.src = qrUrl;
  });
}

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
  const [deleteRequest, setDeleteRequest] = useState<{ row: BoxListRow; force: boolean } | null>(null);
  const [deleteMenu, setDeleteMenu] = useState<{
    row: BoxListRow;
    top: number;
    left: number;
  } | null>(null);
  const deleteMenuRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState(emptyForm);
  const [qrBox, setQrBox] = useState<BoxListRow | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const pageSize = 25;

  const createMutation = trpc.boxes.create.useMutation();
  const updateMutation = trpc.boxes.update.useMutation();
  const deactivateMutation = trpc.boxes.deactivate.useMutation();
  const deleteMutation = trpc.boxes.delete.useMutation();

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
    if (!deleteMenu) return;

    const close = () => setDeleteMenu(null);
    const onPointer = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (deleteMenuRef.current?.contains(target as Node)) return;
      if (target?.closest('[data-box-delete-trigger]')) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    window.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [deleteMenu]);

  useEffect(() => {
    if (!qrBox) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    const apartment = qrBox.communityName?.trim() ?? '';
    QRCode.toDataURL(qrBox.boxCode, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
      .then((url) => buildBoxQrLabel(url, apartment, qrBox.boxCode))
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
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

  const openDeleteMenu = (row: BoxListRow, button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = 84;
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
    const top =
      rect.bottom + 4 + menuHeight > window.innerHeight
        ? Math.max(8, rect.top - menuHeight - 4)
        : rect.bottom + 4;

    setDeleteMenu((current) => (current?.row.id === row.id ? null : { row, top, left }));
  };

  const chooseDelete = (force: boolean) => {
    if (!deleteMenu) return;
    const row = deleteMenu.row;
    setDeleteMenu(null);
    if (!force && row.status === 'OCCUPIED') {
      toast('This box is occupied. Choose Force delete to remove it anyway.', 'error');
      return;
    }
    setDeleteRequest({ row, force });
  };

  const handleDelete = () => {
    if (!deleteRequest) return;
    deleteMutation.mutate(
      { id: deleteRequest.row.id, force: deleteRequest.force },
      {
        onSuccess: () => {
          toast(deleteRequest.force ? 'Box force deleted' : 'Box deleted', 'success');
          setDeleteRequest(null);
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
                      <Button
                        variant="ghost"
                        size="sm"
                        data-box-delete-trigger
                        aria-haspopup="menu"
                        aria-expanded={deleteMenu?.row.id === row.id}
                        onClick={(event) => openDeleteMenu(row, event.currentTarget)}
                      >
                        Delete
                      </Button>
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

      {deleteMenu ? (
        <div
          ref={deleteMenuRef}
          className={styles.menu}
          role="menu"
          style={{ top: deleteMenu.top, left: deleteMenu.left }}
        >
          <button type="button" className={styles.menuItem} role="menuitem" onClick={() => chooseDelete(false)}>
            Delete
          </button>
          <button type="button" className={styles.menuItem} role="menuitem" onClick={() => chooseDelete(true)}>
            Force delete
          </button>
        </div>
      ) : null}

      <ConfirmationDialog
        open={Boolean(deactivateId)}
        onClose={() => setDeactivateId(null)}
        onConfirm={handleDeactivate}
        title="Deactivate box?"
        confirmLabel="Deactivate"
        danger
        message="This box will no longer be available for attach. Occupied boxes cannot be deactivated."
      />

      <ConfirmationDialog
        open={Boolean(deleteRequest)}
        onClose={() => setDeleteRequest(null)}
        onConfirm={handleDelete}
        title={deleteRequest?.force ? 'Force delete box?' : 'Delete box?'}
        confirmLabel={deleteRequest?.force ? 'Force delete' : 'Delete'}
        danger
        message={
          deleteRequest?.force
            ? deleteRequest.row.status === 'OCCUPIED'
              ? `${deleteRequest.row.boxCode} is occupied${
                  deleteRequest.row.currentOrderNumber
                    ? ` by ${deleteRequest.row.currentOrderNumber}`
                    : ''
                }. Force delete removes the box and detaches it from that order.`
              : `${deleteRequest.row.boxCode} will be permanently removed, including its assignment history.`
            : `${deleteRequest?.row.boxCode ?? 'This box'} will be permanently removed. Occupied boxes need Force delete.`
        }
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
            Print and attach to the physical box. The QR itself is still only the box code.
          </p>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={`QR for ${qrBox?.communityName ?? 'box'} ${qrBox?.boxCode ?? ''}`}
              className={styles.qrImage}
            />
          ) : (
            <Loader />
          )}
        </div>
      </Modal>
    </div>
  );
};
