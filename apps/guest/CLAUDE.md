# StaySphere Guest

This project is the public hotel discovery and booking frontend. PMS owns all hotel data and booking writes; Product Site lives separately in apps/site.

Guest pages call PMS through lib/application/pms-api.ts. Keep API DTOs in guest-contracts.ts, and keep public page loading read-only. Booking creation occurs only after the visitor submits the booking flow. Do not add PMS admin pages, local repositories, data seeders, D1/R2 bindings, or direct imports of PMS implementation services.

The Guest site covers the hotel arrival scene, room search and floor plan, room detail, demo booking, booking confirmation, and trips. Local configuration uses PMS_API_URL; the integrated development command is npm run dev:pms-guest from the monorepo root.

Read AGENTS.md for the working contract and DESIGN_SYSTEM.md before visual changes.
