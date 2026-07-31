'use client';

import Icon from '@mdi/react';
import { mdiClose } from '@mdi/js';
import { useEffect, type ReactNode } from 'react';

import { Button } from '../Button/Button';
import styles from './Modal.module.css';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Wider dialog for long forms / grids */
  size?: 'default' | 'wide' | 'xwide';
  /** Raise above another open modal (e.g. nested picker) */
  stacked?: boolean;
};

export const Modal = ({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'default',
  stacked = false,
}: ModalProps) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass =
    size === 'xwide' ? styles.modalXWide : size === 'wide' ? styles.modalWide : '';

  return (
    <div
      className={`${styles.overlay} ${stacked ? styles.overlayStacked : ''}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`${styles.modal} ${sizeClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="modal-title" className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <Icon path={mdiClose} size={0.9} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
};

export const ConfirmationDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <p>{message}</p>
  </Modal>
);
