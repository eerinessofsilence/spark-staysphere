import { revalidatePath } from 'next/cache';

/**
 * Revalidate PMS back-office screens after a CMS save. Guest is a separate
 * application and reads current content through its PMS API on each request.
 */
export function revalidateContent(): void {
  revalidatePath('/');
  revalidatePath('/admin');
  revalidatePath('/admin/rates');
  revalidatePath('/admin/front-desk');
  revalidatePath('/admin/content');
  revalidatePath('/admin/content/hotel');
  revalidatePath('/admin/content/units');
  revalidatePath('/admin/content/add-ons');
  revalidatePath('/admin/content/spinner');
  revalidatePath('/admin/content/spinner/markup');
  revalidatePath('/admin/content/spinner/frames');
  revalidatePath('/admin/content/units/[id]', 'page');
  revalidatePath('/admin/content/rooms/[id]', 'page');
  revalidatePath('/admin/content/add-ons/[id]', 'page');
}
