# QA Review: beta-creation unified creation flow + required mortal pick (v82)

- Date: 2026-09-23
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `src/App.vue`, `src/components/onboarding/CharacterCreationScreen.vue`, `src/core/game/EarlyGameBootstrap.ts`, `src/core/game/GameManagerSaveRestore.ts`, `src/core/player/Player.ts`, `src/services/character/CharacterCreationService.ts`, `src/services/character/SupabaseCharacterCreationService.ts`, `src/services/save/saveVersion.ts`, `src/services/save/GameSave.fixture.ts`, `src/data/skill/TurnSkillDisplayMeta.ts`, `src/locales/{vi,en}.json`, `supabase/migrations/202608240001_online_auth_character.sql`, `src/core/simulation/earlygame/{EarlyGameSession,PerfectionEconomy,EssenceSubstitutionEconomy}.ts`, `tests/e2e/{helpers,boot-fresh.spec,accessibility.spec}.ts` + swept restore-test fixtures.

## Scope and Risk Map

changed-risk-map.mjs returned all task paths `unmappedPaths` — manually routed:
- save/cloud: v82 bump, restore-preflight mortal-pick contract, RPC signature — materially changed (deep-escalation trigger).
- Vue/Pinia: creation screen rewrite + App.vue pick plumbing through the boot transaction.
- economy/progression: measurement-only sim profiles (no production economy path changed).

Escalation decision: save/cloud consistency did materially change, but the risk is bounded in-scope because (a) the diff ships its own boundary matrix — 9 new v82 preflight assertions including zero-mutation checks, (b) production runtime evidence exists for the whole loop (create→save→reload→combat e2e), and (c) the mission's scheduled impl QA-run (census + sealed reviewers incl. authority/persistence) supplies the deep coverage layer. No `Confirmed` defect blocks a quick verdict.

Exclusions: `docs/qa/runs/**` artifacts (journal data, not product); the ~18 mechanically-swept fixture test files reviewed by pattern.

## Invariant Ledger

