import { revalidatePath } from 'next/cache';

/**
 * One helper, called after every CMS save, so a guest sees the change on
 * their next request and a hotel team member sees it back in the CMS. Demo
 * state is process-local (or D1, but still read fresh per request) so
 * nothing here is ever cached across a genuine catalog edit.
 */
export function revalidateContent(): void {
  revalidatePath('/');
  revalidatePath('/rooms');
  revalidatePath('/rooms/[slug]', 'page');
  revalidatePath('/book/[slug]', 'page');
  revalidatePath('/admin');
  revalidatePath('/admin/rates');
  revalidatePath('/admin/tape-chart');
  revalidatePath('/admin/content');
  revalidatePath('/admin/content/hotel');
  revalidatePath('/admin/content/rooms/[id]', 'page');
  revalidatePath('/admin/content/add-ons/[id]', 'page');
}
