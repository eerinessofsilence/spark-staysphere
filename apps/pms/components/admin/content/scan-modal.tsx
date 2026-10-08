'use client';

import * as React from 'react';
import { ArrowPathIcon, ArrowsRightLeftIcon, CameraIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { useAdminT } from '@/lib/i18n/admin/context';
import { iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';
import { PanoramaViewer } from '@/components/view-360';
import { preparePhoto } from './photo-upload';

type Step<TDraft> =
  | { kind: 'capture' }
  | { kind: 'preview'; file: File; url: string; panorama: Panorama | null }
  | { kind: 'recognizing'; file: File; url: string; panorama: Panorama | null }
  | { kind: 'draft'; draft: TDraft; url: string; panoramaUrl: string | null };

/** A stitched 360° tour: the file to upload and its preview. */
export interface Panorama {
  file: File;
  url: string;
}

export type ScanRecognizeResult<TDraft> = { ok: true; draft: TDraft } | { ok: false; message: string };

/** How many frames make one turn — a phone camera sees about 60° across, so eight overlap comfortably. */
const TOUR_FRAMES = 8;
/** One press, one steady turn: a frame lands on its own every this many ms — eight of them make a slow ~7-second full circle. */
const AUTO_CAPTURE_MS = 900;
/** Thumbnail width the alignment search runs at — enough to find a wall edge, cheap enough to run eight times on a phone. */
const MATCH_WIDTH = 160;

/** A frame as a small greyscale sample: what the alignment compares. */
function greyscale(frame: HTMLCanvasElement): { data: Float32Array; width: number; height: number } {
  const width = MATCH_WIDTH;
  const height = Math.max(1, Math.round((MATCH_WIDTH * frame.height) / frame.width));
  const small = document.createElement('canvas');
  small.width = width;
  small.height = height;
  const context = small.getContext('2d');
  const data = new Float32Array(width * height);
  if (!context) return { data, width, height };
  context.drawImage(frame, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  for (let i = 0; i < width * height; i += 1) {
    data[i] = 0.299 * pixels[i * 4]! + 0.587 * pixels[i * 4 + 1]! + 0.114 * pixels[i * 4 + 2]!;
  }
  return { data, width, height };
}

/**
 * How far each frame is shifted right of the one before, in full-size
 * pixels: for every candidate shift the overlapping columns are compared
 * and the shift with the smallest mean difference wins. Shifts under 15%
 * (the camera barely moved) and over 85% (nothing left to match on) are
 * not considered; a pair with no usable overlap falls back to a 45° step.
 */
function alignFrames(frames: HTMLCanvasElement[]): number[] {
  const samples = frames.map(greyscale);
  const offsets: number[] = [];
  for (let i = 1; i < frames.length; i += 1) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    const { width, height } = a;
    let best = Math.round(width * 0.5);
    let bestScore = Number.POSITIVE_INFINITY;
    for (let shift = Math.round(width * 0.15); shift <= Math.round(width * 0.85); shift += 1) {
      const overlap = width - shift;
      let total = 0;
      let count = 0;
      for (let y = 0; y < height; y += 2) {
        const row = y * width;
        for (let x = 0; x < overlap; x += 2) {
          total += Math.abs(a.data[row + x + shift]! - b.data[row + x]!);
          count += 1;
        }
      }
      // Mean difference, nudged so that a wide overlap wins a tie over a thin one.
      const score = total / count + shift * 0.02;
      if (score < bestScore) {
        bestScore = score;
        best = shift;
      }
    }
    offsets.push(Math.round((best / width) * frames[i]!.width));
  }
  return offsets;
}

/** The stitched output: equirectangular is 2:1 by definition, and 4096 across keeps it under the upload limit. */
const PANO_WIDTH = 4096;
const PANO_HEIGHT = 2048;

/**
 * The camera half of every "scan it" flow in the back office: a live
 * viewfinder with a switch between cameras, a shutter, a gallery fallback,
 * a preview with Retake, and the "Recognise" call. What comes back is handed
 * to `children` to render as a draft — the product and room-type scans
 * differ only there.
 *
 * With `tour`, a second mode records a 360° tour: one press starts it, the
 * desk turns slowly on the spot, and a frame is taken by itself every 900ms
 * — eight of them over one steady turn — with no further taps. They are then
 * stitched into an equirectangular strip. The first frame doubles as the
 * cover the recognizer looks at; the strip becomes the gallery's 360° view.
 */
export function ScanModal<TDraft>({
  open,
  onClose,
  title,
  intro,
  tour = false,
  initialMode = 'photo',
  onCapture,
  confirmLabel,
  recognize,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  intro: string;
  /** Offer the 360° tour mode beside the single photo. */
  tour?: boolean;
  initialMode?: 'photo' | 'tour';
  onCapture?: (file: File, panorama: File | null) => void;
  confirmLabel?: string;
  recognize?: (file: File, panorama: File | null) => Promise<ScanRecognizeResult<TDraft> & { panoramaUrl?: string | null }>;
  children?: (draft: TDraft, photoUrl: string, retake: () => void, panoramaUrl: string | null) => React.ReactNode;
}) {
  const t = useAdminT();
  const [step, setStep] = React.useState<Step<TDraft>>({ kind: 'capture' });
  const [mode, setMode] = React.useState<'photo' | 'tour'>(initialMode);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = React.useState<boolean | null>(null);
  const [facing, setFacing] = React.useState<'environment' | 'user'>('environment');
  // The tour in progress: frames captured so far, and the timer taking the next one.
  const framesRef = React.useRef<HTMLCanvasElement[]>([]);
  const [frameCount, setFrameCount] = React.useState(0);
  /** Data URLs of the frames taken so far, for the strip under the viewfinder. */
  const [thumbs, setThumbs] = React.useState<string[]>([]);
  const [recording, setRecording] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);
  const [stitching, setStitching] = React.useState(false);

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // The live camera runs only while the capture step is on screen.
  React.useEffect(() => {
    if (!open || step.kind !== 'capture') {
      stopCamera();
      return;
    }
    let cancelled = false;
    setCameraReady(null);
    if (!navigator.mediaDevices?.getUserMedia) { setCameraReady(false); return; }
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: facing }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraReady(true);
      })
      .catch(() => setCameraReady(false));
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, step.kind, facing, stopCamera]);

  const stopAutoCapture = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
  }, []);

  const resetTour = React.useCallback(() => {
    stopAutoCapture();
    framesRef.current = [];
    setFrameCount(0);
    setThumbs([]);
  }, [stopAutoCapture]);

  // Closing drops whatever was mid-flight so the next open starts at the camera.
  React.useEffect(() => {
    if (open) return;
    setStep((current) => {
      if ('url' in current) URL.revokeObjectURL(current.url);
      if ('panorama' in current && current.panorama) URL.revokeObjectURL(current.panorama.url);
      return { kind: 'capture' };
    });
    setMode(initialMode);
    resetTour();
  }, [open, resetTour, initialMode]);

  const retake = React.useCallback(() => {
    setStep((current) => {
      if ('url' in current) URL.revokeObjectURL(current.url);
      if ('panorama' in current && current.panorama) URL.revokeObjectURL(current.panorama.url);
      return { kind: 'capture' };
    });
    resetTour();
  }, [resetTour]);

  /** The current video frame on a canvas, un-mirrored for the selfie camera. */
  function grabFrame(): HTMLCanvasElement | null {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return null;
    if (facing === 'user') {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(video, 0, 0);
    return canvas;
  }

  function toFile(canvas: HTMLCanvasElement, name: string, quality: number): Promise<File | null> {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob?.type === 'image/webp') {
          resolve(new File([blob], name.replace(/\.[^.]+$/, '.webp'), { type: blob.type }));
          return;
        }
        canvas.toBlob(
          (jpeg) => resolve(jpeg ? new File([jpeg], name.replace(/\.[^.]+$/, '.jpg'), { type: jpeg.type || 'image/jpeg' }) : blob ? new File([blob], name, { type: blob.type }) : null),
          'image/jpeg',
          quality,
        );
      }, 'image/webp', quality);
    });
  }

  async function useFile(raw: File, panorama: Panorama | null = null) {
    try {
      const file = await preparePhoto(raw);
      setStep({ kind: 'preview', file, url: URL.createObjectURL(file), panorama });
    } catch {
      toast.error(t('upload.invalid'));
    }
  }

  async function takePhoto() {
    const canvas = grabFrame();
    if (!canvas) return;
    const file = await toFile(canvas, 'scan.webp', 0.88);
    if (file) await useFile(file);
  }

  /**
   * The frames become one strip by lining each up on what it shares with
   * the one before: the two are compared at thumbnail size across a range
   * of horizontal shifts and the best-matching shift says how far the
   * camera actually turned between them — a slow turn overlaps a lot, a
   * quick one little — so the strip follows the room instead of a fixed
   * 45° grid. Seams are feathered, frames keep their own proportions, and
   * the band sits in the middle of the 2:1 canvas over a blurred copy of
   * itself rather than being stretched to the poles. A cylinder from a
   * phone, not a true sphere, but one that reads as the room.
   */
  async function stitch(frames: HTMLCanvasElement[]): Promise<Panorama | null> {
    const first = frames[0]!;
    const frameW = first.width;
    const frameH = first.height;
    const offsets = alignFrames(frames);
    const stripW = frameW + offsets.reduce((sum, offset) => sum + offset, 0);
    const strip = document.createElement('canvas');
    strip.width = stripW;
    strip.height = frameH;
    const sc = strip.getContext('2d');
    if (!sc) return null;
    const feather = Math.round(frameW * 0.12);
    let x = 0;
    frames.forEach((frame, index) => {
      if (index === 0) {
        sc.drawImage(frame, 0, 0);
        return;
      }
      x += offsets[index - 1]!;
      // Fade the new frame in over its first `feather` pixels so the seam is a crossfade, not a cut.
      const faded = document.createElement('canvas');
      faded.width = frame.width;
      faded.height = frame.height;
      const fc = faded.getContext('2d');
      if (!fc) return;
      fc.drawImage(frame, 0, 0);
      // One fill over the whole frame: `destination-in` keeps only what the
      // fill covers, so a fill of just the feather would erase the rest. The
      // gradient holds its last stop past `feather`, which is the opaque part.
      fc.globalCompositeOperation = 'destination-in';
      const ramp = fc.createLinearGradient(0, 0, feather, 0);
      ramp.addColorStop(0, 'rgba(0,0,0,0)');
      ramp.addColorStop(1, 'rgba(0,0,0,1)');
      fc.fillStyle = ramp;
      fc.fillRect(0, 0, frame.width, frame.height);
      sc.drawImage(faded, x, 0);
    });

    const out = document.createElement('canvas');
    out.width = PANO_WIDTH;
    out.height = PANO_HEIGHT;
    const oc = out.getContext('2d');
    if (!oc) return null;
    // The band at its true proportions, as wide as the canvas; above and
    // below it, the same band stretched and blurred so the poles carry the
    // room's colours instead of black.
    const bandH = Math.min(PANO_HEIGHT, Math.round((PANO_WIDTH * frameH) / stripW));
    oc.filter = 'blur(40px)';
    oc.drawImage(strip, 0, 0, PANO_WIDTH, PANO_HEIGHT);
    oc.filter = 'none';
    oc.drawImage(strip, 0, Math.round((PANO_HEIGHT - bandH) / 2), PANO_WIDTH, bandH);
    const file = await toFile(out, 'tour-360.webp', 0.82);
    return file ? { file, url: URL.createObjectURL(file) } : null;
  }

  const captureTourFrame = React.useCallback(async () => {
    const canvas = grabFrame();
    if (!canvas) return;
    framesRef.current = [...framesRef.current, canvas];
    const count = framesRef.current.length;
    setFrameCount(count);
    // A small copy for the strip: the full frame stays on its own canvas for stitching.
    const thumb = document.createElement('canvas');
    thumb.width = 160;
    thumb.height = Math.round((160 * canvas.height) / canvas.width);
    thumb.getContext('2d')?.drawImage(canvas, 0, 0, thumb.width, thumb.height);
    setThumbs((current) => [...current, thumb.toDataURL('image/jpeg', 0.7)]);
    // `timerRef` is stopped from inside `startAutoCapture` once this frame
    // makes the count, not here: this function runs once per timer tick and
    // has no reason to know whether it is the last one until after counting.
    if (count < TOUR_FRAMES) return;
    stopAutoCapture();
    setStitching(true);
    try {
      const frames = framesRef.current;
      const panorama = await stitch(frames);
      const cover = await toFile(frames[0]!, 'scan.webp', 0.88);
      if (!panorama || !cover) throw new Error('stitch');
      await useFile(cover, panorama);
      // A drag-around preview follows right below — this just says it's there.
      toast.success(t('scan.tourStitched'));
    } catch {
      toast.error(t('scan.tourFailed'));
    } finally {
      setStitching(false);
      resetTour();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads refs and the current facing; recreated per render on purpose
  }, [facing, resetTour, stopAutoCapture, t]);

  /** One press starts it: a frame is taken on its own every `AUTO_CAPTURE_MS`, no further taps, until the eighth stitches. */
  const startAutoCapture = React.useCallback(() => {
    if (recording || stitching) return;
    setRecording(true);
    timerRef.current = window.setInterval(() => {
      void captureTourFrame();
    }, AUTO_CAPTURE_MS);
  }, [recording, stitching, captureTourFrame]);

  // Stop the timer if the sheet closes or the mode changes mid-recording — a
  // background interval still snapping photos of a camera nobody is looking
  // at is exactly the kind of thing that should not be possible.
  React.useEffect(() => {
    if (!open || step.kind !== 'capture' || mode !== 'tour' || !cameraReady) stopAutoCapture();
  }, [open, step.kind, mode, cameraReady, stopAutoCapture]);
  React.useEffect(() => stopAutoCapture, [stopAutoCapture]);

  async function runRecognize() {
    if (step.kind !== 'preview') return;
    const { file, url, panorama } = step;
    if (onCapture) { onCapture(file, panorama?.file ?? null); return; }
    if (!recognize) return;
    setStep({ kind: 'recognizing', file, url, panorama });
    const result = await recognize(file, panorama?.file ?? null);
    if (!result.ok) {
      toast.error(result.message || t('scan.failed'));
      setStep({ kind: 'preview', file, url, panorama });
      return;
    }
    setStep({ kind: 'draft', draft: result.draft, url, panoramaUrl: panorama?.url ?? null });
  }

  const tourActive = tour && mode === 'tour';
  const progress = frameCount / TOUR_FRAMES;

  return (
    <Modal open={open} onClose={onClose} title={title} className="sm:max-w-lg">
      {step.kind === 'capture' ? (
        <div className="grid gap-4">
          {tour ? (
            <div role="group" aria-label={t('scan.mode')} className="flex gap-1 self-start rounded-full bg-stone p-1">
              {(['photo', 'tour'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setMode(option);
                    resetTour();
                  }}
                  aria-pressed={mode === option}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors',
                    mode === option ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option === 'photo' ? <CameraIcon className="size-4" aria-hidden="true" /> : <GlobeAltIcon className="size-4" aria-hidden="true" />}
                  {option === 'photo' ? t('scan.modePhoto') : t('scan.modeTour')}
                </button>
              ))}
            </div>
          ) : null}
          {/* A phone's sheet is short: the intro would push the viewfinder and
              its buttons off the bottom, so there the frame speaks for itself
              and the sentence waits for a tablet with a tall enough screen. */}
          <p className={cn('text-sm text-muted-foreground', !onCapture && 'hidden sm:block [@media(max-height:520px)]:hidden')}>
            {onCapture ? intro : tourActive ? t('scan.tourIntro') : intro}
          </p>
          <div className={cn('relative w-full overflow-hidden bg-ink sm:aspect-[4/3] sm:h-auto sm:max-h-[44svh]', onCapture ? 'h-[30svh]' : 'h-[48svh] rounded-[18px]')}>
            <video ref={videoRef} autoPlay playsInline muted className={cn('size-full object-cover', facing === 'user' && '-scale-x-100')} />
            {cameraReady === false ? (
              <p className="absolute inset-0 grid place-content-center p-6 text-center text-sm text-white/80">{t('scan.noCamera')}</p>
            ) : null}
            {tourActive && cameraReady ? (
              <>
                {/* A ring of eight ticks around a counter: what is taken fills in, what is left stays hollow. */}
                <div className="absolute inset-x-0 top-3 flex justify-center">
                  <div className="flex items-center gap-2 rounded-full bg-ink/80 px-3 py-1.5 text-xs font-semibold text-white shadow-soft">
                    <svg viewBox="0 0 24 24" className="size-5 -rotate-90" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeDasharray={`${2 * Math.PI * 9}`}
                        strokeDashoffset={`${2 * Math.PI * 9 * (1 - progress)}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    {stitching ? t('scan.tourStitching') : t('scan.tourFrame', { n: String(frameCount), total: String(TOUR_FRAMES) })}
                  </div>
                </div>
                {/* A vertical hairline in the middle of the frame: what to keep level while turning. */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-y-6 left-1/2 w-px bg-white/50" />
              </>
            ) : null}
          </div>
          {tourActive ? (
            /* Eight slots, filled left to right as the turn goes round: what is
               in the can and what is still to come, at a glance. */
            <ol className="flex flex-wrap gap-1.5" aria-label={t('scan.tourFrames')}>
              {Array.from({ length: TOUR_FRAMES }, (_, index) => (
                <li key={index} className={cn('admin-grid-photo', thumbs[index] ? 'bg-ink' : 'border border-dashed border-border bg-stone/60')}>
                  {thumbs[index] ? <img src={thumbs[index]} alt="" className="size-full object-cover" /> : null}
                </li>
              ))}
            </ol>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Always offered, not only when `enumerateDevices` counts two
                cameras: browsers under-report before permission settles and a
                laptop's "environment" request quietly lands on the selfie
                camera, so the desk must be able to ask for the other one. */}
            <button
              type="button"
              onClick={() => setFacing((current) => (current === 'environment' ? 'user' : 'environment'))}
              disabled={!cameraReady}
              aria-label={t('scan.flipCamera')}
              title={t('scan.flipCamera')}
              className={iconButton('light', 'size-11 shrink-0')}
            >
              <ArrowsRightLeftIcon className="size-5" aria-hidden="true" />
            </button>
            {tourActive ? (
              <>
                <button
                  type="button"
                  onClick={startAutoCapture}
                  disabled={!cameraReady || recording || stitching}
                  className={pill('primary', 'flex-1 sm:flex-none')}
                >
                  {recording || stitching ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : <GlobeAltIcon className="size-4" aria-hidden="true" />}
                  {stitching ? t('scan.tourStitching') : recording ? t('scan.tourRecording', { n: String(frameCount), total: String(TOUR_FRAMES) }) : t('scan.tourStart')}
                </button>
                {recording ? (
                  <button type="button" onClick={resetTour} className={pill('secondary')}>
                    {t('scan.tourCancel')}
                  </button>
                ) : null}
              </>
            ) : (
              <>
                {/* On a phone the shutter takes the rest of its line and the
                    gallery route sits under it full width; a tablet's row has
                    room for all three side by side. */}
                <button type="button" onClick={takePhoto} disabled={!cameraReady} className={pill('primary', 'flex-1 sm:flex-none')}>
                  <CameraIcon className="size-4" aria-hidden="true" />
                  {t('scan.takePhoto')}
                </button>
                <label className={pill('secondary', 'basis-full cursor-pointer sm:basis-auto')}>
                  {t('scan.choosePhoto')}
                  {/* No `capture`: this is the gallery route — with it, iOS would
                      open the camera again instead of the photo picker. */}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void useFile(file);
                      event.target.value = '';
                    }}
                  />
                </label>
              </>
            )}
          </div>
        </div>
      ) : null}

      {step.kind === 'preview' || step.kind === 'recognizing' ? (
        <div className="grid gap-4">
          {step.panorama ? (
            <>
              {/* Draggable, not a flat strip: a 2:1 panorama laid out straight is
                  a ribbon nobody can judge — the desk needs to actually look
                  around it before trusting it into a room's gallery. */}
              <div className="relative aspect-video w-full overflow-hidden bg-ink">
                <PanoramaViewer key={step.panorama.url} src={step.panorama.url} title={t('scan.tourPreviewTitle')} className="absolute inset-0 size-full" />
              </div>
              <div className="flex items-center gap-3">
                <img src={step.url} alt="" className="admin-grid-photo" />
                <p className="text-sm text-muted-foreground">{t('scan.tourReady')}</p>
              </div>
            </>
          ) : (
            <img src={step.url} alt="" className="aspect-video w-full object-contain sm:max-h-[44svh]" />
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={step.kind === 'recognizing'} onClick={retake} className={pill('secondary')}>
              {t('scan.retake')}
            </button>
            <button type="button" disabled={step.kind === 'recognizing'} onClick={runRecognize} className={pill('primary')}>
              {step.kind === 'recognizing' ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
              {step.kind === 'recognizing' ? t('scan.recognizing') : confirmLabel ?? t('scan.recognize')}
            </button>
          </div>
        </div>
      ) : null}

      {step.kind === 'draft' ? children?.(step.draft, step.url, retake, step.panoramaUrl) : null}
    </Modal>
  );
}
