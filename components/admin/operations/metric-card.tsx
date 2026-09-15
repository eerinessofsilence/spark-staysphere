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
}: {
  label: string;
  value: string;
  detail: string;
  chart?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-[28px] bg-card p-5 shadow-soft sm:p-6">
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="mt-3">
        <span className="text-display block text-2xl tabular-nums sm:text-4xl">{value}</span>
        <span className="mt-1.5 block text-sm text-muted-foreground">{detail}</span>
      </dd>
      {chart}
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
