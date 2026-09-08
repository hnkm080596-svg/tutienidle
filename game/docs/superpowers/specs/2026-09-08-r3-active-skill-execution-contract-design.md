# R3 — Active Skill Execution Contract — Design Spec

Date: 2026-09-08
Missions: Roadmap Phase R3 (Architecture Repair Program), Mission 0 findings AR-03 + AR-04 + AR-06 + relevant AR-18.
Status: APPROVED-by-user-brainstorm (chat), pending spec review.

## 1. Finding / Evidence

### AR-03 (P0, confidence 100): Converter silently degrades authored skill semantics
`SkillToTurnSkillConverter.ts`:
- Reads only the first `damage` and `debuff` effect. Pure buff skills (`type: 'buff'`), multiple debuffs, and `healPercentOfDamage` are dropped.
- Defaults missing damage to `{ kind: 'physical', multiplier: 1 }`.
- Ignores `skill.target === 'self'`, forcing `targeting: { shape: 'single' }`.
- **Observed executed defect:** `thanh_tuyen_duong_linh` (Water special) and `dia_tru_thua_thien` (Earth special) are pure self-buff skills (`target: 'self'`, `effects: [{ type: 'buff', buffId: ... }]`). When cast in turn combat, the engine targets an opposing enemy, deals physical damage ×1, and never applies the authored buff.
- `cau_mang_can_tri` (Wood special) has two debuffs (`troi_chan` and `trung_doc`); the second debuff is silently dropped.
- `doc_vien_bao_can` (Wood ultimate) specifies `healPercentOfDamage: 0.4`; leech healing is silently dropped.

### AR-04 (P1, confidence 100): Turn hit calls omit critical roll and ignore resolution results
- `TurnBattleSystem.ts` calls `resolveActionHit(actor.entity, target.entity, damage)` at 3 call sites (`:893`, `:913`, `:921`) without passing the 4th parameter (`critical`).
- `CombatSystem.ts:148` defaults `critical = false`. As a consequence, turn combat actions never critically strike, regardless of player `criticalRate`.
- `TurnBattleSystem` ignores the returned `DamageResult`:
  - Even when an attack is dodged (`result.dodged === true`), the target is pushed into `targetIds`.
  - On-hit proc effects (`rollOnHitEffects`), reactive triggers (`rollReactiveTrigger('onImpactLanded')`), ailment application (`appliesAilment`), and consume-for-damage run unconditionally on targets that successfully dodged.

### AR-06 (P1, confidence 100): Turn DoT omits its source context
- `TurnBattleSystem.ts:689` calls `actorBuffSystem.update(actor.entity, this.combat, this.registry)` without passing `resolveSource`.
- As a consequence, DoT resolution runs with `source: undefined`. Elemental penetration is forced to 0 (`CombatSystem.ts:430`), and Mộc Tu poison recovery (`poisonRecoveryPercent > 0`, `CombatSystem.ts:452`) never activates.

### AR-18 (P1, confidence 100): Named content policies leak into generic combat engine
- `TurnBattleSystem.ts:25/:808` imports and branches on `action.skillId === REACTION_PATH_SPECIAL_ID` to perform random elemental pair selection, hardcoding content IDs into the generic turn engine.

---

## 2. Invariants

1. **Semantic Fidelity:** A skill's authored target scope, effects, damage components, and ailments must be preserved. A non-damaging skill must never deal physical ×1 fallback damage.
2. **Explicit Rejection:** Any skill with unsupported effect types or invalid configurations must fail explicitly during conversion/validation, never silently degraded.
3. **Outcome Consumption:** Downstream on-hit effects, reactive triggers, ailment application, leech healing, and consume-for-damage require a landed hit (`!result.dodged`). Dodged attacks apply no on-hit effects.
4. **Critical Authority:** `CombatSystem.resolveActionHit` owns critical hit evaluation when not explicitly overridden by the caller.
5. **Source Provenance:** DoT ticks must resolve their source entity from the battle state, allowing elemental penetration and poison leech to operate correctly. Dead or removed sources fail gracefully to undefined.
6. **Generic Capabilities:** Composite selection (e.g. Reaction Path) is declared via a generic skill policy, not hardcoded content IDs.

---

## 3. Reachable Skill Inventory & Capability Matrix (Beta Cap: Trúc Cơ)

