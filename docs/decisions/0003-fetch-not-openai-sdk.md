# 3. Call the OpenAI REST API with `fetch`, not the `openai` npm package

**Status:** Decided and shipped (`lib/infrastructure/openai-search-interpreter.ts`,
`openai-transcriber.ts`).

## Context

The AI concierge needs exactly two things from OpenAI: structured-output chat completion (to turn
an utterance into a filter object) and audio transcription. This ships as a Cloudflare Worker
(`vinext build` → `wrangler`).

## Decision

Both adapters call `https://api.openai.com/v1` directly with `fetch` — no `openai` package in
`package.json`. Quoting TECH.md's own reasoning: "the Worker build does not need an SDK for two
endpoints." Model ids are named constants (`ASSISTANT_MODEL`, `ASSISTANT_TRANSCRIBE_MODEL`), each
in its own file, so they're swappable in one place; both were checked against OpenAI's current
model list when set, not assumed, and are meant to be re-checked the same way before being rolled
forward.

## Why

- **Two endpoints don't need a general-purpose client.** The SDK's value — typed request/response
  models for the whole API surface, retry/pagination helpers, streaming ergonomics — mostly goes
  unused when the actual surface touched is one chat-completion call and one multipart upload.
- **Bundle size and Worker compatibility.** A Worker's execution environment is more constrained
  than Node's; a general SDK brings dependencies and assumptions (Node-specific APIs, larger
  bundle) a Worker build has to either polyfill or avoid. Two `fetch` calls avoid the question
  entirely.
- **Both ports already have a keyless fallback.** `RoomSearchInterpreter` falls back to a
  deterministic keyword interpreter with no `OPENAI_API_KEY` set (`keyword-search-interpreter.ts`);
  transcription has no such fallback and returns 503 instead. Either way, the OpenAI call itself is
  optional at the port boundary — the adapter underneath it doesn't need to be more than the
  smallest thing that makes the call when a key is present.

## Consequences

- Request/response shapes for both endpoints are hand-typed in each adapter file rather than
  imported from a maintained SDK — they need to be kept in sync with OpenAI's API by hand if it
  changes.
- Neither adapter gets automatic retry, backoff, or rate-limit handling from a client library;
  `lib/application/assistant-rate-limit.ts` handles this product's own rate limiting instead, but
  a transient OpenAI-side failure is the caller's problem to retry, not handled automatically.
- If a third OpenAI endpoint is ever needed, revisit whether hand-rolled `fetch` calls are still
  the right call, or whether the surface has grown enough to justify the SDK after all.
