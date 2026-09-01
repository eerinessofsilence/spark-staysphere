import { Box, Scan } from 'lucide-react';
import { hasMedia } from '@/lib/domain/room-attributes';
import type { RoomType } from '@/lib/domain/schemas';
import { cn } from '@/lib/utils';

/** Data-driven: a room only advertises 360°/3D if its media set actually has it. */
export function MediaBadges({
  room,
  className,
}: {
  room: Pick<RoomType, 'media'>;
  className?: string;
}) {
  const has360 = hasMedia(room, '360');
  const has3d = hasMedia(room, 'gltf');
  if (!has360 && !has3d) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {has360 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F2F1EC]/20 bg-ink/75 px-2.5 py-1 text-[11px] font-semibold text-[#F2F1EC] backdrop-blur-sm">
          <Scan className="size-3.5" aria-hidden="true" />
          360° view
        </span>
      ) : null}
      {has3d ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan/40 bg-cyan/15 px-2.5 py-1 text-[11px] font-semibold text-cyan backdrop-blur-sm">
          <Box className="size-3.5" aria-hidden="true" />
          3D tour
        </span>
      ) : null}
    </div>
  );
}
