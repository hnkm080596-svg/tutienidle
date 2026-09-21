# QA Report — M-E Meridian Page Model (quick)

Date: 2026-09-22 · Scope: `feat/me-meridian-pages` task diff (Meridians.ts, MeridianPages.ts, MeridianChapter.ts, MeridianSection.vue, locales, tests) · Mode: quick

## Risk map

`changed-risk-map.mjs` → domains: **economy-and-progression**, **ui-input-lifecycle**; `deepAuditCandidate: true` (2 domains); `unmappedPaths: []`.

**Why bounded rather than deep-escalated:** the economy/progression surface is validation-only — the mission adds no new mutation path, transaction, or reward flow. `invest()` gains an early-return gate (fail-closed); `integrityIssues()` gains a read-only check; `MeridianPages.ts` is a pure projection; `MeridianSection.vue` is read-only presentation. The only persistence-facing change is a stricter restore preflight that rejects semantically impossible state (see H2). No clock/offline, no Pinia lifecycle, no Phaser ownership touched.

## Invariant ledger + hypotheses

| # | Hypothesis | Evidence | Verdict |
|---|---|---|---|
| H1 | `invest` reachable at mortal via a production caller | `GameManagerTickOps:119` auto-invests **`body_refinement` only** (`GameManager.ts:839` hard-binds the chapterId). No production meridian caller exists (M13 parked). New gate is defense-in-depth for future callers. | Bounded — chapter test pins fail-closed at mortal:20 incl. mid-sequence |
| H2 | A legitimate save now rejected by the new `integrityIssues` cross-field check | `assertBodyProgressionIntegrity` runs at restore preflight (`GameManagerSaveRestore.ts:234`, hard-fail seam). Reject requires `openedIds` on a page whose realm index exceeds `player.realmId` — unreachable via production (H1) and impossible legitimately (realm index never decreases). `validatePersistedState` can't hold this check (slice-only, no realmId) — `integrityIssues(player)` is the correct seam. | Bounded — impossible-state only; legit fixtures re-realed to qi_refining, 61 tests green |
| H3 | `isMeridianPageUnlocked`/`listMeridianPages` mis-projects (fail-open, bad grouping) | Fail-closed on unresolved player/page realm (tested both directions + never-relock over all realms). Non-decreasing page-order pinned by data-invariant test; two-page fabricated characterization test. | Tested |
| H4 | Locked page exposes actionable affordance in UI | Runtime (P14): mortal guest → "Mở khóa ở Luyện Khí" + 9 `CHƯA MỞ` rows, zero `KẾ TIẾP`/gate rows, dimmed. | Runtime-verified |
| H5 | `bat-mach:*` modifiers emitted on a locked page | `applyModifiers` still iterates `openedIds` — but that state is unreconstructable legitimately: restore preflight rejects it (H2), live invest gated (H1). Post-advance pages stay unlocked so legit progress always emits. | Bounded |
| H6 | `realmGate` param `{realm}` drift — stale caller without the param | Sole consumer is `MeridianSection.vue` (passes `page.realmName`); vi/en updated symmetrically; `pageLocked` added to both. | Clean |
| H7 | New integrity loop interferes with existing prefix issues | Issues accumulate in a list; unknown ids skip the page check (`find` → undefined). Independent. | Clean |
| H8 | Multi-page integrity misjudgment | Player at higher realm with lower-page opens → unlocked (monotonic); reverse → flagged. Correct by construction; two-page grouping characterized in test. | Tested |
| H9 | Page-lock gate ordered after cost check leaks state | Both paths return 0 before any mutation; order immaterial. | Clean |
| H10 | Pace label leaks cross-realm | `requiredRealmLevel` only set when `inPageRealm`; runtime-verified at foundation:1 — next row shows "4 Thông Mạch Đan" only. | Runtime-verified |

## Runtime evidence (P14, worktree dev server :5933)

- **mortal**: page-lock header + 9 locked rows, no next/cost/gate affordance. Screenshot-inspected.
- **qi_refining:5** (live Pinia patch): page unlocked; 2 opened; Âm Kiều Mạch `KẾ TIẾP` + "4 Thông Mạch Đan · Luyện Khí tầng 6".
- **foundation_establishment:1**: page stays unlocked; next row shows cost only, pace label suppressed.
- Console: 0 errors.

## Findings

- **Coverage gap (Low, recorded not blocking):** no test asserts `applyModifiers` omits `bat-mach:*` for a locked-page `openedIds` state — unreconstructable legitimately (H2/H5 bound it). Mortal invest test uses `realmLevel: 20` (unreachable fixture) — deliberate "no level can bypass" assertion, noted.

## Verdict

**PASS WITH EVIDENCE** — no confirmed or suspected defects; all hypotheses resolved by code inspection, focused tests, or runtime evidence. Deep-escalation conditions documented as bounded.
