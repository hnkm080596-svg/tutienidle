# Stat System — Turn-Based Conversion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Rename `attackSpeed`→`speed` (rescaled ×100, HSR-SPD-style anchor) and `hpRegenPerSecond`→`hpRegenPerTurn` (same value), and retire `cooldownReduction`/`castSpeedPercent`/`movementSpeed` outright, across the whole `StatType` surface and every real call site — unblocking Slice 6.

**Architecture:** `StatTypes.ts` is the single source of truth; renaming there makes the TypeScript compiler enumerate every real call site as a build error — this plan uses that as the navigator for the wide fixup pass (§ Task 6) rather than pre-guessing every one of the ~76 files a grep for these 5 names touches. **Per explicit user direction (2026-09-04): live-game behavioral compatibility is NOT a concern for this plan** — `BattleSystem.ts` is the doomed real-time engine Slice 6 deletes soon, so every fix in this plan is a straightforward mechanical rename (same property, same value) with no compensating scale-correction formulas anywhere, including in `BattleSystem.ts`/`EnemyStatInput.ts`. The compiler errors are treated purely as a checklist of names to update, not a signal to preserve old numeric behavior.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-stat-system-turn-based-conversion-design.md`

## Global Constraints

- No `any` types.
- Do not add speculative new stats/mechanics beyond what the spec specifies (§5 of the spec: Intelligence stays a 2-derived-stat attribute, no filler stat).
- Do not wire `hpRegenPerTurn` into `TurnBattleSystem` — out of scope (spec §6), this plan only renames the field.
- Do not redesign the 3 buffs pairing `movementSpeed`+`attackSpeed` — only remove the `movementSpeed` component so they compile; keep their `attackSpeed`(→`speed`) component per the same rescale rule as everywhere else.
- **Mechanical rename rule (the rule this whole plan runs on — no scale compensation anywhere):**
  - Any code reading `.attackSpeed` becomes `.speed` — same value, no `/100`.
  - Any literal `attackSpeed: N` in a data/test fixture becomes `speed: N` — same `N`, no `* 100`.
  - `hpRegenPerSecond` → `hpRegenPerTurn` — same rename pattern, same value.
  - `movementSpeed`/`castSpeedPercent`/`cooldownReduction` references are DELETED (the field/line/property is removed, not replaced with anything).
  - The ONLY place the new spec'd numbers (`speed` base 100, Dexterity rate 0.15) appear at all is `StatBlock.ts`'s `createBaseStats()` and `StatCalculator.ts`'s `deriveAttributeModifiers()` (Task 2) — those ARE the stat's real definition. Every other file is a pure identifier rename with its existing numbers left untouched, even though this means those numbers (e.g., an equipment affix granting `attackSpeed: 0.02` becoming `speed: 0.02`) are no longer meaningful at the new ~100 scale. That mismatch is accepted and intentional per user direction — this plan does not chase numeric correctness in the doomed real-time system.

---

### Task 1: `StatTypes.ts` — the source of truth

**Files:**
- Modify: `game/src/core/stats/StatTypes.ts`

**Interfaces:**
- Produces: the renamed/retired `StatType` union — every other task in this plan is driven by the compile errors this change produces.

- [x] **Step 1: Edit the `StatType` union**

In `game/src/core/stats/StatTypes.ts`, replace line 11 (`| 'attackSpeed'`) with `| 'speed'`, and delete line 12 (`| 'movementSpeed'`) entirely.

Replace line 53 (`| 'hpRegenPerSecond'`) with `| 'hpRegenPerTurn'`.

Delete line 55 (`| 'cooldownReduction'`) and line 63 (`| 'castSpeedPercent'`) entirely (leave their explanatory comments in place only if they still read sensibly standalone — the comment above line 55 explains `cooldownReduction`'s own mechanic and should be deleted with it; the comment above line 63 explains `castSpeedPercent` relative to `cooldownReduction` and should be deleted with it too, since both concepts it references are gone).

- [x] **Step 2: Confirm the compiler now reports errors everywhere these were used**

Run: `npx vue-tsc --noEmit 2>&1 | head -50`
Expected: A large number of errors referencing `attackSpeed`/`movementSpeed`/`cooldownReduction`/`castSpeedPercent`/`hpRegenPerSecond` as unknown/missing properties — this is expected and is the todo list for Tasks 2-6.

- [x] **Step 3: Commit**

```bash
git add game/src/core/stats/StatTypes.ts
git commit -m "refactor(stats): rename/retire StatType keys for turn-based conversion (task 1)"
```

---

### Task 2: `StatBlock.ts`, `StatCalculator.ts`, `StatMetadata.ts` — the core stat formulas

**Files:**
- Modify: `game/src/core/stats/StatBlock.ts`
- Modify: `game/src/core/stats/StatCalculator.ts`
- Modify: `game/src/core/stats/StatMetadata.ts`

**Interfaces:**
- Consumes: the renamed `StatType` union (Task 1).
- Produces: `createBaseStats()` returning `speed: 100`/`hpRegenPerTurn: 0` instead of the retired fields; `deriveAttributeModifiers()` producing a flat `speed` modifier from Dexterity instead of a percent `attackSpeed` modifier, no `cooldownReduction` modifier, and an `hpRegenPerTurn` modifier instead of `hpRegenPerSecond`.

- [x] **Step 1: Update `StatBlock.ts`'s `createBaseStats()`**

In `game/src/core/stats/StatBlock.ts`, replace:

```typescript
    attackSpeed: 1,

    // Player là tower cố định, không dùng movementSpeed cho bản thân
    // nữa (xem BattleSystem.resolveMovement()) — vẫn giữ stat này vì
    // enemy dùng chung Stats shape, chỉ enemy còn thật sự di chuyển.
    movementSpeed: 60,
