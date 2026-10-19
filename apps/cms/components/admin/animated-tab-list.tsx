'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface AnimatedTabListProps {
  group: string;
  activeValue: string;
  children: React.ReactNode;
  className?: string;
  indicatorClassName?: string;
  indicatorMode?: 'pill' | 'underline';
  label?: string;
  role?: 'tablist';
}

const previousValues = new Map<string, string>();

/** A shared sliding active surface for route tabs and in-page tab controls. */
export function AnimatedTabList({
  group,
  activeValue,
  children,
  className,
  indicatorClassName = 'rounded-full bg-primary',
  indicatorMode = 'pill',
  label,
  role,
}: AnimatedTabListProps) {
  const listRef = React.useRef<HTMLUListElement>(null);
  const [indicator, setIndicator] = React.useState({ x: 0, y: 0, width: 0, height: 0, visible: false, animate: false });

  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let frame = 0;

    const findTab = (value: string) =>
      [...list.querySelectorAll<HTMLElement>('[data-tab-value]')].find((tab) => tab.dataset.tabValue === value);
    const positionFor = (tab: HTMLElement) => {
      const listRect = list.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      return {
        x: tabRect.left - listRect.left + list.scrollLeft,
        y: tabRect.top - listRect.top + list.scrollTop,
        width: tabRect.width,
        height: tabRect.height,
        visible: true,
      };
    };

    const selected = findTab(activeValue);
    if (!selected) return;

    const previousValue = previousValues.get(group);
    const previous = previousValue && previousValue !== activeValue ? findTab(previousValue) : undefined;
    if (previous && previous.getBoundingClientRect().height > 0) {
      setIndicator({ ...positionFor(previous), animate: false });
      frame = requestAnimationFrame(() => setIndicator({ ...positionFor(selected), animate: true }));
    } else {
      setIndicator({ ...positionFor(selected), animate: false });
    }
    previousValues.set(group, activeValue);

    const updatePosition = () => {
      const current = findTab(activeValue);
      if (current) setIndicator((previousIndicator) => ({ ...positionFor(current), animate: previousIndicator.animate }));
    };
    const observer = new ResizeObserver(updatePosition);
    observer.observe(list);
    observer.observe(selected);
    window.addEventListener('resize', updatePosition);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
    };
  }, [activeValue, group]);

  return (
    <ul
      ref={listRef}
      role={role}
      aria-label={label}
      className={cn('relative', className)}
    >
      <li
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-0 left-0 z-0',
          indicator.animate && 'transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          indicatorMode === 'underline' ? 'rounded-none bg-accent' : indicatorClassName,
          indicator.visible ? 'opacity-100' : 'opacity-0',
        )}
        style={indicatorMode === 'underline'
          ? {
              width: indicator.width,
              height: 2,
              transform: `translate3d(${indicator.x}px, ${indicator.y + indicator.height - 2}px, 0)`,
            }
          : {
              width: indicator.width,
              height: indicator.height,
              transform: `translate3d(${indicator.x}px, ${indicator.y}px, 0)`,
            }}
      />
      {children}
    </ul>
  );
}
