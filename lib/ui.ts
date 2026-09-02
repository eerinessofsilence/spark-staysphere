import { cn } from './utils';

/**
 * The few shapes the product is allowed to use, so a button on the admin page
 * and a button on the booking flow are the same object. See DESIGN_SYSTEM.md.
 */
const pillBase =
  'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export const pillVariants = {
  /** Ink fill. The one primary action on a screen. */
  primary: 'bg-ink text-[#F7F5F0] hover:bg-[#2b2b2b]',
  /** White with a hairline. Secondary actions and links that look like buttons. */
  secondary: 'border border-border bg-card text-foreground hover:bg-stone',
  /** No chrome until hovered. Tertiary actions inside dense UI. */
  ghost: 'text-foreground hover:bg-stone',
  /** For use over photography or on the ink band. */
  onDark: 'border border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20',
  /** Frosted white over photography. */
  glass: 'glass text-foreground hover:bg-white/90',
} as const;

export type PillVariant = keyof typeof pillVariants;

export function pill(variant: PillVariant = 'primary', className?: string): string {
  return cn(pillBase, pillVariants[variant], className);
}

/** Small descriptive chip: room facts, amenities, statuses. Never an action. */
export function tag(className?: string): string {
  return cn(
    'inline-flex items-center gap-1.5 rounded-full bg-stone px-3 py-1.5 text-xs font-medium text-foreground',
    className,
  );
}

/** Round icon button, 44px hit area. */
export function iconButton(variant: 'light' | 'dark' | 'glass' = 'light', className?: string): string {
  return cn(
    'inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40',
    variant === 'light' && 'border border-border bg-card hover:bg-stone',
    variant === 'dark' && 'bg-ink text-[#F7F5F0] hover:bg-[#2b2b2b]',
    variant === 'glass' && 'glass text-foreground hover:bg-white/90',
    className,
  );
}

/** Text inputs and selects share one box. */
export const fieldClass =
  'min-h-11 w-full rounded-2xl border border-border bg-card px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-accent';