| # | Invariant | Attack | Result |
|---|-----------|--------|--------|
| 1 | A mortal save MUST carry a precursor pick, learned in skills[] — absence/invalid/unlearned rejects before any owner mutation | crafted saves: missing pick, non-precursor id (`'hoa_cau_thuat','khong_ton_tai','',7`), pick-not-in-skills, post-path pick | pinned+green — `GameManagerSaveRestore.boundary.test.ts` v82 describe block, zero-mutation asserts |
| 2 | Pick must be written post-learn inside the ONE boot seam (setMortalBasicSkill requires learned); false → throw, fail-closed | invalid payload pick reaching bootstrap | `bootstrapEarlyGamePlayer` throws; grant-phase catch routes to `boot.fail()` + hardReset on retry (QA-2026-09-17-B1 convention) |
| 3 | No second authority can set/override the pick silently | traced all write paths: screen emit → onCharacterCreated → boot transaction; restore preflight; ritual commit clears | only `setMortalBasicSkill` writes; `pendingCreationPick` consumed only in onNewCharacter which fires solely via bootGame(true) — always preceded by onCharacterCreated (fresh pick); stale-pick path unreachable |
| 4 | No allocation path remains (UI/service/RPC/fixtures) | grep census `CHARACTER_CREATION_ATTRIBUTE_POINTS|invalid_attributes|attributeStep|p_attributes|preferredBasicSkill` across src/tests/supabase | zero live references; RPC gains `p_mortal_basic_skill_id` + `drop function` on the stale overload |
| 5 | Learn-all-three preserved (hidden-way Lv3 gates reachable) | bootstrap learns all 3 precursors before pick write; pick only selects the STARTING basic | verified in `EarlyGameBootstrap.ts` + journey/sim tests green |
| 6 | Learned pick implies core-node grant (shape layer channel 3) | `saveShapeValidation.ts:1115-1126` learned-levelled↔core correspondence + integer≥1 level gate | static proof — membership check in preflight relies on shape layer already having run |
| 7 | i18n parity + no orphaned keys | t() census on screen template vs vi.json/en.json; removed blocks symmetric | all keys resolve both locales; attributeStep/attributes blocks removed both |
| 8 | Display-name drift ('Hủy Quyền' vs ruling 'Huy Quyền') | TurnSkillDisplayMeta is id-keyed; name is display-only | aligned to 'Huy Quyền'; no id/name-lookup consumer affected |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npx vitest run` (full suite, worktree) | 7195 pass / 3 fail | failures are pre-existing env (2× `spawnSync magick ENOENT`, 1× SettingsPanel modal) — identical on base 44abadfb |
| `npm run type-check` | clean | vue-tsc --build |
| `npx playwright test` (17 specs + reruns) | affected surfaces green: create-to-combat, accessibility, boot-fresh (fixed), save-reload, cultivation-path-ritual ×6, presentation/system-ui/tribulation/turn-combat/wave-vfx/ink-wash/etc | 3 failures pre-existing on base (combat-idle-motion, standing-slot-panel, technique-frozen-warning) — identical signatures on 44abadfb serial run |
| OCR delegation pass (P18) | 63 previewed / 48 reviewed / 15 skipped (generated QA journal) | 1 Low: stale `create_character` overload not dropped → REPAIRED same pass (drop function added, commit 527388a7) |
| Restore-preflight matrix | EXECUTED via boundary suite | 9 v82 assertions incl. zero-mutation on live sets |

## Findings

None `Confirmed`. One `Suspected` (Low, deferred):
- **QA-2026-09-23-B1 — `pendingCreationPick` never cleared after consume.** A second onNewCharacter without a fresh onCharacterCreated would reuse the previous pick. Unreachable today: onNewCharacter fires only inside bootGame(true), which is only invoked from onCharacterCreated (pick always refreshed first); post-boot re-creation requires reload. Defer: future flows that re-enter creation without reload would need the guard cleared on consume; noted for the impl-run reviewers.

## New or Changed QA Tests

- `GameManagerSaveRestore.boundary.test.ts` — new `v82 mortalBasicSkillId preflight` describe (valid×3, missing, unlearned, invalid×4, post-path; zero-mutation asserts).
- `CharacterCreationScreen.test.ts` — rewritten for unified screen (no stepper/attribute testids, 3 precursor cards, finish gating, payload shape).
- `tests/e2e/boot-fresh.spec.ts` — asserts unified screen (name + skill card) instead of stepper text.
- `tests/e2e/helpers.ts` — `createCharacterThroughUi` drives the single screen.

## Gaps and Residual Risk

- Cloud RPC end-to-end not executed (no live Supabase in this env) — contract verified statically (client param ↔ migration signature ↔ validation rule + column).
- `mortalBasicSkillId` runtime fallback `absent→tram` remains in `CultivationPathRegistry.createMortalRuntime` — defensive, unreachable post-v82 for persisted saves; kept intentionally.

## Pre-existing Failures

- `dongFuBuildingPipeline.test.ts` + `dongFuBackgroundAssets.test.ts` — `spawnSync magick ENOENT` (no ImageMagick in env); fail identically on base.
- `SettingsPanel.test.ts` — confirm-modal null click; identical on base.
- e2e `combat-idle-motion-capture`, `standing-slot-panel`, `technique-frozen-warning` — identical failure signatures on base 44abadfb (serial, workers=1).

## P5 Sequential Review Passes (chronological)

```
Sequential Review Pass 1 — Local Correctness / Regression
  Reviewed state: post-OCR implementation @527388a7 (+boot-fresh fix)
  Findings: QA-2026-09-23-B1 (Low — pendingCreationPick never cleared; unreachable today).
            Migration stale overload (Low — confirmed during OCR; FIXED this pass: drop function added).
  Fixes: drop function for old create_character signature (527388a7); boot-fresh.spec stepper assert -> unified screen.
  Verification: vitest full suite 7195/3-pre-existing; playwright affected specs green; type-check clean.

Sequential Review Pass 2 — Architecture / Authority / Ownership
  Reviewed state after Pass 1 fixes: YES
  Findings: none confirmed. Nit noted: draft.mortalBasicSkillId typed string rather than a literal union —
            accepted, matches isMortalPrecursorSkillId runtime-guard convention (no union type exists).
  Authority check: applyCreationProfile/bootstrapEarlyGamePlayer converge App.vue + EarlyGameSession to ONE
            seam each; GameSave.fixture.ts centralizes the 3-channel contract (17 consumers);
            validation re-checked at each boundary (screen -> service -> boot seam -> preflight) by design.
  Fixes: none.
  Verification: re-inspected post-fix diff; unchanged surfaces not re-verified.

Sequential Review Pass 3 — Adversarial Integration
  Reviewed state after Pass 2 fixes: YES
  Findings: none confirmed. Runtime evidence used: create-to-combat (tram pick -> battle), accessibility
            keyboard flow, save-reload persistence, cultivation-path-ritual x6.
  Consumer census: mortalBasicSkillId -> ProgressionOps:652 (write), RealmAdvanceOps:315 (ritual clear),
            CultivationPathRegistry:338 (runtime resolve -> dynamicBasic -> TurnBattleSystem substitution,
            pre-existing v71 plumbing unchanged), preflight, PlayerData default. No consumer missed.
  Fixes: none.
  Verification: no code changed since Pass 1 verifications; suite green.
```
