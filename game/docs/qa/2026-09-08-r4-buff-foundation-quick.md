# R4 — Buff / Status Foundation Closure — QA Quick Report

Date: 2026-09-08
Worktree: E:/tutienidle/.agent-worktrees/r4-buff-foundation
Branch: feat/r4-buff-foundation
Mission: R4 (roadmap 0.6) based on Mission 0 findings AR-19 + buff-related AR-18.
Spec: game/docs/superpowers/specs/2026-09-08-r4-buff-foundation-closure-design.md
Plan: game/docs/superpowers/plans/2026-09-08-r4-buff-foundation-closure.md

## P17 Contract Evidence

The maintained combat reference `docs/superpowers/specs/2026-09-07-turn-based-combat-reference.md` is absent (2026-09-08). The buff system authority contract below was established from production consumers and tests before modifying behavior:

- **Single Authority (A2):** All buff storage and evaluation is unified under `src/core/buff/` (`BuffPool`, `BuffSystem`, `BuffTypes`, `BuffNames`). `TurnBuffSystem`, `TurnBuffPool`, and `TurnBuffTypes` are transparent re-export aliases of the canonical authority.
- **Clock Independence (A9):** Clock-independent mechanics (stacking, refresh, replace, max stacks, duration scaling, DoT formula, poison root escalation, stat modifier extraction, and CC checks) are implemented once in `BuffSystem`.
- **Clock Policies:**
  - Turn duration: decrements `remainingTurns` by 1 per turn step in `update(target, combatSystem, registry?, resolveSource?)`.
  - Wall-clock duration: decrements `remainingTurns` / `remainingTime` by `deltaSeconds` in `updateTime(deltaSeconds)` (used by `GameManager.tick()` for persistent out-of-battle debuffs like Kiếp Thương).
- **Survival Policy Decoupling (AR-18):** `CombatSystem.surviveLethalSession` executes a declarative `SurviveEffectsPolicy` (`cleanseDebuffs`, `grantBuffId`), removing the hardcoded `'tu_sinh_ngo'` content ID from the core damage authority.

## Changes Reviewed (18 files, +446 / −968 lines, net −522 lines eliminated)

- Canonical buff authority:
  - `game/src/core/buff/BuffTypes.ts` (canonical types with `BuffEffectTemplate`, `DotEffect`, `Buff`, `BuffDefinition`).
  - `game/src/core/buff/BuffPool.ts` (canonical pool with `clearCcEffects()`).
  - `game/src/core/buff/BuffSystem.ts` (canonical system with turn update, DoT, convert, triggers, and `updateTime`).
  - `game/src/core/buff/BuffNames.ts` (safe name resolver).
  - `game/src/core/buff/Buff.ts`, `BuffDefinition.ts` (re-exports).
- Clean compatibility re-exports:
  - `game/src/core/battle/turn/TurnBuffTypes.ts` (aliases to `BuffTypes`).
  - `game/src/core/battle/turn/TurnBuffPool.ts` (alias to `BuffPool`).
  - `game/src/core/battle/turn/TurnBuffSystem.ts` (alias to `BuffSystem`).
  - `game/src/core/battle/turn/TurnBuffNames.ts` (alias to `BuffNames`).
  - `game/src/data/buff/TurnBuffRegistry.ts` (alias to `BUFF_REGISTRY`).
- Deduplication & Decoupling:
  - `game/src/core/battle/turn/TurnStatsRecompute.ts` (uses `new BuffSystem(buffs).getActiveModifiers()`).
  - `game/src/core/combat/CombatSystem.ts` (`SurviveEffectsPolicy` decoupling).
  - `game/src/core/game/GameManager.ts` (calls `this.buffSystem.updateTime(deltaSeconds)`).
- Tests:
  - `CombatSystem.surviveLethal.test.ts` (new AR-18 policy test).
  - `BuffPool.test.ts` (new `clearCcEffects` test).
  - `BuffSystem.test.ts`, `ArtifactSystem.test.ts` (compatibility field updates).

## Invariant Ledger (Quick Mode)

| ID | State / Owner | Action & Transition | Invariant | Attack Operator | Observable Oracle | Test Layer | Result |
|---|---|---|---|---|---|---|---|
| INV-R4-1 | Buff authority / `BuffSystem` | Apply buff and query active modifiers | Single authority: canonical BuffSystem implements stat modifier fold | Apply attack buff to pool | `getActiveModifiers()` returns correct `StatModifier[]` | Unit | PASS |
| INV-R4-2 | Buff authority / `BuffPool` | CC buff active on target | CC containment: `clearCcEffects()` purges all CC effects atomically | Pool with stun + stat buffs | Only stat buff remains after `clearCcEffects()` | Unit | PASS |
| INV-R4-3 | Clock policy / `BuffSystem` | Persistent buff ticks outside combat | Clock separation: `updateTime(deltaSeconds)` decrements duration | Delta seconds applied in `GameManager.tick()` | Buff expires when remaining time reaches 0 | Unit | PASS |
| INV-R4-4 | Combat authority / `CombatSystem` | Player survives lethal damage with custom policy | Content decoupling: survival grants policy-specified buff, not hardcoded ID | `grantBuffId: 'custom_phoenix_buff'`, `cleanseDebuffs: false` | Custom buff applied, existing debuffs preserved | Integration | PASS |
| INV-R4-5 | Combat authority / `CombatSystem` | Player survives lethal with default Bất Tử Thể | Parity: default survival preserves Tử Sinh Ngộ + debuff cleanse | Bat Tu The talent active | Debuffs cleansed, `tu_sinh_ngo` granted | Integration | PASS |
| INV-R4-6 | Re-export aliases / `TurnBuff*` | Turn battle imports `TurnBuffSystem` / `TurnBuffPool` | Compatibility: re-exports behave identically to previous separate files | Full turn battle test suite | 47 turn battle test files pass with 0 errors | Integration | PASS |
| INV-R4-7 | Deduplication / `TurnStatsRecompute` | In-battle stat recompute reads active modifiers | Conservation: recompute delegates to `BuffSystem.getActiveModifiers()` | In-battle buff application | Stats computed identically, 20 duplicate lines deleted | Unit | PASS |

## Verification Evidence

- P3 full:
  - `npm.cmd run type-check`: **PASS (0 errors)**.
  - `npm.cmd run build`: **PASS (0 errors)**.
  - `npx.cmd vitest run`: **419 files / 2888 tests PASS (0 failures)**.
- P5 code review: PASS (pre-simplified with E3, net −522 lines eliminated, no findings ≥80).
- P13 runtime wiring: persistent buff tick in `GameManager.ts` routed to `updateTime(deltaSeconds)`.
- P14: deferred to main checkout per isolated-worktree exception.

## Verdict

**PASS WITH EVIDENCE**
