/**
 * Project-specific augmentation of the ambient `Cloudflare.Env` interface
 * from `@cloudflare/workers-types`. TypeScript merges this with the library's
 * declaration, so `env.DB` (from `cloudflare:workers`) is typed everywhere.
 * See lib/infrastructure/cloudflare-env.ts and TECH.md for how it's used.
 */
declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
  }
}
