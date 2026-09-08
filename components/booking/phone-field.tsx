'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { iconButton } from '@/lib/ui';
import { useOverlayTransition } from '@/components/site/use-overlay-transition';
import { cn } from '@/lib/utils';

export interface Country {
  iso: string;
  name: string;
  dial: string;
  flag: string;
}

/**
 * Dial codes a guest booking a Croatian hotel is actually likely to pick —
 * the property's own country first, then the rest of Europe by how often
 * European guests book it, then the other markets a demo needs to cover.
 * Not the full ITU list: this is a booking form, not a phone directory.
 */
export const COUNTRIES: Country[] = [
  { iso: 'HR', name: 'Croatia', dial: '+385', flag: '🇭🇷' },
  { iso: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
  { iso: 'AT', name: 'Austria', dial: '+43', flag: '🇦🇹' },
  { iso: 'IT', name: 'Italy', dial: '+39', flag: '🇮🇹' },
  { iso: 'SI', name: 'Slovenia', dial: '+386', flag: '🇸🇮' },
  { iso: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { iso: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { iso: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱' },
  { iso: 'BE', name: 'Belgium', dial: '+32', flag: '🇧🇪' },
  { iso: 'CH', name: 'Switzerland', dial: '+41', flag: '🇨🇭' },
  { iso: 'ES', name: 'Spain', dial: '+34', flag: '🇪🇸' },
  { iso: 'PT', name: 'Portugal', dial: '+351', flag: '🇵🇹' },
  { iso: 'IE', name: 'Ireland', dial: '+353', flag: '🇮🇪' },
  { iso: 'SE', name: 'Sweden', dial: '+46', flag: '🇸🇪' },
  { iso: 'NO', name: 'Norway', dial: '+47', flag: '🇳🇴' },
  { iso: 'DK', name: 'Denmark', dial: '+45', flag: '🇩🇰' },
  { iso: 'FI', name: 'Finland', dial: '+358', flag: '🇫🇮' },
  { iso: 'PL', name: 'Poland', dial: '+48', flag: '🇵🇱' },
  { iso: 'CZ', name: 'Czechia', dial: '+420', flag: '🇨🇿' },
  { iso: 'SK', name: 'Slovakia', dial: '+421', flag: '🇸🇰' },
  { iso: 'HU', name: 'Hungary', dial: '+36', flag: '🇭🇺' },
  { iso: 'RO', name: 'Romania', dial: '+40', flag: '🇷🇴' },
  { iso: 'BG', name: 'Bulgaria', dial: '+359', flag: '🇧🇬' },
  { iso: 'GR', name: 'Greece', dial: '+30', flag: '🇬🇷' },
  { iso: 'RS', name: 'Serbia', dial: '+381', flag: '🇷🇸' },
  { iso: 'BA', name: 'Bosnia and Herzegovina', dial: '+387', flag: '🇧🇦' },
  { iso: 'ME', name: 'Montenegro', dial: '+382', flag: '🇲🇪' },
  { iso: 'UA', name: 'Ukraine', dial: '+380', flag: '🇺🇦' },
  { iso: 'TR', name: 'Turkey', dial: '+90', flag: '🇹🇷' },
  { iso: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { iso: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { iso: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { iso: 'NZ', name: 'New Zealand', dial: '+64', flag: '🇳🇿' },
  { iso: 'AE', name: 'United Arab Emirates', dial: '+971', flag: '🇦🇪' },
  { iso: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦' },
  { iso: 'IL', name: 'Israel', dial: '+972', flag: '🇮🇱' },
  { iso: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { iso: 'CN', name: 'China', dial: '+86', flag: '🇨🇳' },
  { iso: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵' },
  { iso: 'KR', name: 'South Korea', dial: '+82', flag: '🇰🇷' },
  { iso: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬' },
  { iso: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷' },
  { iso: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽' },
  { iso: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦' },
];

export const DEFAULT_COUNTRY_ISO = 'HR';

export function countryByIso(iso: string): Country {
  return COUNTRIES.find((country) => country.iso === iso) ?? COUNTRIES[0]!;
}

/** Panel width from `sm`. Kept here because the fixed position maths needs it. */
const PANEL_WIDTH = 300;
const VIEWPORT_MARGIN = 12;

function matches(country: Country, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/[^\d]/g, '');
  return (
    country.name.toLowerCase().includes(q) ||
    country.iso.toLowerCase() === q ||
    (digits.length > 0 && country.dial.replace('+', '').startsWith(digits))
  );
}

interface PhoneFieldProps {
  id: string;
  countryIso: string;
  nationalNumber: string;
  onCountryChange: (iso: string) => void;
  onNationalNumberChange: (value: string) => void;
  invalid?: boolean;
}

/**
 * A dial-code picker fused to the number field, the shape every guest already
 * knows from checkout forms. Forty-plus countries is too long a list to
 * scan, so the trigger opens a real search — type a name, an ISO code, or
 * the digits of the dial code itself — rather than asking the guest to
 * scroll, or to know that a native `<select>` jumps on a typed letter.
 */
export function PhoneField({
  id,
  countryIso,
  nationalNumber,
  onCountryChange,
  onNationalNumberChange,
  invalid,
}: PhoneFieldProps) {
  const country = countryByIso(countryIso);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const { rendered, visible } = useOverlayTransition(open);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [anchor, setAnchor] = React.useState<DOMRect | null>(null);

  const results = React.useMemo(
    () => COUNTRIES.filter((candidate) => matches(candidate, query)),
    [query],
  );

  React.useEffect(() => {
    if (!open) return;
    const track = () => setAnchor(triggerRef.current?.getBoundingClientRect() ?? null);
    track();
    window.addEventListener('resize', track);
    window.addEventListener('scroll', track, true);
    return () => {
      window.removeEventListener('resize', track);
      window.removeEventListener('scroll', track, true);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    // The panel's enter transition takes a frame; focusing before that
    // lands the cursor but not the visible caret on some browsers.
    const timeout = window.setTimeout(() => searchRef.current?.focus(), 20);
    return () => window.clearTimeout(timeout);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  React.useEffect(() => {
    if (!rendered) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, rendered]);

  const choose = (iso: string) => {
    onCountryChange(iso);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onSearchKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && results[0]) {
      event.preventDefault();
      choose(results[0].iso);
    }
  };

  const panel = (
    <div className="text-foreground">
      <div
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-40 bg-ink/20 transition-opacity duration-200 sm:hidden',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Country code"
        className={cn(
          'fixed inset-x-3 bottom-3 z-50 flex max-h-[75dvh] flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-soft-lg',
          'sm:inset-auto sm:top-(--panel-top) sm:left-(--panel-left) sm:w-(--panel-width) sm:max-w-[calc(100vw-2rem)] sm:rounded-3xl',
          'transition-[opacity,translate] duration-200 ease-out',
          visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-8 opacity-0 sm:translate-y-0',
        )}
        style={
          anchor
            ? ({
                '--panel-top': `${anchor.bottom + 8}px`,
                '--panel-left': `${Math.min(
                  Math.max(VIEWPORT_MARGIN, anchor.left),
                  Math.max(VIEWPORT_MARGIN, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN),
                )}px`,
                '--panel-width': `${PANEL_WIDTH}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <div className="flex items-center gap-2 border-b border-border p-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className={cn(iconButton('light', 'size-10 shrink-0'), 'sm:hidden')}
          >
            <XMarkIcon className="size-4" aria-hidden="true" />
          </button>
          <div className="relative flex-1">
            <MagnifyingGlassIcon
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search country or code"
              aria-label="Search countries"
              className="min-h-10 w-full rounded-full border border-border bg-transparent py-2 pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-accent"
            />
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto p-2" role="listbox" aria-label="Countries">
          {results.length === 0 ? (
            <li className="p-4 text-center text-sm text-muted-foreground">
              No country matches &ldquo;{query}&rdquo;.
            </li>
          ) : (
            results.map((option) => {
              const selected = option.iso === country.iso;
              return (
                <li key={option.iso}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => choose(option.iso)}
                    className={cn(
                      'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-2xl px-3 text-left text-sm transition-colors hover:bg-stone/60',
                      selected && 'bg-stone/60',
                    )}
                  >
                    <span aria-hidden="true" className="text-base leading-none">
                      {option.flag}
                    </span>
                    <span className="flex-1 truncate">{option.name}</span>
                    <span className="text-muted-foreground">{option.dial}</span>
                    {selected ? (
                      <CheckIcon className="size-4 shrink-0 text-foreground" aria-hidden="true" />
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );

  const overlay = rendered ? createPortal(panel, document.body) : null;

  return (
    <div
      className={cn(
        'flex items-stretch overflow-hidden rounded-2xl border border-border bg-card transition-colors focus-within:border-accent',
        invalid && 'border-danger',
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        id={`${id}-country`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Country code, ${country.name} ${country.dial}. Choose a country.`}
        onClick={() => setOpen((current) => !current)}
        className="flex shrink-0 cursor-pointer items-center gap-1 border-r border-border pr-2 pl-3.5 transition-colors hover:bg-stone/60"
      >
        <span aria-hidden="true" className="text-base leading-none">
          {country.flag}
        </span>
        <span className="text-sm font-medium text-muted-foreground">{country.dial}</span>
        <ChevronDownIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </button>
      <input
        id={id}
        type="tel"
        autoComplete="tel-national"
        placeholder="Enter your phone number"
        value={nationalNumber}
        aria-invalid={invalid}
        onChange={(event) => onNationalNumberChange(event.target.value)}
        className="min-h-11 w-full bg-transparent px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      {overlay}
    </div>
  );
}
