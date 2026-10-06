/**
 * Project-specific augmentation of the ambient `Cloudflare.Env` interface
 * from `@cloudflare/workers-types`. TypeScript merges this with the library's
 * declaration, so `env.DB` (from `cloudflare:workers`) is typed everywhere.
 * See lib/infrastructure/cloudflare-env.ts and TECH.md for how it's used.
 */
declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    /** Resolved by lib/infrastructure/cloudflare-env.ts#getOpenAiKey; see .dev.vars locally. */
    OPENAI_API_KEY?: string;
    /** Resolved by lib/infrastructure/cloudflare-env.ts#getMediaBucket. Spinner frames and, later, uploaded media. */
    MEDIA?: R2Bucket;
    /** The back office's shared password (lib/infrastructure/cloudflare-env.ts#getAdminAuthEnv). Unset, the demo password applies and the sign-in page says so. */
    ADMIN_PASSWORD?: string;
    /** Signs the back-office session cookie. Unset, a fixed development secret applies — set it for anything reachable from outside. */
    ADMIN_SESSION_SECRET?: string;
    /** Shared secret an inbound-email webhook must present (`x-inbound-secret`) before `POST /api/inbound/email` files a guest's mail — see lib/infrastructure/cloudflare-env.ts#getInboundEmailSecret. */
    INBOUND_EMAIL_SECRET?: string;
    /** Public origin of the separate Guest application, used by back-office links. */
    GUEST_APP_URL?: string;
  }
}
