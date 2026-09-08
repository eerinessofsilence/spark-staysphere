import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BuildingBlock, HotelModel } from '@/lib/domain/schemas';

/**
 * The property as a model a guest can turn — one finger on a phone, a drag
 * on a desk, a pinch or a wheel to come closer. Imperative three.js behind a
 * small handle; `HotelModel` (the React side) owns every pixel of UI and
 * only ever tells this module which floor is lit.
 *
 * Built from `HotelModel.blocks` when the property has no model of its own,
 * the way an architect's white model is: floor plates and piers, full-height
 * sliding doors in dark frames, glass balustrades on a handrail, a glazed
 * arcade at the base, the whole thing standing on a headland that falls to
 * the sea, with maquis and cypresses behind. Lit by a real sky — an HDRI from
 * Poly Haven, CC0, in `public/hdri` — with one sun for the shadows, and
 * surfaced with scanned plaster, concrete and ground (`public/textures`, also
 * Poly Haven, CC0; see `public/images/CREDITS.md`). The rocks on the shore and
 * the furniture are Poly Haven photoscans too, cut down to a fraction of their
 * triangles and drawn as instances (`public/models`); the trees are modelled,
 * because a scanned tree does not survive that cut — its leaves go first.
 * Ambient occlusion and anti-aliasing run as passes on a desk with a real GPU;
 * a phone, or a browser drawing in software, draws straight.
 * By night a different sky, most of the rooms lit and the pool glowing. A real
 * GLB (`url`) replaces the massing; a mesh named `floor-3` in it becomes the
 * third floor.
 *
 * Everything is merged into one mesh per material per floor, so a phone
 * draws the whole site in a few dozen calls. This file is imported lazily,
 * so three.js only ships to guests who scroll to the model.
 */

/** Colours read off the page's own tokens, so the model follows the scheme. */
export interface SceneTokens {
  canvas: string;
  stone: string;
  accent: string;
  ink: string;
}

export interface HotelModelSceneOptions {
  container: HTMLElement;
  model: HotelModel;
  tokens: SceneTokens;
  dark: boolean;
  /** Skip the idle turn for guests who asked for less motion. */
  reducedMotion: boolean;
  onHover: (floor: number | null) => void;
  onSelect: (floor: number) => void;
  /** The first drag or pinch, so the hint can step aside. */
  onInteract: () => void;
}

export interface HotelModelSceneHandle {
  setSelected: (floor: number | null) => void;
  setHovered: (floor: number | null) => void;
  setTheme: (tokens: SceneTokens, dark: boolean) => void;
  resetView: () => void;
  dispose: () => void;
}

const DEFAULT_FLOOR_HEIGHT = 3.3;
const BALCONY_DEPTH = 1.9;
const ROOM_MODULE = 4.2;
const SLAB = 0.28;
const PIER = 1.1;

type Face = NonNullable<BuildingBlock['balconies']>[number];

/** Deterministic noise, so the site looks the same on every visit. */
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x: number, y: number, octaves = 4): number {
  let value = 0;
  let amplitude = 0.5;
  for (let index = 0; index < octaves; index += 1) {
    value += amplitude * noise(x, y);
    x *= 2.1;
    y *= 2.1;
    amplitude *= 0.5;
  }
  return value;
}
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
/** A seeded run of pseudo-random numbers, so lit windows fall the same way each time. */
function rng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** A small tiling grain, so flat surfaces read as material rather than paint. */
function grainTexture(size: number, contrast: number, repeat: number): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const n = fbm(x / 23, y / 23, 3) * 0.6 + hash(x, y) * 0.4;
      const value = Math.round(255 * (1 - contrast / 2 + n * contrast));
      const index = (y * size + x) * 4;
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** What a face of a block needs to place something on it: its outward axis and length. */
function faceFrame(block: BuildingBlock, face: Face) {
  const half = { x: block.width / 2, z: block.depth / 2 };
  switch (face) {
    case 'front':
      return { axis: 'z' as const, sign: 1, length: block.width, offset: half.z, rotation: 0 };
    case 'back':
      return { axis: 'z' as const, sign: -1, length: block.width, offset: half.z, rotation: Math.PI };
    case 'right':
      return { axis: 'x' as const, sign: 1, length: block.depth, offset: half.x, rotation: Math.PI / 2 };
    case 'left':
      return { axis: 'x' as const, sign: -1, length: block.depth, offset: half.x, rotation: -Math.PI / 2 };
  }
}

type MaterialName =
  | 'wall'
  | 'slab'
  | 'glass'
  | 'glassLit'
  | 'frame'
  | 'railing'
  | 'metal'
  | 'roof'
  | 'paving'
  | 'terrain'
  | 'cliff'
  | 'sea'
  | 'water'
  | 'poolFloor'
  | 'canopyDark'
  | 'canopyOlive'
  | 'trunk'
  | 'lounger';

/** The materials that take the accent when their floor is picked. */
const TINTED: MaterialName[] = ['wall', 'slab', 'glass', 'glassLit'];

/** Scanned surfaces from Poly Haven (CC0): colour, normal and roughness, 1K. */
interface Scan {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

async function loadScan(loader: THREE.TextureLoader, id: string, anisotropy: number, repeat = 1): Promise<Scan> {
  const [map, normalMap, roughnessMap] = await Promise.all(
    ['diff', 'nor_gl', 'rough'].map((kind) => loader.loadAsync(`/textures/${id}/${id}_${kind}_1k.jpg`)),
  );
  map!.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [map!, normalMap!, roughnessMap!]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.anisotropy = anisotropy;
  }
  return { map: map!, normalMap: normalMap!, roughnessMap: roughnessMap! };
}

interface Scans {
  plaster: Scan;
  concrete: Scan;
  hills: Scan;
  rock: Scan;
}

