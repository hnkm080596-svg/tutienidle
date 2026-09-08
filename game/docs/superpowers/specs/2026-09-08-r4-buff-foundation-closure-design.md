# R4 — Buff / Status Foundation Closure — Design Spec

Date: 2026-09-08
Missions: Roadmap Phase R4 (Architecture Repair Program), Mission 0 findings AR-19 + buff-related AR-18.
Status: APPROVED-by-user-brainstorm (chat), pending spec review.

## 1. Finding / Evidence

### AR-19 (P2, confidence 100): Two live buff systems duplicate clock-independent semantics
- `src/core/buff/BuffSystem.ts` (legacy wall-clock) and `src/core/battle/turn/TurnBuffSystem.ts` (turn-based) duplicate over 150 lines of identical logic:
  - Duration scaling based on `ailmentResistPercent` and `ailmentDurationPercent`.
  - Stack cap evaluation with `skillStats.maxStacksBonusByBuffId`.
  - Stack, refresh, and replace policies in `handleExisting()`.
  - Poison root multiplier calculation (`getPoisonRootMultiplier`).
  - DoT base damage formula (mitigation, penetration, Kiếm Tu armor-ignore, Kim Thế multiplier).
  - Stat modifier extraction into `StatModifier[]` (`getActiveModifiers()`).
  - CC effect detection (`isStunned`, `isFrozen`, `isRooted`).
- The project has fully transitioned to turn-based combat (Phase C1 deleted `battle/legacy/`). Keeping two parallel buff systems is unnecessary technical debt and duplicate authority (A2/A9).
- User decision (2026-09-08): Consolidate `TurnBuffSystem` into the canonical `BuffSystem` under `src/core/buff/`, retire legacy duplicates, and provide compatibility aliases.

### AR-18 (P1, buff-related): Content leak in `CombatSystem.ts`
- `CombatSystem.ts:513` hardcodes `effects.registry.get('tu_sinh_ngo')` and hardcodes debuff cleansing during lethal resolution.
- The survival outcome policy belongs to character talent configuration (`GameManagerTurnBattleOps`), not the generic damage authority.

---

## 2. Invariants

1. **Single Authority (A2/A9):** Exactly one `BuffSystem` and `BuffPool` implementation exists in the project, located at `src/core/buff/`.
2. **Turn-Native Core:** The canonical `BuffSystem` is turn-based by default (`remainingTurns`, `continuousTurns`, turn decrements in `update()`). It also provides `updateTime(deltaSeconds)` for persistent out-of-battle buffs (such as `KIEP_THUONG_DEBUFF` 60s cooldown).
3. **Seamless Backwards Compatibility:** `TurnBuffSystem`, `TurnBuffPool`, `TurnBuffDefinition`, and related turn-buff types in `src/core/battle/turn/` become clean re-export aliases of `src/core/buff/`, ensuring zero breaking changes across existing callers and tests.
4. **Content-Agnostic Survival (A8/AR-18):** `CombatSystem.surviveLethalSession` executes a declarative policy (`grantBuffId`, `cleanseDebuffs`) without hardcoding content IDs like `'tu_sinh_ngo'`.
5. **No Duplication:** `TurnStatsRecompute.ts` reuses `buffs.getActiveModifiers()` instead of maintaining an identical local loop.

---

## 3. Target Architecture

```text
src/core/buff/
├── BuffTypes.ts       ← Canonical types (BuffDefinition, Buff, BuffEffect, Polarity, StackMode)
├── BuffPool.ts        ← Canonical pool with clearCcEffects() and instance management
├── BuffSystem.ts      ← Canonical system with turn update, DoT, convert, triggers, and updateTime()
├── BuffRegistry.ts    ← Canonical registry interface and map implementation
└── BuffNames.ts       ← Canonical presentation name resolver

src/core/battle/turn/
├── TurnBuffTypes.ts   ← Re-exports BuffTypes (type TurnBuffDefinition = BuffDefinition, etc.)
├── TurnBuffPool.ts    ← Re-exports BuffPool as TurnBuffPool
├── TurnBuffSystem.ts  ← Re-exports BuffSystem as TurnBuffSystem
└── TurnBuffNames.ts   ← Re-exports BuffNames

src/data/buff/
├── buffs.ts           ← Authored buff definitions (LIVE_BUFFS)
└── TurnBuffRegistry.ts← Re-exports BUFF_REGISTRY as TURN_BUFF_REGISTRY
```

---

## 4. Component Changes

### 4.1. Canonical Types (`src/core/buff/BuffTypes.ts`)
- Merge `TurnBuffTypes.ts` into `BuffTypes.ts`.
- Defines:
  - `BuffPolarity = 'buff' | 'debuff'`
  - `BuffStackMode = 'stack' | 'refresh' | 'replace'`
  - `BuffEffect`: union of `StatModifier`, `Dot`, `Cc`, `OnHitProc`, `GaugeDelta`, `ReactiveTrigger`.
  - `BuffDefinition`: canonical definition (`id`, `name`, `duration`, `polarity`, `stackMode`, `convertsToId`, `convertsAfterContinuousTurns`, `effects`). Supports optional `convertsAfterContinuousSeconds` for legacy data compatibility.
  - `Buff`: active runtime instance (`id`, `sourceId`, `targetId`, `duration`, `remainingTurns`, `stacks`, `maxStacks`, `continuousTurns`, `convertsToId`, `effects`).
  - `BuffRegistry`: interface with `get(id: string): BuffDefinition`.

