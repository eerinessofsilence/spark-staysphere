"use client";

import * as React from "react";
import { CameraIcon } from "@heroicons/react/24/outline";
import { Modal } from "@/components/site/modal";
import { fieldClass, pill } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { documentOcrService } from "@/lib/application/document-ocr-service";
import { documentPhotoCanvas } from "@/lib/application/document-ocr-image";
import { confirmScannedGuestAction } from "@/app/admin/guests/documents/actions";
import {
  emptyIdentity,
  identitySchema,
  MAX_DOCUMENT_BYTES,
  type DocumentRecognition,
  type GuestIdentity,
  type IdentityField,
} from "@/lib/domain/guest-document";
import type { Guest } from "@/lib/domain/schemas";

export interface ScannedGuestDocument {
  photo: File;
  identity: GuestIdentity;
}
export const identityLabels: Record<IdentityField, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  dateOfBirth: "Date of Birth",
  nationality: "Nationality",
  gender: "Gender",
  documentNumber: "Document Number",
  documentType: "Document Type",
  issueDate: "Issue Date",
  expirationDate: "Expiration Date",
  issuingCountry: "Issuing Country",
};

export function ScanPassport({
  guest,
  onConfirm,
  disabled,
}: {
  guest: Guest;
  onConfirm: (guest: Guest, document: ScannedGuestDocument) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        className={pill("secondary")}
        onClick={() => setOpen(true)}
      >
        <CameraIcon className="size-4" aria-hidden="true" />
        Scan Passport
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Scan Passport"
        fullScreen
      >
        {open ? (
          <PassportCapture
            guest={guest}
            onCancel={() => setOpen(false)}
            onConfirm={(contact, document) => {
              onConfirm(contact, document);
              setOpen(false);
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

function PassportCapture({
  guest,
  onCancel,
  onConfirm,
}: {
  guest: Guest;
  onCancel: () => void;
  onConfirm: (guest: Guest, document: ScannedGuestDocument) => void;
}) {
  const video = React.useRef<HTMLVideoElement>(null);
  const reviewHeading = React.useRef<HTMLHeadingElement>(null);
  const stream = React.useRef<MediaStream | null>(null);
  const cameraAttempt = React.useRef(0);
  const abort = React.useRef(new AbortController());
  const [camera, setCamera] = React.useState(false);
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [url, setUrl] = React.useState("");
  const [review, setReview] = React.useState(false);
  const [fields, setFields] = React.useState<GuestIdentity>({ ...emptyIdentity });
  const [confidence, setConfidence] = React.useState<DocumentRecognition["confidence"]>({});
  const [email, setEmail] = React.useState(guest.email);
  const [phone, setPhone] = React.useState(guest.phone);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [matches, setMatches] = React.useState<(Guest & { id: string })[]>([]);

  function stopCamera() {
    cameraAttempt.current++;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setCamera(false);
  }
  async function openCamera() {
    const attempt = ++cameraAttempt.current;
    setError("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      if (abort.current.signal.aborted || attempt !== cameraAttempt.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = media;
      setCamera(true);
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
    } catch {
      if (!abort.current.signal.aborted && attempt === cameraAttempt.current) {
        setError("Camera unavailable. You can upload a JPEG or PNG photo below.");
      }
    }
  }
  React.useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    if (window.matchMedia("(pointer: coarse)").matches) void openCamera();
    return () => {
      controller.abort();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  React.useEffect(() => {
    if (!photo) {
      setUrl("");
      return;
    }
    const preview = URL.createObjectURL(photo);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [photo]);
  React.useEffect(() => {
    if (review) reviewHeading.current?.focus();
  }, [review]);

  async function fromCanvas(canvas: HTMLCanvasElement) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.94),
    );
    canvas.width = 0;
    canvas.height = 0;
    if (!blob || abort.current.signal.aborted) return;
    setPhoto(new File([blob], "document.jpg", { type: "image/jpeg" }));
    setReview(false);
    setMatches([]);
    stopCamera();
  }
  async function upload(file?: File) {
    if (!file) return;
    stopCamera();
    setError("");
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > MAX_DOCUMENT_BYTES) {
      setError("Use a JPEG or PNG photo up to 8 MB.");
      return;
    }
    try {
      const canvas = await documentPhotoCanvas(file);
      await fromCanvas(canvas); // Strip metadata; retain no copy of the uploaded original.
    } catch {
      setError("This image could not be opened. Choose another photo.");
    }
  }
  async function capture() {
    if (!video.current?.videoWidth) {
      setError("Wait for the camera to be ready.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.current.videoWidth;
    canvas.height = video.current.videoHeight;
    canvas.getContext("2d")!.drawImage(video.current, 0, 0);
    await fromCanvas(canvas);
  }
  async function recognize() {
    if (!photo) return;
    setBusy(true);
    setError("");
    try {
      const result = await documentOcrService.recognize(photo, abort.current.signal);
      setFields(result.fields);
      setConfidence(result.confidence);
      if (![result.fields.firstName, result.fields.lastName, result.fields.documentNumber].some(Boolean)) {
        setError("No document details could be read. Retake a close-up of the identity page with both machine-readable lines sharp and fully visible, or enter the details below.");
      }
      setReview(true);
    } catch {
      if (!abort.current.signal.aborted) {
        setFields({ ...emptyIdentity });
        setConfidence({});
        setReview(true);
        setError("Recognition was unavailable. Enter the document details or rescan.");
      }
    } finally {
      if (!abort.current.signal.aborted) setBusy(false);
    }
  }
  async function confirm(existingGuestId?: string, distinctGuest = false) {
    if (!photo) return;
    const parsed = identitySchema.safeParse(fields);
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((issue) => `${identityLabels[issue.path[0] as IdentityField]}: ${issue.message}`)
          .join(". "),
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await confirmScannedGuestAction(
        { firstName: fields.firstName, lastName: fields.lastName, email, phone },
        parsed.data,
        existingGuestId,
        distinctGuest,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (result.kind === "matches") {
        setMatches(result.matches);
        return;
      }
      onConfirm(result.guest, { photo, identity: result.identity });
    } catch {
      setError("Unable to confirm the guest. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function rescan() {
    setReview(false);
    setPhoto(null);
    setMatches([]);
    setError("");
  }

  return (
    <div>
      {review ? (
        <h3 ref={reviewHeading} tabIndex={-1} className="mb-4 text-xl font-semibold outline-none">Review Guest Information</h3>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">
          Photograph the full identity page, including the machine-readable lines. Keep it flat and
          avoid reflections.
        </p>
      )}
      {error ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        className={cn("mb-4 w-full rounded-[18px] bg-stone", !camera && "hidden")}
        aria-label="Document camera"
      />
      <div className={cn("grid min-w-0 gap-5", review && "md:grid-cols-2")}>
        {url ? (
          <img
            src={url}
            alt="Document photo for review"
            className="max-h-64 w-full rounded-[18px] bg-stone object-contain sm:max-h-96"
          />
        ) : null}
        {review ? (
          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            {(Object.keys(identityLabels) as IdentityField[]).map((key) => (
              <div key={key}>
                <label className="mb-1 block text-sm" htmlFor={`passport-${key}`}>
                  {identityLabels[key]}
                </label>
                {key === "gender" || key === "documentType" ? (
                  <select
                    id={`passport-${key}`}
                    className={fieldClass}
                    value={fields[key]}
                    onChange={(event) => {
                      setFields((value) => ({ ...value, [key]: event.target.value }));
                      setMatches([]);
                    }}
                  >
                    {(key === "gender"
                      ? [
                          ["", "Not specified"],
                          ["M", "Male"],
                          ["F", "Female"],
                          ["X", "Other / unspecified"],
                        ]
                      : [
                          ["passport", "Passport"],
                          ["id", "ID card"],
                        ]
                    ).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`passport-${key}`}
                    type={key.endsWith("Date") || key === "dateOfBirth" ? "date" : "text"}
                    value={fields[key]}
                    autoComplete="off"
                    className={cn(fieldClass, (confidence[key] ?? 0) < 0.8 && "border-warning")}
                    onChange={(event) => {
                      setFields((value) => ({ ...value, [key]: event.target.value }));
                      setMatches([]);
                    }}
                  />
                )}
                {(confidence[key] ?? 0) < 0.8 ? (
                  <span className="mt-1 block text-xs text-warning">Check this field</span>
                ) : null}
              </div>
            ))}
            <div>
              <label htmlFor="passport-email" className="mb-1 block text-sm">
                Email
              </label>
              <input
                id="passport-email"
                type="email"
                className={fieldClass}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setMatches([]);
                }}
              />
            </div>
            <div>
              <label htmlFor="passport-phone" className="mb-1 block text-sm">
                Phone
              </label>
              <input
                id="passport-phone"
                type="tel"
                className={fieldClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Email and phone are needed for the guest profile. Review all fields before confirming.
            </p>
          </div>
        ) : null}
      </div>
      {matches.length ? (
        <div className="mt-5 rounded-[18px] border border-border p-4">
          <h4 className="font-medium">Possible existing guest</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a profile to use. Profiles will not be merged.
          </p>
          {matches.map((match) => (
            <div
              key={match.id}
              className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span>
                {match.firstName} {match.lastName} · {match.email}
              </span>
              <button
                type="button"
                disabled={busy}
                className={pill("secondary")}
                onClick={() => void confirm(match.id)}
              >
                Use existing profile
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={busy || matches.some((m) => m.id === email.trim().toLowerCase())}
            className={cn(pill("ghost"), "mt-3")}
            onClick={() => void confirm(undefined, true)}
          >
            Create a separate guest
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            A separate guest needs a different email address.
          </p>
        </div>
      ) : null}
      {busy ? (
        <p role="status" className="mt-4 text-sm">
          {review ? "Confirming guest…" : "Recognizing document…"}
        </p>
      ) : null}
      {/* One row of actions in every state — the primary first, Cancel last —
          rather than a stray button under the camera and another row above
          this one. With the camera open there is nothing to "open", so
          Take Photo takes its place. */}
      <div className="mt-5 flex flex-wrap gap-3">
        {photo ? (
          <button
            type="button"
            disabled={busy}
            className={pill("primary")}
            onClick={() => void (review ? confirm() : recognize())}
          >
            {review ? "Confirm" : "Use Photo"}
          </button>
        ) : camera ? (
          <button type="button" className={pill("primary")} onClick={() => void capture()}>
            Take Photo
          </button>
        ) : (
          <button type="button" className={pill("primary")} onClick={() => void openCamera()}>
            Open camera
          </button>
        )}
        {photo ? (
          <button type="button" disabled={busy} className={pill("secondary")} onClick={rescan}>
            {review ? "Rescan" : "Retake"}
          </button>
        ) : (
          <label className={cn(pill("secondary"), "cursor-pointer")}>
            Upload photo
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={(event) => {
                void upload(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        )}
        <button type="button" className={pill("secondary")} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
