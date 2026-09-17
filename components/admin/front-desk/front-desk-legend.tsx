import { Prohibit, PushPin } from '@phosphor-icons/react/dist/ssr';
import { demandPattern } from './front-desk-shared';

export function FrontDeskLegend() {
  return (
    <ul
      aria-label="Legend"
      className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground"
    >
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-4 w-8 rounded-full bg-primary" />
        Booking
      </li>
      <li className="flex items-center gap-2">
        <PushPin weight="fill" className="size-4 text-foreground" aria-hidden="true" />
        Chosen by guest
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-4 w-8 rounded-full bg-stone" style={demandPattern} />
        Simulated demand
      </li>
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="grid h-4 w-8 place-items-center rounded-full bg-danger/10 text-danger"
        >
          <Prohibit weight="fill" className="size-3" />
        </span>
        Closed to sale
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-4 w-8 rounded-full border border-border bg-card" />
        Free
      </li>
    </ul>
  );
}
