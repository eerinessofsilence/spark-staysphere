"use client";

import * as React from "react";
import { uploadPhotoAction } from "@/app/admin/content/media-actions";
import type { MediaAsset } from "@/lib/domain/ports";
import { MAX_GALLERY_PHOTOS, MAX_PHOTO_BYTES } from "@/lib/domain/photo-upload";
import { useAdminT } from "@/lib/i18n/admin/context";
import { UploadDropzone } from "./upload-dropzone";
import { useUploadBusy } from "./content-form";

/** Decode locally, strip metadata and resize before sending one bounded file at a time. */
async function preparePhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Cannot decode image");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("Cannot encode image"))),
        "image/webp",
        0.88,
      ),
    );
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: blob.type });
  } finally {
    bitmap.close();
  }
}

export function PhotoUpload({
  onUploaded,
  onLibrary,
  count,
  multiple = true,
  publishOnSave = true,
}: {
  onUploaded: (assets: MediaAsset[]) => void;
  onLibrary?: () => void;
  count: number;
  multiple?: boolean;
  publishOnSave?: boolean;
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
    };
  }, [id, reportBusy]);

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
    setProgress({ done: 0, total: files.length });
    const uploaded: MediaAsset[] = [];
    const failed: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        if (!mounted.current) break;
        try {
          if (
            !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
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
