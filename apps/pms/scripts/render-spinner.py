"""Render the building-spinner orbit frames from a 3D model.

    # A generated model file (glb/gltf/fbx/obj) — a fresh scene is built around it:
    blender --background --python scripts/render-spinner.py -- \
        --model /path/to/building.glb --out public/images/hotel/spin

    # Or a .blend whose scene is already dressed and lit (the procedural candidate):
    blender --background /path/to/candidate.blend --python scripts/render-spinner.py -- \
        --collection HERO_hotel --out public/images/hotel/spin

    Common options: [--frames 48] [--width 2000] [--height 1334] [--elevation 12]
        [--engine CYCLES|BLENDER_EEVEE] [--samples 128] [--start-angle 0] [--fov 32]
        [--format PNG|WEBP] [--quality 80]

Frame 0 is the front-on view (camera on -Y looking at +Y, matching Blender's
front view), and the orbit steps clockwise from above so that dragging right in
`BuildingSpinner` turns the building the way a guest expects. Output is
`frame-00.png ... frame-NN.png`; convert to WebP afterwards (see SPINNER_SPEC.md).
"""

import argparse
import math
import os
import sys

import bpy
from mathutils import Vector


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", help="glb/gltf/fbx/obj to orbit in a fresh scene")
    parser.add_argument("--collection", help="collection in the already-open .blend to orbit (scene kept as-is)")
    parser.add_argument("--out", required=True, help="output directory for frame PNGs")
    parser.add_argument("--frames", type=int, default=48)
    parser.add_argument("--width", type=int, default=2000)
    parser.add_argument("--height", type=int, default=1334)
    parser.add_argument("--elevation", type=float, default=12.0, help="camera pitch above the horizon, degrees")
    parser.add_argument("--start-angle", type=float, default=0.0, help="azimuth of frame 0, degrees")
    parser.add_argument("--engine", default="CYCLES", choices=["CYCLES", "BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"])
    parser.add_argument("--samples", type=int, default=128)
    parser.add_argument("--fov", type=float, default=32.0, help="horizontal field of view, degrees")
    parser.add_argument("--format", default="PNG", choices=["PNG", "WEBP"])
    parser.add_argument("--quality", type=int, default=80, help="WEBP quality, 0-100")
    args = parser.parse_args(argv)
    # Blender 5.x registers EEVEE Next as plain BLENDER_EEVEE.
    if args.engine == "BLENDER_EEVEE_NEXT":
        args.engine = "BLENDER_EEVEE"
    return args


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def import_model(path):
    ext = os.path.splitext(path)[1].lower()
    before = set(bpy.data.objects)
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    else:
        raise SystemExit(f"Unsupported model format: {ext}")
    imported = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in imported if o.type == "MESH"]
    if not meshes:
        raise SystemExit("Model imported no mesh objects")
    return imported, meshes


def world_bounds(meshes):
    lo = Vector((math.inf,) * 3)
    hi = Vector((-math.inf,) * 3)
    for obj in meshes:
        for corner in obj.bound_box:
            p = obj.matrix_world @ Vector(corner)
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    return lo, hi


def add_sun(scene):
    data = bpy.data.lights.new("LGT_key", "SUN")
    data.energy = 4.0
    data.angle = math.radians(2.0)
    sun = bpy.data.objects.new("LGT_key", data)
    scene.collection.objects.link(sun)
    # Lateral, from high front-left: both lit and shadow planes read from every azimuth.
    sun.rotation_euler = (math.radians(50), 0.0, math.radians(-35))
    return sun


def add_world(scene):
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.78, 0.86, 0.95, 1.0)
    bg.inputs[1].default_value = 1.0
    scene.world = world


