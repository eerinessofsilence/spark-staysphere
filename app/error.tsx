'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('StaySphere route error', error);
  }, [error]);

  return (
    <main
      id="main"
      className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 py-20 text-center"
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-danger/10 text-danger">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </span>
      <h1 className="text-display mt-6 text-4xl">Something went wrong</h1>
      <p role="alert" className="mt-4 text-muted-foreground">
        We could not load this part of the booking demo. Nothing was charged or reserved.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="flex min-h-11 items-center rounded-xl bg-cyan px-5 text-sm font-semibold text-ink hover:bg-cyan/85"
        >
          Try again
        </button>
        <Link
          href="/rooms"
          className="flex min-h-11 items-center rounded-xl border border-border bg-card px-5 text-sm font-semibold hover:bg-canvas"
        >
          Back to rooms
        </Link>
      </div>
    </main>
  );
}
