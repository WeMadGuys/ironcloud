'use client';

import { useState } from 'react';

import { Badge, Button, Card } from '@/components';
import { useToast } from '@/components/Toast/ToastProvider';
import { trpc } from '@/lib/trpc';

import assignStyles from './CommunityDetailPage.module.css';
import styles from './CommunityCrmCards.module.css';

type Props = {
  communityId: string;
};

const emptyForm = () => ({ name: '', position: '', phone: '', email: '', isPrimary: false });

export const CommunityContactsCard = ({ communityId }: Props) => {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const contactsQuery = trpc.communities.listContacts.useQuery(
    { communityId },
    { refetchOnWindowFocus: false },
  );

  const closeForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setFormOpen(false);
  };

  const refresh = () => utils.communities.listContacts.invalidate({ communityId });

  const createMutation = trpc.communities.createContact.useMutation({
    onSuccess: async () => {
      toast('Contact added', 'success');
      closeForm();
      await refresh();
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const updateMutation = trpc.communities.updateContact.useMutation({
    onSuccess: async () => {
      toast('Contact updated', 'success');
      closeForm();
      await refresh();
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const deleteMutation = trpc.communities.deleteContact.useMutation({
    onSuccess: async () => {
      toast('Contact removed', 'success');
      await refresh();
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const contacts = contactsQuery.data ?? [];
  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const handleSave = () => {
    const payload = {
      name: form.name.trim(),
      position: form.position,
      phone: form.phone,
      email: form.email.trim(),
      isPrimary: form.isPrimary,
    };
    if (!payload.name) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, communityId, ...payload });
    } else {
      createMutation.mutate({ communityId, ...payload });
    }
  };

  const startEdit = (contact: (typeof contacts)[number]) => {
    setEditingId(contact.id);
    setForm({
      name: contact.name,
      position: contact.position ?? '',
      phone: contact.phone ?? '',
      email: contact.email ?? '',
      isPrimary: contact.is_primary,
    });
    setFormOpen(true);
  };

  return (
    <Card
      title="Contacts"
      subtitle={
        contactsQuery.isLoading
          ? 'Loading…'
          : `${contacts.length} contact${contacts.length === 1 ? '' : 's'}`
      }
    >
      <div className={assignStyles.assignPanel}>
        {contactsQuery.isLoading ? (
          <p className={assignStyles.statusLine}>Loading contacts…</p>
        ) : contacts.length === 0 ? (
          <div className={assignStyles.emptyBox}>
            <p className={assignStyles.emptyTitle}>No contacts yet</p>
            <p className={assignStyles.emptyHint}>
              Add the FM, secretary or committee members you work with.
            </p>
          </div>
        ) : (
          <ul className={assignStyles.assignedList}>
            {contacts.map((contact) => (
              <li key={contact.id} className={styles.item}>
                <div className={styles.itemBody}>
                  <p className={styles.itemTitle}>
                    {contact.name}
                    {contact.is_primary ? (
                      <>
                        {' '}
                        <Badge variant="success">Primary</Badge>
                      </>
                    ) : null}
                  </p>
                  <div className={styles.itemMeta}>
                    {contact.position ? <span>{contact.position}</span> : null}
                    {contact.phone ? (
                      <a className={styles.link} href={`tel:${contact.phone}`}>
                        {contact.phone}
                      </a>
                    ) : null}
                    {contact.email ? (
                      <a className={styles.link} href={`mailto:${contact.email}`}>
                        {contact.email}
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className={styles.itemActions}>
                  {!contact.is_primary ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isMutating}
                      onClick={() =>
                        updateMutation.mutate({ id: contact.id, communityId, isPrimary: true })
                      }
                    >
                      Make primary
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isMutating}
                    onClick={() => startEdit(contact)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={isMutating}
                    onClick={() => deleteMutation.mutate({ id: contact.id, communityId })}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className={assignStyles.assignBox}>
          {formOpen ? (
            <div className={styles.form}>
              <p className={assignStyles.assignLabel}>
                {editingId ? 'Edit contact' : 'Add contact'}
              </p>
              <div className={styles.formRow}>
                <input
                  className={assignStyles.assignSelect}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Name *"
                  aria-label="Contact name"
                />
                <input
                  className={assignStyles.assignSelect}
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                  placeholder="Position, e.g. Facility Manager"
                  aria-label="Position"
                />
              </div>
              <div className={styles.formRow}>
                <input
                  type="tel"
                  inputMode="tel"
                  className={assignStyles.assignSelect}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="Contact number"
                  aria-label="Contact number"
                />
                <input
                  type="email"
                  className={assignStyles.assignSelect}
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="Email (optional)"
                  aria-label="Email"
                />
              </div>
              <label className={assignStyles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={form.isPrimary}
                  onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                />
                Primary contact
              </label>
              <div className={styles.formActions}>
                <Button onClick={handleSave} disabled={isMutating || !form.name.trim()}>
                  {isMutating ? 'Saving…' : editingId ? 'Save' : 'Add contact'}
                </Button>
                <Button variant="secondary" onClick={closeForm} disabled={isMutating}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                setForm({ ...emptyForm(), isPrimary: contacts.length === 0 });
                setFormOpen(true);
              }}
            >
              Add contact
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
