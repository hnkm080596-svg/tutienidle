# REVIEW_RESULT — REV-A-CORRECTNESS (beta-creation-spec-2026-09-23)

- reviewerSession: devin-6b20866c6c99440fb3db342b9680411e (fresh child, sealed)
- requestId: req-roundA-correctness
- phase: CORRECTNESS
- priorFindingsVisible: NO
- verdict: FINDINGS (8)
- reviewedState: productStateId c7159ec3 @ docsCommit 44abadfb
- seal captured via session structured_output at 1790209150 (UTC 2026-09-23)

## Findings (verbatim structured output)

1. **CF1 — missing surface: PerfectionEconomy uses CHARACTER_CREATION_ATTRIBUTE_POINTS as mortal-perfection budget term.** spec census missed `core/simulation/earlygame/PerfectionEconomy.ts:25` importing the constant; `mortalStatBudget()` treats it as `creationPoints` inside `available` (:103) and the `shortfall` identity pinned by `PerfectionEconomy.test.ts:132`. ownerSubsystem: simulation/economy. blastRadius: HIGH — removing or leaving the constant at 5 both break the measured deficit model post-ruling.
2. **CF2 — MEASUREMENT_PROFILE literals in production .ts files carry the old profile shape.** `PerfectionEconomy.ts:32-35` + `EssenceSubstitutionEconomy.ts:48-51` embed `attributes:{strength:2,vitality:3}` literals — spec §1d1 labeled them "test files" and plan edit map omits them; compile breaks under the reshaped `EarlyGameCreationProfile`. ownerSubsystem: simulation. blastRadius: HIGH.
3. **CF3 — i18n key-set drift: `skillStep` keys spec'd (kicker,title,hint) vs impl-needed (kicker,title,selected,description).** Spec D5 lists `skillStep.hint` but the single-screen design needs `selected` (chosen-state label) + `description` (per-skill blurb). ownerSubsystem: ui/i18n. blastRadius: MEDIUM.
4. **CF4 — `ui-components.md` doc drift not censused.** `docs/ui-components.md` describes the creation screen as a 3-step stepper; spec census lists `online-login-cloud-save-plan.md` only. ownerSubsystem: docs. blastRadius: LOW.
5. **CF5 — line-cite drift across the census (11 citations off by 1-3 lines).** e.g. `App.vue:548-587` should be `:548-591`, `StatBlock:59-63`→`:62-66`, `GameManagerProgressionOps:639-654`→`:639-655`. ownerSubsystem: docs. blastRadius: LOW (plan readers mis-grep).
6. **CF6 — plan variable name `pendingMortalBasicSkill` inconsistent with D2 wording.** Spec D2 says "pending creation pick"; plan uses `pendingMortalBasicSkill`. ownerSubsystem: plan. blastRadius: LOW.
7. **CF7 — path-prefix inconsistency in hidden-path citations** (`TheTuPath.ts`/`KiemTuPath.ts` cited bare vs `core/skill/` prefix elsewhere). ownerSubsystem: docs. blastRadius: LOW.
8. **CF8 — open question Q10 wording stale.** Q10 describes re-run risk of `onNewCharacter` as "double-learn guard needed" but boot lifecycle already guarantees consume-once (newCharacterGrantsApplied gate); the doc should state the guard exists, not imply a gap. ownerSubsystem: docs. blastRadius: LOW.

(no attacks, no gaps fields populated — reviewer reported coverage of spec+plan+code oracle)
