'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SubscriptionModule } from '@/lib/domain/subscription';
import { useAdminLocale } from '@/lib/i18n/admin/context';
import { lMoney } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { plans } from './subscription-data';
import { confirmSubscriptionDemoPayment } from '@/app/admin/account/subscription/actions';
import { subscriptionTrialCopy } from './subscription-trial-copy';

type Draft = { modules: string[]; plan: string; roomLimit: number | null; channelLimit: number | null };
export function SubscriptionCheckout({ modules, storageKey }: { modules: SubscriptionModule[]; storageKey: string }) {
  const locale = useAdminLocale();
  const language = locale === 'ru' || locale === 'de' ? locale : 'en';
  const c = {
    en: { title: 'Review and pay', demo: 'Demo payment only. No money is charged. Modules are activated only in this browser session, not in a billing system or external integrations.', confirm: 'Confirm demo payment', back: 'Back to subscription', empty: 'No pending order. Choose modules in Subscription first.', total: 'New monthly total', loading: 'Loading order…', error: 'Browser storage is unavailable. Your subscription has not changed.' },
    ru: { title: 'Проверка и оплата', demo: 'Демо-оплата без списания денег. Модули активируются только в этой сессии браузера, не в биллинге и не во внешних интеграциях.', confirm: 'Подтвердить демо-оплату', back: 'Назад к подписке', empty: 'Нет заказа. Сначала выберите модули в Subscription.', total: 'Новая сумма в месяц', loading: 'Загрузка заказа…', error: 'Хранилище браузера недоступно. Подписка не изменена.' },
    de: { title: 'Prüfen und bezahlen', demo: 'Nur Demo-Zahlung, keine Abbuchung. Module werden nur in dieser Browsersitzung aktiviert, nicht im Abrechnungssystem oder externen Integrationen.', confirm: 'Demo-Zahlung bestätigen', back: 'Zurück zum Abonnement', empty: 'Keine Bestellung. Wählen Sie zuerst Module aus.', total: 'Neuer Monatsbetrag', loading: 'Bestellung wird geladen…', error: 'Browserspeicher nicht verfügbar. Abonnement unverändert.' },
  }[language];
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [paymentError, setPaymentError] = useState(false);
  const trialCopy = subscriptionTrialCopy(locale);
  async function confirm() {
    if (!draft || confirming) return;
    setConfirming(true);
    setError(false);
    setPaymentError(false);
    try {
      sessionStorage.setItem(`${storageKey}.draft`, JSON.stringify(draft));
      const result = await confirmSubscriptionDemoPayment();
      if (!result.ok) { setPaymentError(true); return; }
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
      sessionStorage.removeItem(`${storageKey}.draft`);
      window.location.assign('/admin/account/subscription');
    } catch { setError(true); }
    finally { setConfirming(false); }
  }
  useEffect(() => {
    try {
      const data = JSON.parse(sessionStorage.getItem(`${storageKey}.draft`) ?? 'null');
      if (data && Array.isArray(data.modules) && plans.some((plan) => plan.id === data.plan)) setDraft({
        modules: modules.filter((item) => data.modules.includes(item.id)).map((item) => item.id), plan: data.plan,
        roomLimit: Number.isFinite(data.roomLimit) ? Math.max(0, data.roomLimit) : null,
        channelLimit: Number.isFinite(data.channelLimit) ? Math.max(0, data.channelLimit) : null,
      });
    } catch { setError(true); }
    setLoaded(true);
  }, [modules, storageKey]);
  const plan = plans.find((item) => item.id === draft?.plan);
  const paid = modules.filter((item) => draft?.modules.includes(item.id) && !item.includedIn.includes(draft.plan));
  const extra = plan && draft ? (plan.roomLimit !== null ? Math.max(0, (draft.roomLimit ?? plan.roomLimit) - plan.roomLimit) * 0.9 : 0) + (plan.channelLimit !== null ? Math.max(0, (draft.channelLimit ?? plan.channelLimit) - plan.channelLimit) * 15 : 0) : 0;
  const money = (value: number) => lMoney(value, 'EUR', locale);
  return <div className="rounded-[18px] border border-border bg-card p-6">
    <h1 className="text-display text-2xl">{c.title}</h1><p className="my-5 text-sm text-muted-foreground">{c.demo}</p>
    {!loaded ? <p role="status">{c.loading}</p> : !draft || !plan ? <p>{c.empty}</p> : <>
      <ul className="divide-y divide-border"><li className="flex justify-between gap-4 py-3"><span>{plan.name}</span><span>{money(plan.price + extra)}</span></li>{paid.map((item) => <li key={item.id} className="flex justify-between gap-4 py-3"><span>{item.name[language]}</span><span>{money(item.price)}</span></li>)}</ul>
      <p className="my-5 border-t border-border pt-5">{c.total}: <strong>{money(plan.price + extra + paid.reduce((sum, item) => sum + item.price, 0))}</strong></p>
      <button type="button" disabled={confirming} className={pill('primary')} onClick={confirm}>{confirming ? trialCopy.pending : c.confirm}</button>
    </>}
    {error && <p role="alert" className="mt-4 text-danger">{c.error}</p>}
    {paymentError && <p role="alert" className="mt-4 text-danger">{trialCopy.error}</p>}
    <Link href="/admin/account/subscription" className={pill('secondary', 'mt-4')}>{c.back}</Link>
  </div>;
}
