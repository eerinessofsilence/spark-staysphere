"""Propagate a traced zone outline across the spinner's orbit frames.

    python3 scripts/track-outlines.py --frames ~/Downloads/asteria-full --config scripts/outline-anchors.json

Hand-tracing a shape on 160 frames is not realistic, and tracing a handful and
interpolating drifts off the building between them. This tracks the facade
instead: consecutive frames are matched on their features, the homography
between them is fitted with RANSAC, and the polygon is carried through that
chain — the same planar-tracking idea a compositor's tracker uses.

Drift over a long chain is handled by anchoring: every arc runs between two
hand-traced frames, tracked forward from one and backward from the other, and
the two estimates are blended across the arc. The result matches the anchors
exactly and moves smoothly in between.

Writes a JSON array of `{frameIndex, x, y, outline}` ready to paste into the
hotspot's `keyframes` in `lib/infrastructure/mock-data.ts`.
"""

import argparse
import json
import os

import cv2
import numpy as np

# Features are searched only near the shape, so the tracker follows the building
# rather than the road, the sky or a passing car.
MASK_DILATE_PX = 90
MIN_MATCHES = 12
RANSAC_REPROJ_PX = 3.0
# One frame is 2.25° of orbit, so a step can only move the shape a little. A fit
# that claims more than this is a mis-match, and accepting it destroys the chain:
# the polygon leaves the picture and every later frame has nothing to match on.
MAX_STEP_TRANSLATION_PX = 120.0
MAX_STEP_SCALE = 1.08


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--frames", required=True, help="directory of numbered source frames")
    parser.add_argument("--config", required=True, help="JSON: frameCount + hotspots with anchor polygons")
    parser.add_argument("--out", default="scripts/outline-tracked.json")
    parser.add_argument("--ts", help="also emit a TypeScript module of keyframes for the seed data")
    parser.add_argument("--ext", default="jpg")
    parser.add_argument("--step", type=int, default=1, help="emit every Nth frame of the arc")
    return parser.parse_args()


def load_gray(directory, index, ext):
    path = os.path.join(directory, f"{index}.{ext}")
    image = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise SystemExit(f"missing frame: {path}")
    return image


def wrap(index, count):
    return index % count


def polygon_px(points, size):
    height, width = size
    return np.array([[p["x"] * width, p["y"] * height] for p in points], dtype=np.float32)


def polygon_fractions(points_px, size):
    height, width = size
    return [
        {"x": round(float(x) / width, 4), "y": round(float(y) / height, 4)}
        for x, y in points_px
    ]


def mask_for(points_px, size):
    mask = np.zeros(size, dtype=np.uint8)
    cv2.fillPoly(mask, [points_px.astype(np.int32)], 255)
    kernel = np.ones((MASK_DILATE_PX, MASK_DILATE_PX), np.uint8)
    return cv2.dilate(mask, kernel)


