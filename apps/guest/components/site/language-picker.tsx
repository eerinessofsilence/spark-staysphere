'use client';

import * as React from 'react';
import { CheckIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { useLocale, useT } from '@/lib/i18n/context';
import { LOCALES, type Locale } from '@/lib/i18n/locale';
import { cn } from '@/lib/utils';

const LANGUAGE_NAME: Record<Locale, string> = {
  en: 'English',
  ru: 'Русский',
  hr: 'Hrvatski',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  es: 'Español',
  pl: 'Polski',
};

export function LanguagePicker() {
  const [open, setOpen] = React.useState(false);
  const { locale, setLocale } = useLocale();
  const t = useT();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const choose = (next: Locale) => {
    setLocale(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('language.title')}: ${LANGUAGE_NAME[locale]}`}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-border bg-card transition-colors hover:bg-stone sm:size-12"
      >
        <GlobeAltIcon className="size-5" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="group"
          aria-label={t('language.title')}
          className="absolute right-0 top-full z-50 mt-4 max-h-[196px] w-52 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-3xl border border-border bg-card p-2 shadow-soft-lg"
        >
          {LOCALES.map((code) => {
            const selected = code === locale;
            return (
              <button
                key={code}
                type="button"
                aria-pressed={selected}
                onClick={() => choose(code)}
                className={cn(
                  'flex min-h-11 w-full cursor-pointer items-center justify-between rounded-full px-3 text-left text-sm transition-colors hover:bg-stone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  selected ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {LANGUAGE_NAME[code]}
                {selected ? <CheckIcon className="size-4" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
