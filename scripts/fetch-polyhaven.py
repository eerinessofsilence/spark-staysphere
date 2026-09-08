"""Download the CC0 Poly Haven assets the spinner scene (scripts/asteria-cove.blend) links to.

    python3 scripts/fetch-polyhaven.py            # downloads into scripts/blender-assets/
    python3 scripts/fetch-polyhaven.py --dest DIR

Idempotent: files already on disk are skipped. Writes DIR/manifest.json mapping each slug to
its absolute file paths. Everything here is CC0 (https://polyhaven.com/license); it is
credited in public/images/CREDITS.md anyway.
"""

import argparse
import json
import os
import sys
import urllib.request

API = "https://api.polyhaven.com/files/{slug}"
RES = "2k"

TEXTURES = {
    "white_plaster_02": ["Diffuse", "Rough", "AO", "nor_gl"],
    "rough_concrete": ["Diffuse", "Rough", "AO", "nor_gl"],
    "clean_asphalt": ["Diffuse", "Rough", "AO", "nor_gl"],
    "square_concrete_pavers": ["Diffuse", "Rough", "AO", "nor_gl"],
    "leafy_grass": ["Diffuse", "Rough", "AO", "nor_gl"],
    "coast_sand_02": ["Diffuse", "Rough", "AO", "nor_gl"],
}
HDRIS = ["kloofendal_43d_clear_puresky", "qwantani_noon_puresky"]
MODELS = ["shrub_01", "shrub_02", "shrub_03", "shrub_04", "street_lamp_01", "outdoor_table_chair_set_01"]


# Poly Haven's CDN rejects the default Python-urllib user agent.
HEADERS = {"User-Agent": "spark-staysphere/1.0 (scripts/fetch-polyhaven.py)"}


def open_url(url, timeout):
    return urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=timeout)


def fetch_json(url):
    with open_url(url, 60) as response:
        return json.load(response)


def download(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return False
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".part"
    with open_url(url, 300) as response, open(tmp, "wb") as out:
        while True:
            chunk = response.read(1 << 20)
            if not chunk:
                break
            out.write(chunk)
    os.replace(tmp, path)
    return True


def pick(files, *keys):
    node = files
    for key in keys:
        node = node[key]
    return node


def fetch_texture(slug, maps, dest):
    files = fetch_json(API.format(slug=slug))
    paths = {}
    for map_name in maps:
        entry = pick(files, map_name, RES, "jpg")
        path = os.path.join(dest, slug, os.path.basename(entry["url"]))
        fresh = download(entry["url"], path)
        paths[map_name] = path
        print(f"  {slug}/{map_name}: {'downloaded' if fresh else 'cached'}", flush=True)
    return paths


def fetch_hdri(slug, dest):
    files = fetch_json(API.format(slug=slug))
    entry = pick(files, "hdri", RES, "hdr")
    path = os.path.join(dest, slug, os.path.basename(entry["url"]))
    fresh = download(entry["url"], path)
    print(f"  {slug}: {'downloaded' if fresh else 'cached'}", flush=True)
    return {"hdr": path}


def fetch_model(slug, dest):
    files = fetch_json(API.format(slug=slug))
    entry = pick(files, "blend", RES, "blend")
    root = os.path.join(dest, slug)
    blend = os.path.join(root, os.path.basename(entry["url"]))
    fresh = download(entry["url"], blend)
    # The .blend links its textures by relative path, so they must land at the same paths.
    for rel, sub in (entry.get("include") or {}).items():
        download(sub["url"], os.path.join(root, rel))
    print(f"  {slug}: {'downloaded' if fresh else 'cached'} (+{len(entry.get('include') or {})} files)", flush=True)
    return {"blend": blend}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dest", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "blender-assets"))
    args = parser.parse_args()
    dest = os.path.abspath(args.dest)

    manifest = {"textures": {}, "hdris": {}, "models": {}}
    print("textures", flush=True)
    for slug, maps in TEXTURES.items():
        manifest["textures"][slug] = fetch_texture(slug, maps, dest)
    print("hdris", flush=True)
    for slug in HDRIS:
        manifest["hdris"][slug] = fetch_hdri(slug, dest)
    print("models", flush=True)
    for slug in MODELS:
        manifest["models"][slug] = fetch_model(slug, dest)

    manifest_path = os.path.join(dest, "manifest.json")
    with open(manifest_path, "w") as out:
        json.dump(manifest, out, indent=2)
    print(f"manifest: {manifest_path}", flush=True)
    return manifest


if __name__ == "__main__":
    main()
else:
    # Imported/exec'd inside Blender: expose the manifest as `result` for bl_execute.
    if "bpy" in sys.modules:
        result = main()
