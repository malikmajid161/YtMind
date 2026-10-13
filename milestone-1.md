# Milestone 1 — trustworthy foundation

Deliver a reproducible MV3 extension with native side panel, YouTube SPA lifecycle, central storage and a provider boundary.

## Deliverables

- Source-controlled dependency lock, build script, local assets, install guide and CI.
- Content script on all YouTube routes; work gated to watch pages.
- Origin-scoped IndexedDB with sessions, frames, nodes and edges; serialized writes.
- Per-video identity, 24h unpinned expiry, pinned retention and persistent graph evidence.
- API key in trusted extension storage; Groq calls in background; friendly timeout/auth/rate-limit failures.
- Best-effort caption strategies and explicit manual-source fallback.

## Acceptance

Build and load unpacked; navigating between videos does not mix their evidence. Expiry removes only ephemeral records. Clear data covers every learning store. No key appears in content-script state. Actual caption availability is tested against a corpus and reported separately from routing tests.

## Competitive target

Match the reliability of transcript-first tools while retaining local ownership and clear recovery states. Measure caption success rate and time to first source. Do not claim guaranteed caption access.
