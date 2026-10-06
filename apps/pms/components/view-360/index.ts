/**
 * 360° views — the module's whole public surface. Import from
 * `@/components/view-360`, never from a file inside it: the folders below are
 * private and free to change (oxlint enforces this, see `.oxlintrc.json`).
 * How the pieces fit, and how to extend them: README.md in this folder.
 */

export { BuildingSpinner, type BuildingSpinnerProps } from './building-spinner/building-spinner';
/**
 * The orbit's pure maths, so a second surface can spin the same sequence by
 * the same rules the guest's spinner turns by — the admin's zone markup
 * drags through the frames and settles on a key angle exactly like the
 * arrival screen does. Maths only: no component, no state.
 */
export { dragSteps, loadOrder, nearestKeyAngle, nextStop, ringDelta, wrap } from './building-spinner/orbit';
export { PanoramaViewer, type PanoramaViewerProps } from './panorama-viewer/panorama-viewer';
export type { PanoramaApi, PanoramaHotSpot, PanoramaOutline } from './panorama-viewer/types';
