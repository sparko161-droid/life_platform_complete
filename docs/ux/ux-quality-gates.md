# UI/UX quality gates

**Owner:** UI/UX Lead
**Review:** Journey Agent + QA + Child Experience

## Gate 1 — Language
- All visible strings are localized Russian.
- No technical terms or internal identifiers leak into the interface.

## Gate 2 — Journey
- Entry, completion, cancel, retry and back paths are defined.
- The user always has a clear next action.

## Gate 3 — State
- Loading, empty, error, permission, offline and success states exist where relevant.
- Repeated taps cannot duplicate authoritative operations.

## Gate 4 — Contract
- Every server-backed action maps to one canonical operation.
- Permissions are enforced by the server.
- Events update the correct screens without polling-only hacks where realtime is required.

## Gate 5 — Child experience
- Instructions are short and positive.
- A failure explains how to improve, not why the implementation failed.
- No unnecessary forms, technical dialogs or dense tables.

## Gate 6 — Accessibility
- Touch targets, text scaling, contrast, motion and screen-reader semantics are checked.

## Gate 7 — Cross-platform
- Web, Android and iOS have equivalent product meaning.
- Platform-specific capability differences have explicit fallbacks.

## Acceptance
A screen is not complete when it merely looks correct. The contract, state machine, API link, recovery path and journey test must all pass.
