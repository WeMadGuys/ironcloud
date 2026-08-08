import Link from 'next/link';
import type { ReactNode } from 'react';

import buttonStyles from '@/components/Button/Button.module.css';

type LandingLinkButtonProps = {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  'aria-label'?: string;
};

export function LandingLinkButton({
  href,
  children,
  variant = 'primary',
  size = 'lg',
  className,
  'aria-label': ariaLabel,
}: LandingLinkButtonProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={`${buttonStyles.button} ${buttonStyles[variant]} ${buttonStyles[size]} ${className ?? ''}`}
    >
      {children}
    </Link>
  );
}
