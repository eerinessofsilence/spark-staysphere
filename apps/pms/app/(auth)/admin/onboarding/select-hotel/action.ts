'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminMember, getAdminSession } from '@/lib/application/admin-session';
import { availableHotels, tenantService } from '@/lib/application/container';
import { SELECTED_HOTEL_COOKIE } from '@/lib/application/hotel-context';

export async function selectHotelAction(formData: FormData): Promise<void> {
  const session = await getAdminSession();
  if (!session) redirect('/admin/sign-in');
  const hotelId = formData.get('hotelId');
  if (typeof hotelId !== 'string') redirect('/admin/onboarding/select-hotel');
  const member = await getAdminMember();
  const eligible = session.tenantAccount
    ? await tenantService.listHotels(session.memberId)
    : availableHotels.filter((candidate) => member?.role !== 'Hotelier' || member.hotelIds?.includes(candidate.id));
  const hotel = eligible.find((candidate) => candidate.id === hotelId);
  if (!hotel) redirect('/admin/onboarding/select-hotel');
  const store = await cookies();
  store.set(SELECTED_HOTEL_COOKIE, hotel.slug, { path: '/admin', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365 });
  redirect(member?.role === 'Hotelier' ? '/admin/maintenance' : '/admin');
}
