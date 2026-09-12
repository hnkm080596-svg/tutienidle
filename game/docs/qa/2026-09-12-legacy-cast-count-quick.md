# QA Review: 9.5 #9 — legacy SkillSystem surface retirement + cast-count revival via turn engine

- Date: 2026-09-12
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `src/core/battle/turn/TurnBattleSystem.ts`
  - `src/core/battle/turn/TurnBattleSystem.onSkillCast.test.ts` (new)
  - `src/core/game/GameManagerTurnBattleOps.ts`
  - `src/core/game/GameManager.ts`
  - `src/core/game/GameManager.castCount.test.ts` (new)
  - `src/core/skill/SkillSystem.ts`
  - `src/core/skill/SkillSystem.castCount.test.ts` (new)
  - `src/core/skill/Skill.ts`, `SkillTypes.ts`
  - `src/core/combat/CombatEntity.ts`
  - `src/core/player/Player.ts`
  - `src/data/skill/Skills.ts`, `TalentPassives.ts`
  - `tests/architecture/vitalsWriteAuthority.test.ts`
  - `docs/roadmap.md`
  - test fixtures rewrites: `SkillSystem.huyKiem/.level/.loadoutSlots`, 8 GameManager/skill fixture files (dead `remainingCooldown` props stripped); deleted `SkillSystem.channel.test.ts`, `SkillSystem.momentum.test.ts` (pinned only dead APIs)

## Scope and Risk Map

Changed systems: turn combat engine (committed-action notification), skill progression
(`recordCast` replacing the dead cast-transaction cluster), GameManager orchestration
wiring, PlayerData progression mirror feed. One-hop consumers: `NodeSystem.hasPrerequisite`
(`skillCastCount`), `chooseCultivationPath` route gate (`bat_kiem`), `SaveSystem` skill
round-trip, `CombatAnimationRuntime` ack dedup, `SkillEffectResolver` (`skillExperience`
context field).

- Domains mapped: `combat-and-tribulation` + `economy-and-progression` (turn action →
  persistent progression mirror). Not escalating to deep: every risk hypothesis resolved
  by direct code/test evidence; no new persistence shape, no new transaction type.
- Exclusions: `battle/legacy/` was already deleted at C1 (`834113f6`); its deletion is
  not re-audited. Presentation props (`CombatSkillSlot.isUnreleased`, `castTime`) verified
  out of gameplay authority.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-CC-1 | `Skill.totalExperience` / SkillSystem | committed player cast | Monotonic +1 per committed cast; unlearned/unknown id → no-op | Repeat, invalid id | `recordCast` unit tests (5) + wiring test | Vitest | Resolved |
| INV-CC-2 | `player.skillCastCounts`/`skillLevels` mirror / GameManager sink | cast notification | Mirror equals owner state; never written for enemy/companion actors | Cross-actor leak | `actor === players[0]` reference filter + wiring test asserts `Object.keys === ['tram']` after a real battle where the enemy also cast | Vitest (real clock path) | Resolved |
| INV-CC-3 | Cast notification / TurnBattleSystem | applyActionImpact | Exactly-once per committed action: normal + charge-init count; charge ticks/resolve, CC-blocked, `markerNoPool` do not | Duplicate, interruption, placeholder | 6 onSkillCast tests incl. charge lifecycle | Vitest | Resolved |
| INV-CC-4 | Charge-init cooldown/resource / TurnSkillAction.commitAction | declare charge | Commit happens at initiation (restores authored intent — previously dead inside empty-`affected` gate) | Dead branch | charge-init test asserts `remainingCooldownTurns === 5` on `bat_kiem_thuat` | Vitest | Resolved |
| INV-CC-5 | Save/restore round-trip / SaveSystem | reload mid-grind | `totalExperience` persists → mirror monotonic across reload | Save/load regression | `getAll()` serializes skill objects incl. `totalExperience`; restore keeps totals; sink re-mirrors on next cast | Code inspection | Resolved |
| INV-CC-6 | Double applyActionImpact via duplicate ack / CombatAnimationRuntime | presentation ack | `pendingDeclaredAction` nulled before apply + playback tokens reject stale → second ack no-ops | Duplicate ack | dedup ordering + token checks inspected | Code inspection | Resolved |
| INV-CC-7 | `skillExperienceRatio` consumers | generic `totalExperience` growth | No authored skill/effect carries `skillExperienceRatio` (tram's removed earlier) → generalized counter is inert to damage | Value mutation | grep: zero `skillExperienceRatio` in `data/**` | Static check | Resolved |
| INV-CC-8 | Vitals write authority | removed `consumeResource`/`refundResource` | SkillSystem no longer writes vitals → allowlist entry dropped | Guard staleness | `vitalsWriteAuthority.test.ts` green | Architecture guard | Resolved |
| INV-CC-9 | Authored thresholds | Huy Kiếm L3 = 10000 casts; node gate = 9999 + level 3 | Unchanged | — | `HUY_KIEM_L3_CASTS`, `KiemTuNodes.ts:168` untouched | Data inspection | Resolved |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | exit 0 | clean |
| `npm run build` | success | pre-existing >500 kB chunk warnings only |
| `npx vitest run` (full) | 516 files / 3459 tests pass | ~181 s; zero failures |
| New tests | 13 tests across 3 files | pin recordCast semantics, onSkillCast exactly-once incl. charge lifecycle, GameManager wiring through the real clock path |
| `selfBuff.qa` flake | passed 5/5 on rerun | unpinned `Math.random` dodge — pre-existing flake, unrelated to diff |
| Residual-reference scan | only a historical comment in `CombatSkillPresentation.ts` naming the old shape | intentionally kept (describes removed legacy, marked as such) |

## Findings

None confirmed. One deliberately restored behavior flagged for awareness:

- Charge-initiation now commits cooldown/resource at declare (INV-CC-4). On master this
  commit was unreachable (`affected` is always empty at charge declare for enemy-targeted
  skills), so `bat_kiem_thuat` never paid its authored `cooldownTurns: 5`. The restoration
  matches the pre-existing authored comment ("Cooldown/resource vẫn commit như cast
  thường") and is required for correct cast semantics; it is a latent-bug fix, not a
  redesign. Net effect: `bat_kiem_thuat` now has a real 5-turn cooldown.

## New or Changed QA Tests

- `TurnBattleSystem.onSkillCast.test.ts` — 6 tests pinning exactly-once committed-cast
  notification across normal/charge/blocked/placeholder paths.
- `SkillSystem.castCount.test.ts` — 5 tests pinning `recordCast` counter/sink/no-op
  semantics.
- `GameManager.castCount.test.ts` — 1 wiring test driving the real update loop until a
  primary-player `tram` cast lands; asserts mirror keys stay `['tram']` only (enemy casts
  excluded).

## Gaps and Residual Risk

- Live-browser verification (P14) deferred per worktree exception — no visual/runtime
  surface changed (headless engine + progression state only), so residual risk is low.
- Cast cadence in turn combat is slower than the retired real-time engine → the 10000-cast
  Huy Kiếm grind is longer in wall-clock. Authored thresholds preserved by decision;
  recorded on the roadmap as a balance-tune candidate, not a defect.
- `skill.unreleased`/`requiredRealmId` cast gates were already dead on master (zero
  turn-engine consumers); removing the dead checkers does not regress any live behavior.
  `unreleased` remains authored data for the UI badge.

## Pre-existing Failures

- `selfBuff.qa` intermittent dodge-dependent failure (unpinned `Math.random`), reproduced
  as flaky before and after the diff; 5/5 pass on rerun.
