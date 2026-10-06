/** Scoped SVG paint servers; colours follow the enclosing chart's theme tokens. */
export function ChartGradientDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-accent`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--plot-light)" />
        <stop offset="48%" stopColor="var(--plot-mid)" />
        <stop offset="100%" stopColor="var(--plot-deep)" />
      </linearGradient>
      <linearGradient id={`${id}-light`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--plot-soft-light)" />
        <stop offset="100%" stopColor="var(--plot-soft-deep)" />
      </linearGradient>
      <linearGradient id={`${id}-stone`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--plot-stone-light)" />
        <stop offset="100%" stopColor="var(--plot-stone-deep)" />
      </linearGradient>
    </defs>
  );
}