```

with:

```typescript
    // Turn-based conversion (2026-09-04) — nền 100, ATB gauge-fill-rate
    // stat (ActionGauge.advanceGauge() đọc trực tiếp). Neo giá trị 100
    // theo quy ước SPD của Honkai: Star Rail (baseline ~100-115) — chỉ
    // là chọn đơn vị dễ đọc, GAUGE_MAX=1000 không quan tâm độ lớn tuyệt
    // đối, chỉ quan tâm tỉ lệ speed giữa các actor.
    speed: 100,
```

Find the `cooldownReduction: 0,` and `castSpeedPercent: 0,` lines further down and delete both entirely.

Find `hpRegenPerSecond: 0,` and replace with `hpRegenPerTurn: 0,`.

- [x] **Step 2: Update `StatCalculator.ts`'s `deriveAttributeModifiers()`**

In `game/src/core/stats/StatCalculator.ts`, replace the constant:

```typescript
const ATTRIBUTE_ATTACK_SPEED_PERCENT_PER_POINT = 0.0015
```

with:

```typescript
// Turn-based conversion (2026-09-04) — quy đổi thuần đơn vị từ
// ATTRIBUTE_ATTACK_SPEED_PERCENT_PER_POINT cũ (0.0015): base 1→100 và
// rate 0.0015→0.15 cùng nhân 100, giữ đúng % tăng trưởng tương đối —
// KHÔNG phải cân bằng lại.
const ATTRIBUTE_SPEED_PER_POINT = 0.15
```

Delete the constant:

```typescript
const ATTRIBUTE_COOLDOWN_REDUCTION_PER_POINT = 0.001
```

Replace this block inside `deriveAttributeModifiers()`:

```typescript
    percentAttributeModifier(
      'dexterity',
      'attackSpeed',
      finalized.dexterity * ATTRIBUTE_ATTACK_SPEED_PERCENT_PER_POINT,
    ),
```

with:

```typescript
    flatAttributeModifier(
      'dexterity',
      'speed',
      finalized.dexterity * ATTRIBUTE_SPEED_PER_POINT,
    ),
```

Delete this block entirely (Intelligence's `cooldownReduction` modifier, spec §5 — no replacement):

```typescript
    flatAttributeModifier(
      'intelligence',
      'cooldownReduction',
      finalized.intelligence * ATTRIBUTE_COOLDOWN_REDUCTION_PER_POINT,
    ),
```

Replace this block (Vitality's regen modifier — pure rename, same rate):

```typescript
    flatAttributeModifier(
      'vitality',
      'hpRegenPerSecond',
      finalized.vitality * ATTRIBUTE_HP_REGEN_PER_POINT,
    ),
```

with:

```typescript
    flatAttributeModifier(
      'vitality',
      'hpRegenPerTurn',
      finalized.vitality * ATTRIBUTE_HP_REGEN_PER_POINT,
    ),
```

- [x] **Step 3: Update `StatMetadata.ts`**

In `game/src/core/stats/StatMetadata.ts`, delete these 2 lines from `STAT_METADATA`:

```typescript
  cooldownReduction: { unit: 'percent', min: 0, max: 3 },
  castSpeedPercent: { unit: 'percent', min: 0, max: 3 },
