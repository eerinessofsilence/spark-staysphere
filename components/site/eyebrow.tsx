import { cn } from '@/lib/utils';

/** Uppercase metadata label used above section headings. */
export function Eyebrow({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('eyebrow text-muted-foreground', className)} {...props} />;
}
