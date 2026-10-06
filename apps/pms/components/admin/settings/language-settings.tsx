'use client';

import * as React from 'react';
import { setAdminLocaleAction } from '@/app/admin/actions';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { ADMIN_LANGUAGE_FLAG, ADMIN_LANGUAGE_NAME, ADMIN_LOCALES, isAdminLocale, type AdminLocale } from '@/lib/i18n/admin/locale';
import { fieldClass } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const items = ADMIN_LOCALES.map((code) => ({ value: code, label: ADMIN_LANGUAGE_NAME[code] }));

/**
 * The one setting on `/admin/account` that really saves: the team member's
 * language for the back office, kept in the `/admin` cookie
 * (`setAdminLocaleAction`). Picking one re-renders every screen from the
 * layout down, so there is no "save" button — the page itself is the
 * confirmation. The guest site's language is a separate choice, made on
 * the site, and neither touches the other.
 *
 * A dropdown rather than the guest picker's grid of buttons — three options
 * fit a single row's worth of space this way — but still this product's own
 * `Select` (`components/ui/select.tsx`, the same one `RoomTypeSelect` and
 * the front-desk filters use), never the browser's native control, which
 * would render outside the design system on every platform.
 */
export function LanguageSettings() {
  const locale = useAdminLocale();
  const t = useAdminT();
  const [pending, startTransition] = React.useTransition();
  const [chosen, setChosen] = React.useState<AdminLocale | null>(null);

  function choose(next: string | null) {
    if (!isAdminLocale(next) || next === locale) return;
    setChosen(next);
    startTransition(async () => {
      await setAdminLocaleAction(next);
      setChosen(null);
    });
  }

  return (
    <div role="group" aria-labelledby="language-heading" className="rounded-[18px] bg-card p-6 shadow-soft">
      <h2 id="language-heading" className="text-lg font-medium">
        {t('language.title')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('language.body')}</p>

      <div className="mt-5 max-w-xs">
        <Select items={items} value={chosen ?? locale} disabled={pending} onValueChange={choose}>
          <SelectTrigger aria-labelledby="language-heading" className={cn(fieldClass, 'h-11 w-full justify-between gap-2 py-0 disabled:opacity-60')}>
            <SelectValue>
              {(value: AdminLocale) => (
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-base leading-none">
                    {ADMIN_LANGUAGE_FLAG[value]}
                  </span>
                  {ADMIN_LANGUAGE_NAME[value]}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-2xl border border-border bg-card p-1.5 shadow-soft ring-0">
            {items.map((item) => (
              <SelectItem
                key={item.value}
                value={item.value}
                lang={item.value}
                className="rounded-xl py-2 pl-2.5 text-sm data-highlighted:bg-stone data-highlighted:text-foreground"
              >
                <span aria-hidden="true" className="text-base leading-none">
                  {ADMIN_LANGUAGE_FLAG[item.value]}
                </span>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{t('language.remembered')}</p>
    </div>
  );
}