```

- [x] **Step 4: Run tsc to confirm these 3 files are now clean**

Run: `npx vue-tsc --noEmit --project . 2>&1 | grep -E "StatBlock|StatCalculator|StatMetadata"`
Expected: no output (these 3 files themselves no longer error — remaining errors are in other files, handled by later tasks).

- [x] **Step 5: Commit**

```bash
git add game/src/core/stats/StatBlock.ts game/src/core/stats/StatCalculator.ts game/src/core/stats/StatMetadata.ts
git commit -m "refactor(stats): update core formulas for speed/hpRegenPerTurn, retire cooldownReduction (task 2)"
```

---

### Task 3: `BattleSystem.ts`'s `cadenceInterval()` — mechanical rename only

**Files:**
- Modify: `game/src/core/battle/BattleSystem.ts`

**Interfaces:**
- Consumes: `speed` (Task 1/2).
- Produces: `cadenceInterval()` compiling again — no behavior-preservation attempted (per Global Constraints, live-game numeric compatibility is not a goal of this plan).

- [x] **Step 1: Rename the property reference**

In `game/src/core/battle/BattleSystem.ts`, find:

```typescript
  private cadenceInterval(
    player: CombatEntity,
    execution: Extract<SkillExecutionPolicy, { kind: 'attack_speed' | 'attack_speed_cast' }>,
  ): number {
    return getAttackIntervalSeconds(player.stats.attackSpeed * (execution.attackSpeedMultiplier ?? 1))
  }
```

Replace with:

```typescript
  private cadenceInterval(
    player: CombatEntity,
    execution: Extract<SkillExecutionPolicy, { kind: 'attack_speed' | 'attack_speed_cast' }>,
  ): number {
    return getAttackIntervalSeconds(player.stats.speed * (execution.attackSpeedMultiplier ?? 1))
  }
```

- [x] **Step 2: Commit**

```bash
git add game/src/core/battle/BattleSystem.ts
git commit -m "refactor(battle): rename attackSpeed to speed in cadenceInterval() (task 3)"
```

---

### Task 4: `EnemyStatInput.ts` — mechanical rename only

**Files:**
- Modify: `game/src/core/enemy/EnemyStatInput.ts`

**Interfaces:**
- Consumes: `speed` (Task 1/2), `normalizeEnemyAttackSpeed()` (existing function in this file, unchanged).
- Produces: enemy `Stats.speed` compiling again — same mechanical-rename-only approach as Task 3.

- [x] **Step 1: Read the current file to get exact line numbers**

`EnemyStatInput.ts` builds enemy `Stats` from authored data (`input.attackSpeed`/`input.movementSpeed`) via `normalizeEnemyAttackSpeed()`. Read the file first — this plan was written from a partial grep, not the full file, so confirm the exact surrounding code before editing (the interface fields at lines 16/20/22, the `normalizeEnemyAttackSpeed` comment at line 74, and the object construction around lines 112-146 were seen via grep, but the plan needs the real surrounding statements to edit correctly).

- [x] **Step 2: Apply the field renames**

In the input interface, keep the `attackSpeed: number` field name as-is (it's the AUTHORED input field, not part of `StatType`, no need to rename) but delete the `movementSpeed: number` field entirely (dead per the spec, no enemy movement in turn-based).

In the object construction that currently has:

```typescript
    attackSpeed: normalizeEnemyAttackSpeed(input.attackSpeed),
```

replace with:

```typescript
    speed: normalizeEnemyAttackSpeed(input.attackSpeed),
```

Delete the `movementSpeed: input.movementSpeed,` line entirely.

Replace `hpRegenPerSecond: input.hpRegenPerSecond ?? 0,` with `hpRegenPerTurn: input.hpRegenPerSecond ?? 0,` (the authored INPUT field name `hpRegenPerSecond` on `EnemyStatInput`'s own interface can stay as-is per the same reasoning as `attackSpeed` above — only the OUTPUT `Stats` field name changed).

Delete `cooldownReduction: input.special?.cooldownReduction ?? 0,` and `castSpeedPercent: 0,` entirely. If deleting the `cooldownReduction` output line leaves `input.special?.cooldownReduction` as the last reader of that input field, leave the input field itself alone (it's a separate, pre-existing authored-data concept outside `StatType` — not part of this plan's scope to also prune the raw enemy-data schema).

- [x] **Step 3: Run this file's test to verify**

Run: `npx vitest run game/src/core/enemy/EnemyStatInput.test.ts`
Expected: FAIL initially if this test asserts on the old `attackSpeed`/`movementSpeed`/`cooldownReduction` output fields — apply the same `speed`/removal rules to its assertions (this test file is covered by this task, not Task 6, since it's the direct test of the file just edited).

Run again after fixing assertions: `npx vitest run game/src/core/enemy/EnemyStatInput.test.ts`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add game/src/core/enemy/EnemyStatInput.ts game/src/core/enemy/EnemyStatInput.test.ts
git commit -m "fix(enemy): correct EnemyStatInput speed scale + drop retired stats (task 4)"
```