function createMaterials(scans: Scans): Record<MaterialName, THREE.MeshStandardMaterial> {
  const seaGrain = grainTexture(512, 0.6, 60);
  const scanned = (scan: Scan, normalScale = 1) => ({
    map: scan.map,
    normalMap: scan.normalMap,
    normalScale: new THREE.Vector2(normalScale, normalScale),
    roughnessMap: scan.roughnessMap,
  });
  return {
    wall: new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...scanned(scans.plaster, 0.45) }),
    slab: new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...scanned(scans.concrete, 0.5) }),
    glass: new THREE.MeshPhysicalMaterial({ roughness: 0.08, metalness: 0.55, envMapIntensity: 1.4 }),
    glassLit: new THREE.MeshPhysicalMaterial({ roughness: 0.12, metalness: 0.3, envMapIntensity: 1 }),
    frame: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.6 }),
    railing: new THREE.MeshPhysicalMaterial({
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      opacity: 0.22,
      envMapIntensity: 1.6,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    metal: new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.8 }),
    roof: new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...scanned(scans.concrete, 0.5) }),
    paving: new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...scanned(scans.concrete, 0.4) }),
    terrain: new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, vertexColors: true, ...scanned(scans.hills, 1) }),
    cliff: new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, vertexColors: true, ...scanned(scans.rock, 1) }),
    sea: new THREE.MeshPhysicalMaterial({
      roughness: 0.3,
      metalness: 0.05,
      bumpMap: seaGrain,
      bumpScale: 0.35,
      envMapIntensity: 1.2,
    }),
    water: new THREE.MeshPhysicalMaterial({
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      opacity: 0.85,
      bumpMap: seaGrain,
      bumpScale: 0.08,
      envMapIntensity: 1.3,
    }),
    poolFloor: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    canopyDark: new THREE.MeshStandardMaterial({ roughness: 1 }),
    canopyOlive: new THREE.MeshStandardMaterial({ roughness: 1 }),
    trunk: new THREE.MeshStandardMaterial({ roughness: 1 }),
    lounger: new THREE.MeshStandardMaterial({ roughness: 0.7 }),
  };
}

/** The palette by scheme: a white model in Adriatic light, and the same at dusk. */
function paint(materials: Record<MaterialName, THREE.MeshStandardMaterial>, dark: boolean) {
  // The plaster scan is a mid grey; pushed past white it reads as the
  // limewashed render it stands for.
  if (dark) materials.wall.color.set('#dfe2e8');
  else materials.wall.color.setRGB(1.9, 1.86, 1.78);
  if (dark) materials.slab.color.set('#cfd2d6');
  else materials.slab.color.setRGB(1.4, 1.36, 1.3);
  materials.glass.color.set(dark ? '#0b1218' : '#25343d');
  materials.glass.emissive.set('#000000');
  materials.glass.emissiveIntensity = 0;
  materials.glassLit.color.set(dark ? '#3a3026' : '#25343d');
  materials.glassLit.emissive.set(dark ? '#ffb56b' : '#000000');
  materials.glassLit.emissiveIntensity = dark ? 0.85 : 0;
  materials.frame.color.set(dark ? '#1a1d20' : '#2b2f33');
  materials.railing.color.set(dark ? '#a9c0cc' : '#e8f1f4');
  materials.metal.color.set(dark ? '#4a4f55' : '#8a8f94');
  materials.roof.color.set(dark ? '#8a8884' : '#e2ddd3');
  materials.paving.color.set(dark ? '#9c9a96' : '#ece8e0');
  materials.terrain.color.set(dark ? '#8a8a88' : '#ffffff');
  materials.cliff.color.set(dark ? '#8a8a88' : '#ffffff');
  materials.sea.color.set(dark ? '#07131c' : '#234f60');
  materials.water.color.set(dark ? '#1e7a8a' : '#5fc0cf');
  materials.water.emissive.set(dark ? '#2fc1d6' : '#000000');
  materials.water.emissiveIntensity = dark ? 0.35 : 0;
  materials.poolFloor.color.set(dark ? '#3f8b98' : '#9ad9e2');
  materials.canopyDark.color.set(dark ? '#141f16' : '#152617');
  materials.canopyOlive.color.set(dark ? '#1f2c1c' : '#2c4425');
  materials.trunk.color.set(dark ? '#2a2420' : '#5b4a3a');
  materials.lounger.color.set(dark ? '#cfcac0' : '#faf7f0');
}

/**
 * UVs from world position, by the face's dominant axis: a scanned texture
 * then tiles at the same size on every wall and slab, whatever the box.
 */
