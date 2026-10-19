'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PolygonEditor, type EditorZone, type PolygonEditorHandle, type SpinnerMarkupCatalog } from '@/components/admin/spinner-markup';
import { toast } from '@/components/admin/shell/toast';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import type { AdminT } from '@/lib/i18n/admin/translate';
import { lFacade, lFloor, lRoomNumber } from '@/lib/i18n/format';
import { saveSpinnerZonesAction } from './actions';

/** What a zone's label reads as in the list and in save messages, admin-side. */
function zoneLabelFor(catalog: SpinnerMarkupCatalog, t: AdminT, locale: AdminLocale) {
  const unitById = new Map(catalog.units.map((unit) => [unit.id, unit]));
  const roomById = new Map(catalog.roomTypes.map((room) => [room.id, room]));
  return (zone: EditorZone): string | null => {
    const target = zone.target;
    if (!target) return null;
    switch (target.kind) {
      case 'unit': {
        const unit = unitById.get(target.unitId);
        return unit ? `${lRoomNumber(unit.number, locale)} — ${unit.roomTypeName}` : t('markup.roomMissing');
      }
      case 'floor':
        return `${lFloor(target.floor, locale)}${target.facade ? ` · ${lFacade(target.facade, locale)}` : ''}`;
      case 'roomType': {
        const room = roomById.get(target.roomTypeId);
        return room ? room.name : t('markup.roomTypeMissing');
      }
      case 'link':
        return target.label || t('editor.kindLink');
    }
  };
}

export function MarkupEditor({
  frameIndex,
  image,
  initialZones,
  catalog,
  frames,
  keyAngles,
}: {
  frameIndex: number;
  image: { url: string; width: number; height: number };
  initialZones: EditorZone[];
  catalog: SpinnerMarkupCatalog;
  /** The whole orbit, so the canvas can be dragged around the building. */
  frames: Array<{ index: number; imageUrl: string }>;
  keyAngles: number[];
}) {
  const router = useRouter();
  const t = useAdminT();
  const locale = useAdminLocale();
  const zoneLabel = React.useMemo(() => zoneLabelFor(catalog, t, locale), [catalog, t, locale]);
  const editorRef = React.useRef<PolygonEditorHandle>(null);

  /**
   * A drag around the building settles on a key angle, and that frame's own
   * zones come from the server. Anything still waiting on the autosave timer
   * is written first: the editor remounts on the new frame, and an unflushed
   * edit would go down with it.
   */
  async function openFrame(next: number) {
    await editorRef.current?.flush();
    // `scroll: false`: this fires every time a spin settles on a new key
    // angle. Next's default push scrolls the page to the top on every
    // navigation, which would throw the editor itself out of view the
    // moment the admin had scrolled down to see it — the address bar
    // updates to stay bookmarkable, nothing else about the page should move.
    router.push(`/admin/content/spinner/markup?frame=${next}`, { scroll: false });
  }

  return (
    <PolygonEditor
      key={frameIndex}
      ref={editorRef}
      image={image}
      initialZones={initialZones}
      catalog={catalog}
      zoneLabel={zoneLabel}
      sequence={{ frames, stops: keyAngles, index: frameIndex, onSettle: openFrame }}
      onNotify={({ variant, title, description }) => {
        const message = description ? `${title}: ${description}` : title;
        if (variant === 'error') toast.error(message);
        else toast.success(message);
      }}
      onSave={(batch) => saveSpinnerZonesAction(frameIndex, batch)}
      style={{ height: '100%' }}
    />
  );
}
