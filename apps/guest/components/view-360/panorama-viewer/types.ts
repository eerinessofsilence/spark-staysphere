export type PanoramaStatus = 'loading' | 'ready' | 'error';

/** A marker inside the sphere, drawn as the product's own pill. */
export interface PanoramaHotSpot {
  id: string;
  label: string;
  /** A second, quieter line — the floor and the price — so the pill stays narrow. */
  detail?: string | null;
  /** Degrees; yaw is left–right around the horizon, pitch is up–down. */
  yaw: number;
  pitch: number;
}

/** A footprint drawn on the sphere: its corners in degrees, in drawing order. */
export interface PanoramaOutline {
  id: string;
  points: { yaw: number; pitch: number }[];
}

/** What a parent may drive after the sphere is up. */
export interface PanoramaApi {
  /** Turn the view by so many degrees, eased; positive is to the right. */
  rotate: (degrees: number) => void;
}
