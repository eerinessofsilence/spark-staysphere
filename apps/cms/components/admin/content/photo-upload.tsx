"use client";

import * as React from "react";
import { uploadPhotoAction } from "@/app/admin/content/media-actions";
import type { MediaAsset } from "@/lib/domain/ports";
import { MAX_GALLERY_PHOTOS, MAX_PHOTO_BYTES } from "@/lib/domain/photo-upload";
import { useAdminT } from "@/lib/i18n/admin/context";
import { UploadDropzone } from "./upload-dropzone";
import { useUploadBusy } from "./content-form";

type DecodedPhoto = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

/** Decode locally, strip metadata and resize before sending one bounded file at a time. */
export async function preparePhoto(file: File): Promise<File> {
  let decoded: DecodedPhoto;
  try {
    const bitmap = await createImageBitmap(file);
    decoded = { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    // iOS can expose a camera/gallery image as HEIC while its ImageBitmap
    // decoder is unavailable. The regular image element uses the platform's
    // decoder and gives us a second chance before reporting an invalid upload.
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("Cannot decode image"));
        element.src = url;
      });
      decoded = { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }
  try {
    const scale = Math.min(1, 2400 / Math.max(decoded.width, decoded.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Cannot decode image");
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    const blob = await encodePhoto(canvas);
    const extension = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + `.${extension}`, { type: blob.type });
  } finally {
    decoded.close();
  }
}

async function encodePhoto(canvas: HTMLCanvasElement): Promise<Blob> {
  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode("image/webp", 0.88);
  if (webp?.type === "image/webp") return webp;
  const jpeg = await encode("image/jpeg", 0.9);
  if (jpeg) return jpeg;
  if (webp) return webp;
  throw new Error("Cannot encode image");
}

export function PhotoUpload({
  onUploaded,
  onLibrary,
  count,
  multiple = true,
  publishOnSave = true,
  onBusyChange,
}: {
  onUploaded: (assets: MediaAsset[]) => void;
  onLibrary?: () => void;
  count: number;
  multiple?: boolean;
  publishOnSave?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const t = useAdminT();
  const id = React.useId();
  const lock = React.useRef(false);
  const mounted = React.useRef(true);
  const reportBusy = useUploadBusy();
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = React.useState("");
  const [errors, setErrors] = React.useState<string[]>([]);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      reportBusy(id, false);
      onBusyChange?.(false);
    };
  }, [id, reportBusy, onBusyChange]);

  async function upload(files: File[]) {
    if (lock.current || files.length === 0) return;
    setErrors([]);
    setMessage("");
    if (
      (!multiple && files.length > 1) ||
      (multiple && files.length + count > MAX_GALLERY_PHOTOS)
    ) {
      setErrors([t(multiple ? "upload.limit" : "upload.singleLimit")]);
      return;
    }
    lock.current = true;
    reportBusy(id, true);
    onBusyChange?.(true);
    setProgress({ done: 0, total: files.length });
    const uploaded: MediaAsset[] = [];
    const failed: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        if (!mounted.current) break;
        try {
          if (
            !file.type.startsWith("image/") ||
            file.size > MAX_PHOTO_BYTES ||
            file.size === 0
          ) {
            failed.push(`${file.name}: ${t("upload.invalid")}`);
          } else {
            const data = new FormData();
            data.set("file", await preparePhoto(file));
            const result = await uploadPhotoAction(data);
            if (result.ok) uploaded.push(result.asset);
            else failed.push(`${file.name}: ${result.error}`);
          }
        } catch {
          failed.push(`${file.name}: ${t("upload.failed")}`);
        }
        if (mounted.current) setProgress({ done: index + 1, total: files.length });
      }
      if (mounted.current) {
        if (uploaded.length) {
          onUploaded(uploaded);
          setMessage(
            t(publishOnSave ? "upload.success" : "upload.stored", { count: uploaded.length }),
          );
        }
        setErrors(failed);
      }
    } finally {
      lock.current = false;
      reportBusy(id, false);
      onBusyChange?.(false);
      if (mounted.current) setProgress(null);
    }
  }

  return (
    <UploadDropzone
      onFiles={(files) => {
        void upload(files);
      }}
      onLibrary={onLibrary}
      multiple={multiple}
      hint={t(multiple ? "upload.hint" : "upload.singleHint")}
      progress={progress}
      message={message}
      errors={errors}
    />
  );
}