def homography(detector, matcher, prev_gray, next_gray, points_px, gap=1):
    """Motion of the region under `points_px` from one frame to another `gap` frames away."""
    mask = mask_for(points_px, prev_gray.shape)
    kp1, des1 = detector.detectAndCompute(prev_gray, mask)
    kp2, des2 = detector.detectAndCompute(next_gray, None)
    if des1 is None or des2 is None or len(kp1) < MIN_MATCHES or len(kp2) < MIN_MATCHES:
        return None
    pairs = matcher.knnMatch(des1, des2, k=2)
    # Lowe's ratio test: a match is only trusted when it clearly beats the runner-up.
    good = [m for m, n in (p for p in pairs if len(p) == 2) if m.distance < 0.75 * n.distance]
    if len(good) < MIN_MATCHES:
        return None
    src = np.float32([kp1[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
    dst = np.float32([kp2[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
    # Similarity, not a full homography: a 2.25° step needs no perspective, and the
    # restricted model cannot fold the shape the way a bad homography fit can.
    matrix, _ = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=RANSAC_REPROJ_PX)
    if matrix is None:
        return None
    scale = float(np.hypot(matrix[0, 0], matrix[1, 0]))
    shift = float(np.hypot(matrix[0, 2], matrix[1, 2]))
    limit_scale = MAX_STEP_SCALE**gap
    if not (1 / limit_scale <= scale <= limit_scale) or shift > MAX_STEP_TRANSLATION_PX * gap:
        return None
    return matrix


def track(directory, ext, frame_count, start_index, start_points, steps, direction, detector, matcher):
    """Carry a polygon `steps` frames from `start_index`, one frame at a time."""
    results = {start_index: start_points.copy()}
    # The reference is the last frame that actually matched. A frame that cannot be
    # matched — the four high-resolution stills spliced into the video look different
    # enough to defeat the descriptors — is stepped over rather than ending the chain.
    ref_gray = load_gray(directory, start_index, ext)
    ref_points = start_points.copy()
    ref_offset = 0
    for step in range(1, steps + 1):
        index = wrap(start_index + direction * step, frame_count)
        gray = load_gray(directory, index, ext)
        gap = step - ref_offset
        matrix = homography(detector, matcher, ref_gray, gray, ref_points, gap=gap)
        if matrix is None:
            print(f"  ! frame {index}: no trusted fit, stepping over it")
            results[index] = ref_points.copy()
            continue
        results[index] = cv2.transform(ref_points.reshape(-1, 1, 2), matrix).reshape(-1, 2)
        ref_gray, ref_points, ref_offset = gray, results[index].copy(), step
    return results


def main():
    args = parse_args()
    config = json.load(open(args.config))
    frame_count = config["frameCount"]
    directory = os.path.expanduser(args.frames)

    detector = cv2.SIFT_create(nfeatures=4000)
    matcher = cv2.BFMatcher(cv2.NORM_L2)
    size = load_gray(directory, 0, args.ext).shape
    output = {}

    for hotspot in config["hotspots"]:
        anchors = sorted(hotspot["anchors"], key=lambda a: a["arcPos"])
        print(f"{hotspot['id']}: {len(anchors)} anchors")
        frames = {}

        # A shape traced properly on one frame beats several rough ones: with a
        # single anchor the tracker just runs out from it in both directions.
        if len(anchors) == 1:
            anchor = anchors[0]
            before, after = hotspot.get("spanBefore", 0), hotspot.get("spanAfter", 0)
            points = polygon_px(anchor["outline"], size)
            print(f"  single anchor {anchor['frameIndex']}, tracking -{before} / +{after}")
            back = track(directory, args.ext, frame_count, anchor["frameIndex"], points, before, -1, detector, matcher)
            fwd = track(directory, args.ext, frame_count, anchor["frameIndex"], points, after, 1, detector, matcher)
            frames = {**back, **fwd}
            ordered = []
            for offset in range(-before, after + 1, args.step):
                index = wrap(anchor["frameIndex"] + offset, frame_count)
                if index not in frames:
                    continue
                pts = frames[index]
                centre = pts.mean(axis=0)
                ordered.append(
                    {
                        "frameIndex": index,
                        "x": round(float(centre[0]) / size[1], 4),
                        "y": round(float(centre[1]) / size[0], 4),
                        "outline": polygon_fractions(pts, size),
                    }
                )
            output[hotspot["id"]] = ordered
            print(f"  → {len(ordered)} tracked frames")
            continue

        for first, second in zip(anchors, anchors[1:]):
            span = second["arcPos"] - first["arcPos"]
            if span <= 0:
                continue
            start = polygon_px(first["outline"], size)
            end = polygon_px(second["outline"], size)
            print(f"  arc {first['frameIndex']} → {second['frameIndex']} ({span} frames)")
            forward = track(directory, args.ext, frame_count, first["frameIndex"], start, span, 1, detector, matcher)
            backward = track(directory, args.ext, frame_count, second["frameIndex"], end, span, -1, detector, matcher)
            for offset in range(span + 1):
                index = wrap(first["frameIndex"] + offset, frame_count)
                # Blend the two chains so the shape lands exactly on both anchors.
                t = offset / span
                blended = forward[index] * (1 - t) + backward[index] * t
                frames[index] = blended

        ordered = []
        for offset in range(0, anchors[-1]["arcPos"] - anchors[0]["arcPos"] + 1, args.step):
            index = wrap(anchors[0]["frameIndex"] + offset, frame_count)
            if index not in frames:
                continue
            points = frames[index]
            centre = points.mean(axis=0)
            ordered.append(
                {
                    "frameIndex": index,
                    "x": round(float(centre[0]) / size[1], 4),
                    "y": round(float(centre[1]) / size[0], 4),
                    "outline": polygon_fractions(points, size),
                }
            )
        output[hotspot["id"]] = ordered
        print(f"  → {len(ordered)} tracked frames")

    with open(args.out, "w") as handle:
        json.dump(output, handle, indent=2)
    print(f"wrote {args.out}")

    if args.ts:
        lines = [
            "// Generated by scripts/track-outlines.py — do not edit by hand.",
            "// Regenerate:",
            "//   python3 scripts/track-outlines.py --frames <frames dir> \\",
            "//     --config scripts/outline-anchors.json --ts lib/infrastructure/spinner-outlines.ts",
            "",
            "import type { SpinnerHotspot } from '../domain/schemas';",
            "",
            "type Keyframes = SpinnerHotspot['keyframes'];",
            "",
            "export const trackedOutlines: Record<string, Keyframes> = {",
        ]
        for hotspot_id, keyframes in output.items():
            lines.append(f"  '{hotspot_id}': [")
            for keyframe in keyframes:
                corners = ", ".join(
                    f"{{ x: {p['x']}, y: {p['y']} }}" for p in keyframe["outline"]
                )
                lines.append(
                    f"    {{ frameIndex: {keyframe['frameIndex']}, x: {keyframe['x']}, "
                    f"y: {keyframe['y']}, outline: [{corners}] }},"
                )
            lines.append("  ],")
        lines.append("};")
        lines.append("")
        with open(args.ts, "w") as handle:
            handle.write("\n".join(lines))
        print(f"wrote {args.ts}")


if __name__ == "__main__":
    main()
