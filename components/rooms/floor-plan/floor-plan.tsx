'use client';

import * as React from 'react';
import type { FloorPlanUnit } from '@/lib/application/inventory-service';
import { facades, type Facade } from '@/lib/domain/room-units';
import type { StayCriteria } from '@/lib/domain/schemas';
import { facadeLabels, formatFloor, formatRoomNumber } from '@/lib/formatting';
import { Modal } from '@/components/site/modal';
import { cn } from '@/lib/utils';
import { RoomUnitCard } from './room-unit-card';
import { categoryShort, hatch, statusSurface, unitStatusWords } from './unit-status';

interface FloorPlanProps {
  units: FloorPlanUnit[];
  floors: number[];
  criteria: StayCriteria;
  initialRoom: string | null;
}

const legend = [
  { label: 'Available', swatch: statusSurface.available, style: undefined },
  {
    label: 'Selected',
    swatch: cn(statusSurface.available, 'ring-2 ring-accent ring-offset-1 ring-offset-canvas'),
    style: undefined,
  },
  { label: 'Booked', swatch: statusSurface.booked, style: hatch },
  { label: "Doesn't fit your party", swatch: statusSurface.unsuitable, style: undefined },
  { label: 'Hidden by filters', swatch: statusSurface.filtered, style: undefined },
];

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
      <div className="rounded-[28px] border border-dashed border-border bg-card p-10 text-center">
        <h2 className="text-display text-3xl">No rooms on the plan</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          There are no rooms to show for this stay right now. Try other dates.
        </p>
      </div>
    );
  }

  const gridProps = { units, floors, selected, onSelect: toggle, guests };

  return (
    <div className="grid grid-cols-1 gap-y-6 gap-x-gutter xl:grid-cols-sidebar">
      <div className="min-w-0">
        <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
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

      <aside aria-label="Selected room" className="hidden xl:block">
        <div className="sticky top-24">
          {selectedUnit ? (
            <RoomUnitCard unit={selectedUnit} criteria={criteria} onClose={close} />
          ) : (
            <p className="rounded-[28px] border border-dashed border-border p-6 text-sm leading-relaxed text-muted-foreground">
              Pick a room on the plan to see what it is, what it costs for your dates, and book that
              exact room.
            </p>
          )}
        </div>
      </aside>

      <Modal
        open={selectedUnit !== null && wide === false}
        onClose={close}
        title={selectedUnit ? formatRoomNumber(selectedUnit.number) : 'Room'}
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
}

function FacadeGrid({ units, floors, shown, selected, onSelect, guests }: FacadeGridProps) {
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
          <h3 key={facade} className="rounded-t-[28px] bg-card px-4 pt-4 pb-2 text-sm font-medium">
            {facadeLabels[facade]}
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
                  aria-label={`${facadeLabels[facade]}, ${formatFloor(floor)}`}
                  className={cn(
                    'flex flex-wrap content-start gap-1 bg-card px-3 py-1.5',
                    index > 0 && 'border-t border-border/60',
                    last && 'rounded-b-[28px] pb-4',
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
}: {
  unit: FloorPlanUnit;
  selected: boolean;
  onSelect: (number: string) => void;
  guests: number;
}) {
  const label = `${formatRoomNumber(unit.number)}, ${unit.roomName}. ${unitStatusWords(unit, guests)}`;
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
      <span className="mt-0.5 text-[9px] leading-none opacity-80">{categoryShort[unit.category]}</span>
    </button>
  );
}
