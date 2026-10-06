# StaySphere monorepo

Three applications share one repository:

- apps/site — StaySphere product and marketing site.
- apps/pms — hotel back office, CMS, and PMS APIs.
- apps/guest — guest-facing hotel discovery and booking experience.

Install dependencies from this directory with npm install. Run one app with npm run dev:site, npm run dev:pms, or npm run dev:guest. npm run dev:all starts all three on ports 5173, 3001, and 3000. npm run dev:pms-guest starts PMS and Guest on ports 3001 and 3000 with separate local Worker state; Guest talks to PMS over PMS_API_URL.

Each app keeps its own build and lint commands: npm run build:<app> and npm run lint:<app>. Workspace checks are namespaced at the root.

## Ownership

Site owns product marketing. PMS owns hotel content, staff workflows, booking data, and the APIs. Guest owns the public hotel experience and submits user-initiated bookings through the PMS API. Guest no longer exposes /admin routes or has active D1/R2 bindings. A default showcase read is read-only; PMS admins provision those synthetic trips for the fixed demo hotel.

Guest deployments must set PMS_API_URL to the PMS origin. Local development defaults to http://localhost:3001.

## Remaining source cleanup

The runtime boundary is being completed, but the source split is not yet finished: PMS still contains duplicate public Guest pages, and Guest still has unreachable legacy server modules copied from PMS. Remove those copies before treating the three apps as fully isolated source projects. Existing Guest e2e configuration also still includes PMS back-office scenarios and needs to be narrowed.
