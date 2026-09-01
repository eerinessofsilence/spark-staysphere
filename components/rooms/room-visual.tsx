import type { RoomType } from '@/lib/domain/schemas';
import { cn } from '@/lib/utils';

export const roomZones = ['bedroom', 'living', 'balcony', 'bathroom'] as const;
export type RoomZone = (typeof roomZones)[number];

export const zoneLabels: Record<RoomZone, string> = {
  bedroom: 'Bedroom',
  living: 'Living area',
  balcony: 'Balcony',
  bathroom: 'Bathroom',
};

/**
 * Local, procedural room artwork. Every room gets a deterministic interior
 * drawn from its slug, view, and the zone being inspected — no external image
 * hosts, no per-room asset pipeline, and identical output on server and client.
 * Real photography or a 360 tile set replaces this at the same call site.
 */

interface ViewPalette {
  skyTop: string;
  skyBottom: string;
  ground: string;
  accent: string;
}

const viewPalettes: Record<RoomType['view'], ViewPalette> = {
  sea: { skyTop: '#9EC6CE', skyBottom: '#E4E3D6', ground: '#2E6E74', accent: '#05E6EC' },
  garden: { skyTop: '#B8C9BD', skyBottom: '#EDE9DC', ground: '#3D5A3A', accent: '#8FBF7A' },
  pool: { skyTop: '#A9CBD2', skyBottom: '#EFEADC', ground: '#0E8C93', accent: '#05E6EC' },
  city: { skyTop: '#6E6A83', skyBottom: '#E3C9AE', ground: '#2A2733', accent: '#E9A05C' },
};

function hashOf(input: string): number {
  let value = 5381;
  for (let index = 0; index < input.length; index += 1) {
    value = ((value << 5) + value + input.charCodeAt(index)) >>> 0;
  }
  return value;
}

function ViewContent({ view, seed }: { view: RoomType['view']; seed: number }) {
  const palette = viewPalettes[view];

  if (view === 'sea') {
    return (
      <>
        <rect x="150" y="180" width="340" height="118" fill={palette.ground} />
        <rect x="150" y="262" width="340" height="36" fill="#1E5157" />
        <circle cx={250 + (seed % 180)} cy="150" r="20" fill="#F7E3C4" opacity="0.9" />
        {[204, 226, 248, 270].map((y, index) => (
          <rect
            key={y}
            x={168 + ((seed + index * 47) % 120)}
            y={y}
            width={90 + ((seed + index * 31) % 80)}
            height="2"
            fill="#F2F1EC"
            opacity={0.3 - index * 0.05}
          />
        ))}
        <path d="M392 180 L392 150 L414 180 Z" fill="#F2F1EC" opacity="0.85" />
      </>
    );
  }

  if (view === 'pool') {
    return (
      <>
        <rect x="150" y="208" width="340" height="90" fill="#D9D3C4" />
        <ellipse cx="320" cy="252" rx="120" ry="34" fill={palette.ground} />
        <ellipse cx="320" cy="252" rx="120" ry="34" fill="none" stroke="#F2F1EC" strokeWidth="2" opacity="0.5" />
        {[196, 404].map((x) => (
          <g key={x} opacity="0.85">
            <rect x={x} y="232" width="42" height="6" rx="3" fill="#F2F1EC" />
            <rect x={x + 34} y="220" width="7" height="16" rx="3" fill="#F2F1EC" opacity="0.8" />
          </g>
        ))}
        <rect x="176" y="150" width="5" height="60" fill="#3A4A38" />
        <path d="M178 150 Q206 132 226 152" stroke="#3A4A38" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M178 150 Q150 132 132 152" stroke="#3A4A38" strokeWidth="7" fill="none" strokeLinecap="round" />
      </>
    );
  }

  if (view === 'garden') {
    return (
      <>
        <path d="M150 232 Q250 198 340 226 Q430 250 490 220 L490 298 L150 298 Z" fill={palette.ground} />
        <path d="M150 258 Q260 232 360 256 Q440 274 490 254 L490 298 L150 298 Z" fill="#2C4429" />
        {[
          [208, 214, 26],
          [286, 206, 32],
          [372, 218, 24],
          [440, 210, 28],
        ].map(([x, y, r], index) => (
          <g key={x}>
            <rect x={x - 2} y={y} width="4" height={r + 14} fill="#3B3226" />
            <circle cx={x} cy={y - r / 2 + 2} r={r - ((seed + index) % 6)} fill="#4E7145" opacity="0.95" />
          </g>
        ))}
      </>
    );
  }

  return (
    <>
      <rect x="150" y="230" width="340" height="68" fill={palette.ground} />
      {Array.from({ length: 9 }, (_, index) => {
        const height = 40 + ((seed + index * 53) % 96);
        const x = 156 + index * 38;
        return (
          <g key={index}>
            <rect x={x} y={230 - height} width={30} height={height} fill="#221F2B" />
            {Array.from({ length: Math.max(1, Math.floor(height / 26)) }, (_, row) => (
              <rect
                key={row}
                x={x + 6}
                y={230 - height + 10 + row * 24}
                width="18"
                height="8"
                fill={palette.accent}
                opacity={(seed + index + row) % 3 === 0 ? 0.75 : 0.18}
              />
            ))}
          </g>
        );
      })}
    </>
  );
}

