import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline';
import { pill } from '@/lib/ui';

type AddActionButtonProps = {
  children: ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary';
  href?: string;
  pending?: boolean;
  'data-tour'?: string;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'disabled' | 'onClick' | 'title' | 'aria-label'>;

/** Shared shape and leading icon for standalone Add/Create actions in the admin. */
export function AddActionButton({
  children,
  className,
  variant = 'primary',
  href,
  pending = false,
  type = 'button',
  disabled = false,
  ...props
}: AddActionButtonProps) {
  const icon = pending
    ? <ArrowPathIcon className="size-4 shrink-0 animate-spin" aria-hidden="true" />
    : <PlusIcon className="size-4 shrink-0" aria-hidden="true" />;
  const content = <>{icon}{children}</>;
  const classNames = pill(variant, className);

  return href
    ? <Link href={href} className={classNames}>{content}</Link>
    : <button {...props} type={type} disabled={disabled || pending} className={classNames}>{content}</button>;
}
