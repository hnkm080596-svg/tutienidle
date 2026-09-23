# QA Review: M-F-TALENT — mandatory breakthrough Talent transaction

- Date: 2026-09-23
- Mode: deep (escalated — `changed-risk-map.mjs` returned `deepAuditCandidate: true`: save-schema boundary (v75 + pendingTalentEntitlement + talentLevels), progression/transaction boundary (mandatory breakthrough decision), and presentation boundary (blocking modal + drain lock))
- Verdict: **PASS WITH EVIDENCE** — one confirmed defect found and fixed in-pass (save-validation soft-lock class); all remaining attack hypotheses resolved to proof or a documented design note.
- Task-owned paths: branch `devin/1790133063-m-f-talent` diff vs `origin/p7/truc-co` — `src/core/talent/TalentEntitlement.ts` (new), `src/data/talent/BreakthroughTalentPools.ts` (new), `src/components/common/TalentEntitlementModal.vue` (new), plus touched `useTribulation.ts` lock, `TribulationOutcomeService` commit seam, `PlayerData`/`createDefaultPlayer`, `collectTalentEffects` levels axis + ~19 getter consumers, `GameManagerRealmAdvanceOps` resolve op, `GameRoot.vue` mount, `saveShapeValidation` v75 block, `saveVersion` 75, i18n vi/en, and test/spec files.

## Scope and Risk Map

The change crosses three sensitive boundaries: (1) **persistence** — a new optional persisted record (`pendingTalentEntitlement`) plus a new persisted sparse map (`talentLevels`) under `CURRENT_SAVE_VERSION = 75`; (2) **transaction** — the entitlement is minted on the committed-outcome seam and must be exactly-once, reload-safe, cancel-safe; (3) **presentation** — an uncancellable modal that LOCKS the outcome drain until resolved. Learned-defects ledger applied: QA-2026-09-12-013 (persisted ids referencing static catalogs must fail loud — silent inert loading is data loss).

## Invariant Ledger

| ID | Invariant (mission §15–18 / architecture) | Attack operator | Observable oracle | Result |
| --- | --- | --- | --- | --- |
| INV-T01 | One breakthrough → exactly one entitlement record | Repeat settle / double commit | `createTalentEntitlement` no-overwrite guard; second call is a no-op | PROVEN — `TalentEntitlement.test.ts` |
| INV-T02 | Decision locks the transition until resolved | Drain while pending | `checkTribulationOutcomeAction` returns early (still true) while `pendingTalentEntitlement` set | PROVEN — unit + tribulation-flow.spec.ts E2E (wheel never reattached before resolution) |
| INV-T03 | Settle idempotent across reload/repeat ticks | Reload mid-decision | Record persists v75; modal re-presents identical offers after reload; resolve post-reload grants once | PROVEN — runtime recording + reload re-present screenshot |
| INV-T04 | Cancel-safety: no bypass path | Escape/scrim/close | Modal renders no cancel affordance; `onEscape` intentionally no-ops; `useDialogFocus` contains focus | PROVEN — code + runtime (no close affordance present) |
| INV-T05 | NEW draws 3 eligible realm-pooled cards, deduped, no reroll | Pool overlap / dup draw | `drawBreakthroughTalentOffers` splice-without-replacement; offers ⊆ realm pool, all resolvable via `getTalentDefinition` | PROVEN — pool tests (eligibility/dedupe/weights) |
| INV-T06 | UPGRADE offers only owned talents with a legal next level | Max-level / unowned offer | `getUpgradeableTalentIds` = owned ∩ deduped ∩ `level < maxLevel`; `resolveTalentEntitlement` rejects unowned/at-cap ids | PROVEN — domain tests + resolve-validation tests |
| INV-T07 | `pham_cot` stays an explicit special case | Auto-upgrade to pham_nhan_chi_cot | `pham_cot` maxLevel 1 → never upgradeable; conversion still happens inside `resolveVictory` ordering after entitlement mint | PROVEN — pham_cot test + ordering read |
| INV-T08 | Effects at level > 1 use authored `levels` axis | Stale level-1 magnitude | `getTalentEffectsAtLevel(id, n)`; `collectTalentEffects` reads `talentLevels?.[id] ?? 1` for every owned id | PROVEN — effect tests + cultivationSpeed multi-talent pin (4× −75% → floor 0.1/s) |
| INV-T09 | ReleasePolicy gates future-realm pools | Locked realm leak | `createTalentEntitlement` skips when policy off / pool unavailable; kd_* dormant pool unreachable under policy | PROVEN — policy-gated draw tests |
| INV-T10 | Creation rolls never draw pool talents | Catalog leak | `rollCharacterCreationTalents` sources only `CHARACTER_CREATION_TALENTS`; pools aggregated only in `TALENTS_BY_ID` | PROVEN — structural read + catalog test |
| INV-T11 | Malformed persisted record fails loud (never restores into a stuck modal) | Corrupt realmId / unknown offer id / degenerate record | `saveShapeValidation` rejects: realmId ∉ REALMS; offeredTalentIds entry unresolvable; empty offers with zero upgradeable owned talents | PROVEN — new validator + failing repro tests (see QA-2026-09-23-001) |
| ARCH-1 | No migrations by convention | Older version must not silently load | Save v<75 classified `incompatible` → SaveIncompatibleScreen | PROVEN — saveVersion.ts:470-497 convention (unchanged) |
| ARCH-2 | Entitlement minted before pham_cot conversion | Special-case ordering | `createTalentEntitlement` call precedes the great_dao conversion block in `resolveVictory` | PROVEN — code order read |

## Focused Checks Run This Pass

