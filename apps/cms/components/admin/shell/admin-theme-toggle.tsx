'use client';

import * as React from 'react';
import { ComputerDesktopIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { Modal } from '@/components/site/modal';
import { useAdminT } from '@/lib/i18n/admin/context';
import { applyTheme, readTheme, storeTheme, type ThemePreference } from '@/lib/theme';
import { iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'light', label: 'theme.light', icon: SunIcon },
  { value: 'dark', label: 'theme.dark', icon: MoonIcon },
  { value: 'system', label: 'theme.system', icon: ComputerDesktopIcon },
] as const satisfies readonly {
  value: ThemePreference;
  label: 'theme.light' | 'theme.dark' | 'theme.system';
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}[];

/** Keeps the admin's colour preference in the same browser setting as the guest site. */
export function AdminThemeToggle({ labelled = false }: { labelled?: boolean }) {
  const t = useAdminT();
  const [open, setOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<ThemePreference | null>(null);

  React.useEffect(() => setTheme(readTheme()), []);

  React.useEffect(() => {
    if (theme !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme('system');
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [theme]);

  const choose = (next: ThemePreference) => {
    setTheme(next);
    storeTheme(next);
    applyTheme(next);
  };

  const TriggerIcon = theme === 'dark' ? MoonIcon : theme === 'light' ? SunIcon : ComputerDesktopIcon;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('theme.appearance')}
        title={t('theme.appearance')}
        className={labelled ? 'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent' : iconButton('light')}
      >
        <TriggerIcon className="size-5" aria-hidden="true" />
        {labelled ? t('theme.appearance') : null}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('theme.appearance')} className="sm:max-w-sm">
        <div
          role="radiogroup"
          aria-label={t('theme.appearance')}
          className="grid grid-cols-3 gap-1 rounded-2xl bg-stone/60 p-1"
        >
          {OPTIONS.map((option) => {
            const selected = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => choose(option.value)}
                className={cn(
                  'flex min-h-12 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition-colors',
                  selected ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <option.icon className="size-5" aria-hidden="true" />
                {t(option.label)}
              </button>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
