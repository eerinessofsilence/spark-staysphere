import type { AdminLocale } from '@/lib/i18n/admin/locale';

const copy = {
  en: {
    trial: 'Free trial', expired: 'Your subscription has ended', expiredShort: 'Trial ended', active: 'Active (demo)', update: 'Update subscription',
    remaining: (days: number) => `${days} ${days === 1 ? 'day' : 'days'} left to explore StaySphere.`,
    daysLeft: (days: number) => `${days} ${days === 1 ? 'day' : 'days'} left`,
    invite: 'Choose a plan and keep your hotel moving. Your data stays right here.',
    demo: 'Demo payment only. No money is charged.', confirm: 'Confirm demo payment', pending: 'Confirming…',
    unavailable: 'Subscription status is unavailable. Reload to try again.', error: 'Could not update your subscription. Please try again.',
    ended: 'Choose a plan to continue.', ends: 'Trial ends', renews: 'Demo access ends', proposed: 'Plan after trial',
  },
  ru: {
    trial: 'Пробный период', expired: 'Ваша подписка закончилась', expiredShort: 'Пробный период завершён', active: 'Активна (демо)', update: 'Обновить подписку',
    remaining: (days: number) => `Осталось дней для знакомства со StaySphere: ${days}.`,
    daysLeft: (days: number) => `Осталось дней: ${days}`,
    invite: 'Выберите тариф и продолжайте управлять отелем. Все ваши данные остаются здесь.',
    demo: 'Только демо-оплата. Деньги не списываются.', confirm: 'Подтвердить демо-оплату', pending: 'Подтверждение…',
    unavailable: 'Статус подписки недоступен. Обновите страницу, чтобы повторить.', error: 'Не удалось обновить подписку. Попробуйте ещё раз.',
    ended: 'Выберите тариф, чтобы продолжить.', ends: 'Пробный период до', renews: 'Демо-доступ до', proposed: 'Тариф после пробного периода',
  },
  de: {
    trial: 'Kostenlose Testphase', expired: 'Ihr Abonnement ist abgelaufen', expiredShort: 'Testphase beendet', active: 'Aktiv (Demo)', update: 'Abonnement aktualisieren',
    remaining: (days: number) => `Noch ${days} ${days === 1 ? 'Tag' : 'Tage'}, um StaySphere zu entdecken.`,
    daysLeft: (days: number) => `Noch ${days} ${days === 1 ? 'Tag' : 'Tage'}`,
    invite: 'Wählen Sie einen Tarif und verwalten Sie Ihr Hotel weiter. Ihre Daten bleiben erhalten.',
    demo: 'Nur Demo-Zahlung. Es wird kein Geld abgebucht.', confirm: 'Demo-Zahlung bestätigen', pending: 'Wird bestätigt…',
    unavailable: 'Abonnementstatus nicht verfügbar. Laden Sie die Seite erneut.', error: 'Abonnement konnte nicht aktualisiert werden. Bitte erneut versuchen.',
    ended: 'Wählen Sie einen Tarif, um fortzufahren.', ends: 'Testphase endet', renews: 'Demo-Zugang endet', proposed: 'Tarif nach der Testphase',
  },
};

export function subscriptionTrialCopy(locale: AdminLocale) {
  return copy[locale === 'ru' || locale === 'de' ? locale : 'en'];
}
