# QA Review: Monster attack VFX sweep

- Date: 2026-10-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - game/src/core/audio/AudioCueManifest.ts
  - game/src/core/battle/CombatAction.ts
  - game/src/core/battle/turn/TurnBattleSystem.specialAttacks.test.ts
  - game/src/core/battle/turn/TurnBattleSystem.ts
  - game/src/core/combat/CombatEntity.ts
  - game/src/core/enemy/Enemy.ts
  - game/src/core/game/GameManagerTurnBattleOps.ts
  - game/src/data/enemy/FoundationEnemies.ts
  - game/src/data/enemy/MortalEnemies.ts
  - game/src/data/skill/TurnBasicAttacks.test.ts
  - game/src/data/skill/TurnBasicAttacks.ts
  - game/src/data/vfx/CombatVfxPresets.ts
  - game/src/data/vfx/SkillPresentationRecipes.test.ts
  - game/src/data/vfx/SkillPresentationRecipes.ts
  - game/src/data/vfx/VfxSheetManifest.test.ts (new)
  - game/src/data/vfx/VfxSheetManifest.ts (new)
  - game/src/game/scenes/CombatScene.ts
  - game/src/game/support/skill-vfx/PhaserSkillVfxDriver.ts
  - game/src/presentation/assets/AssetBundleCatalog.ts
  - game/src/presentation/skills/SkillPresentationRecipe.ts
  - game/tests/e2e/monster-attack-vfx.spec.ts (new)

## Scope and Risk Map

changed-risk-map.mjs routed the diff to domains `combat-and-tribulation` +
`pinia-phaser-sync` and set `deepAuditCandidate: true` (cross-system: 2
domains). Manual routing of the 11 `unmappedPaths`: every one is the
combat-presentation seam (VFX preset data, sheet manifest, presentation
driver, asset descriptor catalog, e2e spec) — CombatScene supplies the
Phaser surface. The diff is presentation-only: no damage, stat, reward,
persistence, or timing ownership changes; `presetId` consumers are all
presentation reads (SkillPresentationFacts:133/181, CombatAnimationRuntime
:375, TurnBattleSystem:2073/2979 extra-impact emission). Phaser GameObject
lifecycle risk is bounded by inspection: sheet sprites are tracked in
`liveSheetSprites`, retired by the cue handle's finish/cancel and by
reset()/destroy(), capped at 8 per cue, and `sample()` early-returns on
epoch mismatch; Phaser `GameObject.destroy()` is idempotent
(`!this.scene` early-return, node_modules/phaser/src/gameobjects
/GameObject.js:1008). Deep escalation triggers (save/cloud, clock,
economy/progression, unboundable lifecycle risk) are absent — risk is
confidently bounded, no deep audit.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-VFX-1 | liveSheetSprites / PhaserSkillVfxDriver | cast sheet cue -> finish/cancel/reset/destroy | Lifecycle: every spawned sprite is retired at cue end, battle reset, or scene teardown | Repeat + interruption | no vfx-sheet children outside clip windows; e2e isLive returns to false after clips | Playwright + code inspection | PASS |
| INV-VFX-2 | presentation casts / SkillPresentationRunner | one cast emits one handle per cue | Exactly-once: no re-fire, no double sprite set | Repeat | RR1 pattern (event cardinality): no new event path; openSheet runs once per open() call | code inspection + e2e | PASS |
| INV-VFX-3 | recipe validation / validateSkillRecipe | malformed sheet cue payload | Boundedness: sheetKey/frames/fps/fitPx bounds enforced | Value mutation | throws for empty key, negative frame, inverted window, fps 0/200, fitPx 4/700; sheet fields rejected on non-sheet primitive | Vitest (SkillPresentationRecipes.test.ts malformed-cue cases) | PASS |
| INV-VFX-4 | TurnBattleSystem scripted special | specialAttack.presetId stamped onto action.skill copy | Presentation-only: gameplay identity (skillId, cooldown, damage) unchanged; participant.basic not mutated | Value mutation | step.skillId === 'qa_basic', resolvedSkill.id unchanged, resolvedSkill.presetId === 'water_surge' | Vitest (specialAttacks.test.ts) | PASS |
| INV-VFX-5 | participant basic defs / enemyBasicAttackFor | authored vs unauthored presetId | Shared-state: authored enemy gets a fresh def; unauthored keeps the pre-existing shared GENERIC_PHYSICAL_BASIC | Stale state | basic.id stays generic_physical; presetId stamped; identity check for shared def | Vitest (TurnBasicAttacks.test.ts) | PASS |
| INV-VFX-6 | surface.sprite hook / CombatScene | texture key missing or hook absent (dev surface, headless) | Recoverability/degraded: quietHandle, analytic primitives carry the impact | Degraded environment | textures.exists gate; no lease consumed; no throw | code inspection (CombatScene.ts sprite hook, openSheet early-return) | PASS |
| INV-VFX-7 | sheet sprite anchor | grounded vs upright binding | Anchoring: ground sheets sit at grid foot + DEPTH_GROUND_VFX; upright at body anchor + uprightDepth | Timing boundary | e2e samples within 160px of the attacked player's sprite rect for all 7 bindings | Playwright (monster-attack-vfx.spec.ts) | PASS |
| INV-VFX-8 | sheet window -> frame index | elapsed sampling over clip | Boundedness: index clamped to [firstFrame,lastFrame]; <=8 sprites per cue | Value mutation | e2e asserts every sampled frame inside the authored window | Playwright + Vitest | PASS |
| INV-VFX-9 | beta roster coverage | every BETA_ENEMY_ROSTER id | Coverage: every roster enemy carries a bound attackPresetId | Cross-system chain | roster x binding matrix asserted | Vitest (VfxSheetManifest.test.ts) | PASS |
| INV-VFX-10 | concurrent sheet cues | overlapping casts of same/different presets | Isolation: each handle owns only its own sprites array | Concurrency | end() closes over its own sprites; Set dedupe on destroy | code inspection | PASS |
| INV-VFX-11 | atlas assets / AssetBundleCatalog | kind 'atlas' descriptors + frame_N keys | Asset contract: files exist, windows inside atlas frame counts, loader supports atlas kind | Degraded environment | all 7 png+json present in public/assets/vfx/spritesheets; frame_N naming verified; AssetLoaderScene:157 load.atlas path | file inspection + e2e (sprites rendered) | PASS |
| INV-VFX-12 | audio coupling / AudioCueManifest | 'bite' in IMPACT_PRESET_IDS | Coupling: new presetId registered for impact audio | Value mutation | existing manifest coupling test | Vitest | PASS |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | clean | vue-tsc --build, no errors |
| `npx vitest run` (scoped files incl. new tests) | green | 90 files / 766 tests previously; sheet-cue, manifest, enemyBasicAttackFor, specialAttacks suites pass |
| `npx playwright test tests/e2e/monster-attack-vfx.spec.ts` | green (1.0-1.2m, 3 runs) | real battle on mortal_dong_1; all 7 bindings + scripted water_surge special produce vfx-sheet sprites with frames inside authored windows and anchors within 160px of the player rect; 8 mid-play screenshots captured (Phaser loop frozen while sprite live) |
| `ocr delegate preview/rule` | 21 files, 0 excluded, 100% coverage | reviewed every file against resolved project + system rules; 2 Low findings fixed (dead probe field, silent anchor skip) |
| Phaser destroy idempotency | verified | GameObject.js:1008 `!this.scene` early-return |