function ZoneFurniture({ zone, seed }: { zone: RoomZone; seed: number }) {
  if (zone === 'bedroom') {
    return (
      <>
        {/* Headboard */}
        <rect x="196" y="238" width="248" height="66" rx="8" fill="#B79B7A" />
        <rect x="196" y="238" width="248" height="10" rx="5" fill="#A6886A" />
        {[258, 320, 382].map((x) => (
          <rect key={x} x={x} y="252" width="2" height="48" fill="#A6886A" opacity="0.7" />
        ))}
        {/* Mattress and linen */}
        <rect x="176" y="300" width="288" height="76" rx="10" fill="#F6F4EE" />
        <rect x="176" y="336" width="288" height="40" rx="10" fill="#E2DED2" />
        <rect x="212" y="290" width="80" height="30" rx="8" fill="#FFFFFF" opacity="0.95" />
        <rect x="308" y="290" width="80" height="30" rx="8" fill="#FFFFFF" opacity="0.95" />
        {/* Bedside table and lamp */}
        <rect x="108" y="316" width="62" height="60" rx="6" fill="#8E7458" />
        <rect x="136" y="284" width="6" height="34" fill="#3A3A36" />
        <path d="M118 284 L156 284 L148 262 L126 262 Z" fill="#F7E3C4" opacity="0.92" />
        <g transform={`translate(${514 + (seed % 10)} 298)`}>
          <path d="M-17 54 L17 54 L13 80 L-13 80 Z" fill="#B0805C" />
          <ellipse cx="0" cy="54" rx="17" ry="4" fill="#96694A" />
          <path d="M0 54 L0 18" stroke="#3E5138" strokeWidth="3" />
          <ellipse cx="-13" cy="26" rx="14" ry="7" fill="#4E7145" transform="rotate(-25 -13 26)" />
          <ellipse cx="13" cy="17" rx="14" ry="7" fill="#5A8050" transform="rotate(20 13 17)" />
          <ellipse cx="-4" cy="7" rx="12" ry="6" fill="#456A3E" transform="rotate(-8 -4 7)" />
        </g>
      </>
    );
  }

  if (zone === 'living') {
    return (
      <>
        <rect x="150" y="292" width="286" height="54" rx="14" fill="#4C5A52" />
        <rect x="162" y="276" width="262" height="34" rx="12" fill="#5E6E64" />
        <rect x="186" y="272" width="66" height="30" rx="10" fill="#D9CFBB" />
        <rect x="268" y="272" width="66" height="30" rx="10" fill="#D9CFBB" />
        <rect x="150" y="346" width="286" height="12" rx="6" fill="#3B463F" />
        <ellipse cx="500" cy="344" rx="62" ry="16" fill="#8E7458" />
        <rect x="494" y="344" width="12" height="34" fill="#6F5942" />
        <rect x="470" y="376" width="60" height="7" rx="3" fill="#6F5942" />
        <rect x="86" y="270" width="52" height="108" rx="8" fill="#8E7458" opacity="0.9" />
      </>
    );
  }

  if (zone === 'balcony') {
    return (
      <>
        {/* Glass balustrade, drawn over the open view */}
        <rect x="60" y="252" width="520" height="4" rx="2" fill="#F2F1EC" opacity="0.9" />
        <rect x="60" y="256" width="520" height="86" fill="#DDECEC" opacity="0.16" />
        {Array.from({ length: 12 }, (_, index) => (
          <rect key={index} x={70 + index * 44} y="256" width="2" height="86" fill="#F2F1EC" opacity="0.35" />
        ))}
        <rect x="60" y="342" width="520" height="8" rx="3" fill="#F2F1EC" opacity="0.75" />
        {/* Lounge chair and side table */}
        <rect x="128" y="300" width="98" height="12" rx="6" fill="#C9BCA4" />
        <rect x="196" y="264" width="12" height="44" rx="6" fill="#C9BCA4" />
        <rect x="140" y="312" width="8" height="26" fill="#9C8E77" />
        <rect x="206" y="312" width="8" height="26" fill="#9C8E77" />
        <circle cx="292" cy="308" r="24" fill="#8E7458" />
        <rect x="288" y="308" width="8" height="30" fill="#6F5942" />
      </>
    );
  }

  return (
    <>
      {/* Freestanding tub */}
      <path d="M132 306 Q132 292 152 292 L316 292 Q336 292 336 306 L328 366 Q326 378 310 378 L158 378 Q142 378 140 366 Z" fill="#F6F4EE" />
      <path d="M144 306 L324 306 L318 356 Q317 364 306 364 L162 364 Q151 364 150 356 Z" fill="#DCE7E4" />
      <rect x="120" y="252" width="6" height="56" rx="3" fill="#8A8F8C" />
      <path d="M120 252 Q120 240 140 240 L154 240" stroke="#8A8F8C" strokeWidth="6" fill="none" strokeLinecap="round" />
      {/* Basin and mirror */}
      <rect x="398" y="312" width="132" height="14" rx="7" fill="#C9BCA4" />
      <rect x="410" y="326" width="108" height="46" rx="6" fill="#B0A48D" />
      <ellipse cx="464" cy="312" rx="38" ry="12" fill="#F6F4EE" />
      <circle cx={464 + (seed % 4)} cy="238" r="42" fill="#DCE7E4" opacity="0.9" />
      <circle cx="464" cy="238" r="42" fill="none" stroke="#8A8F8C" strokeWidth="3" opacity="0.7" />
    </>
  );
}

