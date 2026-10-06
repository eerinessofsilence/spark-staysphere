import Link from 'next/link';
import { pill } from '@/lib/ui';

const copy = {
  en: { title: 'Admin is temporarily unavailable', body: 'The hotel data service did not respond. Your session may still be active. Try again shortly.', retry: 'Try again' },
  ru: { title: 'Админка временно недоступна', body: 'Хранилище данных отеля не ответило. Ваша сессия может быть активна. Повторите попытку позже.', retry: 'Повторить' },
  pl: { title: 'Panel jest chwilowo niedostępny', body: 'Usługa danych hotelu nie odpowiedziała. Sesja może być nadal aktywna. Spróbuj ponownie za chwilę.', retry: 'Spróbuj ponownie' },
} as const;

export function AdminServiceUnavailable({ locale }: { locale: string }) {
  const t = locale in copy ? copy[locale as keyof typeof copy] : copy.en;
  return (
    <main id="main" className="container-form py-16">
      <h1 className="text-display text-2xl">{t.title}</h1>
      <p role="alert" className="mt-3 max-w-prose text-sm text-muted-foreground">{t.body}</p>
      <Link href="/admin" className={pill('primary', 'mt-6')}>{t.retry}</Link>
    </main>
  );
}
