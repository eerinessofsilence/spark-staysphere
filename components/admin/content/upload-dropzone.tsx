"use client";

import * as React from "react";
import { UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { useAdminT } from "@/lib/i18n/admin/context";
import { pill } from "@/lib/ui";
import { cn } from "@/lib/utils";

/** Shared interaction and presentation; each caller retains its own storage and validation rules. */
export function UploadDropzone({
  onFiles,
  onLibrary,
  multiple = true,
  disabled = false,
  hint,
  chooseLabel,
  progress,
  message = "",
  errors = [],
}: {
  onFiles: (files: File[]) => void;
  onLibrary?: () => void;
  multiple?: boolean;
  disabled?: boolean;
  hint: string;
  chooseLabel?: string;
  progress?: { done: number; total: number } | null;
  message?: string;
  errors?: string[];
}) {
  const t = useAdminT();
  const input = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const blocked = disabled || Boolean(progress);
  return (
    <div className="grid min-w-0 gap-3" data-testid="upload-dropzone">
      <div
        className={cn(
          "rounded-[18px] border-2 border-dashed p-6 text-center transition-colors",
          dragging ? "border-accent bg-accent-soft" : "border-border bg-canvas/40",
        )}
        aria-busy={Boolean(progress)}
        onDragOver={(event) => {
          event.preventDefault();
          if (!blocked) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (
            !(event.relatedTarget instanceof Node) ||
            !event.currentTarget.contains(event.relatedTarget)
          )
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!blocked) onFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <UploadSimple
          weight="fill"
          className="mx-auto mb-3 size-7 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="font-medium">{t("upload.drop")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple={multiple}
          aria-label={chooseLabel ?? t("upload.choose")}
          className="sr-only"
          tabIndex={-1}
          disabled={blocked}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (!blocked) onFiles(files);
          }}
        />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={blocked}
            onClick={() => input.current?.click()}
            className={pill("primary")}
          >
            {chooseLabel ?? t("upload.choose")}
          </button>
          {onLibrary ? (
            <button
              type="button"
              disabled={blocked}
              onClick={onLibrary}
              className={pill("secondary")}
            >
              {t("upload.library")}
            </button>
          ) : null}
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
