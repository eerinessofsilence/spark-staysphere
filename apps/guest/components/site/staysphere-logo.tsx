'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import './staysphere-logo.css';

// These clips follow the gaps in the original artwork; the SVG mask keeps its exact contours.
const stripes = [
  { origin: '45.99px 13.27px', points: '17.79,21.67 22.59,16.87 31.59,10.27 44.79,4.27 46.59,4.27 51.99,2.47 54.99,2.47 55.59,1.87 68.19,1.87 72.99,3.67 74.19,5.47 74.19,9.07 72.99,10.27 71.79,10.27 67.59,9.07 56.79,9.07 56.19,9.67 52.59,9.67 51.99,10.27 44.19,11.47 35.19,14.47 24.39,19.87 17.79,24.67' },
  { origin: '27.39px 33.97px', points: '3.99,49.27 5.79,42.07 8.19,37.27 16.59,28.27 24.99,22.87 42.39,15.07 46.59,14.47 49.59,15.67 50.79,17.47 50.79,21.07 48.39,24.07 46.59,25.27 44.19,25.87 27.39,34.27 17.19,40.87 3.99,53.47' },
  { origin: '49.59px 40.87px', points: '2.79,65.47 3.39,63.07 5.19,60.07 10.59,54.67 20.79,48.07 45.39,36.07 46.59,36.07 59.19,29.47 74.19,19.87 84.99,10.27 90.39,8.47 93.99,9.67 96.39,12.07 96.39,17.47 92.79,21.67 86.79,25.87 72.99,33.07 71.79,33.07 68.79,34.87 67.59,34.87 64.59,36.67 54.39,40.27 52.59,41.47 49.59,42.07 44.79,44.47 41.79,45.07 33.99,48.67 32.79,48.67 30.99,49.87 29.79,49.87 20.19,54.67 12.99,59.47 8.19,64.27 3.39,73.27 2.79,71.47' },
  { origin: '61.29px 59.47px', points: '7.59,83.47 9.39,79.87 12.39,76.87 20.19,71.47 36.39,63.67 37.59,63.67 39.39,62.47 52.59,57.67 55.59,55.87 59.79,54.67 62.79,52.87 63.99,52.87 84.99,42.67 96.39,34.87 106.59,25.27 110.19,25.27 111.39,25.87 113.79,28.27 114.99,30.67 114.99,37.27 113.79,39.67 109.59,43.87 97.59,51.07 96.39,51.07 90.39,54.07 87.39,54.67 85.59,55.87 82.59,56.47 80.79,57.67 75.99,58.87 74.19,60.07 60.99,64.27 56.19,66.67 53.19,67.27 40.59,73.27 39.39,73.27 31.59,77.47 21.99,84.07 13.59,93.67 11.19,93.67 8.79,91.27 7.59,88.87' },
  { origin: '73.59px 82.57px', points: '23.79,103.87 26.19,100.87 30.99,97.27 46.59,88.87 47.79,88.87 50.79,87.07 51.99,87.07 59.79,83.47 62.79,82.87 67.59,80.47 70.59,79.87 75.39,77.47 81.39,75.67 98.19,67.87 108.39,61.27 113.79,55.87 115.59,52.87 117.99,50.47 120.99,50.47 122.79,52.27 123.39,54.67 123.39,61.27 121.59,64.87 119.19,67.27 109.59,72.67 80.79,82.87 78.99,82.87 60.99,88.87 42.39,97.27 38.79,99.67 32.19,106.27 31.59,107.47 30.99,114.67 29.79,114.67 26.19,112.27 23.79,109.27' },
  { origin: '93.99px 91.87px', points: '67.59,103.87 69.99,101.47 79.59,96.67 80.79,96.67 83.79,94.87 93.99,91.27 106.59,85.27 120.39,75.67 120.39,80.47 119.19,84.67 116.79,89.47 113.79,93.07 109.59,96.07 102.39,99.67 89.19,103.87 84.39,104.47 74.19,107.47 71.79,107.47 71.19,108.07 67.59,107.47' },
  { origin: '81.39px 111.07px', points: '53.79,117.07 54.99,115.87 57.99,114.67 71.19,113.47 71.79,112.87 74.79,112.87 75.39,112.27 77.79,112.27 78.39,111.67 87.39,109.87 95.79,106.27 96.99,106.27 108.99,99.67 108.99,102.67 99.39,111.67 93.99,115.27 83.19,120.07 81.39,120.07 78.99,121.27 76.59,121.27 75.99,121.87 72.39,121.87 71.79,122.47 57.39,122.47 54.39,121.27 53.79,120.07' },
];

