'use client';

import * as React from 'react';
import type { Currency } from '@/lib/domain/schemas';
import { INTL_TAGS, type Locale } from '@/lib/i18n/locale';

/** A short, one-shot count-up for large monetary figures. */
export function AnimatedMoney({ amount, currency, locale }: { amount: number; currency: Currency; locale: Locale }) {
  const [displayAmount, setDisplayAmount] = React.useState(0);
  const formatter = React.useMemo(() => new Intl.NumberFormat(INTL_TAGS[locale], {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }), [currency, locale]);
  const finalValue = formatter.format(amount);

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || amount === 0) {
      setDisplayAmount(amount);
      return;
    }

    const duration = 1100;
    let frame = 0;
    let startedAt: number | null = null;
    const animate = (now: number) => {
      startedAt ??= now;
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - (1 - progress) ** 4;
      setDisplayAmount(amount * eased);
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [amount]);

  return (
    <>
      <span aria-hidden="true">{formatter.format(displayAmount)}</span>
      <span className="sr-only">{finalValue}</span>
    </>
  );
}
