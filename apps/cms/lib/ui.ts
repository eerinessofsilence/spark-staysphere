import { cn } from './utils';

/**
 * The few shapes the product is allowed to use, so a button on the admin page
 * and a button on the booking flow are the same object. See DESIGN_SYSTEM.md.
 */
const pillBase =
  'inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-bold whitespace-nowrap transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50';

export const pillVariants = {
  /** The primary fill — ink by day, lime by night. The one primary action on a screen. */
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  /** White with a hairline. Secondary actions and links that look like buttons. */
  secondary: 'border border-border bg-card text-foreground hover:bg-stone',
  /** No chrome until hovered. Tertiary actions inside dense UI. */
  ghost: 'text-foreground hover:bg-stone',
  /** For use over photography or on the ink band. */
  onDark: 'border border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20',
  /** Frosted over photography. Hovers to the same warm white, not to plain. */
  glass: 'glass text-foreground hover:bg-glass-tint/90',
  /**
   * The one filled pill for a surface that is dark in both schemes — a band
   * laid over a photograph. Literal colours on purpose: `primary` inverts
   * with the theme, and on a surface that never changes, it would turn into
   * an ink pill on a night photograph by day.
   */
  onPhoto: 'bg-[#F7F5F0] text-[#161616] hover:bg-white',
} as const;

export type PillVariant = keyof typeof pillVariants;

export function pill(variant: PillVariant = 'primary', className?: string): string {
  return cn(pillBase, pillVariants[variant], className);
}

/** Small descriptive chip: room facts, amenities, statuses. Never an action. */
export function tag(className?: string): string {
  return cn(
    'inline-flex items-center gap-1.5 rounded-full bg-stone px-3 py-1 text-xs font-medium text-foreground',
    className,
  );
}

/** A status keeps its words neutral while the filled mark carries its colour. */
export function statusBadge(className?: string, surface: 'card' | 'glass' = 'card'): string {
  return cn(
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-foreground whitespace-nowrap',
    surface === 'glass' ? 'glass' : 'border border-border bg-card',
    className,
  );
}

/** Round icon button, 44px hit area. */
export function iconButton(variant: 'light' | 'dark' | 'glass' = 'light', className?: string): string {
  return cn(
    'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40',
    variant === 'light' && 'border border-border bg-card hover:bg-stone',
    variant === 'dark' && 'bg-primary text-primary-foreground hover:bg-primary-hover',
    variant === 'glass' && 'glass text-foreground hover:bg-glass-tint/90',
    className,
  );
}

/** Shared square trigger and shape for row-level overflow action menus. */
export const actionMenuTriggerClass =
  'inline-flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-[8px] border border-border bg-stone text-foreground outline-none transition-colors hover:bg-stone/70 data-popup-open:bg-stone/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50';

/** Menu surfaces use a compact 6px radius; width stays contextual to their actions. */
export const actionMenuPopupClass =
  'rounded-[6px] border border-border bg-card p-1.5 text-foreground shadow-soft outline-none';

/** Consistent, touch-friendly action rows for overflow menus. */
export const actionMenuItemClass =
  'flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[4px] px-3 text-sm outline-none select-none data-highlighted:bg-stone data-disabled:cursor-not-allowed data-disabled:opacity-60';

/** Text inputs and selects share one box. */
export const fieldClass =
  'min-h-11 w-full rounded-2xl border border-border bg-card px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-accent';

/** Multi-line form controls need explicit vertical padding; browsers otherwise differ. */
export function textareaFieldClass(className?: string): string {
  return cn(fieldClass, 'resize-y py-3 leading-relaxed', className);
}
