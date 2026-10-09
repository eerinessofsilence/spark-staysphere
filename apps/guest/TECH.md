# Guest technical notes

Guest is a stateless frontend Worker. PMS owns hotels, room content, prices, availability, booking creation and updates, guest records, and the curated showcase. Guest has no active admin surface and no D1/R2 bindings.

## Request flow

    Guest page or action
      -> lib/application/pms-api.ts
      -> PMS HTTP API at PMS_API_URL
      -> PMS application service and repository

The API proxy routes under app/api preserve same-origin URLs for the booking form and assistant. They forward requests to PMS and do not read or write a local Guest database. PMS_API_URL is read from Worker env or .env.local; production deployments must set it to the PMS origin.

## Data access

- Catalog reads use PMS /api/public/catalog operations.
- Quotes and booking submissions go to PMS /api/quotes and /api/bookings; PMS rechecks price and availability and enforces idempotency.
- Confirmation access uses a signed token stored in an HttpOnly Guest cookie and verified by PMS.
- Trip lookup uses signed tokens for remembered bookings; claiming or cancellation requires the booking reference and matching email.
- The Guest /trips showcase read is read-only. PMS admins provision synthetic showcase records for the fixed demo hotel from PMS bookings; Guest has no seeder.
- Media URLs are proxied to PMS. Guest does not own an uploaded-media bucket.

Types in guest-contracts.ts are the HTTP boundary shapes consumed by the frontend. Guest-side domain helpers may parse URLs or format presentation data, but PMS owns business decisions and persistence.

## Local and deployed setup

Run npm run dev:pms-guest from the monorepo root to start PMS on port 3001 and Guest on port 3000. They have separate local Worker state; the only connection is the Guest-to-PMS API URL. Deploy Guest with npm run deploy --workspace=@staysphere/guest after configuring the Guest Worker variable PMS_API_URL. The Guest deploy script does not create storage resources.
