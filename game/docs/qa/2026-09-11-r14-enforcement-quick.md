# QA Quick — R14 Architecture Enforcement (first slice)

- **Date:** 2026-09-11
- **Scope:** branch `r14-architecture-enforcement`, worktree `.agent-worktrees/r14-architecture-enforcement`
- **Task-owned diff:** 4 guard test files under `game/tests/architecture/**` (+ shared scan helper), `game/eslint.config.js` (block order de-overlap + carve-outs), `game/vite.config.ts` (vitest include extended to `tests/**/*.test.ts`), move of `src/composables/slots/normalizeSlotRank.ts` -> `src/core/profession/slotRank.ts` with 10 consumer import updates, production lint cleanup in 4 core files (dead imports/args), `game/docs/roadmap.md` (R14 status section).
- **Exclusions (not task-owned, not reviewed):** none — the worktree baseline was clean.

## Mapper result

`changed-risk-map.mjs` returned `deepAuditCandidate: true` ("cross-system change: 3 domains": economy-and-progression, inventory-equipment, ui-input-lifecycle) and 11 unmapped paths (config/docs/test files). Per the quick workflow, code inspection was used to bound materiality:

- The three "domains" are touched only through a **pure function relocation** (`professionGradeRank` / `itemQualityRank` / `isMaxRankTone` — order lookups, no state, no RNG, no persistence). No gameplay formula, cost, drop, or progression value changed; the helpers' unit tests moved unchanged with them (31/31 pass including consumers `EquipmentNaming`, `SlotView`, `DissolveTab`, `EquipmentPaperdoll`, `MaterialBagFilter`).
- Config changes affect dev tooling only: eslint effective severity and vitest include. Both are pinned by new guards and verified below.
- No save/cloud, clock/offline, combat-resolution, or Vue/Pinia/Phaser lifecycle surface is modified. **Escalation to deep is therefore not warranted**; the cross-domain breadth is an artifact of the mapper not distinguishing "file path touched" from "domain behavior touched".

## Attack surface & invariant ledger

| # | Hypothesis | Operator | Result |
|---|---|---|---|
| H1 | Rank helper move changed behavior (wrong rank -> wrong colors/tooltips) | Run the moved unit tests + all name-composition consumers | PASS — 31/31, outputs are pure lookups, byte-equivalent logic (hand-copied then re-tested; test file moved unchanged) |
| H2 | ESLint de-overlap silently breaks `npm run lint` for legit code (rule too broad) | Full `eslint src/` before/after; compare with master checkout | 2 pre-existing errors remain (`Skills.chain.test.ts` optional-chain assertions — verified present on MASTER too); 57 other surfaced errors were fixed (dead imports/args in core production) or carved out with documented rationale (combat-held files) |
| H3 | Vitest include `tests/**/*.test.ts` accidentally picks up e2e specs or other files | `vitest run tests/e2e` | "No test files found" — `.spec.ts` untouched; only the 4 architecture guards run from `tests/` |
| H4 | Guards silently pass (wrong cwd, empty corpus, comment-blind miss) | Probe files with real violations (upward import, dynamic import, re-export from phaser, direct HP write, baseStats write) | All probes tripped the intended guard; probes removed. Corpus-size assertions (>100 core files) guard against wrong-cwd silent pass. One real self-catch: R14.3b flagged the identifier in a comment — guard now strips comments before scanning (comments are documentation, not calls) |
| H5 | Full-suite contention makes guard tests flaky (timeouts) | 3 consecutive full-suite runs after adding explicit 60s timeouts | Run 3: 460 files / 3113 tests all pass; runs 1-2 failed on 5s default timeout before the fix — root cause was guard harness, not app code |
| H6 | Production cleanup edits changed runtime behavior (dead import removal, `_`-renames) | type-check + full suite + targeted tests (QuestSystem.lifecycle, TribulationDirector, EquipmentNaming) | PASS — `no-unused-vars` fixes are semantics-neutral (removed only unreferenced imports/args; QuestSystem arg rename documented in code) |

## Confirmed defects

None in task-owned production code. (One defect class was found and fixed during development, before this QA run: ESLint core block was shadowed by the later `src/**` block — the exact AR-33 defect; the fix is the subject of this change, pinned by `tests/architecture/eslintCoreSeverity.test.ts`.)

## Suspected / coverage gaps

- `Skills.chain.test.ts` 2 lint errors — **pre-existing on master** (same errors under the same config there); not task-caused, reported for awareness.
- 30+ components use `useI18n({ useScope: 'local' })` without local messages, emitting vue-i18n missing-key warnings at runtime (keys exist at root). Pre-existing convention gap; candidate for a future i18n-parity guard. Not fixed here (out of R14 scope, P10).

## Verification evidence

- `npm run type-check`: PASS
- `npm run build`: PASS
- Full suite: **460 files / 3113 tests PASS** (baseline was 456/3103; +4 guard files, +10 tests)
- `eslint src/`: 2 errors / 213 warnings — down from 59 surfaced errors at de-overlap time; both remaining errors verified pre-existing on master
- `eslint tests/architecture/`: clean
- Probe-verified falsifiability for every file-scan guard (scratch violation files tripped each guard, then removed)

## P14 note

Deferred per isolated-worktree exception — no visual surface changed (guards + module move only; moved helpers verified by existing rendering-consumer tests).

## Verdict

**PASS WITH EVIDENCE**
