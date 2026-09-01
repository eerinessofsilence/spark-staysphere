/**
 * Procedural resort massing, drawn as SVG.
 *
 * This is the non-3D path: it renders identically on the server, costs nothing
 * on mobile, and gives the arrival screen a real subject before any GLB exists.
 * `HotelScene` owns the camera/parallax so a React Three Fiber canvas can be
 * dropped in behind the same layer contract without touching the UI around it.
 */

const FLOOR_COUNT = 8;
const FLOOR_HEIGHT = 44;
const GROUND_Y = 470;

interface Floor {
  level: number;
  x: number;
  y: number;
  width: number;
}

const floors: Floor[] = Array.from({ length: FLOOR_COUNT }, (_, index) => {
  // Upper floors step back, giving each penthouse level its own terrace.
  const setback = index >= 5 ? (index - 4) * 26 : 0;
  return {
    level: index,
    x: 430 + setback,
    y: GROUND_Y - index * FLOOR_HEIGHT,
    width: 340 - setback * 2,
  };
});

function windowsFor(floor: Floor) {
  const count = Math.max(3, Math.floor(floor.width / 46));
  const gap = floor.width / count;
  return Array.from({ length: count }, (_, index) => ({
    key: `${floor.level}-${index}`,
    x: floor.x + gap * index + gap * 0.22,
    width: gap * 0.56,
    // A scattering of lit rooms, deterministic so server and client agree.
    lit: (floor.level * 7 + index * 3) % 5 < 2,
  }));
}

const trees = [
  { x: 195, y: 545, scale: 1.05 },
  { x: 246, y: 556, scale: 0.8 },
  { x: 905, y: 540, scale: 1.15 },
  { x: 960, y: 556, scale: 0.85 },
  { x: 1035, y: 548, scale: 0.95 },
];

interface ResortMassingProps {
  className?: string;
  /** Camera position, -1 (looking from the west) to 1 (from the east). */
  orbit?: number;
}

