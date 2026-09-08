'use client';

import * as React from 'react';
import { GlobeAltIcon } from '@heroicons/react/24/outline';
import { Modal } from '@/components/site/modal';
import { cn } from '@/lib/utils';

/**
 * Language and region, picked the way the large travel sites do it: a globe in
 * the header opening a grid of languages with their region underneath.
 *
 * The choice is remembered per browser. Translating the interface itself is
 * the next step — until then the picker says so rather than pretending.
 */

const STORAGE_KEY = 'staysphere:locale';

interface Language {
  code: string;
  label: string;
  region: string;
}

const languages: Language[] = [
  { code: 'en', label: 'English', region: 'United Kingdom' },
  { code: 'ru', label: 'Русский', region: 'Россия' },
  { code: 'hr', label: 'Hrvatski', region: 'Hrvatska' },
  { code: 'de', label: 'Deutsch', region: 'Deutschland' },
  { code: 'fr', label: 'Français', region: 'France' },
  { code: 'it', label: 'Italiano', region: 'Italia' },
  { code: 'es', label: 'Español', region: 'España' },
  { code: 'pl', label: 'Polski', region: 'Polska' },
];

export function LanguagePicker() {
  const [open, setOpen] = React.useState(false);
  const [locale, setLocale] = React.useState('en');

  // Read after mount: the server cannot know the browser's stored choice, and
  // reading it during render would break hydration.
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && languages.some((language) => language.code === stored)) setLocale(stored);
    } catch {
      // A browser with storage blocked simply stays on the default.
    }
  }, []);

  const active = languages.find((language) => language.code === locale) ?? languages[0]!;

  const choose = (code: string) => {
    setLocale(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Not being able to remember it is not a reason to refuse the choice.
    }
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Language and region: ${active.label}`}
        // A bare 16px glyph on a phone read as decoration, not a button. It
        // gets the frame every other icon control in the product has, and a
        // mark big enough to recognise.
        className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-stone sm:px-3.5"
      >
        <GlobeAltIcon className="size-5" aria-hidden="true" />
        <span className="hidden sm:inline">{active.code.toUpperCase()}</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Language and region">
        <div className="grid gap-2 sm:grid-cols-2">
          {languages.map((language) => {
            const selected = language.code === active.code;
            return (
              <button
                key={language.code}
                type="button"
                onClick={() => choose(language.code)}
                aria-pressed={selected}
                className={cn(
                  'cursor-pointer rounded-2xl border p-3 text-left transition-colors',
                  selected ? 'border-primary bg-stone' : 'border-transparent hover:bg-stone',
                )}
              >
                <span className="block text-sm font-medium">{language.label}</span>
                <span className="block text-xs text-muted-foreground">{language.region}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          Demo: your choice is remembered on this device. The interface itself is still English —
          translations land with the next step.
        </p>
      </Modal>
    </>
  );
}
