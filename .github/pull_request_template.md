## What this does

<!-- One or two sentences. If it fixes a bug, say what was wrong and what the fix actually is. -->

## Checks

CI runs these automatically (`.github/workflows/ci.yml`) — check the ones you also ran locally,
and rely on CI for the rest:

- [ ] `npm run typecheck`
- [ ] `npm run test` (vitest — if you touched `lib/domain`)
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run test:e2e` (if you touched a guest or admin flow)

## States covered

For a new or changed flow — delete this section if it doesn't apply:

- [ ] Loading
- [ ] Empty
- [ ] Error
- [ ] Unavailable (sold out, hidden, mocked adapter)
- [ ] Success

## Docs

- [ ] I changed a rule, a number, or a claim that a doc states, and updated that doc in this PR
      (`docs/README.md` says which file owns what).
- [ ] Not needed — this PR doesn't change anything a doc describes.

## Anything a reviewer should know

<!-- Trade-offs made, what you deliberately left out, what you're unsure about. -->
