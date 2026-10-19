/**
 * Guest has no hotel database or object storage bindings. It only needs the
 * CMS origin for server-to-server requests.
 */
declare namespace Cloudflare {
  interface Env {
    CMS_API_URL?: string;
  }
}
