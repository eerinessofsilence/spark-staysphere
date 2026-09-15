import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { contentService } from '@/lib/application/container';
import { formatFloor } from '@/lib/formatting';
import { pill } from '@/lib/ui';
import { ContentForm } from '@/components/admin/content/content-form';
import { NewPhysicalRoomFields } from '@/components/admin/content/new-physical-room-fields';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { createPhysicalRoomAction } from './actions';

export const metadata: Metadata = { title: 'New room — Rooms | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default async function NewPhysicalRoomPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = Array.isArray(params.type) ? params.type[0] : params.type;
  const [types, suggestions] = await Promise.all([
    contentService.listRoomsContent(),
    contentService.suggestRoomNumbers(),
  ]);
  // A room can't exist without a type; the Rooms page sends a hotel with none to create one first.
  if (types.length === 0) redirect('/admin/content/units');
  const initialTypeId = types.find((type) => type.id === requested)?.id ?? types[0]!.id;

  return (
    <AdminPage width="narrow">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <Link href="/admin/content/units" className={pill('secondary')}>
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Rooms
        </Link>
      </nav>

      <AdminPageHeader
        title="New room"
        description="A room sells as part of its room type: each one you add is one more of that type on sale every night."
      />

      <div className="mt-8 rounded-[28px] bg-card p-5 shadow-soft sm:p-6">
        <ContentForm action={createPhysicalRoomAction} initialVersion={0} submitLabel="Create room" dock>
          <NewPhysicalRoomFields
            initialTypeId={initialTypeId}
            types={types.map((type) => ({
              id: type.id,
              label: `${type.name} · ${formatFloor(type.floor)}${type.hidden ? ' · hidden' : ''}`,
              suggestion: suggestions[type.id] ?? '',
            }))}
          />
        </ContentForm>
      </div>
    </AdminPage>
  );
}
