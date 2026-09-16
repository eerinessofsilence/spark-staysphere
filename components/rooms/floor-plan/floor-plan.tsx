'use client';

import * as React from 'react';
import type { FloorPlanUnit } from '@/lib/application/inventory-service';
import { facades, type Facade } from '@/lib/domain/room-units';
import type { StayCriteria } from '@/lib/domain/schemas';
import { useLocale, useT } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n/dictionaries';
import { lCategoryShort, lFacade, lFloor, lRoomNumber } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locale';
import { Modal } from '@/components/site/modal';
import { cn } from '@/lib/utils';
import { RoomUnitCard } from './room-unit-card';
import { hatch, statusSurface, unitStatusWords } from './unit-status';

interface FloorPlanProps {
  units: FloorPlanUnit[];
  floors: number[];
  criteria: StayCriteria;
  initialRoom: string | null;
}

/** Null until mounted, so a preselected room never flashes the phone sheet open on a desk. */
function useWideScreen(): boolean | null {
  const [wide, setWide] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    const query = window.matchMedia('(min-width: 1280px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return wide;
}

export function FloorPlan({ units, floors, criteria, initialRoom }: FloorPlanProps) {
  const t = useT();
  const { locale } = useLocale();
  const legend = [
    { label: t('rooms.legendAvailable'), swatch: statusSurface.available, style: undefined },
    {
      label: t('rooms.legendSelected'),
      swatch: cn(statusSurface.available, 'ring-2 ring-accent ring-offset-1 ring-offset-canvas'),
      style: undefined,
    },
    { label: t('rooms.legendBooked'), swatch: statusSurface.booked, style: hatch },
    { label: t('rooms.legendUnsuitable'), swatch: statusSurface.unsuitable, style: undefined },
    { label: t('rooms.legendFiltered'), swatch: statusSurface.filtered, style: undefined },
  ];
  const [selected, setSelected] = React.useState<string | null>(
    initialRoom && units.some((unit) => unit.number === initialRoom) ? initialRoom : null,
  );
  const wide = useWideScreen();
  const close = React.useCallback(() => setSelected(null), []);
  const toggle = React.useCallback(
    (number: string) => setSelected((current) => (current === number ? null : number)),
    [],
  );
  const selectedUnit = units.find((unit) => unit.number === selected) ?? null;
  const guests = criteria.adults + criteria.children;

  if (units.length === 0) {
    return (
      <div className="rounded-[18px] border border-dashed border-border bg-card p-10 text-center">
        <h2 className="text-display text-3xl">{t('rooms.noRoomsOnPlan')}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t('rooms.noRoomsOnPlanBody')}</p>
      </div>
    );
  }

  const gridProps = { units, floors, selected, onSelect: toggle, guests, t, locale };

  return (
    <div className="grid grid-cols-1 gap-y-6 gap-x-gutter xl:grid-cols-sidebar">
      <div className="min-w-0">
        <ul aria-label={t('rooms.legendAria')} className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn('size-4 shrink-0 rounded-[5px] border border-border', item.swatch)}
                style={item.style}
              />
              {item.label}
            </li>
          ))}
        </ul>

        <div className="mt-5 hidden sm:block">
          <FacadeGrid {...gridProps} shown={facades} />
        </div>
        <div className="mt-5 grid gap-5 sm:hidden">
          {facades.map((facade) => (
            <FacadeGrid key={facade} {...gridProps} shown={[facade]} />
          ))}
        </div>
      </div>

      <aside aria-label={t('rooms.selectedRoomAria')} className="hidden xl:block">
        <div className="sticky top-24">
          {selectedUnit ? (
            <RoomUnitCard unit={selectedUnit} criteria={criteria} onClose={close} />
          ) : (
            <p className="rounded-[18px] border border-dashed border-border p-6 text-sm leading-relaxed text-muted-foreground">
              {t('rooms.pickARoomOnPlan')}
            </p>
          )}
        </div>
      </aside>

      <Modal
        open={selectedUnit !== null && wide === false}
        onClose={close}
        title={selectedUnit ? lRoomNumber(selectedUnit.number, locale) : t('rooms.room')}
        chrome={false}
      >
        {selectedUnit ? <RoomUnitCard unit={selectedUnit} criteria={criteria} onClose={close} bare /> : null}
      </Modal>
    </div>
  );
}

