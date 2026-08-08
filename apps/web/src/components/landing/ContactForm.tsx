'use client';

import { FormEvent, useState } from 'react';

import { Button } from '@/components/Button/Button';
import { SUPPORT_EMAIL } from '@/constants/marketing';

import styles from './ContactForm.module.css';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const subject = encodeURIComponent(`Iron Cloud enquiry from ${name.trim() || 'website visitor'}`);
    const body = encodeURIComponent(
      [`Name: ${name.trim()}`, `Email: ${email.trim()}`, '', message.trim()].join('\n'),
    );

    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate={false}>
      <div className={styles.field}>
        <label htmlFor="contact-name">Name</label>
        <input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="contact-email">Email</label>
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="contact-message">Message</label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          required
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>

      <Button type="submit" variant="primary" size="lg" className={styles.submit}>
        Send message
      </Button>

      {submitted ? (
        <p className={styles.success} role="status">
          Your email client should open shortly. If it does not, write to{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      ) : null}
    </form>
  );
}
