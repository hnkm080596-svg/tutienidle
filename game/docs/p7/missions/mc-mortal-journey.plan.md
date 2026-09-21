# M-C — MortalChapterJourney Suite — Plan

Spec: `mc-mortal-journey.spec.md` (v2 — review-resolved). Decision D5. Worktree `.agent-worktrees/mc-mortal-journey`, branch `feat/mc-mortal-journey`.

## Task card (G0)

- **Responsibility:** the committed regression contract for the Mortal chapter journey — one suite owning the canonical creation→qi_refining progression narrative.
- **Owner:** `core/simulation/earlygame/MortalChapterJourney.test.ts` (new) on the `EarlyGameSession` harness; `M0LoopProbe.test.ts` deleted.
- **Chain:** session seams only (`runStage`/`cultivate`/`breakthroughIfReady`/`runTribulation`/`performRitual`/`allocateAttribute`/`purchaseNode`/`equipAll`/`investRefinement`) + `buildGameSave`/`restoreFromSave` for the checkpoint leg.
- **Non-goals:** production changes (beyond the session-seam `runTribulation` precheck), balance wall, CI wiring, new content.

## Steps

1. **Session-seam fix (red→green):** `runTribulation` checks `realmAdvanceOps.canTriggerBreakthrough` → `refused` below gate; test asserts mortal:1 → refused, mortal:12 → starts.
2. **Journey suite legs** in `MortalChapterJourney.test.ts`:
   - A: combat-economy happy path (dong_1 defeat→grind→victory→dong_2; bag receives drops).
   - B: cultivation spine (→mortal:12→tribulation victory→ritual→post-state) + ritual/tribulation INDEPENDENCE case (no tribulation run → ritual still succeeds on an ungated base way — regression gate for the documented contract).
   - C: boundary rejects (early tribulation refused via new precheck, early ritual, invalid pair, second ritual, locked stage, attribute cap, zero-material refinement) + post-reject happy-path completion.
   - D: save/restore checkpoint mid-journey → fresh `EarlyGameSession` (fresh catalog-registered manager + fresh Pinia owner) restored via the REAL `restoreGameSession` (`session.restoreCheckpoint` wraps it only) → pinned `Date.now` (offline=0) → persisted-field snapshot parity excluding transient `tribulationState` → manager-backed continuation (`runStage` victory).
   - E: determinism (2 same-seed runs → identical snapshots).
3. **M0LoopProbe deletion** after parity check vs. its trace (all legs covered).
4. **Gates:** type-check, focused vitest + wider simulation scope, OCR, adversarial QA (quick — test-only surface), P5 passes, external impl review, merge.

## Risks / watch

- Flaky timing: `runStage`/`runTribulation` are deterministic (seeded RNG + manual clock) — keep timeouts generous (60s on heavy legs, matching existing).
- `mortal_dong_5` wall: never assert beyond it; characterization comment preserved.
- `investRefinement` return semantics: returns number invested — zero-material → 0.