| Skill ID | Build / Role | Authored Semantics | Target Scope | Damage | Ailments / Buffs | Special Handling |
|---|---|---|---|---|---|---|
| `hoa_cau_thuat` | Fire Basic | Single target fire dmg + Bỏng | `enemy` | Elemental Fire ×1.0 | `bong` (100%) | — |
| `tam_muoi_chan_hoa` | Fire Special | Single target fire dmg + Bỏng | `enemy` | Elemental Fire ×1.3 | `bong` (100%), add_stack support | Specializations: Tụ Diễm (+1 stack), Tán Diễm (AoE square) |
| `hoa_ha_cuu_thien` | Fire Ultimate | Line AoE fire dmg + Bỏng | `enemy` | Elemental Fire ×2.4 (line) | `bong` (100%) | — |
| `thuy_tien_thuat` | Water Basic | Single target water dmg + Tê Cóng | `enemy` | Elemental Water ×1.0 | `te_cong` (100%) | — |
| `thanh_tuyen_duong_linh` | Water Special | Self MP/Ward buff | `self` | `undefined` (no dmg) | `thanh_tuyen` (self) | Specializations: Tuyển (`thanh_tuyen` 8s), Băng Giáp (`bang_giap`) |
| `bac_hai_cuong_lan` | Water Ultimate | All-lanes AoE water dmg + Tê Cóng | `enemy` | Elemental Water ×2.4 (all_lanes) | `te_cong` (100%) | — |
| `doc_chuong` | Wood Basic | Single target wood dmg + Trúng Độc | `enemy` | Elemental Wood ×1.0 | `trung_doc` (100%) | — |
| `cau_mang_can_tri` | Wood Special | Single target wood dmg + Trói + Độc | `enemy` | Elemental Wood ×1.3 | `troi_chan` (80%), `trung_doc` (60%) | Multiple ailments on hit; Specs: Cấm Bộ (root long), Thâm Độc (+2 poison) |
| `doc_vien_bao_can` | Wood Ultimate | Single target wood dmg + nổ Độc + Leech | `enemy` | Elemental Wood ×2.4 | Consumes `trung_doc` (30/stack) | `healPercentOfDamage: 0.4` |
| `diem_kim_thuat` | Metal Basic | Single target metal dmg + Xuất Huyết | `enemy` | Elemental Metal ×1.0 | `chay_mau` (100%) | — |
| `kim_lang_toan_phong` | Metal Special | Square AoE metal dmg + Xuất Huyết | `enemy` | Elemental Metal ×1.2 (square) | `chay_mau` (60%) | Specs: Toàn Vực (square wider), Xuyên Liệt (line + add_stack) |
| `kim_luan_tran_ap` | Metal Ultimate | Single target metal dmg + nổ Xuất Huyết | `enemy` | Elemental Metal ×2.4 | Consumes `chay_mau` (40/stack) | — |
| `tho_cau_thuat` | Earth Basic | Single target earth dmg + Trói | `enemy` | Elemental Earth ×1.0 | `troi_chan` (100%) | — |
| `dia_tru_thua_thien` | Earth Special | Self Ward buff | `self` | `undefined` (no dmg) | `dia_tru` (self) | Specs: Bích (`dia_tru_bich`), Thứ (`dia_tru_thu`) |
| `cuu_tru_dia_lao` | Earth Ultimate | Single target earth dmg + nổ Khiên + Trói | `enemy` | Elemental Earth ×2.4 | Consumes Ward (1.5/pt), `troi_chan` (100%) | — |
| `phap_tu_reaction_special` | Reaction Special | 2 random elemental basic attacks | `enemy` | `undefined` (composite) | From picks | `compositePicks: { poolType: 'reaction_path', count: 2 }` |
| `phap_tu_reaction_ultimate` | Reaction Ultimate | Self buff reaction empowerment | `self` | `undefined` (no dmg) | `reaction_empowerment` (self) | Gated by 100 Thế / mana |
| `bat_kiem_thuat` | Sword Special | 2-phase charge Thế → Trảm | `enemy` | Physical ×3 | — | `chargeTurns: 3` |
| `tru_tien_kiem_tran` | Sword Ultimate | Heavy finisher consuming 100 Thế | `enemy` | Physical ×5 | — | `resourceType: 'the'`, `resourceCost: 100` |
| Enemy basic / special / boss | Enemy actions | Archetype basic / everyNth special / enrage | `enemy` | Physical / scaled | `bossTrigger` buff | Handled through existing engine |

---

## 4. Architecture & Design Changes

