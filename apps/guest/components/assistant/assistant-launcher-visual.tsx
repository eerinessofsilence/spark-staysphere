'use client';

import styles from './assistant-launcher-visual.module.css';

// One deterministic vector mesh; only its layers move, with no per-frame JS.
function contour(phase: number, radius: number) {
  return (
    Array.from({ length: 97 }, (_, index) => {
      const angle = (index / 96) * Math.PI * 2;
      const ripple = Math.sin(angle * 5 + phase) * 1.8 + Math.cos(angle * 3 - phase) * 1.4;
      const r = radius + ripple;
      return `${index ? 'L' : 'M'}${(60 + Math.cos(angle) * r).toFixed(2)},${(60 + Math.sin(angle) * r).toFixed(2)}`;
    }).join(' ') + ' Z'
  );
}

function surfacePoint(latitude: number, longitude: number) {
  const radius = 36 + Math.sin(longitude * 5 + latitude * 3) * 1.1;
  const x = Math.cos(latitude) * Math.sin(longitude) * radius;
  const y = Math.sin(latitude) * radius;
  const z = Math.cos(latitude) * Math.cos(longitude) * radius;
  return `${(60 + x).toFixed(2)},${(60 + y * 0.96 - z * 0.26).toFixed(2)}`;
}

const latitudeMesh = Array.from({ length: 23 }, (_, row) => {
  const latitude = ((row + 1) / 24 - 0.5) * Math.PI;
  return Array.from(
    { length: 41 },
    (_, index) => `${index ? 'L' : 'M'}${surfacePoint(latitude, (index / 40 - 0.5) * Math.PI)}`,
  ).join(' ');
}).join(' ');

const longitudeMesh = Array.from({ length: 25 }, (_, column) => {
  const longitude = ((column + 1) / 26 - 0.5) * Math.PI;
  return Array.from(
    { length: 41 },
    (_, index) => `${index ? 'L' : 'M'}${surfacePoint((index / 40 - 0.5) * Math.PI, longitude)}`,
  ).join(' ');
}).join(' ');

const shellContours = Array.from({ length: 8 }, (_, index) => contour(index * 0.64, 35.5 + index * 0.6));

/** The button owns interaction; the decorative orb animates while the launcher is visible. */
export function AssistantLauncherVisual({ id, hidden = false }: { id: string; hidden?: boolean }) {
  const paint = (name: string) => `url(#${id}-${name})`;

  return (
    <span className={styles.visual} data-paused={hidden} aria-hidden="true">
      <span className={styles.halo} />
      <svg className={styles.orb} viewBox="0 0 120 120" fill="none" focusable="false">
        <defs>
          <radialGradient id={`${id}-body`} cx="38%" cy="30%" r="73%">
            <stop stopColor="var(--orb-mid)" />
            <stop offset="0.38" stopColor="var(--orb-shade)" />
            <stop offset="0.7" stopColor="var(--ink)" />
            <stop offset="0.9" stopColor="var(--orb-shade)" />
            <stop offset="1" stopColor="var(--orb-mid)" />
          </radialGradient>
          <linearGradient id={`${id}-rim`} x1="38" y1="21" x2="72" y2="103" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--orb-highlight)" />
            <stop offset="0.28" stopColor="var(--orb-accent)" />
            <stop offset="0.65" stopColor="var(--orb-mid)" />
            <stop offset="1" stopColor="var(--orb-shade)" />
          </linearGradient>
          <linearGradient id={`${id}-mesh`} x1="41" y1="25" x2="78" y2="97" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--orb-highlight)" stopOpacity="0.6" />
            <stop offset="0.5" stopColor="var(--orb-accent)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--orb-highlight)" stopOpacity="0.45" />
          </linearGradient>
          <radialGradient id={`${id}-light`} cx="50%" cy="0%" r="85%">
            <stop stopColor="var(--orb-accent)" stopOpacity="0.55" />
            <stop offset="0.48" stopColor="var(--orb-accent)" stopOpacity="0.08" />
            <stop offset="1" stopColor="var(--orb-accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className={styles.body}>
          <path d={contour(0.4, 36.5)} fill={paint('body')} />
          <g className={styles.mesh} stroke={paint('mesh')} strokeWidth="0.38">
            <path d={latitudeMesh} />
            <path d={longitudeMesh} />
          </g>
          <path className={styles.light} d={contour(0.4, 36.5)} fill={paint('light')} />
        </g>
        <g className={styles.ribbons} stroke={paint('rim')}>
          {shellContours.map((path, index) => (
            <path key={index} d={path} strokeWidth={index % 3 === 0 ? 1.15 : 0.6} opacity={0.8 - index * 0.06} />
          ))}
        </g>
        <g className={styles.filaments} stroke={paint('rim')} strokeWidth="0.65" opacity="0.75">
          <path d={contour(2.8, 38.3)} />
          <path d={contour(4.5, 40)} />
        </g>
      </svg>
      <span className={styles.label}>AI</span>
    </span>
  );
}