export function ResortMassing({ className, orbit = 0 }: ResortMassingProps) {
  /** Layers slide against each other to read as depth. Nearer layers move more. */
  const shift = (depth: number) => `translate(${(-orbit * depth * 90).toFixed(2)} 0)`;

  return (
    <svg
      viewBox="0 0 1200 700"
      className={className}
      preserveAspectRatio="xMidYMid slice"
      role="presentation"
      focusable="false"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#05090B" />
          <stop offset="45%" stopColor="#0C1A21" />
          <stop offset="78%" stopColor="#1E3A40" />
          <stop offset="100%" stopColor="#5E6B5F" />
        </linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#123038" />
          <stop offset="60%" stopColor="#0B2027" />
          <stop offset="100%" stopColor="#071519" />
        </linearGradient>
        <linearGradient id="facade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F2F1EC" />
          <stop offset="55%" stopColor="#DFDDD4" />
          <stop offset="100%" stopColor="#A9A79E" />
        </linearGradient>
        <linearGradient id="pool" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#05E6EC" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#087F83" stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#F6E3C4" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#F6E3C4" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="deck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2A2B25" />
          <stop offset="100%" stopColor="#141613" />
        </linearGradient>
      </defs>

      {/* Sky */}
      <g transform={shift(0.04)}>
        <rect width="1200" height="700" fill="url(#sky)" />
        <circle cx="880" cy="330" r="190" fill="url(#glow)" />
        <circle cx="880" cy="332" r="26" fill="#F7EAD2" opacity="0.9" />
        {[
          [140, 90],
          [320, 60],
          [520, 120],
          [1040, 78],
          [1130, 150],
          [700, 52],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="#F2F1EC" opacity="0.45" />
        ))}
      </g>

      {/* Far headland */}
      <g transform={shift(0.14)}>
        <path
          d="M0 352 L120 330 L230 344 L340 322 L430 340 L520 330 L600 344 L700 328 L820 342 L940 326 L1060 340 L1200 330 L1200 372 L0 372 Z"
          fill="#0A1A1E"
          opacity="0.95"
        />
      </g>

      {/* Sea */}
      <g transform={shift(0.08)}>
        <rect x="0" y="360" width="1200" height="140" fill="url(#sea)" />
        {Array.from({ length: 11 }, (_, index) => (
          <rect
            key={index}
            x={60 + ((index * 137) % 900)}
            y={378 + index * 10}
            width={90 + (index % 4) * 46}
            height="1.5"
            fill="#05E6EC"
            opacity={0.06 + (index % 3) * 0.035}
          />
        ))}
        <rect x="836" y="368" width="88" height="132" fill="#F7EAD2" opacity="0.06" />
      </g>

      {/* Hotel massing */}
      <g transform={shift(0.32)}>
        {floors.map((floor) => (
          <g key={floor.level}>
            <rect
              x={floor.x}
              y={floor.y}
              width={floor.width}
              height={FLOOR_HEIGHT}
              fill="url(#facade)"
              opacity={0.94}
            />
            {/* Slab edge */}
            <rect
              x={floor.x - 10}
              y={floor.y + FLOOR_HEIGHT - 7}
              width={floor.width + 20}
              height="7"
              fill="#F2F1EC"
              opacity="0.9"
            />
            {windowsFor(floor).map((window) => (
              <rect
                key={window.key}
                x={window.x}
                y={floor.y + 8}
                width={window.width}
                height={FLOOR_HEIGHT - 20}
                rx="2"
                fill={window.lit ? '#F7E4BE' : '#16262B'}
                opacity={window.lit ? 0.92 : 0.82}
              />
            ))}
            {/* Balcony rail, cyan rim light */}
            <rect
              x={floor.x - 10}
              y={floor.y + FLOOR_HEIGHT - 20}
              width={floor.width + 20}
              height="1.5"
              fill="#05E6EC"
              opacity="0.5"
            />
          </g>
        ))}

        {/* Rooftop terrace on the top setback */}
        <rect x="560" y="112" width="80" height="6" fill="#05E6EC" opacity="0.6" />
        <rect x="586" y="86" width="4" height="28" fill="#F2F1EC" opacity="0.6" />

        {/* Spa annex, right of the tower */}
        <rect x="790" y="428" width="120" height="86" fill="#DFDDD4" opacity="0.9" />
        <rect x="790" y="428" width="120" height="4" fill="#05E6EC" opacity="0.45" />
        <rect x="812" y="452" width="30" height="42" rx="2" fill="#16262B" opacity="0.8" />
        <rect x="856" y="452" width="30" height="42" rx="2" fill="#F7E4BE" opacity="0.85" />

        {/* Lobby, glazed base */}
        <rect x="416" y="470" width="368" height="46" fill="#16262B" opacity="0.9" />
        <rect x="416" y="470" width="368" height="2" fill="#05E6EC" opacity="0.55" />
        {Array.from({ length: 7 }, (_, index) => (
          <rect
            key={index}
            x={432 + index * 50}
            y={480}
            width="30"
            height="30"
            rx="2"
            fill="#F7E4BE"
            opacity="0.5"
          />
        ))}
      </g>

      {/* Pool deck */}
      <g transform={shift(0.52)}>
        <rect x="0" y="500" width="1200" height="200" fill="url(#deck)" />
        <ellipse cx="300" cy="566" rx="152" ry="36" fill="url(#pool)" opacity="0.9" />
        <ellipse cx="300" cy="566" rx="152" ry="36" fill="none" stroke="#F2F1EC" strokeWidth="1.5" opacity="0.35" />
        {Array.from({ length: 4 }, (_, index) => (
          <rect
            key={index}
            x={210 + index * 60}
            y={556 + (index % 2) * 8}
            width="46"
            height="2"
            fill="#F2F1EC"
            opacity="0.22"
          />
        ))}
        {/* Loungers */}
        {[152, 428].map((x) => (
          <g key={x} opacity="0.7">
            <rect x={x} y="540" width="34" height="5" rx="2" fill="#F2F1EC" opacity="0.55" />
            <rect x={x + 26} y="530" width="6" height="14" rx="2" fill="#F2F1EC" opacity="0.45" />
          </g>
        ))}
      </g>

      {/* Foreground planting */}
      <g transform={shift(0.85)}>
        {trees.map((tree) => (
          <g key={`${tree.x}-${tree.y}`} transform={`translate(${tree.x} ${tree.y}) scale(${tree.scale})`}>
            <rect x="-2.5" y="-58" width="5" height="58" fill="#101512" />
            {[-1, 1].map((direction) =>
              [0, 1, 2].map((leaf) => (
                <path
                  key={`${direction}-${leaf}`}
                  d={`M0 -58 Q ${direction * (26 + leaf * 12)} ${-70 - leaf * 6} ${direction * (44 + leaf * 14)} ${-48 - leaf * 10}`}
                  stroke="#16211A"
                  strokeWidth="5"
                  strokeLinecap="round"
                  fill="none"
                />
              )),
            )}
          </g>
        ))}
        <rect x="0" y="660" width="1200" height="40" fill="#0A0D0E" opacity="0.85" />
      </g>
    </svg>
  );
}