## Findings

No Confirmed findings.

### QA-2026-10-04-L1: e2e probe carried a dead timestamp field
- Severity: Low
- Status: Confirmed (by inspection; fixed in the spec — QA-allowed write)
- Invariant: n/a (test hygiene)
- Evidence: `t: now` sample field became unused after the freshness-check rewrite; removed.

### QA-2026-10-04-L2: anchor assertion could silently skip
- Severity: Low
- Status: Confirmed (by inspection; fixed in the spec)
- Invariant: observability — anchor proof must not be skippable
- Evidence: `if (anchor)` guard would skip the 160px check if the sprite-map lookup regressed; now hard-asserts `anchor` non-null.

## New or Changed QA Tests

- `game/tests/e2e/monster-attack-vfx.spec.ts` — authored during the task; proves all 7 wired presets plus the scripted special through the real declare -> present -> driver pipeline with frame-window and anchor oracles.
- `game/src/data/vfx/VfxSheetManifest.test.ts` — binding/preset integrity + full beta-roster coverage.
- `game/src/data/vfx/SkillPresentationRecipes.test.ts` (sheet cue injection block) — cue sizing and malformed-payload rejection.
- `game/src/data/skill/TurnBasicAttacks.test.ts` (enemyBasicAttackFor block) — preset stamping + untouched shared basic.
- `game/src/core/battle/turn/TurnBattleSystem.specialAttacks.test.ts` — scripted special stamps presetId onto resolvedSkill.

## Gaps and Residual Risk

- Subjective visual quality (does 'Slash_21' read well for a boar gore, art-direction sign-off) is a human judgment — recorded as needing Minh's eye, not a defect.
- Scripted-special coverage in e2e uses a participant-level `entity.specialAttacks` poke (documented in the spec); the production path from authored data is covered by the Vitest assertion on resolvedSkill.presetId plus real `specialAttacks` entries in enemy data.
- Non-roster enemies outside beta keep the generic fallback intentionally (scope).

## Pre-existing Failures

None observed in scope.