---

### Task 5: `EquipmentStatPolicy.ts` — valid stat key lists

**Files:**
- Modify: `game/src/core/equipment/EquipmentStatPolicy.ts`
- Modify: `game/src/core/equipment/EquipmentStatPolicy.test.ts` (if its assertions reference the retired/renamed keys)

**Interfaces:**
- Consumes: the renamed `StatType` union (Task 1).
- Produces: equipment main-stat/substat policy lists with `'attackSpeed'`→`'speed'`, `'hpRegenPerSecond'`→`'hpRegenPerTurn'`, and `'castSpeedPercent'`/`'cooldownReduction'` entries removed — pure string-literal edits, no numeric/formula changes (this file only lists which `StatType` keys equipment slots may roll, it does not compute values).

- [x] **Step 1: Read the file and apply the renames**

Read `game/src/core/equipment/EquipmentStatPolicy.ts` in full. For every string literal `'attackSpeed'` in a stat-key array, replace with `'speed'`. For every `'hpRegenPerSecond'`, replace with `'hpRegenPerTurn'`. Remove every `'castSpeedPercent'` and `'cooldownReduction'` entry from whatever array contains it (do not leave an empty array if one becomes empty — if a slot's whole substat list was only these 2 entries, that is a real content gap to flag to the user rather than silently leaving an empty/broken policy; based on the grep survey this session, these 2 always co-occur with other real stat keys in the same array, so this situation is not expected, but confirm by reading the actual arrays before editing).

- [x] **Step 2: Run the test and fix any assertions on the removed/renamed keys**

Run: `npx vitest run game/src/core/equipment/EquipmentStatPolicy.test.ts`
Expected: FAIL initially on any assertion mentioning the old key names; update those assertions to the new names/removed entries, matching the same rule.

Run again: `npx vitest run game/src/core/equipment/EquipmentStatPolicy.test.ts`
Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add game/src/core/equipment/EquipmentStatPolicy.ts game/src/core/equipment/EquipmentStatPolicy.test.ts
git commit -m "fix(equipment): update stat policy key lists for renamed/retired stats (task 5)"
```

---

### Task 6: Compiler-navigated fixup pass — every remaining file

**Files:** every remaining file the grep survey found referencing `attackSpeed`/`movementSpeed`/`castSpeedPercent`/`cooldownReduction`/`hpRegenPerSecond` and not already covered by Tasks 2-5 — approximately 70 files, spanning `game/src/data/skill/Skills.ts`, `game/src/core/battle/SkillEffectResolver.ts`, `game/src/data/skill/TalentPassives.ts`, `game/src/data/buff/buffs.ts`, `game/src/core/skill/Skill.ts`, `game/src/locales/vi.json`/`en.json`, `game/src/components/panels/skill-path/SkillDetailView.vue`, `game/src/core/equipment/EquipmentSystem.ts`, `game/src/core/battle/EnemyAttackSystem.ts`, `game/src/components/panels/equipment-hall/EnhanceTab.vue`/`RefineTab.vue`, `game/src/components/panels/CharacterPanel.vue`, `game/src/data/equipment/affixes.ts`, `game/src/data/enemy/Enemies.ts`, `game/src/core/artifact/ArtifactSystem.ts`, `game/src/services/save/SaveSystem.ts`, `game/src/core/stats/StatLabels.ts`, `game/src/data/progression/KiemTuNodes.ts`, `game/src/core/combat/CombatSkillPresentation.ts`, `game/src/data/equipment/equipment.ts`, `game/src/core/combat/AttackTiming.ts`, `game/src/data/technique/CombatTechniqueTypes.ts`, `game/src/data/progression/PhapTuNodes.ts`, `game/src/core/skill/SkillSystem.ts`, `game/src/core/game/GameManager.ts`, `game/src/core/equipment/EquipmentRollPrimitives.ts`, `game/src/core/technique/Technique.ts`, `game/src/core/pill/PillSystem.ts`, `game/src/components/panels/bag-sections/PillBagSection.vue`, `game/src/core/combat/CombatEntity.ts`, `game/src/data/realm/Meridians.ts`/`BodyRefinement.ts`/`RealmPassives.ts`, `game/src/data/talisman/talismans.ts`, plus every `BattleSystem.*.test.ts`/`GameManager.*.test.ts`/`buffs.test.ts`/`BuffSystem.test.ts`/other `*.test.ts` file the grep found.

**Interfaces:**
- Consumes: the renamed `StatType` union (Task 1), the mechanical rename rule (Global Constraints).
- Produces: a fully compiling, fully passing codebase — the deliverable of this whole plan.

- [x] **Step 1: Get the full compile error list**

Run: `npx vue-tsc --noEmit 2>&1 > /tmp/stat-rename-errors.txt` (or an equivalent local scratch file — do not commit this file) then read it in full, or run `npx vue-tsc --noEmit` repeatedly in batches if the output is too large for one pass.

- [x] **Step 2: Fix each file, applying the mechanical rename rule from Global Constraints**

For each file the compiler flags — pure identifier renames, no numeric changes anywhere in this task:
- A property access like `entity.stats.attackSpeed` → `entity.stats.speed`.
- A property access like `entity.stats.hpRegenPerSecond` → `entity.stats.hpRegenPerTurn`.
- A literal object field `attackSpeed: N` in a `Stats`/`StatModifier`/test-fixture object → `speed: N` (same `N`).
- A literal object field `hpRegenPerSecond: N` → `hpRegenPerTurn: N` (same `N`).
- Any reference to `movementSpeed`/`castSpeedPercent`/`cooldownReduction` (a field, a `StatModifier` targeting that `stat`, an i18n label key, a UI display row) → delete it. For the 3 buffs pairing `movementSpeed`+`attackSpeed` (haste/slow effects, found in `data/buff/buffs.ts`) specifically: keep the modifier targeting `speed` (renamed, same value) and delete only the modifier targeting `movementSpeed` from the same buff definition — do not delete or redesign the buff itself.
- `game/src/locales/vi.json`/`en.json`: rename the `attackSpeed`/`hpRegenPerSecond` label/description keys to `speed`/`hpRegenPerTurn`, and delete the `castSpeedPercent`/`cooldownReduction` keys — keep the Vietnamese/English label TEXT itself unchanged unless it explicitly names "Cooldown Reduction"/"Cast Speed" (those 2 specific label strings are now dead and should be deleted with their keys, not repurposed).
- `game/src/components/panels/CharacterPanel.vue`'s `combatPower` display formula (`stats.attackSpeed * 200`) → `stats.speed * 200` (identifier renamed only, coefficient untouched — the displayed "Chiến Lực" number is allowed to shift, per Global Constraints).
- Re-run `npx vue-tsc --noEmit` after each file (or small batch of files) to confirm the error count is shrinking and no new errors were introduced.

- [x] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: initially FAIL on any test file not yet fixed by Step 2, or on any test whose numeric assertions were written against the old `attackSpeed`/`hpRegenPerSecond` values. Fix each failure by renaming the fixture's field name only (same value) and, ONLY where a test's assertion is now numerically wrong as a direct consequence of `StatCalculator.ts`'s Task 2 formula change (i.e., tests exercising `deriveAttributeModifiers()`'s Dexterity→speed output specifically), update the expected number to match the new formula (`100 + dexterity * 0.15`) — every other test's fixtures/assertions keep their existing numbers unchanged, renamed only.

Run again: `npx vitest run`
Expected: PASS, full suite.

- [x] **Step 4: Final typecheck**

Run: `npx vue-tsc --noEmit`
Expected: PASS, zero errors.

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(stats): compiler-navigated fixup pass for speed/hpRegenPerTurn rename (task 6)"
```

(If the fixup naturally splits into several logical groups — e.g., all `BattleSystem.*.test.ts` files as one commit, all `data/` content files as another, UI components as a third — commit in those logical groups instead of one giant commit, matching this repo's existing "frequent, focused commits" convention. Use judgement; the important constraint is that `npx vitest run` passes fully at the end, not the exact commit boundaries.)

## Not Covered By This Plan

- Wiring `hpRegenPerTurn` into `TurnBattleSystem` (no call site exists there yet) — separate future work.
- Real content changes to the 3 movementSpeed+attackSpeed buffs beyond dropping the dead `movementSpeed` component — no redesign.
- Any tuning pass on `criticalDamage`/`ailmentResistPercent` to compensate Intelligence's lost 3rd derived stat.
- Re-authoring enemy `speed` values for real turn-based pacing — `Enemies.ts`'s existing per-enemy `attackSpeed` data is only renamed by this plan (§ Global Constraints — no scale change), so it is not yet meaningful as a turn-based `speed` value. Real re-authoring is separate future content work, already tracked in the roadmap's out-of-scope table.