| Attack | Method | Result |
| --- | --- | --- |
| Corrupt `pendingTalentEntitlement.realmId` survives validation | Wrote repro test (realmId `'not_a_realm'`) | **DEFECT CONFIRMED** — old validator passed it; fixed (QA-2026-09-23-001) |
| Corrupt `offeredTalentIds` entry survives validation | Repro test (`'retired_talent_id'`) | **DEFECT CONFIRMED** — same fix |
| Degenerate record (empty offers + no upgradeable owned) → empty uncancellable modal | Repro test (`['retired_talent_id','pham_cot']`, `offeredTalentIds:[]`) | **DEFECT CONFIRMED** — would soft-lock the drain forever; now fails `player.pendingTalentEntitlement` |
| Legitimate all-consumed record still loads | Acceptance test (empty offers + owned `lk_bac_hai` at level 2) | Passes — level 2 < maxLevel ⇒ upgradeable ⇒ not degenerate |
| `getUpgradeableTalentIds` duplicate ids | OCR finding earlier | Fixed upstream of this audit (`new Set` dedupe); re-verified 442 green |
| Modal legibility on dark surface | Runtime screenshot | Fixed earlier in-session (paper→surface token remap on `.talent-entitlement__panel`); re-verified |
| Second tribulation after resolution drains normally | tribulation-flow.spec.ts patched to resolve, then asserts wheel reattach | PROVEN — E2E green |
| E2E helpers that drive Quan Khi victory | Grep for victory→wheel waits | 3 sites patched to resolve the modal first (tribulation-flow, cultivation-path-ritual, combat-vertical-slice) — all green |

## Findings

### QA-2026-09-23-001: malformed `pendingTalentEntitlement` restored into a permanent soft-lock — FIXED in pass
- Severity: **High** (save-integrity class; learned-defect QA-2026-09-12-013 rule)
- Invariant: INV-T11 / ARCH-1
- Mechanism: the v75 validator block checked only `realmId` non-empty + `offeredTalentIds` string-array shape. A save carrying `{realmId:'not_a_realm'}` or an `offeredTalentIds` entry no longer in the catalog passed validation and restored; a record with `offeredTalentIds: []` and no upgradeable owned talent restored into a modal rendering zero legal decisions — uncancellable, locking `checkTribulationOutcomeAction` forever.
- Evidence: failing repro tests (`saveShapeValidation.test.ts:1739-1785`) before fix; green after.
- Fix: hard-fail on (a) `realmId ∉ REALMS`, (b) any offered id unresolvable via `getTalentDefinition`, (c) duplicate offered ids (a dup would grant the same talent twice — double-counted effects; the live draw is deduped), (d) degenerate record — empty offers AND no owned talent below `getTalentMaxLevel` (delegated to `getUpgradeableTalentIds` after sanitize, no duplicated rule), (e) `talentLevels` entries above the talent's authored `maxLevel` for resolvable ids (unknown/retired ids stay tolerated, matching `selectedTalentIds` semantics). The live seam can never author a degenerate record (`createTalentEntitlement` returns `undefined` when nothing is offerable), so it can only arrive via corruption — fail-loud is correct per the QA-2026-09-12-013 rule.

### Pre-existing / out-of-scope findings (not blockers)
- `tests/e2e/combat-idle-motion-capture.spec.ts` fails identically on `origin/p7/truc-co` (`/tmp/base-check`): "player is playing no animation" — animation/asset-layer flake unrelated to this change (spec contains no tribulation path).
- `tests/e2e/standing-slot-panel.spec.ts` fails identically on base: `formation_slot` wheel button `is-disabled` for a fresh mortal (unlock requires Trúc Cơ); the spec never seeds realm — pre-existing suite defect.
- Unit suite: 6 pre-existing/environmental failures confirmed on the base worktree — `magick ENOENT` ×2 (no ImageMagick binary), `asciiComments` baseline violations ×1 (M-F-RESPEC), `SkillPathPanel` ×3 (`getTurnBattle` missing on test double). None in the changed surface.
- Design nit (recorded, deferred): the entitlement modal offers no reroll by mission design (Beta); pool weights 55/28/12/4 are scaffolding pending the deferred balance pass.

### Coverage gaps (documented, non-blocking)
- `test:e2e` has no dedicated spec driving the modal's UPGRADE lane end-to-end (NEW lane is exercised through every victory-driving spec). UPGRADE legality is covered at domain level (`getUpgradeableTalentIds`, resolve-validation tests) and by the runtime recording; an upgrade-lane e2e would mostly re-assert the same DOM path.
- `drawBreakthroughTalentOffers` rng injection is unit-covered; distribution fairness is not statistically tested (balance deferred by mission scope).

## Verification Evidence Referenced

- `npm run test` (worktree): 446/446 in `src/services/save/` incl. all new repro tests (drift/degenerate/dup/over-max); task-scope vitest scope green; full-suite remainder = 6 pre-existing/environmental failures classified on `/tmp/base-check` (magick ×2, asciiComments ×1, SkillPathPanel ×3).
- `npm run type-check`: clean (vue-tsc).
- `npm run build`: green (vite build, 1817 modules).
- `npm run test:e2e`: 27/29 pass; the 2 failures proven pre-existing on base (identical errors on `/tmp/base-check`). All 10 victory-driving specs re-verified green after the entitlement-resolution patches.
- P18 OCR: clean on re-run after the `getUpgradeableTalentIds` dedupe fix.
- Runtime evidence: recordings `rec-f80a78fc-...-edited.mp4` (full loop: victory → modal → resolve → drain → reload re-present → resolve) and `rec-b5473e85-...-edited.mp4` (legibility re-verify); screenshots `ss_9db0f78a` (3 NEW + UPGRADE), `ss_6d442d2c` (reload re-present Tầng 2→3), `ss_51eec2e7` (resolved v75 save).
