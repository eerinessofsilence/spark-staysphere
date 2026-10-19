declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    MEDIA?: R2Bucket;
    ADMIN_PASSWORD?: string;
    EDITOR_PASSWORD?: string;
    ADMIN_SESSION_SECRET?: string;
    GUEST_APP_URL?: string;
    OPENAI_API_KEY?: string;
  }
}
