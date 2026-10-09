import { redirect } from 'next/navigation';
import { getAdminMember, getAdminSession } from '@/lib/application/admin-session';
import { availableHotels, tenantService } from '@/lib/application/container';
import { cookies } from 'next/headers';
import { SELECTED_HOTEL_COOKIE } from '@/lib/application/hotel-context';
import { getAdminT } from '@/lib/i18n/admin/server';
import { pill } from '@/lib/ui';
import { selectHotelAction } from './action';
import { AutoSelectHotel } from './auto-select-hotel';

export default async function SelectHotelPage() {
  const session = await getAdminSession();
  if (!session) redirect('/admin/sign-in?next=select-hotel');
  const [member, t, store] = await Promise.all([getAdminMember(), getAdminT(), cookies()]);
  if (!member) redirect('/admin/sign-in?next=select-hotel');
  const hotels = session.tenantAccount
    ? await tenantService.listHotels(session.memberId)
    : availableHotels.filter((hotel) => member.role !== 'Hotelier' || member.hotelIds?.includes(hotel.id));
  if (hotels.length === 1) return <AutoSelectHotel hotelId={hotels[0]!.id} label={t('onboarding.openHotel')} />;
  const currentSlug = store.get(SELECTED_HOTEL_COOKIE)?.value;
  const orderedHotels = [...hotels].sort((a, b) => Number(b.slug === currentSlug) - Number(a.slug === currentSlug));
  const highlightedSlug = hotels.find((hotel) => hotel.slug === currentSlug)?.slug ?? orderedHotels[0]?.slug;
  return <div className="mx-auto w-full max-w-sm rounded-[18px] bg-card p-6 shadow-soft sm:p-8">
    <h1 className="text-display text-3xl">{t('onboarding.selectHotelHeading')}</h1>
    {orderedHotels.length ? <form action={selectHotelAction} className="mt-6 grid gap-3">{orderedHotels.map((hotel) => <button key={hotel.id} name="hotelId" value={hotel.id} className={pill('secondary', `w-full justify-between ${hotel.slug === highlightedSlug ? 'ring-2 ring-accent' : ''}`)}><span>{hotel.name}</span><span className="text-xs text-muted-foreground">{hotel.location}</span></button>)}</form> : <div className="mt-5 grid gap-4"><p className="text-sm text-muted-foreground">{t('onboarding.noHotels')}</p>{session.tenantAccount && <a href="/admin/onboarding/create-hotel" className={pill('primary', 'w-full')}>{t('onboarding.createFirstHotel')}</a>}</div>}
  </div>;
}
