# T10 independent review

State: blocked. Source: independent reviewer run d96a6ee5-0de1-4324-a068-f4f3396fe575 returned findings; parent persisted report because reviewer did not write its requested file.

- B1 Blocker: `src/shell/application/content-actions.ts:133-137` buffers unbounded response.arrayBuffer before 4096-byte rejection; Content-Length cannot establish bound. Stream/cancel after overflow; absent/lying header tests.
- B2 Major: `content-actions.ts:380-403` reports discovery failure only when both channels reject. Content failure plus current CORE success falsely reports up-to-date. Preserve successful channel while exposing each failed channel.
- B3 Major: `content-actions.ts:347-377,520-547` delayed check uses selector captured before concurrent Delete all. Selector becomes generation2/content null but canInstall remains false. Guard operation generations/final selector reread or serialize conflicting actions.
- B4 Major: `content-actions.ts:197-242,493-505` media count scans whole manifest while download uses selected chapter closure. Two-chapter fixture remains missingMedia1 forever after selected media download. Count exact same closure.
- B5 Evidence: native media coverage Main Menu/Story only, not Free Play/editor/collection/duel; CORE asserts caches not approval row/active controller identity. Cross-tab application broadcasts don't refresh ContentActionsView, potentially stale actions/warnings.

## Validation

- V1 Focused Vitest14/14; Chromium2/2; native regressions5/5; boundaries94/94; typecheck/build pass Shell99224/115000. Inventory27/27 hashes; scoped quality passes.
- V2 Reviewer reproductions confirm B2 false success, B3 stale selector/actions and B4 selected-closure mismatch.
- V3 Strict test-first chronology missed; ticket D1/P1 must remain unchecked. Retrospective RED is not chronological TDD.
- V4 T11 missing assets deferred; B1-B4 are new T10 defects. No reviewer source edits, live calls, staged files.