function boxMapUv(geometry: THREE.BufferGeometry, tile: number) {
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const normals = geometry.attributes.normal as THREE.BufferAttribute;
  const uvs = new Float32Array(positions.count * 2);
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const nx = Math.abs(normals.getX(index));
    const ny = Math.abs(normals.getY(index));
    const nz = Math.abs(normals.getZ(index));
    let u: number;
    let v: number;
    if (ny >= nx && ny >= nz) {
      u = x;
      v = z;
    } else if (nx >= nz) {
      u = z;
      v = y;
    } else {
      u = x;
      v = y;
    }
    uvs[index * 2] = u / tile;
    uvs[index * 2 + 1] = v / tile;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

export async function createHotelModelScene(options: HotelModelSceneOptions): Promise<HotelModelSceneHandle> {
  const { container, model } = options;
  const floorHeight = model.floorHeight ?? DEFAULT_FLOOR_HEIGHT;
  const isPhone = window.innerWidth < 640;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // A phone, or a browser drawing in software (no GPU in CI, a locked-down
  // desktop), gets the lighter scene: no passes, fewer things on the site.
  const context = renderer.getContext();
  const debugInfo = context.getExtension('WEBGL_debug_renderer_info');
  const gpuName = debugInfo ? String(context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : '';
  const light = isPhone || /swiftshader|llvmpipe|software|mesa offscreen/i.test(gpuName);
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 3000);

  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const textureLoader = new THREE.TextureLoader();
  const [plaster, concrete, hills, rock] = await Promise.all([
    loadScan(textureLoader, 'white_plaster_02', anisotropy),
    loadScan(textureLoader, 'concrete_floor_01', anisotropy),
    loadScan(textureLoader, 'aerial_grass_rock', anisotropy),
    loadScan(textureLoader, 'rock_ground_02', anisotropy),
  ]);
  const materials = createMaterials({ plaster, concrete, hills, rock });

  // The sky is a photograph: an HDRI lights everything and is the backdrop,
  // so glass reflects real clouds and the white walls shade the way they do
  // outdoors. One for each scheme, the night's loaded only when asked for.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const hdriLoader = new HDRLoader();
  const skies = new Map<'day' | 'night', { background: THREE.Texture; environment: THREE.Texture }>();
  const loadSky = async (which: 'day' | 'night') => {
    const cached = skies.get(which);
    if (cached) return cached;
    // The day sky is the backdrop too, so it is worth the 2K; the night's
    // lamps at the horizon are soft anyway.
    const file = which === 'day' ? 'kloofendal_48d_partly_cloudy_puresky_2k' : 'moonless_golf_1k';
    const background = await hdriLoader.loadAsync(`/hdri/${file}.hdr`);
    background.mapping = THREE.EquirectangularReflectionMapping;
    const environment = pmrem.fromEquirectangular(background).texture;
    const sky = { background, environment };
    skies.set(which, sky);
    return sky;
  };
  const initialSky = await loadSky(options.dark ? 'night' : 'day');
  scene.background = initialSky.background;
  scene.environment = initialSky.environment;

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(light ? 1024 : 2048, light ? 1024 : 2048);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.04;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 800;
  scene.add(hemisphere, sun, sun.target);

  // Geometry is gathered per material and per floor, then merged: one draw
  // call each, and a floor stays one pickable thing.
  const parts = new Map<string, THREE.BufferGeometry[]>();
  const partKey = (material: MaterialName, floor?: number) => `${material}:${floor ?? 'site'}`;
  const scratch = new THREE.Matrix4();
  const place = (
    material: MaterialName,
    geometry: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
    rotationY = 0,
    floor?: number,
  ) => {
    const copy = geometry.clone();
    scratch.makeRotationY(rotationY);
    scratch.setPosition(x, y, z);
    copy.applyMatrix4(scratch);
    const key = partKey(material, floor);
    const list = parts.get(key) ?? [];
    list.push(copy);
    parts.set(key, list);
  };
  const boxes = new Map<string, THREE.BoxGeometry>();
  const box = (w: number, h: number, d: number) => {
    const key = `${w.toFixed(3)}x${h.toFixed(3)}x${d.toFixed(3)}`;
    let geometry = boxes.get(key);
    if (!geometry) {
      geometry = new THREE.BoxGeometry(w, h, d);
      boxes.set(key, geometry);
    }
    return geometry;
  };

  /** A hollow frame — four bars — around an opening, so the glass inside stays visible. */
  const frameBars = (
    material: MaterialName,
    width: number,
    height: number,
    bar: number,
    depth: number,
    position: [number, number, number],
    rotationY: number,
    floor?: number,
  ) => {
    const [x, y, z] = position;
    const dx = Math.cos(rotationY);
    const dz = -Math.sin(rotationY);
    const half = width / 2 - bar / 2;
    place(material, box(width, bar, depth), x, y + height / 2 - bar / 2, z, rotationY, floor);
    place(material, box(width, bar, depth), x, y - height / 2 + bar / 2, z, rotationY, floor);
    place(material, box(bar, height - 2 * bar, depth), x + dx * half, y, z + dz * half, rotationY, floor);
    place(material, box(bar, height - 2 * bar, depth), x - dx * half, y, z - dz * half, rotationY, floor);
  };

  const building = new THREE.Group();
  scene.add(building);
  /** Everything drawn, so it can all be let go of. */
  const meshes: THREE.Mesh[] = [];
  let topFloor = 1;
  const random = rng(7);

  /**
   * One face of one floor: the rhythm of a hotel elevation — a pier, a
   * full-height sliding door in a dark frame, the next pier — and, on the
   * balcony faces, the balcony itself with its glass rail and dividers.
   */
  const buildFace = (
    block: BuildingBlock,
    face: Face,
    floor: number,
    y0: number,
    kind: 'balcony' | 'window' | 'arcade',
    body: { width: number; depth: number; x: number; z: number },
  ) => {
    const frame = faceFrame(block, face);
    // Where the body's face sits, measured inward from the block's edge.
    const bodyLength = frame.axis === 'z' ? body.width : body.depth;
    const bodyCentre = frame.axis === 'z' ? body.x : body.z;
    const bodyInset =
      frame.axis === 'z'
        ? block.depth / 2 - (frame.sign > 0 ? body.z + body.depth / 2 - block.z : block.z - (body.z - body.depth / 2))
        : block.width / 2 - (frame.sign > 0 ? body.x + body.width / 2 - block.x : block.x - (body.x - body.width / 2));
    const at = (inset: number, along: number, y: number): [number, number, number] => {
      const out = frame.sign * (frame.offset - inset);
      return frame.axis === 'z' ? [block.x + along, y, block.z + out] : [block.x + out, y, block.z + along];
    };
    const modules = Math.max(1, Math.round(bodyLength / ROOM_MODULE));
    const moduleLength = bodyLength / modules;
    const openingHeight = floorHeight - SLAB - 0.12;
    const centreOffset = bodyCentre - (frame.axis === 'z' ? block.x : block.z);

    if (kind === 'arcade') {
      // The glazed base: a run of glass behind round columns, set well back.
      const recess = bodyInset + 0.05;
      const glassLength = bodyLength - 0.2;
      place('glassLit', box(glassLength, floorHeight - SLAB, 0.06), ...at(recess, centreOffset, y0 + SLAB + (floorHeight - SLAB) / 2), frame.rotation, floor);
      const mullions = Math.round(glassLength / 2.4);
      for (let index = 0; index <= mullions; index += 1) {
        const along = centreOffset - glassLength / 2 + (glassLength * index) / mullions;
        place('frame', box(0.1, floorHeight - SLAB, 0.12), ...at(recess, along, y0 + SLAB + (floorHeight - SLAB) / 2), frame.rotation, floor);
      }
      return;
    }

    for (let index = 0; index < modules; index += 1) {
      const along = centreOffset - bodyLength / 2 + moduleLength * (index + 0.5);
      if (kind === 'balcony') {
        const opening = moduleLength - PIER;
        const lit = random() < 0.62;
        // A dark frame proud of the wall, the glass set just inside it, and
        // the meeting stile of the two sliding leaves down the middle.
        const centre = y0 + SLAB + openingHeight / 2;
        frameBars('frame', opening + 0.16, openingHeight + 0.12, 0.08, 0.12, at(bodyInset - 0.07, along, centre), frame.rotation, floor);
        place(lit ? 'glassLit' : 'glass', box(opening, openingHeight, 0.04), ...at(bodyInset - 0.04, along, centre), frame.rotation, floor);
        place('frame', box(0.05, openingHeight, 0.1), ...at(bodyInset - 0.09, along, centre), frame.rotation, floor);
      } else {
        // A window in the plain faces: a dark frame let into the wall.
        const width = Math.min(2.2, moduleLength - 1.6);
        const height = 1.6;
        const sill = y0 + SLAB + 0.9;
        frameBars('frame', width + 0.16, height + 0.16, 0.08, 0.14, at(bodyInset - 0.08, along, sill + height / 2), frame.rotation, floor);
        place(random() < 0.5 ? 'glassLit' : 'glass', box(width, height, 0.04), ...at(bodyInset - 0.04, along, sill + height / 2), frame.rotation, floor);
      }
    }

    if (kind !== 'balcony') return;

    // The balcony: slab, glass rail on a handrail, a divider between rooms.
    const railHeight = 1.05;
    place('slab', box(bodyLength, 0.2, BALCONY_DEPTH + 0.05), ...at(BALCONY_DEPTH / 2, centreOffset, y0 + SLAB - 0.1), frame.rotation, floor);
    place('railing', box(bodyLength - 0.1, railHeight - 0.08, 0.02), ...at(0.06, centreOffset, y0 + SLAB + (railHeight - 0.08) / 2), frame.rotation, floor);
    place('metal', box(bodyLength, 0.05, 0.06), ...at(0.06, centreOffset, y0 + SLAB + railHeight), frame.rotation);
    for (let index = 0; index <= modules; index += 1) {
      const along = centreOffset - bodyLength / 2 + moduleLength * index;
      place('metal', box(0.05, railHeight, 0.05), ...at(0.06, along, y0 + SLAB + railHeight / 2), frame.rotation);
      if (index > 0 && index < modules) {
        place('wall', box(0.14, floorHeight - SLAB - 0.1, BALCONY_DEPTH - 0.15), ...at(BALCONY_DEPTH / 2 + 0.05, along, y0 + SLAB + (floorHeight - SLAB - 0.1) / 2), frame.rotation, floor);
      }
    }
  };

  const buildBlock = (block: BuildingBlock) => {
    const balconies = new Set<Face>(block.balconies ?? ['front']);
    const glazed = new Set(block.glazedFloors ?? []);
    topFloor = Math.max(topFloor, block.toFloor);

    for (let floor = block.fromFloor; floor <= block.toFloor; floor += 1) {
      const y0 = (floor - 1) * floorHeight;
      const isGlazed = glazed.has(floor);
      const withBalconies = isGlazed ? new Set<Face>() : balconies;
      const arcadeInset = isGlazed ? 1.4 : 0;

      // The body is the block minus the balconies, which sit in the inset.
      const insetOf = (face: Face) => (withBalconies.has(face) ? BALCONY_DEPTH : arcadeInset);
      const body = {
        width: block.width - insetOf('left') - insetOf('right'),
        depth: block.depth - insetOf('front') - insetOf('back'),
        x: block.x + insetOf('left') / 2 - insetOf('right') / 2,
        z: block.z + insetOf('back') / 2 - insetOf('front') / 2,
      };
      if (!isGlazed) {
        place('wall', box(body.width, floorHeight, body.depth), body.x, y0 + floorHeight / 2, body.z, 0, floor);
      } else {
        // Columns hold the floors above where the glass steps back.
        const column = new THREE.CylinderGeometry(0.28, 0.28, floorHeight - SLAB, 14);
        const columnsAlong = Math.round(block.width / 4.2);
        for (let index = 0; index <= columnsAlong; index += 1) {
          const x = block.x - block.width / 2 + 0.5 + ((block.width - 1) * index) / columnsAlong;
          place('wall', column, x, y0 + SLAB + (floorHeight - SLAB) / 2, block.z + block.depth / 2 - 0.5, 0, floor);
        }
        column.dispose();
      }

      // The floor plate, run just past the walls: the line that makes a
      // stack of rooms read as floors.
      place('slab', box(block.width + 0.1, SLAB, block.depth + 0.1), block.x, y0 + SLAB / 2, block.z, 0, floor);

      for (const face of ['front', 'back', 'left', 'right'] as const) {
        buildFace(block, face, floor, y0, isGlazed ? 'arcade' : withBalconies.has(face) ? 'balcony' : 'window', body);
      }
    }

    // The roof: a slab, a deck, and a parapet — a glass one when it is a terrace.
    const top = block.toFloor * floorHeight;
    place('slab', box(block.width + 0.1, SLAB, block.depth + 0.1), block.x, top + SLAB / 2, block.z);
    place('roof', box(block.width - 0.6, 0.06, block.depth - 0.6), block.x, top + SLAB + 0.03, block.z);
    for (const face of ['front', 'back', 'left', 'right'] as const) {
      const frame = faceFrame(block, face);
      const out = frame.sign * (frame.offset - 0.08);
      const position: [number, number, number] =
        frame.axis === 'z' ? [block.x, top + SLAB, block.z + out] : [block.x + out, top + SLAB, block.z];
      if (block.roofTerrace) {
        place('railing', box(frame.length - 0.1, 1, 0.02), position[0], position[1] + 0.5, position[2], frame.rotation);
        place('metal', box(frame.length, 0.05, 0.06), position[0], position[1] + 1.05, position[2], frame.rotation);
      } else {
        place('wall', box(frame.length, 0.7, 0.16), position[0], position[1] + 0.35, position[2], frame.rotation);
      }
    }
  };

  /** A GLB of the property: fitted to the ground, floors found by name. */
  const pickable: THREE.Mesh[] = [];
  const gltfLoader = new GLTFLoader();
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  const loadModel = async (url: string) => {
    const gltf = await gltfLoader.loadAsync(url);
    const root = gltf.scene;
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
      const match = /^floor[-_ ]?(\d+)/i.exec(node.name);
      if (match) {
        const floor = Number(match[1]);
        node.userData.floor = floor;
        pickable.push(node);
        topFloor = Math.max(topFloor, floor);
      }
    });
    const bounds = new THREE.Box3().setFromObject(root);
    const centre = bounds.getCenter(new THREE.Vector3());
    root.position.set(-centre.x, -bounds.min.y, -centre.z);
    building.add(root);
  };

  if (model.url) {
    await loadModel(model.url);
  } else {
    model.blocks.forEach(buildBlock);
  }

  // The site. A pad the building stands on, level; beyond it the headland
  // falls to the sea in front and rises into scrub behind.
  const grounds = model.grounds;
  const pad = {
    minX: Math.min(...model.blocks.map((block) => block.x - block.width / 2)) - 6,
    maxX: Math.max(...model.blocks.map((block) => block.x + block.width / 2)) + 6,
    minZ: Math.min(...model.blocks.map((block) => block.z - block.depth / 2)) - 6,
    maxZ: Math.max(...model.blocks.map((block) => block.z + block.depth / 2)) + 6,
  };
  if (grounds?.pool) {
    pad.minX = Math.min(pad.minX, grounds.pool.x - grounds.pool.width / 2 - 5);
    pad.maxX = Math.max(pad.maxX, grounds.pool.x + grounds.pool.width / 2 + 5);
    pad.maxZ = Math.max(pad.maxZ, grounds.pool.z + grounds.pool.depth / 2 + 5);
  }
  const cliff = grounds?.height ?? 4;
  const seaLevel = -cliff;

  /** Distance outside the pad, and which way — the land's shape follows from it. */
  const terrainHeight = (x: number, z: number): number => {
    const dx = Math.max(pad.minX - x, 0, x - pad.maxX);
    const dz = Math.max(pad.minZ - z, 0, z - pad.maxZ);
    const outside = Math.hypot(dx, dz);
    if (outside <= 0) return 0;
    const n = fbm(x / 28 + 3, z / 28 + 7, 4) - 0.5;
    // In front the pad runs to a cliff and the shore; behind and beside it
    // the ground climbs gently, broken up by rock.
    const front = smoothstep(pad.maxZ - 8, pad.maxZ + 6, z);
    const shore = seaLevel - 1.5 + 2 * n + 1.5 * smoothstep(80, 10, z - pad.maxZ);
    const drop = Math.min(0, -(cliff + 1.5) * smoothstep(0, 16, outside)) + n * 1.2 * smoothstep(0, 10, outside);
    const cliffHeight = Math.max(shore, drop);
    const hills = outside * 0.09 + n * 3 * smoothstep(4, 30, outside);
    return hills * (1 - front) + cliffHeight * front;
  };

  if (grounds) {
    // Two sheets of ground meeting at the top of the cliff: the hills behind
    // wear the scanned grass-and-rock, the drop to the sea bare rock. Vertex
    // colours only tint the scans — paler where it is dry, greener where the
    // maquis takes, sandier at the water.
    const span = 520;
    const seam = pad.maxZ - 6;
    const density = isPhone ? 0.22 : 0.36;
    const sheet = (fromZ: number, toZ: number, material: THREE.MeshStandardMaterial, tile: number) => {
      const depth = toZ - fromZ;
      const geometry = new THREE.PlaneGeometry(span, depth, Math.round(span * density), Math.round(depth * density));
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, 0, (fromZ + toZ) / 2);
      const positions = geometry.attributes.position as THREE.BufferAttribute;
      const uvs = geometry.attributes.uv as THREE.BufferAttribute;
      const colours = new Float32Array(positions.count * 3);
      const dry = new THREE.Color('#d2d3c8');
      const green = new THREE.Color('#7f9a6a');
      const bare = new THREE.Color('#c4bfb4');
      const sand = new THREE.Color('#e6dcc2');
      const wet = new THREE.Color('#9a9484');
      const colour = new THREE.Color();
      for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index);
        const z = positions.getZ(index);
        const y = terrainHeight(x, z);
        positions.setY(index, y);
        // World-space tiling, so both sheets carry the same grain per metre;
        // the drop is folded into v so a steep face is not stretched.
        uvs.setXY(index, x / tile, (z - y * 0.9) / tile);
        const slope = Math.abs(terrainHeight(x + 1.5, z) - y) + Math.abs(terrainHeight(x, z + 1.5) - y);
        const scrubMix = smoothstep(0.2, 0.5, fbm(x / 30, z / 30, 3)) * smoothstep(0, 2.5, Math.max(y, 0)) * (1 - smoothstep(0.5, 1.4, slope));
        const shoreMix = smoothstep(2.5, 0.5, y - seaLevel) * (1 - smoothstep(0.4, 1, slope));
        colour.copy(dry).lerp(green, scrubMix).lerp(bare, smoothstep(0.35, 1.2, slope)).lerp(sand, shoreMix);
        if (y < seaLevel + 0.6) colour.copy(wet);
        // A finer mottle so the scan's repeat never lines up into a grid.
        colour.multiplyScalar(0.82 + 0.36 * fbm(x / 5 + 11, z / 5 + 4, 3));
        colours[index * 3] = colour.r;
        colours[index * 3 + 1] = colour.g;
        colours[index * 3 + 2] = colour.b;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.receiveShadow = true;
      building.add(mesh);
    };
    sheet(-span / 2, seam, materials.terrain, 14);
    sheet(seam, span / 2, materials.cliff, 9);

    // The pad itself is paved: a concrete deck laid over the ground.
    place('paving', box(pad.maxX - pad.minX, 0.12, pad.maxZ - pad.minZ), (pad.minX + pad.maxX) / 2, 0.06, (pad.minZ + pad.maxZ) / 2);

    if (grounds.sea) {
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), materials.sea);
      sea.rotation.x = -Math.PI / 2;
      sea.position.y = seaLevel;
      sea.receiveShadow = true;
      building.add(sea);
    }

    // The pad's edge toward the sea: a low parapet along the promenade.
    place('wall', box(pad.maxX - pad.minX, 0.9, 0.3), (pad.minX + pad.maxX) / 2, 0.45, pad.maxZ - 0.3);

    if (grounds.pool) {
      const { pool } = grounds;
      // The ground is one surface, so the pool sits on it rather than in it:
      // a pale floor a hand's width up, the water on that, a coping around.
      place('poolFloor', box(pool.width, 0.12, pool.depth), pool.x, 0.06, pool.z);
      place('slab', box(pool.width + 1.6, 0.2, 0.8), pool.x, 0.1, pool.z - pool.depth / 2 - 0.4);
      place('slab', box(pool.width + 1.6, 0.2, 0.8), pool.x, 0.1, pool.z + pool.depth / 2 + 0.4);
      place('slab', box(0.8, 0.2, pool.depth), pool.x - pool.width / 2 - 0.4, 0.1, pool.z);
      place('slab', box(0.8, 0.2, pool.depth), pool.x + pool.width / 2 + 0.4, 0.1, pool.z);
      // Its own geometry: the shared boxes are disposed once the site is merged.
      const water = new THREE.Mesh(new THREE.BoxGeometry(pool.width, 0.04, pool.depth), materials.water);
      water.position.set(pool.x, 0.15, pool.z);
      building.add(water);
      // Loungers in a row along the far side, a parasol between pairs.
      const loungers = Math.max(2, Math.floor(pool.width / 2.4));
      for (let index = 0; index < loungers; index += 1) {
        const x = pool.x - pool.width / 2 + 1.2 + index * ((pool.width - 2.4) / (loungers - 1));
        const z = pool.z - pool.depth / 2 - 2.2;
        place('lounger', box(0.7, 0.3, 1.9), x, 0.3, z);
        place('lounger', box(0.7, 0.5, 0.1), x, 0.65, z - 0.9);
        if (index % 2 === 0) {
          const parasol = new THREE.ConeGeometry(1.25, 0.45, 12, 1, true);
          place('lounger', parasol, x + 1.15, 2.25, z - 0.5);
          parasol.dispose();
          place('metal', box(0.05, 2.2, 0.05), x + 1.15, 1.1, z - 0.5);
        }
      }
    }

    // The rocks and the furniture are photoscans, each drawn once per
    // instance: boulders down the drop to the sea, a table and chairs on the
    // pool deck and on every roof terrace.
    const treeRandom = rng(11);
    const boulders: THREE.Matrix4[] = [];
    const tables: THREE.Matrix4[] = [];

    // Trees are modelled: a few overlapping lobes, never one clean shape —
    // a cypress a tall stack of them, a pine a wide, flattened cluster.
    const lobe = new THREE.IcosahedronGeometry(1, 1);
    const cypress = mergeGeometries(
      [0, 1.4, 2.7, 3.9, 4.9].map((height, index) => {
        const radius = 0.95 - index * 0.13;
        return lobe.clone().scale(radius, radius * 1.7, radius).translate(0, height, 0);
      }),
      false,
    )!;
    const pine = mergeGeometries(
      [
        [0, 0, 0, 2.2],
        [1.4, 0.3, 0.6, 1.7],
        [-1.3, 0.2, -0.5, 1.8],
        [0.3, 0.6, -1.4, 1.6],
        [-0.4, 0.9, 1.1, 1.5],
      ].map(([x, y, z, radius]) => lobe.clone().scale(radius!, radius! * 0.65, radius!).translate(x!, y!, z!)),
      false,
    )!;
    lobe.dispose();
    const trunk = new THREE.CylinderGeometry(0.16, 0.24, 2.2, 6);
    let planted = 0;
    for (let attempt = 0; attempt < 700 && planted < (light ? 60 : 140); attempt += 1) {
      const x = (treeRandom() - 0.5) * 260;
      const z = (treeRandom() - 0.5) * 220 - 30;
      const insidePad = x > pad.minX - 2 && x < pad.maxX + 2 && z > pad.minZ - 2 && z < pad.maxZ + 2;
      if (insidePad) continue;
      const y = terrainHeight(x, z);
      if (y < 0.5 || z > pad.maxZ) continue;
      if (fbm(x / 30, z / 30, 3) < 0.42) continue;
      const scale = 0.8 + treeRandom() * 0.7;
      const turned = treeRandom() * Math.PI * 2;
      place('trunk', trunk, x, y + 1.1, z);
      if (treeRandom() < 0.4) {
        place('canopyDark', cypress.clone().scale(scale, scale, scale), x, y + 1.6, z, turned);
      } else {
        place('canopyOlive', pine.clone().scale(scale, scale * 0.9, scale), x, y + 2.2 + scale, z, turned);
      }
      planted += 1;
    }
    cypress.dispose();
    pine.dispose();
    trunk.dispose();
    const at = (x: number, y: number, z: number, turn: number, scale: number) =>
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn),
        new THREE.Vector3(scale, scale, scale),
      );
    for (let attempt = 0; attempt < 400 && boulders.length < (light ? 5 : 10); attempt += 1) {
      const x = (treeRandom() - 0.5) * 200;
      const z = pad.maxZ + 2 + treeRandom() * 40;
      const y = terrainHeight(x, z);
      if (y < seaLevel - 0.5 || y > 1.5) continue;
      boulders.push(at(x, y - 0.3, z, treeRandom() * Math.PI * 2, 1.6 + treeRandom() * 2.2));
    }
    if (grounds.pool) {
      const { pool } = grounds;
      const deckZ = pool.z + pool.depth / 2 + 2.6;
      for (let index = 0; index < 3; index += 1) {
        const x = pool.x - pool.width / 2 + 4 + (index * (pool.width - 8)) / 2;
        tables.push(at(x, 0.12, deckZ, (treeRandom() - 0.5) * 0.8, 1));
      }
    }
    for (const block of model.blocks) {
      if (!block.roofTerrace || block.width < 16) continue;
      const top = block.toFloor * floorHeight + SLAB + 0.06;
      tables.push(at(block.x + block.width * 0.28, top, block.z + block.depth * 0.22, (treeRandom() - 0.5) * 0.8, 1));
      tables.push(at(block.x - block.width * 0.3, top, block.z + block.depth * 0.18, (treeRandom() - 0.5) * 0.8, 1));
    }

    /** A photoscan as instances: its meshes, baked to the root, one draw each. */
    const scatter = async (id: string, transforms: THREE.Matrix4[]) => {
      if (transforms.length === 0) return;
      const gltf = await gltfLoader.loadAsync(`/models/${id}.glb`);
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        const geometry = (node.geometry as THREE.BufferGeometry).clone().applyMatrix4(node.matrixWorld);
        const material = node.material as THREE.MeshStandardMaterial;
        // Leaves come as blended alpha; cut them out instead, so they sort
        // and shadow like solid things.
        if (material.transparent) {
          material.transparent = false;
          material.alphaTest = 0.45;
          material.depthWrite = true;
        }
        material.side = THREE.DoubleSide;
        const instanced = new THREE.InstancedMesh(geometry, material, transforms.length);
        transforms.forEach((transform, index) => instanced.setMatrixAt(index, transform));
        instanced.castShadow = true;
        instanced.receiveShadow = true;
        building.add(instanced);
        meshes.push(instanced);
      });
    };
    await Promise.all([scatter('boulder_01', boulders), scatter('outdoor_table_chair_set_01', tables)]);
  }

  // Merge: one mesh per material per floor. Tinted materials are cloned per
  // floor so a pick can light that floor alone.
  const floorMaterials = new Map<string, THREE.MeshStandardMaterial>();
  for (const [key, geometries] of parts) {
    const [name, floorKey] = key.split(':') as [MaterialName, string];
    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    if (!merged) continue;
    const floor = floorKey === 'site' ? undefined : Number(floorKey);
    let material: THREE.MeshStandardMaterial = materials[name];
    if (floor !== undefined && TINTED.includes(name)) {
      material = materials[name].clone();
      floorMaterials.set(key, material);
    }
    boxMapUv(merged, name === 'wall' ? 2.4 : 3.2);
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = name !== 'railing' && name !== 'water';
    mesh.receiveShadow = true;
    if (floor !== undefined) {
      mesh.userData.floor = floor;
      if (name !== 'railing') pickable.push(mesh);
    }
    building.add(mesh);
    meshes.push(mesh);
  }
  for (const geometry of boxes.values()) geometry.dispose();

  // Framing: the building's own bounds, not the headland's.
  const bounds = new THREE.Box3(
    new THREE.Vector3(pad.minX + 4, 0, pad.minZ + 4),
    new THREE.Vector3(pad.maxX - 4, topFloor * floorHeight, pad.maxZ - 4),
  );
  if (model.url) bounds.setFromObject(building);
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.z, size.y * 1.5) / 2;
  const fitDistance = (radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.22;

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 0.8;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.autoRotate = !options.reducedMotion;
  controls.autoRotateSpeed = 0.4;
  controls.target.copy(centre);

  let aspect = 1;
  const distanceFor = () => {
    const modelDistance = model.view?.distance ?? fitDistance;
    // A portrait-ish stage has to stand further back to fit the same width.
    return modelDistance * Math.max(1, 1.5 / aspect);
  };

  const placeCamera = () => {
    const azimuth = THREE.MathUtils.degToRad(model.view?.azimuth ?? 30);
    const elevation = THREE.MathUtils.degToRad(model.view?.elevation ?? 18);
    const distance = distanceFor();
    controls.minDistance = distance * 0.4;
    controls.maxDistance = distance * 2.4;
    camera.position.set(
      centre.x + distance * Math.cos(elevation) * Math.sin(azimuth),
      centre.y + distance * Math.sin(elevation),
      centre.z + distance * Math.cos(elevation) * Math.cos(azimuth),
    );
    controls.target.copy(centre);
    controls.update();
  };

  // Late-afternoon sun from the south-west, and a shadow map that covers
  // just the site — the tighter it is, the crisper it draws.
  sun.position.set(centre.x - radius * 2.2, radius * 2.6, centre.z + radius * 1.6);
  sun.target.position.copy(centre);
  const shadowReach = radius * 1.7;
  sun.shadow.camera.left = -shadowReach;
  sun.shadow.camera.right = shadowReach;
  sun.shadow.camera.top = shadowReach;
  sun.shadow.camera.bottom = -shadowReach;
  sun.shadow.camera.updateProjectionMatrix();

  // Passes: ambient occlusion tucks the balconies and window reveals into
  // shadow the way real corners are, and SMAA settles the railings. Both
  // cost too much on a phone, which draws straight to the screen.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = light ? null : new GTAOPass(scene, camera, 1, 1);
  if (gtao) {
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 0.85;
    gtao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1, thickness: 1, scale: 1.2, samples: 12, distanceFallOff: 1 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 3, samples: 12 });
    composer.addPass(gtao);
  }
  composer.addPass(new OutputPass());
  if (!light) composer.addPass(new SMAAPass());

  let needsRender = true;
  let visible = true;
  let selected: number | null = null;
  let hovered: number | null = null;
  let tokens = options.tokens;
  let dark = options.dark;
  let targetY = centre.y;

  const applyHighlight = () => {
    const accent = new THREE.Color(tokens.accent);
    const litFor = (floor: number) => (floor === selected ? 0.4 : floor === hovered ? 0.16 : 0);
    for (const [key, material] of floorMaterials) {
      const [name, floorKey] = key.split(':') as [MaterialName, string];
      const base = materials[name];
      const lit = litFor(Number(floorKey));
      material.color.copy(base.color);
      material.emissive.copy(base.emissive);
      material.emissiveIntensity = base.emissiveIntensity;
      if (!lit) continue;
      if (name === 'glass' || name === 'glassLit') {
        material.emissive.copy(accent);
        material.emissiveIntensity = Math.max(base.emissiveIntensity, lit * 1.5);
      } else {
        material.color.lerp(accent, lit);
        material.emissive.copy(accent);
        material.emissiveIntensity = lit * 0.35;
      }
    }
    // A GLB has no per-floor materials; tint its named meshes instead.
    if (model.url) {
      for (const mesh of pickable) {
        if (!(mesh.material instanceof THREE.MeshStandardMaterial)) continue;
        const lit = litFor(mesh.userData.floor as number);
        mesh.material.emissive.set(lit ? tokens.accent : '#000000');
        mesh.material.emissiveIntensity = lit;
      }
    }
    needsRender = true;
  };

  let themeRequest = 0;
  const applyTheme = () => {
    paint(materials, dark);
    // The night sky is a dark photograph, so the moon and the sky fill do
    // more of the work than the sun does by day.
    hemisphere.color.set(dark ? '#5b6b8a' : '#cfdbe6');
    hemisphere.groundColor.set(dark ? '#1a1814' : '#b9ae9c');
    hemisphere.intensity = dark ? 1.6 : 0.35;
    sun.color.set(dark ? '#aabbd8' : '#ffe6c4');
    sun.intensity = dark ? 1.5 : 2.1;
    scene.environmentIntensity = dark ? 2 : 1;
    scene.backgroundIntensity = dark ? 1 : 1;
    scene.fog = new THREE.Fog(dark ? '#0c1018' : '#dfe3e6', fitDistance * 1.8, fitDistance * 6);
    applyHighlight();
    // The sky for the other scheme arrives when it is first asked for.
    const request = (themeRequest += 1);
    void loadSky(dark ? 'night' : 'day').then((sky) => {
      if (request !== themeRequest) return;
      scene.background = sky.background;
      scene.environment = sky.environment;
      needsRender = true;
    });
  };
  applyTheme();

  // Sizing: the stage decides, the canvas follows.
  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    needsRender = true;
  };
  const resizeObserver = new ResizeObserver(() => {
    const before = aspect;
    resize();
    // The first measurement frames the opening view; a later one — a rotate
    // to landscape, fullscreen — keeps whatever the guest has done.
    if (before === 1 && aspect !== 1) placeCamera();
  });
  resizeObserver.observe(container);
  resize();
  placeCamera();

  // Only draw while on screen, and only when something moved.
  const visibility = new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting);
    if (visible) needsRender = true;
  });
  visibility.observe(container);

  controls.addEventListener('change', () => {
    needsRender = true;
  });
  const onStart = () => {
    controls.autoRotate = false;
    options.onInteract();
  };
  controls.addEventListener('start', onStart);

  // Picking: a tap or a click on a floor, never the end of a drag.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downAt: { x: number; y: number } | null = null;

  const floorAt = (event: PointerEvent): number | null => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickable, false)[0];
    return hit ? ((hit.object.userData.floor as number | undefined) ?? null) : null;
  };

  const onPointerDown = (event: PointerEvent) => {
    downAt = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!downAt) return;
    const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
    downAt = null;
    if (moved > 6) return;
    const floor = floorAt(event);
    if (floor !== null) options.onSelect(floor);
  };
  let hoverFrame = 0;
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || downAt) return;
    if (hoverFrame) return;
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = 0;
      const floor = floorAt(event);
      if (floor !== hovered) options.onHover(floor);
      canvas.style.cursor = floor === null ? 'grab' : 'pointer';
    });
  };
  const onPointerLeave = () => {
    if (hovered !== null) options.onHover(null);
  };
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);

  let frame = requestAnimationFrame(function tick() {
    frame = requestAnimationFrame(tick);
    if (!visible || document.visibilityState === 'hidden') return;
    // Ease the view toward the chosen floor's height so the guest is looking
    // at what they picked, not at the building's middle.
    if (Math.abs(controls.target.y - targetY) > 0.01) {
      // Eased on a real GPU; a software renderer cannot afford the frames.
      controls.target.y = light ? targetY : controls.target.y + (targetY - controls.target.y) * 0.08;
      needsRender = true;
    }
    controls.update();
    if (!needsRender) return;
    needsRender = false;
    composer.render();
  });

  return {
    setSelected(floor) {
      selected = floor;
      targetY = floor === null ? centre.y : Math.min(centre.y * 1.6, (floor - 0.5) * floorHeight);
      applyHighlight();
    },
    setHovered(floor) {
      hovered = floor;
      applyHighlight();
    },
    setTheme(nextTokens, nextDark) {
      tokens = nextTokens;
      dark = nextDark;
      applyTheme();
    },
    resetView() {
      controls.autoRotate = !options.reducedMotion;
      placeCamera();
      needsRender = true;
    },
    dispose() {
      cancelAnimationFrame(frame);
      if (hoverFrame) cancelAnimationFrame(hoverFrame);
      resizeObserver.disconnect();
      visibility.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      controls.dispose();
      for (const mesh of meshes) mesh.geometry.dispose();
      for (const material of Object.values(materials)) {
        material.map?.dispose();
        material.bumpMap?.dispose();
        material.dispose();
      }
      for (const material of floorMaterials.values()) material.dispose();
      for (const sky of skies.values()) {
        sky.background.dispose();
        sky.environment.dispose();
      }
      pmrem.dispose();
      for (const scan of [plaster, concrete, hills, rock]) {
        scan.map.dispose();
        scan.normalMap.dispose();
        scan.roughnessMap.dispose();
      }
      building.traverse((node) => {
        if (node instanceof THREE.Mesh && !meshes.includes(node)) node.geometry.dispose();
      });
      composer.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
