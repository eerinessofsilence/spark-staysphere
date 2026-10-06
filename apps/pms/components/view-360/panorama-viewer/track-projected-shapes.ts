import { anchorWithin, type CardAnchor } from '@/components/site/use-anchored-card';
import { readTranslate, type ScreenPolygon } from './sphere-geometry';
import { cornerKey } from './sphere-hotspots';
import type { PanoramaOutline } from './types';

export interface ProjectedElements {
  /** Corner elements by `cornerKey`. */
  corners: Record<string, HTMLElement>;
  /** Marker elements by hotspot id. */
  markers: Record<string, HTMLElement>;
}

interface TrackOptions {
  container: HTMLElement;
  elements: ProjectedElements;
  /** Read every frame, so the current props are always the ones tracked. */
  outlines: () => PanoramaOutline[];
  activeMarkerId: () => string | null | undefined;
  /** Called only when a polygon actually moved. */
  onPolygons: (polygons: Record<string, ScreenPolygon>) => void;
  /** Called only when the open marker moved, appeared, or went behind the camera. */
  onActiveAnchor: (anchor: CardAnchor | null) => void;
}

/**
 * Reads, every animation frame, where Pannellum has put each outline's corners
 * and the open marker. It runs continuously rather than only while outlines
 * exist: which marker is open can change at any time, and a card that opened
 * beside a marker has to follow it while the guest keeps dragging.
 *
 * Returns the function that stops it.
 */
export function trackProjectedShapes(options: TrackOptions): () => void {
  let frame = 0;
  let lastPolygons = '';
  let lastAnchor = '';

  const track = () => {
    const polygons: Record<string, ScreenPolygon> = {};
    for (const outline of options.outlines()) {
      const points: ScreenPolygon = [];
      for (let i = 0; i < outline.points.length; i++) {
        const element = options.elements.corners[cornerKey(outline.id, i)];
        // Behind the camera Pannellum hides the corner; the whole shape goes.
        if (!element || element.style.visibility === 'hidden') break;
        const point = readTranslate(element.style.transform);
        if (!point) break;
        points.push(point);
      }
      if (points.length === outline.points.length) polygons[outline.id] = points;
    }
    const polygonsKey = JSON.stringify(polygons);
    if (polygonsKey !== lastPolygons) {
      lastPolygons = polygonsKey;
      options.onPolygons(polygons);
    }

    const activeId = options.activeMarkerId();
    const marker = activeId ? options.elements.markers[activeId] : undefined;
    if (marker && marker.style.visibility !== 'hidden') {
      const anchor = anchorWithin(options.container, marker);
      const anchorKey = JSON.stringify(anchor);
      if (anchorKey !== lastAnchor) {
        lastAnchor = anchorKey;
        options.onActiveAnchor(anchor);
      }
    } else if (lastAnchor !== 'none') {
      lastAnchor = 'none';
      options.onActiveAnchor(null);
    }

    frame = requestAnimationFrame(track);
  };

  frame = requestAnimationFrame(track);
  return () => cancelAnimationFrame(frame);
}
