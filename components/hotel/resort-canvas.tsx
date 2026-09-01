'use client';

import * as React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Procedural resort in React Three Fiber. It is the same subject as the SVG
 * poster, modelled from primitives so a real GLB can replace `<ResortModel />`
 * without touching the camera rig, the hotspots, or the surrounding UI.
 *
 * Kept deliberately cheap for phones: no shadow maps, no post-processing, low
 * segment counts, and a camera clamped to a narrow, flattering arc.
 */

const FLOORS = 8;
const FLOOR_HEIGHT = 1.5;
const TOWER_WIDTH = 7;
const TOWER_DEPTH = 5;

export interface CanvasHotspot {
  id: string;
  label: string;
  position: [number, number, number];
}

const materials = {
  facade: '#E8E5DC',
  slab: '#F6F4EE',
  glass: '#16262B',
  litGlass: '#F7E4BE',
  deck: '#3A3B31',
  sea: '#123840',
  water: '#0E8C93',
  foliage: '#22331F',
  trunk: '#141613',
};

function Floor({ level }: { level: number }) {
  // Upper levels step back, matching the setbacks in the SVG massing.
  const setback = level >= 5 ? (level - 4) * 0.55 : 0;
  const width = TOWER_WIDTH - setback * 2;
  const depth = TOWER_DEPTH - setback * 1.2;
  const y = level * FLOOR_HEIGHT + FLOOR_HEIGHT / 2;
  const windows = Math.max(3, Math.round(width / 1.1));

  return (
    <group>
      <mesh position={[0, y, 0]}>
        <boxGeometry args={[width, FLOOR_HEIGHT, depth]} />
        <meshLambertMaterial color={materials.facade} />
      </mesh>

      {/* Balcony slab, oversailing the facade */}
      <mesh position={[0, y + FLOOR_HEIGHT / 2 - 0.06, 0]}>
        <boxGeometry args={[width + 0.9, 0.12, depth + 0.9]} />
        <meshLambertMaterial color={materials.slab} />
      </mesh>

      {/* Glazing on the seaward face */}
      {Array.from({ length: windows }, (_, index) => {
        const step = width / windows;
        const x = -width / 2 + step * index + step / 2;
        const lit = (level * 7 + index * 3) % 5 < 2;
        return (
          <mesh key={index} position={[x, y, depth / 2 + 0.02]}>
            <planeGeometry args={[step * 0.6, FLOOR_HEIGHT * 0.55]} />
            <meshBasicMaterial color={lit ? materials.litGlass : materials.glass} />
          </mesh>
        );
      })}
    </group>
  );
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 2.2, 6]} />
        <meshLambertMaterial color={materials.trunk} />
      </mesh>
      <mesh position={[0, 2.5, 0]}>
        <icosahedronGeometry args={[0.95, 0]} />
        <meshLambertMaterial color={materials.foliage} flatShading />
      </mesh>
    </group>
  );
}

function ResortModel() {
  return (
    <group>
      {/* Sea, then the terrace the resort sits on */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]}>
        <planeGeometry args={[220, 220]} />
        <meshLambertMaterial color={materials.sea} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 4]}>
        <planeGeometry args={[46, 26]} />
        <meshLambertMaterial color={materials.deck} />
      </mesh>

      {Array.from({ length: FLOORS }, (_, level) => (
        <Floor key={level} level={level} />
      ))}

      {/* Rooftop mast */}
      <mesh position={[0, FLOORS * FLOOR_HEIGHT + 0.7, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.4, 6]} />
        <meshBasicMaterial color="#05E6EC" />
      </mesh>

      {/* Spa annex */}
      <mesh position={[7.5, 1.1, 2]}>
        <boxGeometry args={[5, 2.2, 4]} />
        <meshLambertMaterial color={materials.facade} />
      </mesh>

      {/* Pool */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-8.5, 0.02, 7]}>
        <circleGeometry args={[4.2, 40]} />
        <meshBasicMaterial color={materials.water} />
      </mesh>

      {[
        [-14, 0, 10],
        [-11.5, 0, 12.5],
        [12, 0, 9],
        [15, 0, 11.5],
      ].map(([x, y, z], index) => (
        <Tree key={`${x}-${z}`} position={[x, y, z]} scale={0.85 + (index % 3) * 0.12} />
      ))}
    </group>
  );
}

interface ResortCanvasProps {
  hotspots: CanvasHotspot[];
  activeHotspot: string | null;
  onSelectHotspot: (id: string | null) => void;
  autoRotate: boolean;
}

export default function ResortCanvas({
  hotspots,
  activeHotspot,
  onSelectHotspot,
  autoRotate,
}: ResortCanvasProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [18, 12, 26], fov: 38 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ scene }) => {
        scene.fog = new THREE.Fog('#0A1215', 85, 210);
      }}
      // The scene is decorative; the hotspot buttons inside it carry the semantics.
      aria-hidden="true"
    >
      <color attach="background" args={['#0A1215']} />
      <hemisphereLight args={['#BFE2E6', '#2A3A34', 1.35]} />
      <directionalLight position={[16, 22, 10]} intensity={2.1} color="#FBEBD0" />
      <directionalLight position={[-18, 10, -12]} intensity={0.7} color="#05E6EC" />

      <ResortModel />

      {hotspots.map((hotspot) => (
        <Html key={hotspot.id} position={hotspot.position} center distanceFactor={22} zIndexRange={[20, 10]}>
          <button
            type="button"
            aria-label={hotspot.label}
            aria-pressed={activeHotspot === hotspot.id}
            onClick={() => onSelectHotspot(activeHotspot === hotspot.id ? null : hotspot.id)}
            className={
              activeHotspot === hotspot.id
                ? 'flex min-h-11 items-center gap-2 rounded-full border border-cyan bg-cyan px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-ink'
                : 'flex min-h-11 items-center gap-2 rounded-full border border-[#F2F1EC]/25 bg-ink/80 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-[#F2F1EC] hover:border-cyan hover:text-cyan'
            }
          >
            <span
              aria-hidden="true"
              className={
                activeHotspot === hotspot.id
                  ? 'size-1.5 rounded-full bg-ink'
                  : 'size-1.5 rounded-full bg-cyan'
              }
            />
            {hotspot.label}
          </button>
        </Html>
      ))}

      <OrbitControls
        makeDefault
        enablePan={false}
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
        target={[0, 5, 0]}
        minDistance={22}
        maxDistance={52}
        // Keep the camera above the terrace and off the underside of the model.
        minPolarAngle={Math.PI * 0.18}
        maxPolarAngle={Math.PI * 0.46}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