interface RoomVisualProps {
  room: Pick<RoomType, 'slug' | 'view' | 'name'>;
  zone?: RoomZone;
  className?: string;
}

export function RoomVisual({ room, zone = 'bedroom', className }: RoomVisualProps) {
  const seed = hashOf(`${room.slug}:${zone}`) % 997;
  const palette = viewPalettes[room.view];
  const clipId = `room-window-${room.slug}-${zone}`;
  const skyId = `room-sky-${room.slug}-${zone}`;
  const wallId = `room-wall-${room.slug}-${zone}`;
  const openAir = zone === 'balcony';

  return (
    <svg
      viewBox="0 0 640 420"
      className={cn('block size-full', className)}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`Illustration of the ${zoneLabels[zone].toLowerCase()} in the ${room.name}`}
    >
      <defs>
        <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.skyTop} />
          <stop offset="100%" stopColor={palette.skyBottom} />
        </linearGradient>
        <linearGradient id={wallId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E6E1D6" />
          <stop offset="100%" stopColor="#F3F0E8" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x="150" y="48" width="340" height="250" rx="8" />
        </clipPath>
      </defs>

      {openAir ? (
        <>
          <rect width="640" height="420" fill={`url(#${skyId})`} />
          <g>
            <rect x="0" y="0" width="640" height="420" fill={`url(#${skyId})`} />
            <g transform="translate(0 0)">
              <g transform="scale(1.6) translate(-120 -20)">
                <ViewContent view={room.view} seed={seed} />
              </g>
            </g>
          </g>
          <rect x="0" y="350" width="640" height="70" fill="#C9A27E" />
          <rect x="0" y="350" width="640" height="6" fill="#A8845F" opacity="0.5" />
        </>
      ) : (
        <>
          <rect width="640" height="420" fill={`url(#${wallId})`} />
          <rect width="640" height="46" fill="#0A0D0E" opacity="0.05" />
          <rect y="340" width="640" height="80" fill="#C9A27E" />
          <rect y="340" width="640" height="5" fill="#A8845F" opacity="0.6" />
          {/* Window opening */}
          <g clipPath={`url(#${clipId})`}>
            <rect x="150" y="48" width="340" height="250" fill={`url(#${skyId})`} />
            <ViewContent view={room.view} seed={seed} />
          </g>
          <rect x="150" y="48" width="340" height="250" rx="8" fill="none" stroke="#3A3A36" strokeWidth="4" />
          <rect x="318" y="48" width="4" height="250" fill="#3A3A36" opacity="0.85" />
          {/* Linen curtains */}
          <rect x="112" y="40" width="38" height="272" fill="#EDE7DA" />
          <rect x="490" y="40" width="38" height="272" fill="#EDE7DA" />
          <rect x="126" y="40" width="2" height="272" fill="#D7CFBE" />
          <rect x="504" y="40" width="2" height="272" fill="#D7CFBE" />
        </>
      )}

      <ZoneFurniture zone={zone} seed={seed} />
      <rect width="640" height="420" fill="#0A0D0E" opacity="0.04" />
    </svg>
  );
}