def add_ground(scene, centre, radius):
    mesh = bpy.data.meshes.new("ENV_ground")
    size = radius * 6
    mesh.from_pydata(
        [(-size, -size, 0), (size, -size, 0), (size, size, 0), (-size, size, 0)],
        [],
        [(0, 1, 2, 3)],
    )
    ground = bpy.data.objects.new("ENV_ground", mesh)
    ground.location = (centre.x, centre.y, 0.0)
    mat = bpy.data.materials.new("MAT_ground")
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.62, 0.6, 0.55, 1.0)
    mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
    ground.data.materials.append(mat)
    scene.collection.objects.link(ground)
    return ground


def setup_camera(scene, args, centre, radius):
    for name in ("CAM_orbit", "CAM_target"):
        stale = bpy.data.objects.get(name)
        if stale:
            bpy.data.objects.remove(stale, do_unlink=True)
    cam_data = bpy.data.cameras.new("CAM_orbit")
    cam_data.clip_end = 10000
    cam_data.sensor_fit = "HORIZONTAL"
    cam_data.lens_unit = "FOV"
    cam_data.angle = math.radians(args.fov)
    cam = bpy.data.objects.new("CAM_orbit", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    target = bpy.data.objects.new("CAM_target", None)
    target.location = centre
    scene.collection.objects.link(target)
    track = cam.constraints.new("TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"

    # Distance so the bounding sphere fits the horizontal FOV with air for rails, lamps, palms.
    distance = radius / math.sin(math.radians(args.fov) / 2) * 1.25
    return cam, distance


def render_frames(scene, cam, centre, distance, args):
    os.makedirs(args.out, exist_ok=True)
    scene.render.engine = args.engine
    scene.render.resolution_x = args.width
    scene.render.resolution_y = args.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = args.format
    if args.format == "WEBP":
        scene.render.image_settings.quality = args.quality
    scene.render.film_transparent = False
    if args.engine == "CYCLES":
        scene.cycles.samples = args.samples
        scene.cycles.use_denoising = True
    else:
        scene.eevee.taa_render_samples = args.samples

    elevation = math.radians(args.elevation)
    for index in range(args.frames):
        azimuth = math.radians(args.start_angle) - (2 * math.pi * index / args.frames)
        # Frame 0 sits on -Y (Blender "front"); increasing index walks clockwise seen from above.
        x = centre.x + distance * math.cos(elevation) * math.sin(azimuth)
        y = centre.y - distance * math.cos(elevation) * math.cos(azimuth)
        z = centre.z + distance * math.sin(elevation)
        cam.location = (x, y, z)
        scene.render.filepath = os.path.join(args.out, f"frame-{index:02d}.{args.format.lower()}")
        bpy.ops.render.render(write_still=True)
        print(f"rendered {index + 1}/{args.frames}", flush=True)


def main():
    args = parse_args()
    if bool(args.model) == bool(args.collection):
        raise SystemExit("Pass exactly one of --model or --collection")

    if args.model:
        scene = reset_scene()
        _, meshes = import_model(os.path.abspath(args.model))
        lo, hi = world_bounds(meshes)
        # Sit the model on the ground plane and orbit around its footprint centre.
        for obj in meshes:
            if obj.parent is None:
                obj.location.z -= lo.z
        lo, hi = world_bounds(meshes)
        centre = (lo + hi) / 2
        radius = max((hi - lo).length / 2, 1e-3)
        add_world(scene)
        add_sun(scene)
        add_ground(scene, centre, radius)
    else:
        # The .blend passed to Blender is already open: its world, lights and site stay.
        scene = bpy.context.scene
        collection = bpy.data.collections.get(args.collection)
        if collection is None:
            raise SystemExit(f"No collection named {args.collection!r} in the open file")
        meshes = [o for o in collection.all_objects if o.type == "MESH" and not o.hide_render]
        if not meshes:
            raise SystemExit(f"Collection {args.collection!r} has no renderable meshes")
        lo, hi = world_bounds(meshes)
        centre = (lo + hi) / 2
        radius = max((hi - lo).length / 2, 1e-3)

    cam, distance = setup_camera(scene, args, centre, radius)
    render_frames(scene, cam, centre, distance, args)


if __name__ == "__main__":
    main()
