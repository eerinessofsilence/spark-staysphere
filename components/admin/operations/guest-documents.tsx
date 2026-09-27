"use client";

import * as React from "react";
import Link from "next/link";
import type { GuestDocument } from "@/lib/domain/guest-document";
import { Modal } from "@/components/site/modal";
import { pill } from "@/lib/ui";

export type DocumentView = Omit<GuestDocument, "objectKeys" | "hotelId">;
export function GuestDocuments({ documents }: { documents: DocumentView[] }) {
  const [preview, setPreview] = React.useState<DocumentView | null>(null);
  if (!documents.length)
    return (
      <p className="mt-6 rounded-[18px] bg-card p-6 text-sm text-muted-foreground">
        No documents yet. Scan a passport or ID when adding a booking.
      </p>
    );
  const imageUrl = (id: string) => `/admin/guests/documents/${encodeURIComponent(id)}/image`;
  return (
    <>
      <div className="mt-6 space-y-4">
        {documents.map((document) => (
          <article
            key={document.id}
            className="grid gap-5 rounded-[18px] border border-border bg-card p-5 sm:grid-cols-[12rem_minmax(0,1fr)]"
          >
            {document.status === "active" ? (
              <button
                type="button"
                aria-label="Open document preview"
                className="rounded-[18px] focus-visible:outline-accent"
                onClick={() => setPreview(document)}
              >
                <DocumentImage src={imageUrl(document.id)} />
              </button>
            ) : (
              <div className="flex items-center justify-center rounded-[18px] bg-stone p-4 text-sm text-muted-foreground">
                {document.status === "deleted"
                  ? "Document image deleted"
                  : document.status === "pending_deletion"
                    ? "Document image unavailable — pending deletion"
                    : "Document upload incomplete"}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-base font-medium">
                {document.identity.documentType === "passport" ? "Passport" : "ID card"}
              </h3>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Document Number</dt>
                <dd className="break-words">{document.identity.documentNumber}</dd>
                <dt className="text-muted-foreground">Issuing Country</dt>
                <dd>{document.identity.issuingCountry}</dd>
                <dt className="text-muted-foreground">Nationality</dt>
                <dd>{document.identity.nationality || "—"}</dd>
                <dt className="text-muted-foreground">Issue Date</dt>
                <dd>{document.identity.issueDate || "—"}</dd>
                <dt className="text-muted-foreground">Expiration Date</dt>
                <dd>{document.identity.expirationDate || "—"}</dd>
                <dt className="text-muted-foreground">Related Reservation</dt>
                <dd>
                  <Link
                    className="underline"
                    href={`/admin/bookings/${document.reservationReference}`}
                  >
                    {document.reservationReference}
                  </Link>
                </dd>
                <dt className="text-muted-foreground">Created At</dt>
                <dd>
                  <time dateTime={document.createdAt}>
                    {new Date(document.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC
                  </time>
                </dd>
              </dl>
              {document.deletionReason ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  {document.status === "deleted"
                    ? "Automatically deleted after Check-out"
                    : "Automatic deletion after Check-out is pending. The image is no longer accessible."}
                  {document.deletedAt ? (
                    <>
                      <br />
                      Deleted:{" "}
                      <time dateTime={document.deletedAt}>
                        {new Date(document.deletedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC
                      </time>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title="Document preview"
        className="sm:max-w-4xl"
      >
        {preview ? (
          <>
            <DocumentImage src={imageUrl(preview.id)} />
            <button
              type="button"
              className={`${pill("secondary")} mt-4`}
              onClick={() => setPreview(null)}
            >
              Close
            </button>
          </>
        ) : null}
      </Modal>
    </>
  );
}

function DocumentImage({ src }: { src: string }) {
  const [failed, setFailed] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  return failed ? (
    <p role="status" className="p-4 text-sm text-muted-foreground">
      Document image is no longer available.
    </p>
  ) : (
    <>
      {!loaded ? (
        <span role="status" className="text-sm text-muted-foreground">
          Loading document…
        </span>
      ) : null}
      <img
        src={src}
        alt="Guest identity document"
        className="max-h-[65vh] w-full rounded-[18px] object-contain"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </>
  );
}
