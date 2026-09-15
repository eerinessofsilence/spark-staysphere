/**
 * The one place that knows Pannellum exists. It is vendored at
 * `public/vendor/pannellum` (2.5.7, MIT — see `public/images/CREDITS.md`) as a
 * plain script and stylesheet: a global, not an ES module, so it is loaded as a
 * real `<script>` tag rather than imported, and only once per page however many
 * viewers mount. Swapping the library means replacing this file and the calls
 * `panorama-viewer.tsx` makes on `PannellumViewer`.
 */

declare global {
  interface Window {
    pannellum?: {
      viewer: (container: HTMLElement, config: PannellumConfig) => PannellumViewer;
    };
  }
}

export interface PannellumViewer {
  on: (event: 'load' | 'error', handler: () => void) => PannellumViewer;
  getYaw: () => number;
  setYaw: (yaw: number, animated?: number | boolean) => PannellumViewer;
  resize: () => void;
  destroy: () => void;
}

/**
 * A point Pannellum projects onto the screen every frame; a marker or an
 * invisible outline corner. Pannellum hands `createTooltipArgs` back to
 * `createTooltipFunc` unchanged — `never` lets each builder type its own args.
 */
export interface PannellumHotSpot {
  id: string;
  yaw: number;
  pitch: number;
  cssClass: string;
  createTooltipFunc: (element: HTMLElement, args: never) => void;
  createTooltipArgs: unknown;
  clickHandlerFunc?: () => void;
}

export interface PannellumConfig {
  type: 'equirectangular';
  panorama: string;
  autoLoad: boolean;
  yaw: number;
  pitch: number;
  hfov: number;
  showControls: boolean;
  compass: boolean;
  hotSpots: PannellumHotSpot[];
}

const VENDOR_BASE = '/vendor/pannellum';
let loadPromise: Promise<void> | null = null;

/** Resolves once `window.pannellum` exists; a failed load can be retried by the next viewer that mounts. */
export function loadPannellum(): Promise<void> {
  if (window.pannellum) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${VENDOR_BASE}/pannellum.css"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${VENDOR_BASE}/pannellum.css`;
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = `${VENDOR_BASE}/pannellum.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Could not load the panorama viewer.'));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}