const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function StaySphereLogo({ href, className, footer = false }: {
  href: string;
  className?: string;
  footer?: boolean;
}) {
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);
  const sheen = useRef<SVGRectElement>(null);
  const pulse = useRef<SVGGElement>(null);
  const sheenAnimation = useRef<Animation | null>(null);
  const pulseAnimation = useRef<Animation | null>(null);
  const stripeAnimations = useRef<{ element: SVGGElement; animation: Animation }[]>([]);
  const [highlighted, setHighlighted] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cancel = () => {
      sheenAnimation.current?.cancel();
      pulseAnimation.current?.cancel();
      stripeAnimations.current.forEach(({ animation }) => animation.cancel());
    };
    const update = () => { if (motion.matches) cancel(); };
    motion.addEventListener('change', update);
    return () => {
      motion.removeEventListener('change', update);
      cancel();
    };
  }, []);

  function enter() {
    setHighlighted(true);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    sheenAnimation.current?.cancel();
    sheenAnimation.current = sheen.current?.animate([
      { transform: 'translateX(-568px)' },
      { transform: 'translateX(568px)' },
    ], { duration: 800, easing: 'ease-in-out', fill: 'forwards' }) ?? null;

    const transforms = Array.from(svg.current?.querySelectorAll<SVGGElement>('[data-logo-stripe]') ?? [])
      .map((element) => ({ element, transform: getComputedStyle(element).transform }));
    stripeAnimations.current.forEach(({ animation }) => animation.cancel());
    stripeAnimations.current = transforms.map(({ element, transform }, index) => ({
      element,
      animation: element.animate([
        { transform },
        { transform: 'scale(1.012, 1.045)', offset: 0.4 },
        { transform: 'scale(1)' },
      ], { duration: 620, delay: index * 28, easing: 'ease-in-out', fill: 'backwards' }),
    }));
  }

  function leave() {
    setHighlighted(false);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stripeAnimations.current.forEach(({ animation }) => animation.cancel());
      return;
    }
    stripeAnimations.current = stripeAnimations.current.map(({ element, animation }) => {
      const transform = getComputedStyle(element).transform;
      animation.cancel();
      return {
        element,
        animation: element.animate([{ transform }, { transform: 'scale(1)' }], { duration: 260, easing }),
      };
    });
  }

  function click() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const transform = pulse.current ? getComputedStyle(pulse.current).transform : 'none';
    pulseAnimation.current?.cancel();
    pulseAnimation.current = pulse.current?.animate([
      { transform },
      { transform: 'scale(1.075)', offset: 0.35 },
      { transform: 'scale(1)' },
    ], { duration: 390, easing: 'ease-in-out' }) ?? null;
  }

  return (
    <Link
      href={href}
      aria-label="StaySphere"
      className={cn('staysphere-logo-link inline-flex min-h-11 shrink-0 items-center rounded-full', footer && 'staysphere-logo-footer')}
      data-logo-highlighted={highlighted}
      onPointerEnter={(event) => { if (event.pointerType !== 'touch') enter(); }}
      onPointerLeave={(event) => { if (!event.currentTarget.matches(':focus-visible')) leave(); }}
      onPointerCancel={leave}
      onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) enter(); }}
      onBlur={(event) => { if (!event.currentTarget.matches(':hover')) leave(); }}
      onClick={click}
    >
      <svg ref={svg} viewBox="0 0 718.05 125" width="718.05" height="125" aria-hidden="true" focusable="false" className={cn('staysphere-logo h-7 w-auto', className)}>
        <defs>
          <mask id={`${id}-artwork`} maskUnits="userSpaceOnUse" x="0" y="0" width="718.05" height="125" style={{ maskType: 'alpha' }}>
            <image href="/brand/staysphere-logo-on-light.svg" width="718.05" height="125" />
          </mask>
          <clipPath id={`${id}-wordmark`}><rect x="150" width="568.05" height="125" /></clipPath>
          {stripes.map((stripe, index) => (
            <clipPath key={index} id={`${id}-stripe-${index}`}><polygon points={stripe.points} /></clipPath>
          ))}
          <linearGradient id={`${id}-sheen`}>
            <stop offset="0.25" stopColor="var(--logo-sheen)" stopOpacity="0" />
            <stop offset="0.5" stopColor="var(--logo-sheen)" stopOpacity="0.65" />
            <stop offset="0.75" stopColor="var(--logo-sheen)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g mask={`url(#${id}-artwork)`} clipPath={`url(#${id}-wordmark)`}>
          <rect width="718.05" height="125" fill="var(--logo-wordmark)" />
          <rect ref={sheen} className="staysphere-logo-sheen" x="150" width="568.05" height="125" fill={`url(#${id}-sheen)`} />
        </g>
        <g className="staysphere-logo-hover">
          <g ref={pulse} className="staysphere-logo-pulse">
            {stripes.map((stripe, index) => (
              <g key={index} data-logo-stripe="" style={{ transformOrigin: stripe.origin }}>
                <rect width="125" height="125" fill="var(--logo-mark)" mask={`url(#${id}-artwork)`} clipPath={`url(#${id}-stripe-${index})`} />
              </g>
            ))}
          </g>
        </g>
      </svg>
    </Link>
  );
}
