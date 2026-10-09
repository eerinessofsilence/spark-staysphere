# 360° views

This module contains the building orbit and room panorama viewer used by the public Guest app.
Import components through `@/components/view-360`; keep internal module imports relative.

The building orbit renders the frame sequence and public hotspot/zone data returned by PMS. The
PMS CMS owns editing spinner frames and zones; Guest must not import PMS services, repositories, or
storage to read that content. Room panoramas are local assets under `public/images/panoramas` and
are rendered from catalog media returned by PMS.

The frame math and sphere geometry are pure helpers beside their implementations. Preserve
pointer and touch behavior: a press becomes a drag only after its movement threshold, and the stage
must allow vertical page scrolling on touch devices. Keep visible loading and fallback states when
frames or panorama assets cannot load.

The Guest journey is covered by `apps/guest/e2e/golden-path.spec.ts`. Spinner editing is covered by
the PMS editor specs under `apps/pms/e2e/`; these apps use different base URLs and own separate
browser flows.
