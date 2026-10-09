import type { ReactNode } from 'react';

/**
 * One figure on an operator's screen: a short label, the display number, one
 * muted line of context, and an optional mark beneath. The admin exception to
 * rule 2 in DESIGN_SYSTEM.md — an operator scans these in a grid, not in a
 * sentence. Shared by the dashboard and accounting so the two read as one set.
 * Render inside a `<dl>`.
 */
export function Metric({
  label,
  value,
  detail,
  chart,
  icon,
}: {
  label: string;
  value: ReactNode;
  detail: string;
  chart?: ReactNode;
  /** A Heroicons outline mark beside the label — the interface glyph for what the figure counts (rule 5), never a tinted-circle feature icon (rule 3). */
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
      <dt className="flex items-center gap-2 text-sm font-medium">
        {icon ? <span className="shrink-0 text-muted-foreground [&>svg]:size-5" aria-hidden="true">{icon}</span> : null}
        {label}
      </dt>
      <dd className="mt-3">
        <span className="text-display block text-2xl tabular-nums sm:text-3xl">{value}</span>
        <span className="mt-1.5 block text-sm text-muted-foreground">{detail}</span>
      </dd>
      {/* Pinned to the bottom so marks line up across a row of cards whose copy wraps differently. */}
      {chart ? <div className="mt-auto pt-6">{chart}</div> : null}
    </div>
  );
}

/** A ratio against its own total — fill in the accent, track a lighter step of the same ramp. */
export function Meter({ share }: { share: number }) {
  return (
    <div aria-hidden="true" className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-accent-soft">
      <div
        className="h-full rounded-full bg-accent"
        style={{ width: `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%` }}
      />
    </div>
  );
}
