"use client";

import * as React from "react";
import type { MediaAsset } from "@/lib/domain/ports";
import { PhotoUpload } from "./photo-upload";
import { useFieldErrors } from "./content-form";
import { MediaPicker } from "./media-picker";
import { pill } from "@/lib/ui";

/** Single-image slots share the gallery uploader, replacing rather than appending. */
export function PhotoField({
  name,
  initial,
  assets,
  contain = false,
  publishOnSave = true,
  clearLabel,
}: {
  name: string;
  initial: string;
  assets: MediaAsset[];
  contain?: boolean;
  publishOnSave?: boolean;
  clearLabel?: string;
}) {
  const [url, setUrl] = React.useState(initial);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [uploaded, setUploaded] = React.useState<MediaAsset[]>([]);
  const errors = useFieldErrors();

  return (
    <div className="grid gap-3" data-photo-editor={name}>
      <input type="hidden" name={name} value={url} />
      {url ? (
        <div className="flex flex-wrap items-end gap-3">
          <span className="block aspect-[4/3] w-full max-w-40 overflow-hidden rounded-2xl bg-stone">
            <img
              src={url}
              alt=""
              className={contain ? "size-full object-contain p-3" : "size-full object-cover"}
            />
          </span>
          {clearLabel ? <button type="button" onClick={() => setUrl("")} className={pill("secondary", "min-h-10 px-4 text-sm")}>{clearLabel}</button> : null}
        </div>
      ) : null}
      <PhotoUpload
        count={0}
        multiple={false}
        publishOnSave={publishOnSave}
        onLibrary={() => setPickerOpen(true)}
        onUploaded={(items) => {
          setUploaded((current) => [...current, ...items]);
          if (items[0]) setUrl(items[0].url);
        }}
      />
      {errors[name]?.map((error) => (
        <p key={error} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ))}

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        assets={[...assets, ...uploaded]}
        onPick={(picked) => setUrl(picked.url)}
      />
    </div>
  );
}
