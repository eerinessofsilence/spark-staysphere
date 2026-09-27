# Guest identity documents

The existing Add Booking forms share `components/admin/front-desk/booking-form-fields.tsx`.
The optional scanner opens from that Guest section. Manual entry and property-scoped guest
search remain available. Camera capture requires HTTPS or localhost and camera permission;
JPEG/PNG upload works without camera access. Images are re-encoded to remove file metadata.

Recognition runs locally in a disposable Tesseract Web Worker. Its code, WASM and English
language data are served from this application; no passport is sent to an external OCR API.
`scripts/prepare-document-ocr.mjs` copies the locked npm assets during install/dev/build.
The provider port is `DocumentOcrProvider` in `lib/domain/guest-document.ts`; the browser
service is `lib/application/document-ocr-service.ts`. Tesseract configuration follows its
[official local installation documentation](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md).
The parser supports TD1/TD2/TD3 MRZ and English printed labels. Missing/unverified values
need staff review; it does not infer missing issue dates or validate document authenticity.

Nothing is persisted by OCR. Confirm validates reviewed fields, offers matching profiles
by document number/country or the existing email identity, and uses the existing guest
profile repository. Email and phone remain required by the existing booking model.
Identity metadata extends GuestProfile through the `guest_profile_identities` table.

The same reviewed photo is uploaded with Create booking and stored in private object storage.
`guest_documents` records the existing property-scoped guest email identity and the reservation
ID/reference. Booking request IDs are stable across retries. If booking succeeds and upload
fails, the form reports the reference and can retry the attachment without creating another stay.
An uploading record is saved before PUT so interrupted uploads are discoverable for erasure.
No thumbnails are generated or persisted; previews stream the original through the authenticated
route, without Next image optimization, public URLs, or HTTP caching.

## Hosting

Cloudflare uses a **separate, private** R2 binding `PRIVATE_DOCUMENTS`. Local Vite configuration
provides this binding automatically. `scripts/deploy.mjs` provisions the private bucket when
that existing deployment command is used. Keep its R2 public access and custom public domains
disabled; do not configure replication, archival, or external backups of document image objects.
Public CMS photos continue to use `MEDIA`.
Document uploads also require the existing durable D1/Turso database; unlike general demo data,
document records do not fall back to process memory, which would lose their deletion queue.

Vercel uses a separate **private** Blob store token `PRIVATE_DOCUMENTS_BLOB_READ_WRITE_TOKEN`.
The existing public Blob token is never used as a fallback. Configure `CRON_SECRET` for the
authenticated deletion endpoint and enable the cron in `vercel.json` on a plan supporting
its ten-minute schedule. No credentials are needed for OCR.

The new `worker.ts` retains the existing vinext fetch handler and adds Cloudflare scheduled
deletion every ten minutes. On Vercel the cron calls `/api/internal/document-deletions`.
Opening Guest → Documents also drains that property's pending deletions. Local dev does not
automatically fire Cloudflare cron events; immediate checkout and page-triggered retry work,
and local cron can be exercised with Wrangler's scheduled-event testing support.

## Retention and access

The existing `BookingService.setStayStateAsHotel` invokes erasure only after the persisted
state becomes `checked_out`. D1 writes deletion intent atomically with that transition.
Planned dates and extensions do not trigger erasure. Undoing checkout does not undo erasure.
The document remains with status, deletion reason and timestamp; guest and booking history remain.
All object keys (original and any future derivatives) are deleted idempotently. Storage errors
leave `pending_deletion` and never fail checkout. The persisted checkout itself provides recovery
if a process stops before the callback; scheduled processing also retries explicit deletion intent.
The worker reapplies retained deletion records idempotently so a late completion of an interrupted
upload cannot leave an orphaned image. The original deletion timestamp is preserved.

The image route resolves the selected property on the server, requires the existing
`team.permViewBookings` permission, and checks the current reservation state both before and after
reading storage. `no-store`, `nosniff`, and same-origin headers apply to every image response.
Metadata is property-scoped. No new roles or permissions are introduced. The demo's existing
property switcher remains its property context; this feature does not introduce a new membership model.

Photos are held only in component memory before submission, with object URLs revoked and
camera tracks/OCR workers stopped on close. Images are absent from browser persistent storage,
application logs, analytics, audit records, and database payloads. Use synthetic fixtures for tests.

## Verification

`lib/domain/document-mrz.test.ts` covers parsed fields and damaged MRZ checksums.
`lib/application/guest-document-service.test.ts` covers matching, property separation, dates,
actual checkout, original/derivative erasure, retries, recovery, concurrent upload, and idempotency.
`e2e/guest-documents.spec.ts` exercises real local OCR, review edits, booking attachment,
private preview, check-in/out, retained history, manual booking and guest selection on both layouts.
