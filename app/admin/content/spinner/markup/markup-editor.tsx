'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PolygonEditor, type EditorZone, type PolygonEditorHandle, type SpinnerMarkupCatalog } from '@/components/admin/spinner-markup';
import { toast } from '@/components/admin/shell/toast';
import { saveSpinnerZonesAction } from './actions';

/** What a zone's label reads as in the list and in save messages, admin-side. */
function zoneLabelFor(catalog: SpinnerMarkupCatalog) {
  const unitById = new Map(catalog.units.map((unit) => [unit.id, unit]));
  const roomById = new Map(catalog.roomTypes.map((room) => [room.id, room]));
  return (zone: EditorZone): string | null => {
    const target = zone.target;
    if (!target) return null;
    switch (target.kind) {
      case 'unit': {
        const unit = unitById.get(target.unitId);
        return unit ? `Room ${unit.number} — ${unit.roomTypeName}` : 'Room (missing)';
      }
      case 'floor':
        return `Floor ${target.floor}${target.facade ? ` · ${target.facade}` : ''}`;
      case 'roomType': {
        const room = roomById.get(target.roomTypeId);
        return room ? room.name : 'Room type (missing)';
      }
      case 'link':
        return target.label || 'Link';
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
  const editorRef = React.useRef<PolygonEditorHandle>(null);

  /**
   * A drag around the building settles on a key angle, and that frame's own
   * zones come from the server. Anything still waiting on the autosave timer
   * is written first: the editor remounts on the new frame, and an unflushed
   * edit would go down with it.
   */
  async function openFrame(next: number) {
    await editorRef.current?.flush();
    router.push(`/admin/content/spinner/markup?frame=${next}`);
  }

  return (
    <PolygonEditor
      key={frameIndex}
      ref={editorRef}
      image={image}
      initialZones={initialZones}
      catalog={catalog}
      zoneLabel={zoneLabelFor(catalog)}
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
