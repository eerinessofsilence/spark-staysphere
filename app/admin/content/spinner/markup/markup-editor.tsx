'use client';

import { PolygonEditor, type EditorZone, type SpinnerMarkupCatalog } from '@/components/admin/spinner-markup';
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
}: {
  frameIndex: number;
  image: { url: string; width: number; height: number };
  initialZones: EditorZone[];
  catalog: SpinnerMarkupCatalog;
}) {
  return (
    <PolygonEditor
      key={frameIndex}
      image={image}
      initialZones={initialZones}
      catalog={catalog}
      zoneLabel={zoneLabelFor(catalog)}
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