### 4.1. `TurnSkillDefinition` contract extension
In `core/battle/turn/TurnSkillAction.ts`:
```typescript
export interface TurnSkillAilmentApplication {
  buffDefinitionId: string
  chance: number
  stacks?: number
}

export interface TurnSkillDefinition {
  id: string
  cooldownTurns: number
  targetScope?: 'enemy' | 'self'
  resourceType?: SkillResourceType
  resourceCost?: number
  damage?: ActionDamageInfo               // Optional: pure buff/heal skills have no damage
  targeting: ActionTargeting
  compositePicks?: {                      // Generic composite action policy (replaces AR-18 check)
    poolType: 'reaction_path'
    count: number
  }
  appliesBuff?: { definitionId: string; target: 'self' | 'target' }
  appliesAilment?: TurnSkillAilmentApplication
  appliesAilments?: TurnSkillAilmentApplication[]  // Multiple ailments (e.g. cau_mang_can_tri)
  consumesAilmentId?: string
  damagePerStack?: number
  consumesWardForDamage?: boolean
  damagePerWardPoint?: number
  healPercentOfDamage?: number           // Leech healing on hit (doc_vien_bao_can)
  chargeTurns?: number
  presetId?: CombatVfxPresetId
}
```

### 4.2. `SkillToTurnSkillConverter` strict conversion
In `core/game/SkillToTurnSkillConverter.ts`:
- **Target scope:** If `skill.target === 'self'`, set `targetScope: 'self'`, `targeting: { shape: 'single' }`.
- **Damage effect:**
  - If a `damage` effect exists: map to `ActionDamageInfo` (`elemental`, `primordial`, or `physical`).
  - If `skill.target === 'self'` and no damage effect: `damage` is `undefined`.
  - If `skill.target !== 'self'` and no damage effect: throw `Error(`Unsupported: non-self skill "${skill.id}" has no damage effect`)`.
  - Map `healPercentOfDamage` if present.
- **Buff effect:**
  - If a `buff` effect exists: map to `appliesBuff: { definitionId: buffEffect.buffId, target: skill.target === 'self' ? 'self' : 'target' }`.
- **Debuff & add_stack effects:**
  - Collect all `debuff` effects into `appliesAilments`.
  - For `add_stack` effects, increment `stacks` on the matching `buffId` in `appliesAilments`.
  - Maintain `appliesAilment = appliesAilments[0]` for backwards compatibility.
- **Strict validation:** Any unhandled effect type (e.g., unexpected future types) throws an explicit `Error` in development/test.

### 4.3. Hit resolution & Dodge handling in `TurnBattleSystem`
In `core/battle/turn/TurnBattleSystem.ts`:
- **Declare phase (`declareActorAction`):**
  - If `action.skill?.targetScope === 'self'`:
    - `affected = [actor]`
    - `scaledDamage = null`
  - Otherwise, resolve opposing target as before.
- **Impact phase (`applyActionImpact`):**
  - If `declared.scaledDamage`:
    - For each target in `declared.affected`:
      - `const hitResult = this.combat.resolveActionHit(actor.entity, target.entity, declared.scaledDamage)`
      - If `!hitResult.dodged`:
        - `targetIds.push(target.id)`
        - If `action.skill?.healPercentOfDamage && hitResult.finalDamage > 0`:
          `this.combat.applyHealing(actor.entity, hitResult.finalDamage * action.skill.healPercentOfDamage, actor.entity.id, 'leech')`
        - Resolve consume-for-damage (ailment/ward).
        - If `this.registry`:
          - `rollOnHitEffects`
          - `rollReactiveTrigger('onImpactLanded')`
          - Apply each ailment in `appliesAilments` (with reaction check).
      - If `hitResult.dodged`:
        - Target is NOT added to `targetIds`; no on-hit effects, debuffs, or consume triggers fire.
  - **Buff application:**
    - `if (action.skill?.appliesBuff && this.registry)`:
      - Runs independently of `declared.scaledDamage`.
      - If `appliesBuff.target === 'self'`: apply to `actor.buffs`; ensure `actor.id` is in `targetIds`.
      - If `appliesBuff.target === 'target'`: apply to targets in `declared.affected` that were actually hit.

### 4.4. Critical authority in `CombatSystem`
In `core/combat/CombatSystem.ts`:
```typescript
resolveActionHit(
  source: CombatEntity,
  target: CombatEntity,
  damage: ActionDamageInfo,
  critical?: boolean,
): DamageResult {
  const isCritical = critical !== undefined ? critical : this.rollCritical(source, target)
  // ... rest of pipeline uses isCritical
}
```
Existing unit tests passing `critical = false` explicitly are unchanged. Turn combat calls omitting `critical` automatically roll via `source.stats.criticalRate - target.stats.criticalAvoidance`.

