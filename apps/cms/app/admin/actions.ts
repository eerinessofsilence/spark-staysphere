'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/application/admin-session';
import { ADMIN_LOCALE_COOKIE, isAdminLocale } from '@/lib/i18n/admin/locale';
export async function setAdminLocaleAction(locale: string) {
  await requireAdminSession();
  if (!isAdminLocale(locale)) return;
  (await cookies()).set(ADMIN_LOCALE_COOKIE, locale, { path: '/admin', maxAge: 31536000, sameSite: 'lax' });
  revalidatePath('/admin', 'layout');
}
