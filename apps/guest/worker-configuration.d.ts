/**
 * Guest has no hotel database or object storage bindings. It only needs the
 * PMS origin for server-to-server requests.
 */
declare namespace Cloudflare {
  interface Env {
    PMS_API_URL?: string;
  }
}
