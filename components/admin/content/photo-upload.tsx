"use client";

import * as React from "react";
import { UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { uploadPhotoAction } from "@/app/admin/content/media-actions";
import type { MediaAsset } from "@/lib/domain/ports";
import { MAX_GALLERY_PHOTOS, MAX_PHOTO_BYTES } from "@/lib/domain/photo-upload";
import { useAdminT } from "@/lib/i18n/admin/context";
import { pill } from "@/lib/ui";
import { cn } from "@/lib/utils";
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
}: {
  onUploaded: (assets: MediaAsset[]) => void;
  onLibrary: () => void;
  count: number;
}) {
  const t = useAdminT();
  const id = React.useId();
  const input = React.useRef<HTMLInputElement>(null);
  const lock = React.useRef(false);
  const mounted = React.useRef(true);
  const reportBusy = useUploadBusy();
  const [dragging, setDragging] = React.useState(false);
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
    if (files.length + count > MAX_GALLERY_PHOTOS) {
      setErrors([t("upload.limit")]);
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
          setMessage(t("upload.success", { count: uploaded.length }));
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
    <div className="grid gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!progress) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(Array.from(event.dataTransfer.files));
        }}
        className={cn(
          "rounded-[18px] border-2 border-dashed p-6 text-center transition-colors",
          dragging ? "border-accent bg-accent-soft" : "border-border bg-canvas/40",
        )}
        aria-busy={Boolean(progress)}
      >
        <UploadSimple
          weight="fill"
          className="mx-auto mb-3 size-7 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="font-medium">{t("upload.drop")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("upload.hint")}</p>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          aria-label={t("upload.choose")}
          className="sr-only"
          tabIndex={-1}
          disabled={Boolean(progress)}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void upload(files);
          }}
        />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={Boolean(progress)}
            onClick={() => input.current?.click()}
            className={pill("primary")}
          >
            {t("upload.choose")}
          </button>
          <button
            type="button"
            disabled={Boolean(progress)}
            onClick={onLibrary}
            className={pill("secondary")}
          >
            {t("upload.library")}
          </button>
        </div>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {progress ? t("upload.progress", progress) : message}
      </p>
      {progress ? (
        <progress
          className="h-2 w-full accent-accent"
          max={progress.total}
          value={progress.done}
          aria-label={t("upload.title")}
        />
      ) : null}
      {errors.length ? (
        <ul role="alert" className="grid gap-1 text-sm text-danger">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
