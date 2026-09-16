'use client';

import * as React from 'react';
import { GlobeAltIcon } from '@heroicons/react/24/outline';
import { useLocale, useT } from '@/lib/i18n/context';
import { LOCALES, type Locale } from '@/lib/i18n/locale';
import { Modal } from '@/components/site/modal';
import { cn } from '@/lib/utils';

/**
 * Language and region, picked the way the large travel sites do it: a globe in
 * the header opening a grid of languages with their region underneath.
 *
 * Picking one actually switches the interface — `LocaleProvider` (see
 * `lib/i18n/context.tsx`) holds the choice and every guest page reads it.
 */

const REGION: Record<Locale, string> = {
  en: 'United Kingdom',
  ru: 'Россия',
  hr: 'Hrvatska',
  de: 'Deutschland',
  fr: 'France',
  it: 'Italia',
  es: 'España',
  pl: 'Polska',
};

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

  const choose = (next: Locale) => {
    setLocale(next);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${t('language.title')}: ${LANGUAGE_NAME[locale]}`}
        // A bare 16px glyph on a phone read as decoration, not a button. It
        // gets the frame every other icon control in the product has, and a
        // mark big enough to recognise.
        className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-stone sm:px-3.5"
      >
        <GlobeAltIcon className="size-5" aria-hidden="true" />
        <span className="hidden sm:inline">{locale.toUpperCase()}</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t('language.title')}>
        <div className="grid gap-2 sm:grid-cols-2">
          {LOCALES.map((code) => {
            const selected = code === locale;
            return (
              <button
                key={code}
                type="button"
                onClick={() => choose(code)}
                aria-pressed={selected}
                className={cn(
                  'cursor-pointer rounded-2xl border p-3 text-left transition-colors',
                  selected ? 'border-primary bg-stone' : 'border-transparent hover:bg-stone',
                )}
              >
                <span className="block text-sm font-medium">{LANGUAGE_NAME[code]}</span>
                <span className="block text-xs text-muted-foreground">{REGION[code]}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{t('language.note')}</p>
      </Modal>
    </>
  );
}
