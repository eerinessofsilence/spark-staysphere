'use client';

import { useEffect, useState } from 'react';
import type { SubscriptionModule } from '@/lib/domain/subscription';
import { useAdminLocale } from '@/lib/i18n/admin/context';
import { lMoney } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { Modal } from '@/components/site/modal';

const copy = {
  en: { title: 'Modules', demo: 'Demo estimate: no payment is collected and changes are not saved. Module selection does not activate external integrations.', operations: 'Operations', distribution: 'Distribution', guest: 'Guest experience', included: 'Included in your plan', add: 'Add module', remove: 'Remove module', active: 'Added', estimate: 'Monthly bill estimate', base: 'Base plan', extras: 'Extra rooms and channels', total: 'Total per month', confirm: 'Confirm preview', cancel: 'Cancel', change: 'Change module', month: '/mo', empty: 'No modules in this category.' },
  de: { title: 'Module', demo: 'Demo-Schätzung: keine Zahlung, Änderungen werden nicht gespeichert. Die Auswahl aktiviert keine externen Integrationen.', operations: 'Betrieb', distribution: 'Vertrieb', guest: 'Gästeerlebnis', included: 'Im Tarif enthalten', add: 'Modul hinzufügen', remove: 'Modul entfernen', active: 'Hinzugefügt', estimate: 'Monatliche Kostenschätzung', base: 'Basistarif', extras: 'Zusätzliche Zimmer und Kanäle', total: 'Gesamt pro Monat', confirm: 'Vorschau bestätigen', cancel: 'Abbrechen', change: 'Modul ändern', month: '/Monat', empty: 'Keine Module in dieser Kategorie.' },
  ru: { title: 'Модули', demo: 'Демо-расчёт: деньги не списываются, изменения не сохраняются. Выбор модуля не активирует внешние интеграции.', operations: 'Операции', distribution: 'Дистрибуция', guest: 'Опыт гостя', included: 'Включён в тариф', add: 'Добавить модуль', remove: 'Убрать модуль', active: 'Добавлен', estimate: 'Расчёт подписки', base: 'Базовый тариф', extras: 'Дополнительные номера и каналы', total: 'Итого в месяц', confirm: 'Подтвердить демо', cancel: 'Отмена', change: 'Изменить модуль', month: '/мес.', empty: 'Нет модулей в этой категории.' },
};

