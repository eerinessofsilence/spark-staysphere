'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import './preloader.css';

export function Preloader({
  active = true,
  label,
  size = 'compact',
  delay = 250,
  className,
}: {
  active?: boolean;
  label: string;
  size?: 'compact' | 'page';
  delay?: number;
  className?: string;
}) {
  const [visible, setVisible] = React.useState(delay === 0);

  React.useEffect(() => {
    setVisible(false);
    if (!active) return;
    if (delay === 0) {
      setVisible(true);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [active, delay]);

  if (!active || (!visible && delay !== 0)) return null;

  return (
    <span role="status" aria-live="polite" className={cn('preloader', `preloader--${size}`, className)}>
      <span className="preloader-brand" aria-hidden="true">
        <img src="/brand/staysphere-logo.svg" alt="" className="preloader-logo" />
      </span>
      <span className="preloader-label">{label}</span>
    </span>
  );
}
