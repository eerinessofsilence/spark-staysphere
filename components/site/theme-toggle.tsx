'use client';

import * as React from 'react';
import { ComputerDesktopIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import {
  applyTheme,
  readTheme,
  storeTheme,
  type ThemePreference,
} from '@/lib/theme';
import { cn } from '@/lib/utils';

const options: { value: ThemePreference; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'System', icon: ComputerDesktopIcon },
];

/**
 * Day, night, or whatever the machine says. The class is already on `<html>`
 * before this mounts (see `THEME_BOOTSTRAP`); this only reads the stored
 * choice back so the right segment is lit, and writes the new one.
 */
export function ThemeToggle() {
  const [theme, setTheme] = React.useState<ThemePreference | null>(null);

  React.useEffect(() => setTheme(readTheme()), []);

  // Only while following the system: the OS switching at dusk should move the
  // page with it, but never override a visitor who picked a side.
  React.useEffect(() => {
    if (theme !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => applyTheme('system');
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [theme]);

  const choose = (next: ThemePreference) => {
    setTheme(next);
    storeTheme(next);
    applyTheme(next);
  };

  return (
    <div>
      <p className="mb-2 px-3 text-xs text-muted-foreground">Appearance</p>
      <div
        role="radiogroup"
        aria-label="Appearance"
        className="grid grid-cols-3 gap-1 rounded-2xl bg-stone/60 p-1"
      >
        {options.map((option) => {
          // Before the effect runs nothing is selected rather than the wrong
          // thing: the stored choice is not knowable while rendering on the
          // server, and a guessed highlight would flip under the visitor.
          const selected = theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(option.value)}
              className={cn(
                'flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition-colors',
                selected ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <option.icon className="size-4" aria-hidden="true" />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