### 4.2. Canonical Pool (`src/core/buff/BuffPool.ts`)
- Replaces legacy `BuffPool` with `TurnBuffPool` implementation:
  - `getAllById(id: string): Buff[]`
  - `getFromSource(id: string, sourceId: string): Buff | undefined`
  - `getAll(): Buff[]`
  - `hasAny(id: string): boolean`
  - `add(buff: Buff): void`
  - `removeInstance(id: string, sourceId: string): void`
  - `removeAllById(id: string): void`
  - `clear(): void`
  - `clearCcEffects(): void` (for Bá Thể CC-lock guard)

### 4.3. Canonical System (`src/core/buff/BuffSystem.ts`)
- Implements all methods from `TurnBuffSystem`:
  - `apply(definition, source, target, registry?)`
  - `update(target, combatSystem, registry?, resolveSource?)`: turn-based update (decrements `remainingTurns`, executes DoT with source context, converts, expires).
  - `updateTime(deltaSeconds: number)`: decrements `remainingTurns` (or seconds) for out-of-battle persistent buffs in `GameManager.tick()`, removing expired instances.
  - `getActiveModifiers(): StatModifier[]`
  - `rollOnHitEffects(source, target, registry)`
  - `rollReactiveTrigger(target, triggerEvent, registry)`
  - `isStunned()`, `isFrozen()`, `isRooted()`
  - `getStacks(id)`
  - `getAll()`, `getAllById(id)`
  - `remove(id, sourceId?)`, `removeAllById(id)`
  - `renewWithExtension(id, sourceId, addedDuration)`

### 4.4. Clean Backwards Compatibility Re-exports
- `src/core/battle/turn/TurnBuffTypes.ts`:
  `export * from '../../buff/BuffTypes'` + aliases (`export type TurnBuffDefinition = BuffDefinition`, etc.).
- `src/core/battle/turn/TurnBuffPool.ts`:
  `export { BuffPool as TurnBuffPool } from '../../buff/BuffPool'`.
- `src/core/battle/turn/TurnBuffSystem.ts`:
  `export { BuffSystem as TurnBuffSystem } from '../../buff/BuffSystem'`.
- `src/data/buff/TurnBuffRegistry.ts`:
  Exports `BUFF_REGISTRY` and aliases `export const TURN_BUFF_REGISTRY = BUFF_REGISTRY`.

### 4.5. Decouple `CombatSystem.ts` Survival Policy (AR-18)
In `CombatSystem.ts`:
```typescript
export interface SurviveEffectsPolicy {
  buffSystem: TurnBuffSystem // or BuffSystem
  registry: TurnBuffRegistry
  grantBuffId?: string       // Default: 'tu_sinh_ngo'
  cleanseDebuffs?: boolean   // Default: true
}
```
In `CombatSystem.killIfDead`:
```typescript
const effects = surviveSession.surviveEffects
if (effects) {
  if (effects.cleanseDebuffs !== false) {
    for (const buff of effects.buffSystem.getAll()) {
      if (buff.polarity === 'debuff' && buff.targetId === entity.id) {
        effects.buffSystem.remove(buff.id, buff.sourceId)
      }
    }
  }

  const grantId = effects.grantBuffId ?? 'tu_sinh_ngo'
  const def = effects.registry.get(grantId)
  if (def) {
    effects.buffSystem.apply(def, entity, entity, effects.registry)
  }
}
```
In `GameManagerTurnBattleOps.ts:209`: passes `{ buffSystem, registry: TURN_BUFF_REGISTRY, grantBuffId: 'tu_sinh_ngo', cleanseDebuffs: true }`.

### 4.6. Deduplicate `TurnStatsRecompute.ts`
Replace the local `collectStatModifiers` function with `buffs.getActiveModifiers()` (or `new BuffSystem(buffs).getActiveModifiers()`).

---

## 5. Verification Strategy & TDD

1. **TDD Step 1 (Unit & Parity):**
   - Write tests verifying `BuffSystem` in `src/core/buff/` implements the turn-native contract, including DoT, convert, stack modes, and `updateTime()`.
   - Verify `TurnBuffSystem` re-export aliases are transparent.
2. **TDD Step 2 (Survival Policy):**
   - Test `CombatSystem` with a custom `grantBuffId` on survive-lethal, proving no hardcoded dependency on `'tu_sinh_ngo'`.
3. **P3 Full Verification:**
   - `npm run type-check`: 0 errors.
   - `npm run build`: 0 errors.
   - `npx vitest run`: all 419+ files green.
4. **P4 Adversarial QA Quick Report:**
   - Invariant ledger verifying single authority, clock independence, survival decoupling.

---

## 6. Explicitly Out of Scope

- Changing authored buff duration numbers or values in `buffs.ts` (roadmap Must-NOT).
- Modifying UI components (badge rendering already reads name from registry).
- Presentation timing separation (Phase R5).

---

## 7. Completion Gate

- Exactly one `BuffSystem` and `BuffPool` exists under `src/core/buff/`; legacy duplicate code deleted.
- Turn-based compatibility re-exports compile and pass without breakage.
- `CombatSystem` no longer hardcodes `'tu_sinh_ngo'`.
- `TurnStatsRecompute` deduplicated.
- Full test suite PASS (type-check + build + vitest).
