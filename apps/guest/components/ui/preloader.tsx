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
  const id = React.useId();
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
        <svg className="preloader-orb" viewBox="0 0 64 64" fill="none">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="currentColor" stopOpacity="0.35" />
              <stop offset="0.55" stopColor="currentColor" />
            </linearGradient>
          </defs>
          <g transform="rotate(-24 32 32)" stroke={`url(#${id})`} strokeWidth="3.4" strokeLinecap="round">
            {[10, 19, 27, 30, 27, 19, 10].map((radius, index) => (
              <ellipse
                key={index}
                cx="32"
                cy={6 + index * 8.6}
                rx={radius}
                ry={Math.max(2.5, radius * 0.23)}
                pathLength="100"
                className="preloader-band"
                style={{ '--band-offset': index * -13 } as React.CSSProperties}
              />
            ))}
          </g>
        </svg>
        <span className="preloader-wordmark">
          <img src="/brand/staysphere-logo-on-light.svg" alt="" className="dark:hidden" />
          <img src="/brand/staysphere-logo.svg" alt="" className="hidden dark:block" />
        </span>
      </span>
      <span className="preloader-label">{label}</span>
    </span>
  );
}