export function SubscriptionModules({ modules, planId, basePrice, extraPrice, selected, active, onChange, onCheckout, disabled }: {
  modules: SubscriptionModule[]; planId: string; basePrice: number; extraPrice: number;
  selected: string[]; active: string[]; onChange: (ids: string[]) => void; onCheckout: () => void; disabled: boolean;
}) {
  const locale = useAdminLocale();
  const language = locale === 'ru' || locale === 'de' ? locale : 'en';
  const c = copy[language];
  const [category, setCategory] = useState<SubscriptionModule['category']>('operations');
  const [pending, setPending] = useState<SubscriptionModule | null>(null);
  const [details, setDetails] = useState<SubscriptionModule | null>(null);
  const about = language === 'ru' ? 'О модуле' : language === 'de' ? 'Über das Modul' : 'About module';
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const paid = modules.filter((item) => selected.includes(item.id) && !item.includedIn.includes(planId));
  const total = basePrice + extraPrice + paid.reduce((sum, item) => sum + item.price, 0);
  const removing = !!pending && selected.includes(pending.id);
  const money = (amount: number) => lMoney(amount, 'EUR', locale);
  return (
    <section aria-label={c.title} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 rounded-[18px] border border-border bg-card p-5">
        <h2 className="text-lg font-medium">{c.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{c.demo}</p>
        <div className="my-5 flex flex-wrap gap-2" aria-label={c.title}>
          {(['operations', 'distribution', 'guest'] as const).map((id) => <button key={id} type="button" aria-pressed={id === category} className={pill(id === category ? 'primary' : 'secondary')} onClick={() => setCategory(id)}>{c[id]}</button>)}
        </div>
        <ul className="divide-y divide-border">
          {modules.filter((item) => item.category === category).map((item) => {
            const included = item.includedIn.includes(planId);
            const chosen = selected.includes(item.id);
            return <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0"><p className="font-medium">{item.name[language]}</p><p className="mt-1 text-sm text-muted-foreground">{included ? c.included : `${money(item.price)} ${c.month}${active.includes(item.id) ? ` · ${language === 'ru' ? 'Активен (демо)' : language === 'de' ? 'Aktiv (Demo)' : 'Active (demo)'}` : chosen ? ` · ${language === 'ru' ? 'Ожидает оплаты' : language === 'de' ? 'Zahlung ausstehend' : 'Pending payment'}` : ''}`}</p></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!ready} className={pill('secondary')} aria-label={`${about}: ${item.name[language]}`} onClick={() => setDetails(item)}>{about}</button>
                {!included && <button type="button" disabled={disabled || !ready} className={pill(chosen ? 'secondary' : 'primary')} aria-label={`${chosen ? c.remove : c.add}: ${item.name[language]}`} onClick={() => setPending(item)}>{chosen ? c.remove : c.add}</button>}
              </div>
            </li>;
          })}
        </ul>
        {!modules.some((item) => item.category === category) && <p className="text-muted-foreground">{c.empty}</p>}
      </div>
      <aside className="self-start rounded-[18px] border border-border bg-card p-5" aria-label={c.estimate}>
        <h2 className="text-lg font-medium">{c.estimate}</h2>
        <dl className="mt-5 grid gap-4 text-sm">
          <div className="flex justify-between gap-3"><dt>{c.base}</dt><dd>{money(basePrice)}</dd></div>
          {extraPrice > 0 && <div className="flex justify-between gap-3"><dt>{c.extras}</dt><dd>{money(extraPrice)}</dd></div>}
          {paid.map((item) => <div key={item.id} className="flex items-start justify-between gap-3">
            <dt className="min-w-0 flex-1">{item.name[language]}</dt>
            <dd className="flex shrink-0 flex-col items-end gap-2">
              <span>{money(item.price)}</span>
              <button type="button" disabled={disabled || !ready} className={pill('secondary', 'min-h-10 px-3 text-xs')} aria-label={`${c.remove}: ${item.name[language]}`} onClick={() => setPending(item)}>{c.remove}</button>
            </dd>
          </div>)}
          <div className="border-t border-border pt-4"><dt>{c.total}</dt><dd data-subscription-total className="mt-2 text-display text-3xl">{money(total)}</dd></div>
        </dl>
        {selected.some((id) => !active.includes(id)) || active.some((id) => !selected.includes(id)) ? <button type="button" disabled={disabled} onClick={onCheckout} className={pill('primary', 'mt-5 w-full')}>
          {language === 'ru' ? 'Продолжить к оплате' : language === 'de' ? 'Weiter zur Zahlung' : 'Continue to payment'}
        </button> : null}
      </aside>
      <Modal open={!!details} onClose={() => setDetails(null)} title={details?.name[language] ?? about}>
        {details && <div className="space-y-5">
          <p className="leading-relaxed">{details.description?.[language] ?? details.name[language]}</p>
          <p className="font-medium">{details.includedIn.includes(planId) ? c.included : `${money(details.price)} ${c.month}`}</p>
          <p className="text-sm text-muted-foreground">{c.demo}</p>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className={pill('secondary')} onClick={() => setDetails(null)}>{language === 'ru' ? 'Закрыть' : language === 'de' ? 'Schließen' : 'Close'}</button>
            {!details.includedIn.includes(planId) && !selected.includes(details.id) ? <button type="button" disabled={disabled} className={pill('primary')} onClick={() => { onChange([...selected, details.id]); setDetails(null); }}>{c.add}</button> : null}
          </div>
        </div>}
      </Modal>
      <Modal open={!!pending} onClose={() => setPending(null)} title={c.change}>
        {pending && <div className="p-5"><h3 className="text-lg font-medium">{pending.name[language]}</h3><p className="mt-3 text-sm text-muted-foreground">{c.demo}</p><p className="my-5">{c.total}: <strong>{money(total + (removing ? -pending.price : pending.price))}</strong></p><div className="flex flex-wrap justify-end gap-3"><button type="button" className={pill('secondary')} onClick={() => setPending(null)}>{c.cancel}</button><button type="button" className={pill('primary')} onClick={() => { onChange(removing ? selected.filter((id) => id !== pending.id) : [...selected, pending.id]); setPending(null); }}>{c.confirm}</button></div></div>}
      </Modal>
    </section>
  );
}