interface FacadeGridProps {
  units: FloorPlanUnit[];
  floors: number[];
  shown: Facade[];
  selected: string | null;
  onSelect: (number: string) => void;
  guests: number;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  locale: Locale;
}

function FacadeGrid({ units, floors, shown, selected, onSelect, guests, t, locale }: FacadeGridProps) {
  const rows = floors.filter((floor) =>
    units.some((unit) => unit.floor === floor && shown.includes(unit.facade)),
  );

  return (
    <div className="relative overflow-x-auto contain-inline-size">
      <div
        className="grid gap-x-3"
        style={{ gridTemplateColumns: `2rem repeat(${shown.length}, minmax(0, 1fr)) 2rem` }}
      >
        <span aria-hidden="true" />
        {shown.map((facade) => (
          <h3 key={facade} className="rounded-t-[18px] bg-card px-4 pt-4 pb-2 text-sm font-medium">
            {lFacade(facade, locale)}
          </h3>
        ))}
        <span aria-hidden="true" />

        {rows.map((floor, index) => {
          const last = index === rows.length - 1;
          return (
            <React.Fragment key={floor}>
              <FloorLabel floor={floor} />
              {shown.map((facade) => (
                <div
                  key={facade}
                  role="group"
                  aria-label={`${lFacade(facade, locale)}, ${lFloor(floor, locale)}`}
                  className={cn(
                    'flex flex-wrap content-start gap-1 bg-card px-3 py-1.5',
                    index > 0 && 'border-t border-border/60',
                    last && 'rounded-b-[18px] pb-4',
                  )}
                >
                  {units
                    .filter((unit) => unit.floor === floor && unit.facade === facade)
                    .map((unit) => (
                      <Cell
                        key={unit.number}
                        unit={unit}
                        selected={unit.number === selected}
                        onSelect={onSelect}
                        guests={guests}
                        t={t}
                        locale={locale}
                      />
                    ))}
                </div>
              ))}
              <FloorLabel floor={floor} />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function FloorLabel({ floor }: { floor: number }) {
  return (
    <span aria-hidden="true" className="flex items-start justify-center pt-4 text-xs text-muted-foreground tabular-nums">
      {floor === 0 ? 'G' : floor}
    </span>
  );
}

function Cell({
  unit,
  selected,
  onSelect,
  guests,
  t,
  locale,
}: {
  unit: FloorPlanUnit;
  selected: boolean;
  onSelect: (number: string) => void;
  guests: number;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  locale: Locale;
}) {
  const label = `${lRoomNumber(unit.number, locale)}, ${unit.roomName}. ${unitStatusWords(unit, guests, t)}`;
  return (
    <button
      type="button"
      onClick={() => onSelect(unit.number)}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      style={unit.status === 'booked' ? hatch : undefined}
      className={cn(
        'flex size-11 cursor-pointer flex-col items-center justify-center rounded-lg text-center transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card',
        statusSurface[unit.status],
        selected
          ? 'opacity-100 ring-2 ring-accent ring-offset-2 ring-offset-card'
          : unit.status === 'available' && 'hover:ring-2 hover:ring-tint-sage-ink/40',
      )}
    >
      <span className={cn('text-[11px] leading-none font-semibold tabular-nums', unit.status === 'booked' && 'line-through')}>
        {unit.number}
      </span>
      <span className="mt-0.5 text-[9px] leading-none opacity-80">{lCategoryShort(unit.category, locale)}</span>
    </button>
  );
}
