'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminAuthConfig } from '@/lib/application/container';
import { ADMIN_SESSION_COOKIE, sameString, writeAdminSession } from '@/lib/application/admin-session';

export async function signInAction(_previous: string, data: FormData): Promise<string> {
  const password = String(data.get('password') ?? '');
  const config = adminAuthConfig();
  const role = sameString(password, config.password) ? 'admin' : config.editorPassword && sameString(password, config.editorPassword) ? 'editor' : null;
  if (!role) return 'Incorrect password.';
  await writeAdminSession(role);
  redirect('/admin/content');
}
export async function signOutAction() {
  (await cookies()).set(ADMIN_SESSION_COOKIE, '', { path: '/admin', maxAge: 0, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  redirect('/admin/sign-in');
}
