"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileArrowUp, CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Modal } from "@/components/site/modal";
import {
  GUEST_IMPORT_BATCH_SIZE,
  MAX_GUEST_IMPORT_ROWS,
  guestImportResultSchema,
  previewGuestImport,
  type GuestImportRow,
  type GuestImportResult,
} from "@/lib/domain/guest-import";
import { useAdminT } from "@/lib/i18n/admin/context";
import type { AdminTranslationKey } from "@/lib/i18n/admin/dictionaries";
import { iconButton, pill } from "@/lib/ui";

type Stage = "closed" | "reading" | "review" | "importing" | "result" | "error";
type Result = Omit<GuestImportResult, "status"> & {
  status: GuestImportResult["status"] | "unknown";
};
const PAGE_SIZE = 50;
const checkboxClass =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

export function ImportGuestsButton({ hotelSlug }: { hotelSlug: string }) {
  const t = useAdminT();
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const allRef = React.useRef<HTMLInputElement>(null);
  const locked = React.useRef(false);
  const readVersion = React.useRef(0);
  const [mounted, setMounted] = React.useState(false);
  const [stage, setStage] = React.useState<Stage>("closed");
  const [filename, setFilename] = React.useState("");
  const [rows, setRows] = React.useState<GuestImportRow[]>([]);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [results, setResults] = React.useState<Result[]>([]);
  const [error, setError] = React.useState<AdminTranslationKey | null>(null);
  const [page, setPage] = React.useState(0);
  const [processed, setProcessed] = React.useState(0);
  const valid = rows.filter((row) => !row.issues.length);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const importing = stage === "importing";
  const imported = results.filter((row) => row.status === "imported").length;
  const duplicate = results.filter((row) => row.status === "duplicate").length;
  const failed = results.filter((row) => !["imported", "duplicate"].includes(row.status));

  React.useEffect(() => {
    setMounted(true);
    return () => {
      readVersion.current += 1;
    };
  }, []);
  React.useEffect(() => {
    if (allRef.current)
      allRef.current.indeterminate = selected.size > 0 && selected.size < valid.length;
  }, [selected, valid.length, stage]);
  React.useEffect(() => {
    if (!importing) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [importing]);

  function close() {
    if (locked.current) return;
    readVersion.current += 1;
    setStage("closed");
    if (results.length) router.refresh();
  }

  async function onFile(file: File) {
    const version = ++readVersion.current;
    setStage("reading");
    setFilename(file.name);
    setError(null);
    setResults([]);
    setRows([]);
    setPage(0);
    let problem: AdminTranslationKey = "import.badFile";
    try {
      if (!/\.xlsx?$/i.test(file.name)) throw new Error("format");
      if (file.size > 10 * 1024 * 1024) {
        problem = "import.tooLarge";
        throw new Error("size");
      }
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        sheetRows: MAX_GUEST_IMPORT_ROWS + 2,
      });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("sheet");
      const cells = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
        raw: false,
        blankrows: true,
      });
      const start = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]).s.r : 0;
      const headers = (cells[0] ?? []).map(String);
      const data = cells
        .slice(1)
        .map((values, index) => ({
          rowNumber: start + index + 2,
          raw: Object.fromEntries(headers.map((header, col) => [header, values[col] ?? ""])),
        }))
        .filter(({ raw }) => Object.values(raw).some((value) => String(value).trim()));
      const originalRange = sheet["!fullref"];
      if (
        data.length > MAX_GUEST_IMPORT_ROWS ||
        (originalRange &&
          XLSX.utils.decode_range(originalRange).e.r - start > MAX_GUEST_IMPORT_ROWS)
      ) {
        problem = "import.tooMany";
        throw new Error("rows");
      }
      if (!data.length) {
        problem = "import.empty";
        throw new Error("empty");
      }
      const preview = previewGuestImport(data);
      if (version !== readVersion.current) return;
      setRows(preview);
      setSelected(new Set(preview.filter((row) => !row.issues.length).map((row) => row.rowNumber)));
      setStage("review");
    } catch {
      if (version === readVersion.current) {
        setError(problem);
        setStage("error");
      }
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function submit() {
    if (locked.current || !selected.size) return;
    locked.current = true;
    const chosen = rows.filter((row) => selected.has(row.rowNumber) && !row.issues.length);
    setStage("importing");
    setProcessed(0);
    setError(null);
    setResults([]);
    const completed: Result[] = [];
    try {
      for (let offset = 0; offset < chosen.length; offset += GUEST_IMPORT_BATCH_SIZE) {
        const batch = chosen.slice(offset, offset + GUEST_IMPORT_BATCH_SIZE);
        const response = await fetch("/api/admin/guests/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            hotelSlug,
            rows: batch.map(({ rowNumber, guest }) => ({ rowNumber, guest })),
          }),
          signal: AbortSignal.timeout(60_000),
        });
        if (!response.ok) {
          setError(
            response.status === 401
              ? "import.unauthorized"
              : response.status === 403
                ? "import.forbidden"
                : "import.requestFailed",
          );
          throw new Error("request");
        }
        const data = guestImportResultSchema.parse(await response.json());
        const ids = new Set(data.results.map((row) => row.rowNumber));
        if (
          ids.size !== batch.length ||
          data.results.length !== batch.length ||
          batch.some((row) => !ids.has(row.rowNumber))
        )
          throw new Error("response");
        completed.push(...data.results);
        setProcessed(completed.length);
      }
    } catch {
      const confirmed = new Set(completed.map((row) => row.rowNumber));
      completed.push(
        ...chosen
          .filter((row) => !confirmed.has(row.rowNumber))
          .map((row): Result => ({ rowNumber: row.rowNumber, status: "unknown" })),
      );
      setError((current) => current ?? "import.requestFailed");
    } finally {
      setResults(completed);
      setStage("result");
      locked.current = false;
      router.refresh();
    }
  }

  function retry() {
    const remaining = new Set(failed.map((row) => row.rowNumber));
    setRows((current) => current.filter((row) => remaining.has(row.rowNumber)));
    setSelected(remaining);
    setPage(0);
    setResults([]);
    setError(null);
    setStage("review");
  }

  const title =
    stage === "review"
      ? t("import.review")
      : stage === "reading"
        ? t("import.reading")
        : importing
          ? t("import.importing")
          : stage === "result"
            ? t(
                failed.length
                  ? imported || duplicate
                    ? "import.partial"
                    : "import.failure"
                  : "import.success",
              )
            : t("import.title");

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xls,.xlsx"
        hidden
        tabIndex={-1}
        aria-label={t("import.title")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFile(file);
        }}
      />
      <button
        type="button"
        className={pill("secondary")}
        disabled={!mounted || importing}
        onClick={() => inputRef.current?.click()}
      >
        <FileArrowUp weight="fill" className="size-4" aria-hidden="true" />
        {t("import.title")}
      </button>
      <Modal
        open={stage !== "closed"}
        onClose={close}
        title={title}
        chrome={false}
        className="sm:max-w-3xl"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-border p-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="truncate text-xs text-muted-foreground">{filename}</p>
          </div>
          <button
            type="button"
            className={iconButton()}
            disabled={importing}
            onClick={close}
            aria-label={stage === "result" ? t("import.done") : t("import.cancel")}
          >
            <XMarkIcon className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
          {(stage === "reading" || importing) && (
            <div
              role="status"
              aria-live="polite"
              className="flex min-h-52 flex-col items-center justify-center gap-4 py-6 text-center"
            >
              <ArrowPathIcon
                className="size-9 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              <p className="font-semibold">
                {importing
                  ? t("import.progress", { processed, total: selected.size })
                  : t("import.reading")}
              </p>
              {importing && (
                <>
                  <progress
                    className="h-2 w-full max-w-sm accent-primary"
                    value={processed}
                    max={selected.size}
                    aria-label={t("import.importing")}
                  />
                  <p className="text-sm text-muted-foreground">{t("import.wait")}</p>
                </>
              )}
            </div>
          )}
          {stage === "review" && (
            <>
              <p className="text-sm text-muted-foreground">{t("import.instructions")}</p>
              <p className="mt-2 text-xs text-muted-foreground">{t("import.columns")}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
                  <input
                    ref={allRef}
                    type="checkbox"
                    className={checkboxClass}
                    checked={valid.length > 0 && selected.size === valid.length}
                    disabled={!valid.length}
                    onChange={(event) =>
                      setSelected(
                        new Set(event.target.checked ? valid.map((row) => row.rowNumber) : []),
                      )
                    }
                  />
                  {t("import.selectAll")}
                </label>
                <p role="status" className="text-xs text-muted-foreground">
                  {t("import.selected", { selected: selected.size, total: rows.length })}
                </p>
              </div>
              <ul className="divide-y divide-border">
                {rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((row) => {
                  const name =
                    `${row.guest.firstName} ${row.guest.lastName}`.trim() ||
                    t("import.row", { number: row.rowNumber });
                  return (
                    <li key={row.rowNumber}>
                      <label className="flex min-h-20 cursor-pointer items-start gap-3 py-4">
                        <input
                          type="checkbox"
                          className={`${checkboxClass} mt-1`}
                          aria-label={t("import.selectGuest", { name })}
                          checked={selected.has(row.rowNumber)}
                          disabled={!!row.issues.length}
                          onChange={(event) =>
                            setSelected((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(row.rowNumber);
                              else next.delete(row.rowNumber);
                              return next;
                            })
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-semibold">{name}</span>
                          <span className="block break-all text-xs text-muted-foreground">
                            {row.guest.email || "—"} · {row.guest.phone || "—"}
                          </span>
                          {row.issues.length ? (
                            <span className="mt-1 flex items-start gap-1 text-xs text-destructive">
                              <WarningCircle
                                weight="fill"
                                className="mt-0.5 size-3 shrink-0"
                                aria-hidden="true"
                              />
                              <span>
                                {row.issues.map((issue) => t(`import.${issue}`)).join(" · ")}
                              </span>
                            </span>
                          ) : (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {t("import.ready")}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          #{row.rowNumber}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <button
                    type="button"
                    className={pill("secondary")}
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    {t("import.previous")}
                  </button>
                  <span className="text-xs">
                    {t("import.page", { page: page + 1, total: totalPages })}
                  </span>
                  <button
                    type="button"
                    className={pill("secondary")}
                    disabled={page + 1 === totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    {t("import.next")}
                  </button>
                </div>
              )}
            </>
          )}
          {stage === "error" && (
            <div role="alert" className="space-y-3 py-5">
              <WarningCircle weight="fill" className="size-9 text-destructive" aria-hidden="true" />
              <p>{error && t(error)}</p>
              <p className="text-sm text-muted-foreground">{t("import.columns")}</p>
            </div>
          )}
          {stage === "result" && (
            <>
              <div role="status" className="space-y-3 py-3">
                {failed.length ? (
                  <WarningCircle
                    weight="fill"
                    className="size-10 text-destructive"
                    aria-hidden="true"
                  />
                ) : (
                  <CheckCircle weight="fill" className="size-10 text-primary" aria-hidden="true" />
                )}
                <p>{t("import.summary", { imported, duplicate, failed: failed.length })}</p>
              </div>
              {error && (
                <p role="alert" className="my-3 text-sm text-destructive">
                  {t(error)}
                </p>
              )}
              {!!failed.length && (
                <ul className="max-h-60 divide-y divide-border overflow-y-auto">
                  {failed.map((result) => {
                    const row = rows.find((item) => item.rowNumber === result.rowNumber);
                    return (
                      <li key={result.rowNumber} className="py-3 text-sm">
                        <p className="break-words font-semibold">
                          {row?.guest.firstName} {row?.guest.lastName} ·{" "}
                          {t("import.row", { number: result.rowNumber })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t(`import.${result.status}`)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
        {!importing && stage !== "reading" && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-card p-4 sm:px-6">
            {stage !== "result" && (
              <button
                type="button"
                className={pill("secondary", "mr-auto")}
                onClick={() => inputRef.current?.click()}
              >
                {t("import.otherFile")}
              </button>
            )}
            {stage === "review" && (
              <button
                type="button"
                className={pill("primary")}
                disabled={!selected.size}
                onClick={() => void submit()}
              >
                {t("import.continue", { count: selected.size })}
              </button>
            )}
            {stage === "result" && (
              <>
                {!!failed.length && (
                  <button type="button" className={pill("secondary")} onClick={retry}>
                    {t("import.retry")}
                  </button>
                )}
                <button type="button" className={pill("primary")} onClick={close}>
                  {t("import.done")}
                </button>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
