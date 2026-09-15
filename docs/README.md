# Documentation index

Which file to open for what. New here? Start with **ONBOARDING.md**, not this list — it tells you
the order to read everything else in.

| Doc | Read it when… |
|---|---|
| [ONBOARDING.md](ONBOARDING.md) | It's your first day on this codebase. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | You need the mental model, or you're hunting for where a piece of logic lives. |
| [HOWTO.md](HOWTO.md) | You're about to add a room type, a route, a rule, an admin screen, or an API route, and want the pattern this codebase already uses. |
| [GLOSSARY.md](GLOSSARY.md) | A term in a comment or a variable name is unfamiliar (tape chart, stay bucket, seed vs. overlay, hold, …). |
| [TESTING.md](TESTING.md) | You're deciding unit vs. e2e, or the e2e suite is behaving strangely. |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Something is broken in a way that feels like it's happened before. |
| [decisions/](decisions/) | You're wondering *why* something was built the way it was, not just how it works. |

Outside `docs/`, at the repo root:

| Doc | Read it when… |
|---|---|
| [README.md](../README.md) | You're setting up the project for the first time, or need the route list. |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | You're about to commit, open a PR, or aren't sure what "done" means for a change. |
| [AGENTS.md](../AGENTS.md) | You're an AI agent working in this repo (or want the working rules an agent follows). |
| [CLAUDE.md](../CLAUDE.md) | You want the product intent and the implementation roadmap in one place. |
| [TECH.md](../TECH.md) | You want the deep technical reference — persistence, the CMS's concurrency model, the AI concierge, production integration — all with the *why*, not just the *what*. This is the file `docs/ARCHITECTURE.md` is the fast, five-minute version of. |
| [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) | You're adding or changing any UI. Read its **Rules** section first, always. |
| [SPINNER_SPEC.md](../SPINNER_SPEC.md) | You want the specific reasoning behind the building spinner's frame count, hotspot mechanic, and baked-vs-live-scene choice — it's `docs/decisions/`'s first entry in substance, kept at the root because most of the other docs already link it there. |

## Keeping this accurate

A doc that names a file, a route, or a number is a claim that can go stale the moment the code
changes under it — this happened to nearly every top-level doc in this repo before a dedicated
review caught it. If you change something a doc describes, update the doc in the same PR; see
CONTRIBUTING.md.
