# CMS project

Independent extraction of StaySphere's hotel content tools and public showcase.
The original project at ../staysphere must never be edited by work in this project.

- apps/cms owns hotel content, rooms, media, 360 frames and zones, staff authentication, and the public catalog API.
- apps/guest is a stateless showcase. It reads CMS_API_URL; it never checks availability, creates bookings, collects payments or stores guest records.
- apps/site is the product marketing site.
- Keep the existing design system and real photography/360 viewers. Read the app's DESIGN_SYSTEM.md before UI changes.
- Never copy credentials, .env/.dev.vars, deployment identities, local databases, uploads or production state from StaySphere.
- CMS uses its own project-local D1/R2 emulation. Never reuse another project's bindings or state paths.
- No tests, builds, lint, typecheck, browser or visual checks without the user's explicit request.
- Do not create subagents without the user's explicit request.
- Manual edits use apply_patch. Preserve unrelated work and do not deploy without a deployment request.
