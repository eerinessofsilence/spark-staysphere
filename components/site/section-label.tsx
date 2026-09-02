import { cn } from '@/lib/utils';

/**
 * A small sentence-case lead-in with an accent dot. This is the only kind of
 * label allowed above a heading — never uppercase, never letter-spaced.
 */
export function SectionLabel({
  className,
  tone = 'default',
  ...props
}: React.ComponentProps<'p'> & { tone?: 'default' | 'onDark' }) {
  return (
    <p
      className={cn(
        'flex items-center gap-2 text-sm',
        tone === 'onDark' ? 'text-white/70' : 'text-muted-foreground',
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
      <span>{props.children}</span>
    </p>
  );
}
