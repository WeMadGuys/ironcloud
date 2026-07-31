'use client';

import type { ReactNode } from 'react';

import { Button } from '../Button/Button';
import { Modal } from '../Modal/Modal';

type CreateEntityModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  size?: 'default' | 'wide' | 'xwide';
};

export const CreateEntityModal = ({
  open,
  onClose,
  title,
  children,
  onSubmit,
  submitLabel = 'Create',
  submitting = false,
  submitDisabled = false,
  size = 'default',
}: CreateEntityModalProps) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    size={size}
    footer={
      <>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={submitting || submitDisabled}>
          {submitting ? 'Creating...' : submitLabel}
        </Button>
      </>
    }
  >
    {children}
  </Modal>
);