### 4.5. DoT source context in `TurnBattleSystem`
In `core/battle/turn/TurnBattleSystem.ts:689`:
```typescript
const resolveSource = (sourceId: string): CombatEntity | undefined => {
  const participant =
    battle.players.find((p) => p.id === sourceId) ??
    battle.enemies.find((e) => e.id === sourceId)
  return participant?.entity
}

actorBuffSystem.update(actor.entity, this.combat, this.registry, resolveSource)
```

### 4.6. Generic composite skill policy (AR-18)
- In `data/skill/TurnReactionPathSkills.ts`:
  `PHAP_TU_REACTION_SPECIAL` defines `compositePicks: { poolType: 'reaction_path', count: 2 }`, removing the `damage: { kind: 'physical', multiplier: 0 }` dummy.
  `PHAP_TU_REACTION_ULTIMATE` defines `targetScope: 'self'`, removing dummy damage.
- In `TurnBattleSystem.ts`:
  Remove `import { REACTION_PATH_SPECIAL_ID }`. Inspect `action.skill?.compositePicks?.poolType === 'reaction_path'`.

---

## 5. Files to Touch

1. `game/src/core/battle/turn/TurnSkillAction.ts` — `TurnSkillDefinition` extensions (`targetScope`, optional `damage`, `appliesAilments`, `healPercentOfDamage`, `compositePicks`).
2. `game/src/core/game/SkillToTurnSkillConverter.ts` — strict conversion: `target: 'self'`, pure buff, multiple debuffs, `add_stack` fold, `healPercentOfDamage`, fail-explicitly guard.
3. `game/src/core/combat/CombatSystem.ts` — `resolveActionHit` defaults `critical` to `this.rollCritical(source, target)`.
4. `game/src/core/battle/turn/TurnBattleSystem.ts` —
   - `declareActorAction`: `targetScope: 'self'` targeting actor with no damage;
   - `applyActionImpact`: hit consumption (`!dodged` gate), critical evaluation, leech heal, multiple ailments, decoupled self-buff;
   - `actorBuffSystem.update`: provide `resolveSource`;
   - Generic `compositePicks` check replacing `REACTION_PATH_SPECIAL_ID`.
5. `game/src/data/skill/TurnReactionPathSkills.ts` — update reaction special/ultimate definitions to use new declarative fields.
6. Tests:
   - `SkillToTurnSkillConverter.test.ts` — test all reachable skills in inventory, self-buff, multiple ailments, leech, strict throw.
   - `TurnBattleSystem.test.ts` / new focused tests:
     - Pure self-buff execution: `thanh_tuyen_duong_linh` applies buff to player, 0 damage to enemy.
     - Critical hit execution: criticalRate 1.0 produces critical hit in turn battle.
     - Dodge gating: 100% evasion enemy takes 0 damage, receives no debuff, triggers no on-hit effects.
     - DoT source resolution: poison recovery heals source; elemental penetration applies.
     - Multiple ailments: `cau_mang_can_tri` applies both `troi_chan` and `trung_doc`.
     - Leech: `doc_vien_bao_can` heals player for 40% of damage dealt.

---

## 6. Verification Strategy & TDD

- **TDD cycle:**
  1. RED: Write tests for self-buff conversion & battle execution (currently fails: deals physical damage to enemy, no buff).
  2. RED: Write tests for turn critical strike (currently fails: critical false).
  3. RED: Write tests for dodged attacks gating on-hit effects (currently fails: on-hit fires on dodge).
  4. RED: Write tests for DoT source context & poison recovery (currently fails: no healing to source).
  5. GREEN: Implement fixes across converter, combat system, and turn battle system.
  6. Characterization verification: Run full inventory validation across all 15 chain skills + specializations.
- **P3 full:** `type-check` + `build` + `npx vitest run`.
- **P4 adversarial QA quick:** write QA report with invariant ledger.
- **P5 code review:** post-simplification review.

---

## 7. Explicitly Out of Scope

- Adding new skills or changing authored skill numbers (roadmap Must-NOT).
- Full BuffSystem vs TurnBuffSystem unification (Phase R4).
- Stale presentation token cleanup (AR-20 / Phase R5).
- Old development save compatibility (E8).

---

## 8. Completion Gate

- All 15 chain skills + Kiếm Tu + Reaction Path convert without errors or silent degradation.
- Pure self-buff skills cast on self, deal no enemy damage, and apply their authored buff.
- Critical hits occur naturally in turn battles based on character stats.
- Dodged hits do not trigger on-hit effects or debuffs.
- DoT damage receives source context (penetration and poison recovery functional).
- No hardcoded `REACTION_PATH_SPECIAL_ID` check in generic engine.
- Full suite green (type-check + build + vitest).
