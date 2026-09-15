# Kiem Tu Reimagined — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy Kiem Tu (route-locked formation/charge kit) with the reimagined two-path design — Kiếm Phổ preset-combo path (hien) and Ngự Kiếm Đạo hidden forge path (ngu).

**Architecture:** Two domain systems under `src/core/kiem-tu/` own all rules: `KiemPhoSystem` (preset cursor, combo log, suffix-free matcher, combo modifiers) and `NguKiemDao` (Kiếm Ý economy, forge/merge, Roll Cascade). The turn engine gets three generic primitives — `guaranteedHit`, resolved armor policy, and a `dynamicBasic` participant provider — and never branches on kiem-tu ids. `PlayerData.kiemTu` is the single authority; `kiemTuRoute` dies.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser.

**Spec:** `docs/superpowers/specs/2026-09-15-kiem-tu-reimagined-design.md` — read it before every task; the plan argues from it.

## Global Constraints

- Work in an isolated worktree (`using-git-worktrees` → `.agent-worktrees/kiem-tu-reimagined`); P2.
- No save migration: bump `CURRENT_SAVE_VERSION` and add a version-note comment only (K19 — same convention as versions 5–54).
- Comments English/ASCII only in `.ts`/`.vue` (P15). Vietnamese in UI strings goes through `useI18n()` (P16); `data/**` content descriptions may keep Vietnamese.
- No `any` (P8). No new dependencies.
- Generic mechanisms never grow `if skillId === 'ngu_kiem_thuat'` branches (A8). The engine sees flags/fields; `NguKiemDao`/`KiemPhoSystem` decide them.
- Kill-list items are **retire-if-present** — verify no surviving consumer before removing (spec §7).
- Verification per P3: `quick` mode (`npm run type-check` + scoped vitest) per task; `full` (`+ npm run build` + whole suite) at Task 13.
- `realmIndex` everywhere means the existing 0-based realm index (mortal=0 … tribulation=9).

---

## Phase A — Foundations

### Task 1: `PlayerData.kiemTu` state + save bump + path choice always hien

**Files:**
- Create: `src/core/kiem-tu/KiemTuState.ts`
- Modify: `src/core/player/Player.ts` (field ~114, defaults ~368, predicate ~448)
- Modify: `src/services/save/saveVersion.ts`, `src/services/save/saveTypes.ts` (version comment block)
- Modify: `src/core/game/GameManagerRealmAdvanceOps.ts` (~152-190: remove tram-count route lock)
- Test: `src/core/kiem-tu/KiemTuState.test.ts`, update `src/core/game/GameManager.kiemTuRoute.test.ts` → rename intent

**Interfaces:**
- Produces:
  ```ts
  export type KiemTuMode = 'hien' | 'ngu'
  export interface KiemTuState {
    mode: KiemTuMode
    preset: OrbId[]          // 1..9 contiguous, hien-only live
    kiemY: number            // banked, persisted
    kiemDaoCount: number     // >=1 while ngu
    kiemDaoBase: number      // merged multiplier, persists
  }
  export function freshKiemTuState(): KiemTuState
  // -> { mode:'hien', preset:['orb_dam'], kiemY:0, kiemDaoCount:1, kiemDaoBase:1 }
  ```
  `OrbId` canonical definition lives HERE in `KiemTuState.ts` from Task 1; Task 3's `KiemPhoOrbs.ts` imports and re-exports it (one home, no dual declaration).

- [ ] **Step 1: failing test** — `freshKiemTuState()` returns the locked defaults; `PlayerData.kiemTu` present on a fresh player.

- [ ] **Step 2: implement** — new type file; `PlayerData.kiemTu: KiemTuState` (required, initialized in `createDefaultPlayer`-equivalent alongside `kiemTuRoute: undefined` which is deleted); delete `KiemTuRoute` type + `kiemTuRoute` field + the line-448 predicate usage (it referenced `bat_kiem` — re-express as `player.kiemTu.mode === 'ngu'` or delete if the consumer dies in Task 12; check the consumer first).

- [ ] **Step 3: path choice** — in `chooseCultivationPath`, the `kiem_tu` branch stops reading `skillCastCounts['tram']`/`HUY_KIEM_L3_CASTS`; it sets `player.kiemTu = freshKiemTuState()` and learns/equips nothing extra (hien needs no granted skill — orbs are realm-gated data). `bat_kiem_thuat`/`tru_tien_kiem_tran` grants/equips in this branch die here (they are Task-12 kill-list items — removing the grant sites now is required for compile).

- [ ] **Step 4: save bump** — `CURRENT_SAVE_VERSION` 61 → **62** in `src/services/save/saveVersion.ts` (the constant lives THERE — the `saveTypes.ts` comment block is stale history, do not trust it) with comment `v62: Kiem Tu Reimagined — PlayerData.kiemTu replaces kiemTuRoute; old saves rejected, no migration (convention of v5+).`

- [ ] **Step 4b: legacy grant cleanup in `chooseCultivationPath`** — the kiem_tu branch still ends with `purchaseNode('kiem_tran_luong_nghi')` + `bat_kiem`/`kiem_tran` route writes; remove the whole legacy tail (the node dies in Task 12, but the purchase call must not survive past Task 1 or fresh hien players get a retired node).

- [ ] **Step 5: run** `npm run type-check` + `npx vitest run src/core/kiem-tu src/core/player`. Fix compile fallout minimally — remaining `kiemTuRoute` readers switch to `kiemTu.mode` or defer to Task 12 if the whole consumer is being retired (list each deferred one in the commit body).

- [ ] **Step 6: commit** `refactor(kiem-tu): PlayerData.kiemTu state model, path choice always hien, save v62`.

- [ ] **Step 7: K3 regression guard** — removing the route lock must NOT reopen mortal precursor skills: post-path, `tram`/`linh_bao`/`huy_quyen` (the spec-locked precursor set — `ngu_kiem` is a technique, NOT a precursor) cannot be equipped or cast. Locate the existing equip/cast gate that enforced this (was it driven by `kiemTuRoute`? a path/scope field on the skill def? the technique slot?) — if the old lock WAS the route mechanism, re-implement it as a `cultivationPath != null` check on the precursor ids. Test is table-driven over the whole precursor set: `chooseCultivationPath('kiem_tu')` → none of `['tram','linh_bao','huy_quyen']` is equipable/castable. This invariant also lands in Task 13 (INV-15).

---

### Task 2: Engine primitives — hit options, armor policy, multi-instance, dynamicBasic

**Files:**
- Modify: `src/core/battle/ActionImpactSystem.ts` (`HitResolveOptions` ~47)
- Modify: `src/core/combat/CombatSystem.ts` (`resolveActionHit` ~160-200)
- Modify: `src/core/combat/DamageCalculator.ts` (`calculateBaseDamage` ~28-49)
- Modify: `src/core/battle/turn/TurnSkillAction.ts` (`TurnSkillDefinition` ~28-88)
- Modify: `src/core/battle/turn/TurnBattleSystem.ts` (hit call sites ~1089/1158/1179; action select ~941)
- Test: `src/core/battle/turn/TurnBattleSystem.primitives.test.ts`

**Interfaces:**
- Produces (all generic, no kiem-tu ids):
  ```ts
  // ActionImpactSystem.ts
  export interface HitResolveOptions {
    critical?: boolean
    guaranteedHit?: boolean          // skip the accuracy/evasion roll
    armorPierceFraction?: number     // 0..1 — mitigation *= (1-f)
    armorBypass?: boolean            // mitigation = 0
    damageScale?: number             // extra per-instance multiplier
    skillId?: string
    knockbackDistance?: number
    isPrimary: boolean
    origin?: CombatActionOrigin
  }

  // TurnSkillDefinition additions
  instances?: {
    count: number
    perInstanceOptions?: (index: number, target: CombatEntity) =>
      Partial<Pick<HitResolveOptions,'critical'|'guaranteedHit'|'armorPierceFraction'|'armorBypass'|'damageScale'>>
  }

  // TurnBattleParticipant additions (TurnBattleSystem.ts)
  dynamicBasic?: {
    resolveBasic(participant: TurnBattleParticipant): TurnSkillDefinition
    // manual pick channel — validates defId ∈ manualOptions ids; null =
    // not a pickable basic. The presentation layer queues the picked
    // defId; the engine's forced-action path resolves it through this.
    resolveManualPick(defId: string): TurnSkillDefinition | null
    manualOptions(participant: TurnBattleParticipant): TurnSkillDefinition[]
    // battle-scoped state lives inside the provider — reset when a
    // battle cycle restarts (auto-repeat reuses participants; without
    // this the cursor/log would leak across cycles).
    resetForBattle(): void
    onCastResolved?(ctx: {
      participant: TurnBattleParticipant
      battle: TurnBattle
      resolvedSkillId: string              // the def that just resolved — for hien this IS the OrbId
      targetIds: string[]
      resolveHit: (target: CombatEntity, damage: ActionDamageInfo, options: HitResolveOptions) => { landed: boolean }
      // buff channel — combos can carry appliesBuff per the data
      // contract; routed through the same buff/ailment application
      // owner skills use (never a kiem-tu-local applier).
      resolveBuff: (target: TurnBattleParticipant, buff: BuffDefinition) => void
      presetId?: CombatVfxPresetId
    }): { presetId: CombatVfxPresetId; targetIds: string[]; hitCount: number }[]
  }
  ```
- `resolveActionHit` signature becomes `(source, target, damage, options?: Partial<HitResolveOptions>)` — the old positional `critical?: boolean` migrates; call sites pass `{ critical }`/`{}`. Inside: `if (!options.guaranteedHit && !this.rollHit(...))` → dodge; `critical ?? rollCritical`; `damageScale` folds into `effectiveMultiplier`; armor policy passes into `calculateBaseDamage(source, target, kind, ignoreResistance || armorBypass, armorPierceFraction)` where `mitigation *= (1 - armorPierceFraction)` inside the calculator.
- **Multi-instance loops the FULL hit pipeline, not raw `resolveActionHit`.** Extract a private `resolveDeclaredHit(battle, actor, targetParticipant, damage, options)` on `TurnBattleSystem` that owns the whole landed-hit consequence chain the normal path runs today (resolveActionHit → leech → appliesAilment(s) → consume effects → `refreshParticipantStats` both sides → on-hit procs). `instances` loops THIS helper per instance (per-instance options merged, break on `!target.entity.alive`). Combo extra hits in Task 6 use the same helper via `ctx.resolveHit`. `applyActionImpact` returns `{ targetIds, extraImpacts }` — `extraImpacts: { presetId, targetIds, hitCount }[]` collected from `onCastResolved` so presentation can emit each (K11).

- [ ] **Step 1: failing tests** —
  ```ts
  it('guaranteedHit bypasses the hit roll', () => {
    // force rollHit to always miss via Math.random=0.999 like the existing dodge test
    const r = combat.resolveActionHit(src, tgt, {kind:'physical',multiplier:1}, { guaranteedHit:true, isPrimary:true })
    expect(r.dodged).toBe(false)
  })
  it('armorPierceFraction scales armor mitigation', () => { /* 50% pierce → damage between full-mitigated and bypass */ })
  it('instances loop N hits on primary, break on target death', () => { /* count=5, target dies at hit 2 → exactly 2 resolveActionHit calls */ })
  it('dynamicBasic.resolveBasic supplies the per-turn def', () => { /* participant.dynamicBasic returns defA then defB → two consecutive turns cast different ids */ })
  it('resetForBattle clears carried-over provider state', () => { /* resolve() advances internal state; resetForBattle() then resolve() → first def again */ })
  it('resolveManualPick validates against manualOptions ids', () => { /* unknown id → null; valid id → its def */ })
  ```

- [ ] **Step 2: run — expect FAIL** (fields don't exist).

- [ ] **Step 3: implement** — options threading (signature + call sites: charge-resolve ~1089, reaction picks ~1158, normal ~1179 — pass `{}`/existing critical); `calculateBaseDamage` 5th param `armorPierceFraction = 0` (`mitigation * (1 - clamp01(f))`); `resolveDeclaredHit` extraction from the existing `declared.scaledDamage` hit block; `instances` loop inside that path: when `action.skill.instances` and single-primary targeting, run `resolveDeclaredHit` `count` times on the primary target with `perInstanceOptions?.(i, target.entity)` merged in, break when `!target.entity.alive`; `dynamicBasic`: `selectAction` returns `{ skillId: resolved.id, skill: resolved, damage: resolved.damage, targeting: resolved.targeting, slot: null }` when `participant.dynamicBasic` present (before the basic fallback); the forced-action path resolves via `participant.dynamicBasic.resolveManualPick(forcedDefId)` (validates membership in `manualOptions`); `applyActionImpact` calls `actor.dynamicBasic?.onCastResolved?.(...)` after the normal hit loop, collects its returned impacts into `extraImpacts`, and returns `{ targetIds, extraImpacts }`; wire `resetForBattle()` at the cycle-restart point (`restartTurnBattleCycle` / participant carry-over) so carried-over providers start clean.

- [ ] **Step 4: run** `npm run type-check` + `npx vitest run src/core/battle`. All existing battle tests must stay green (options default = old behavior).

- [ ] **Step 5: commit** `feat(turn-engine): generic hit options, armor policy, multi-instance, dynamicBasic primitives`.

---

### Task 3: Orb definitions + OrbId + realm unlock table

**Files:**
- Create: `src/data/skill/KiemPhoOrbs.ts`
- Modify: `src/core/kiem-tu/KiemTuState.ts` (no-op if Task 1 already declared `OrbId` — canonical home is `KiemTuState.ts`; this file's only change is a re-export convenience if Task 1 didn't already add it)
- Test: `src/data/skill/KiemPhoOrbs.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type OrbId = 'orb_dam'|'orb_chem'|'orb_bo'|'orb_hat'|'orb_quet'
  export const KIEM_PHO_ORBS: Record<OrbId, TurnSkillDefinition>
  export const ORB_UNLOCK_REALM: Record<OrbId, number> // realmIndex
  //  orb_dam:1 orb_chem:2 orb_bo:3 orb_hat:4 orb_quet:5
  export function unlockedOrbs(realmIndex: number): OrbId[]
  ```
- Orb defs (spec §3): `orb_dam` ×1.0 physical single; `orb_chem` ×1.2 + `appliesAilments` bleed `kiem_thuong` (new physical-DoT debuff — create `src/data/buff/` entry: `dot.element:'physical'`, max 3 stacks, might-scaled); `orb_bo` ×1.8 + defense-down debuff (reuse the simplest existing defense-down buff if one exists in `data/buff`, else author `pha_giap`); `orb_hat` ×0.6 + `appliesAilments` `choang` with authored chance (~0.2, balance-tunable); `orb_quet` ×0.8 AoE targeting (per-target, not split). All `cooldownTurns:0`, no resourceType, `targetScope` default.

- [ ] **Step 1: failing test** — `unlockedOrbs(1) === ['orb_dam']`; `unlockedOrbs(5)` = all five; every orb def has `presetId` or gets one in Task 6 wiring (assert the field exists per spec §8 — add `presetId` now if the CombatVfxPresetId union has a generic sword entry; if not, add a preset entry per orb in the VFX registry — check `CombatVfxPresetId` first and note the choice).

- [ ] **Step 2: implement** — defs + table + `kiem_thuong` bleed buff (physical DoT, `maxStacks:3`).

- [ ] **Step 3: run** `npm run type-check` + `npx vitest run src/data/skill/KiemPhoOrbs`.

- [ ] **Step 4: commit** `feat(kiem-tu): five Kiem Pho orb definitions + realm unlock table`.

---

## Phase B — Hien (Kiếm Phổ)

### Task 4: `KiemPhoSystem` — preset validation, cursor, log, matcher

**Files:**
- Create: `src/core/kiem-tu/KiemPhoSystem.ts`
- Test: `src/core/kiem-tu/KiemPhoSystem.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface KiemPhoBattleState {
    preset: OrbId[]          // snapshot of PlayerData.kiemTu.preset
    cursor: number           // 0-based; each battle starts at 0
    log: OrbId[]             // <=5 entries
    comboMaxLength: 3|4|5    // from realmComboMax(realmIndex)
  }
  export function realmComboMax(realmIndex: number): 3|4|5  // <3:3, 3..5:4, >=6:5
  export function validatePreset(preset: OrbId[], realmIndex: number): boolean
  //   1..9 length, every orb in unlockedOrbs(realmIndex)
  export function initKiemPhoBattle(player: PlayerData): KiemPhoBattleState
  export function nextOrb(state: KiemPhoBattleState): OrbId        // auto cursor
  export function recordCastAndMatch(
    state: KiemPhoBattleState,
    orb: OrbId,
  ): KiemPhoCombo | null           // append → longest-first → full reset on match
  ```
- Combo/matcher semantics per spec §4.1: after append, check `len = min(5, comboMaxLength)` down to 3; first tail match wins; log clears entirely; at most one fire per cast (guaranteed by clear).

- [ ] **Step 1: failing tests** —
  ```ts
  it('matches len-3 tail and resets the log', () => { /* dam dam dam -> tam_thich, log empty */ })
  it('longest-first: a 4-tail beats a 3-tail when realmComboMax>=4', () => { /* e.g. log ends B-C-Đ-B… pick the len-4 combo */ })
  it('realm gate: len-4 combos cannot match while comboMaxLength===3', () => { /* same input at max 3 → fires the len-3 (or nothing if tail blocked) */ })
  it('log never exceeds 5 entries', () => {})
  it('validatePreset rejects empty, >9, locked orbs', () => {})
  it('cursor wraps mod preset.length', () => {})
  ```

- [ ] **Step 2: run — FAIL**; **Step 3: implement**; **Step 4: run** `npx vitest run src/core/kiem-tu`.

- [ ] **Step 5: commit** `feat(kiem-tu): KiemPhoSystem matcher core`.

---

### Task 5: Combo table — 37 patterns + suffix-free arch test + modifiers

**Files:**
- Create: `src/data/skill/KiemPhoCombos.ts`
- Modify: `src/core/kiem-tu/KiemPhoSystem.ts` (modifier pass-through in `recordCastAndMatch` — accept `modifiers: KiemPhoComboModifier[]` param, apply matched modifiers sorted `priority ASC, nodeId ASC`, each `apply` receives a cloned combo effect)
- Test: `src/data/skill/KiemPhoCombos.test.ts` (data invariants)

**Interfaces:**
- Produces (per spec §4.2):
  ```ts
  export interface KiemPhoCombo {
    id: string
    pattern: OrbId[]
    presetId: CombatVfxPresetId       // REQUIRED
    damage?: { multiplier: number }
    appliesBuff?: { definitionId: string; target: 'self'|'target' }
    targeting?: ActionTargeting
  }
  export interface KiemPhoComboModifier {
    nodeId: string
    priority: number
    matches(combo: KiemPhoCombo): boolean
    apply(combo: KiemPhoCombo): KiemPhoCombo   // returns derived copy
  }
  export const KIEM_PHO_COMBOS: KiemPhoCombo[]  // 37 entries, spec §4.3
  ```

- [ ] **Step 1: failing tests** —
  ```ts
  it('exactly 37 combos: 15 len-3, 12 len-4, 10 len-5', () => {})
  it('suffix-free: no len-3 is the last-3 of any len-4/5; no len-4 is the last-4 of any len-5', () => {
    // for each pair (shorter, longer): expect(shorter.pattern).not.toEqual(longer.pattern.slice(-shorter.length))
  })
  it('every combo has a UNIQUE presetId and unique id', () => {
    // K11: the fired payload is the ONLY discovery signal — two combos
    // sharing a presetId would be indistinguishable to the player.
    const ids = KIEM_PHO_COMBOS.map((c) => c.presetId)
    expect(new Set(ids).size).toBe(KIEM_PHO_COMBOS.length)
  })
  it('every pattern orb is a valid OrbId', () => {})
  ```

- [ ] **Step 2: run — FAIL** (table missing).

- [ ] **Step 3: author the 37 entries** verbatim from spec §4.3 — including the suffix-free-corrected len-4s (`orb_dam,orb_chem,orb_chem,orb_hat` / `orb_chem,orb_dam,orb_dam,orb_hat` / `orb_bo,orb_dam,orb_dam,orb_quet`). Effects: spec defers effect authoring to a separate pass — give every entry `damage.multiplier` scaffold values by length (len3 2.5, len4 4.0, len5 7.0 — flagged `// content-pass values, see spec §11`) plus a **unique `presetId` per combo** — K11 makes the payload the only discovery signal, so per-tier preset reuse is NOT acceptable; add one preset entry per combo id in the VFX preset union. Uniqueness of ID alone is NOT sufficient — spec K11 requires the fired payload be visibly distinct: simplest compliant impl = shared length-tier base VFX + a distinguishing element per combo (combo-name floating text on fire, or per-combo color signature). Two combos must never render identically.

- [ ] **Step 4: run** `npx vitest run src/data/skill/KiemPhoCombos` + `src/core/kiem-tu`.

- [ ] **Step 5: commit** `feat(kiem-tu): 37-combo table, suffix-free guard, modifier contract`.

---

### Task 6: Hien battle wiring — dynamicBasic provider + combo fire + manual pick

**Files:**
- Create: `src/core/kiem-tu/KiemPhoProvider.ts` (builds the `dynamicBasic` for a hien participant)
- Modify: `src/core/game/GameManagerTurnBattleOps.ts` (participant build site — pass provider when `player.cultivationPath==='kiem_tu' && player.kiemTu.mode==='hien'`; also the manual forced-pick plumbing for orb selection)
- Modify: `src/core/game/TurnBattleAdapter.ts` (remove `SPECIALS_BY_BUILD/ULTIMATES_BY_BUILD` kiem_tu entries — dead; hien has no special/ult)
- Test: `src/core/kiem-tu/KiemPhoProvider.test.ts`, `src/core/game/GameManager.kiemPho.test.ts`

**Interfaces:**
- Consumes: Task 2 `dynamicBasic`, Task 3 orbs, Task 4/5 system+table.
- Produces:
  ```ts
  export function buildKiemPhoProvider(
    player: PlayerData,
    modifiers: KiemPhoComboModifier[],   // from purchased capstones (Task 11)
  ): NonNullable<TurnBattleParticipant['dynamicBasic']>
  ```
  - `resolveBasic` → `KIEM_PHO_ORBS[nextOrb(state)]` (auto); the battle-scoped `state` lives inside the provider closure — NOT on PlayerData (cursor/log are battle runtime, spec §4.1).
  - `manualOptions` → defs of `unlockedOrbs(realmIndex)` — the 5-button picker source. Manual pick channel: the existing manual-submit pipeline (the op that feeds `selectForcedAction`) gains a direct choice `{ kind:'dynamic_basic', defId }` — the engine resolves it via `participant.dynamicBasic.resolveManualPick(defId)` in the same turn. NO GameManager pending-pick state: cursor/log/choice all stay battle-runtime inside `KiemPhoSystem` (spec K6/K7 single ownership). The pick calls `recordCastAndMatch` with the picked orb and does NOT advance the cursor.
  - `resetForBattle` → `state = initKiemPhoBattle(player)` — required because auto-repeat reuses participants (cycle-restart must not leak cursor/log).
  - `onCastResolved` → `recordCastAndMatch(state, ctx.resolvedSkillId as OrbId)`; on a matched combo, apply matched `modifiers` (sorted priority/nodeId, derived copies), resolve `combo.damage` via `ctx.resolveHit` per `combo.targeting ?? same-target`, apply `combo.appliesBuff` via `ctx.resolveBuff`, and return `[{ presetId: combo.presetId, targetIds, hitCount }]` so `applyActionImpact` can surface it in `extraImpacts` for presentation (Task 2 contract — the only discovery signal, K11).

- [ ] **Step 1: failing test** — headless battle: hien participant casts preset orbs in order; preset `['orb_dam','orb_dam','orb_dam']` fires `tam_thich` on the 3rd cast (assert extra damage hit lands + log resets); manual forced orb pick does not advance the cursor.

- [ ] **Step 2: run — FAIL**; **Step 3: implement** provider + adapter/ops wiring.

- [ ] **Step 4: run** `npm run type-check` + `npx vitest run src/core/kiem-tu src/core/game/GameManager.kiemPho`.

- [ ] **Step 5: commit** `feat(kiem-tu): hien dynamic-basic wiring, combo fire through engine`.

---

### Task 7: Preset op + HUD surfaces (hien)

**Files:**
- Modify: `src/core/game/GameManagerProgressionOps.ts` (or the ops file owning player mutations — `setKiemPhoPreset(preset: OrbId[]): boolean` calls `validatePreset` against CURRENT realm; out-of-combat only — reject while a battle is active; writes `player.kiemTu.preset`)
- Modify: `src/presentation/bridges/kiemBarBridge.ts` → rewrite HIEN branch only: next-orb indicator + preset strip model. The Ngu branch (`kiemY / forgeCost(realmIndex)` progress + cascade status) lands in Task 8 — `forgeCost` doesn't exist yet and every task must compile at its boundary.
- Modify: combat HUD component owning the 3-slot skill bar (find via `git grep -l "special" src/presentation` — the orb picker replaces it for hien manual mode: 5 orb buttons fed by `manualOptions`)
- Test: `src/core/game/GameManager.kiemPhoPreset.test.ts`, update `src/presentation/bridges/kiemBarBridge.test.ts`

- [ ] **Step 1: failing test** — `setKiemPhoPreset` accepts `['orb_dam','orb_chem']` at realm≥2, rejects `['orb_chem']` at realm 1, rejects `[]`/`length>9`, rejects while a battle is running.

- [ ] **Step 2: run — FAIL**; **Step 3: implement** op + bridge rewrite + picker.

- [ ] **Step 4: run** `npm run type-check` + scoped vitest.

- [ ] **Step 5: P14 note** — preset editor + picker are visual; run the P14 Playwright check now if the harness allows, else flag `DONE_WITH_CONCERNS` for the finishing pass (per P14 worktree exception).

- [ ] **Step 6: commit** `feat(kiem-tu): preset op, hien HUD (preset strip, manual orb picker), bridge rewrite`.

---

## Phase C — Ngu (Ngự Kiếm Đạo)

### Task 8: `NguKiemDao` economy — Ý gain, forgeCost, cap, merge

**Files:**
- Create: `src/core/kiem-tu/NguKiemDao.ts`
- Modify: `src/core/game/GameManagerRealmAdvanceOps.ts` (merge hook at realm advance — mode==='ngu' → snapshot/merge/reset, exactly once)
- Modify: `src/presentation/bridges/kiemBarBridge.ts` (NGU branch lands here — `kiemY / forgeCost(realmIndex)` progress + `kiemDaoCount` display, read via live PlayerData query)
- NOT `GameManagerTurnBattleOps.onSkillCast` — the cast→gain hook does NOT belong in the generic cast sink (that would be `if skillId==='ngu_kiem_thuat'` in engine code, violating this plan's own Global Constraints). The +1 Ý gain fires inside `NguKiemDaoProvider.onCastResolved` — the domain owner — wired in Task 9.
- Modify: `src/core/game/GameManagerRealmAdvanceOps.ts` (realm-advance success path — `if (player.kiemTu.mode==='ngu') applyBreakthroughMerge(player.kiemTu)` exactly once, after the realm id changes)
- Test: `src/core/kiem-tu/NguKiemDao.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const KIEM_DAO_MERGE_BONUS = 0.3
  export function kiemDaoCap(realmIndex: number): number   // assert>=1; realmIndex+1
  export function forgeCost(realmIndex: number): number    // assert>=1; ceil(9999*1.3^(r-1))
  export function gainKiemY(player: PlayerData, amount: number): void
  //   no-op when kiemDaoCount >= cap; else kiemY += amount then
  //   while (kiemY >= forgeCost && count < cap): kiemY -= forgeCost; count++
  export function applyBreakthroughMerge(state: KiemTuState): void
  //   const mergedCount = state.kiemDaoCount
  //   state.kiemDaoBase *= 1 + KIEM_DAO_MERGE_BONUS * mergedCount
  //   state.kiemDaoCount = 1            // kiemY untouched
  ```

- [ ] **Step 1: failing tests** —
  ```ts
  it('gain is a no-op at cap', () => {})
  it('converts exactly at forgeCost, keeps remainder', () => { /* LK: +9999 -> count 2 (cap), y=0; next +1 no-op */ })
  it('forgeCost: LK 9999, TC 12999, DK ~81565; assert(realmIndex>=1) throws at 0', () => {})
  it('merge snapshots count before reset: count 3/base 1 -> base 1.9, count 1; kiemY untouched', () => {})
  it('realm advance applies merge exactly once for ngu, never for hien', () => {})
  ```

- [ ] **Step 2: run — FAIL**; **Step 3: implement** functions + merge hook at realm advance + the ngu bridge branch. (The cast→gain call is Task 9's provider — `onCastResolved` fires once per resolved cast.)

- [ ] **Step 4: run** `npm run type-check` + `npx vitest run src/core/kiem-tu src/core/game/GameManagerRealmAdvanceOps`.

- [ ] **Step 5: commit** `feat(kiem-tu): NguKiemDao economy — gain/cap/convert/merge`.

---

### Task 9: `ngu_kiem_thuat` + Roll Cascade + emblem markers

**Files:**
- Create: `src/data/skill/NguKiemDaoSkills.ts` (`ngu_kiem_thuat` active def + `tu_kiem_y`/`kiem_dao_cascade` passive-emblem defs — `targetScope:'self'`, `cooldownTurns:0`, marker-only)
- Create: `src/core/kiem-tu/NguKiemDaoProvider.ts` (builds `dynamicBasic` for ngu — reuses the Task-2 primitive: `resolveBasic` returns a fresh def `{...NGU_KIEM_THUAT, damage:{kind:'physical',multiplier:kiemDaoBase}, instances:{count:kiemDaoCount, perInstanceOptions}}`)
- Modify: `src/core/battle/turn/TurnSkillAction.ts` (`selectAction`/`selectForcedAction` treat emblem defs as absent — add a marker field `emblemOnly?: boolean` on TurnSkillDefinition; slots containing one are skipped by selection, so the basic always resolves)
- Modify: `src/core/game/GameManagerTurnBattleOps.ts` (participant build — when `player.kiemTu.mode==='ngu'`, attach `participant.special = {skill: TU_KIEM_Y_EMBLEM}` and `participant.ultimate = {skill: KIEM_DAO_CASCADE_EMBLEM}` so the spec's 2 emblem lanes exist on the bar; hien participants get neither. Emblem defs live-read `player.kiemTu` via a small display query — they render, never resolve)
- Test: `src/core/kiem-tu/NguKiemDaoProvider.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface KiemDaoCascadeUnlocks { a: boolean; e: boolean; d: boolean }
  export function buildNguKiemDaoProvider(
    player: PlayerData,                      // live-read: mid-battle forge works
    unlocks: KiemDaoCascadeUnlocks,          // from purchased nodes (Task 11)
    rng: () => number = Math.random,         // injected — replay determinism + tests
  ): NonNullable<TurnBattleParticipant['dynamicBasic']>
  ```
  - `perInstanceOptions(index, target)` implements spec §5.2 verbatim:
    `guaranteedHit:true` always; Roll 1 (`a` unlocked): `target.currentHp / target.maxHp < min(0.5, 0.1*realmIndex)` → `damageScale: EXECUTE_MULT`; Roll 2 (`e` unlocked): `rng() < CASCADE_CRIT_CHANCE` → `critical:true`; Roll 3 (`d` unlocked): `rng() < CASCADE_PIERCE_CHANCE` → `armorBypass:true`, else `armorPierceFraction: PIERCE_FRACTION`. Constants live in `NguKiemDao.ts` (`EXECUTE_MULT=10`, `CASCADE_CRIT_CHANCE=0.25`, `CASCADE_PIERCE_CHANCE=0.5`, `PIERCE_FRACTION=0.6` — first-pass tunables, spec §11). hp% reads LIVE `currentHp/maxHp` per instance (spec §5.2 — earlier swords dig the target below threshold for later ones). All cascade rolls go through `rng`, never bare `Math.random`.
  - `manualOptions` → `[ngu_kiem_thuat def]` only; `resetForBattle` → no-op (ngu has no battle-scoped cursor/log — count/base are live PlayerData reads).
  - `onCastResolved` → `gainKiemY(player, 1)` — the +1 Ý per-cast gain lives HERE (domain owner), not in the generic `onSkillCast` sink. Fires once per resolved cast; the gain gate inside `gainKiemY` decides acceptance.

- [ ] **Step 1: failing tests** —
  ```ts
  it('casts N hits = kiemDaoCount on the primary target; break on mid-cast kill', () => {})
  it('every instance carries guaranteedHit (0 evasion cases still land)', () => {})
  it('locked a/e/d → no rolls: normal armor, pipeline crit only', () => {})
  it('unlocked e forces crit on success; locked e never force-crits', () => {})
  it('unlocked d: success bypasses armor fully, fail pierces PIERCE_FRACTION', () => {})
  it('emblem slots are never selected as actions', () => {})
  it('ngu participant carries tu_kiem_y + kiem_dao_cascade emblems on special/ultimate slots', () => {})
  ```

- [ ] **Step 2: run — FAIL**; **Step 3: implement** defs + provider + `emblemOnly` skip.

- [ ] **Step 4: run** `npm run type-check` + `npx vitest run src/core/kiem-tu src/core/battle`.

- [ ] **Step 5: commit** `feat(kiem-tu): ngu_kiem_thuat multi-instance + Roll Cascade`.

---

### Task 10: `kiem_tu_an` hidden node — reveal gate + one-way mode flip

**Files:**
- Modify: `src/data/progression/KiemTuNodes.ts` — the file EXISTS with the full legacy Kiếm Trận/Bát Kiếm tree: append `kiem_tu_an` to `KIEM_TU_NODES` alongside legacy nodes (they stay until Task 11/12). NOT a create, NOT a rewrite — compile must survive every task boundary.
- Modify: `src/core/progression/ProgressionNode.ts` — add `revealWhen?: NodePrerequisite` (display-only gate) + `NodeEffect.kiemTuModeSwitch?: 'ngu'`
- Modify: `src/core/progression/NodeSystem.ts` — `canPurchaseNode` already evaluates prerequisites; the reveal gate is consumed by views only, and purchase must ALSO re-check `revealWhen` (a hidden node is never purchasable before reveal — fold it into `canPurchaseNode` as an additional prereq evaluation)
- Modify: `src/core/progression/NodeBranchViews.ts` + `src/components/...NodeTreePanel` — node hidden until `revealWhen` holds (evaluate the prereq against player)
- Modify: `src/core/game/GameManagerProgressionOps.ts` (`purchaseNode` — on success, if `node.effect.kiemTuModeSwitch === 'ngu'`: set `player.kiemTu.mode='ngu'` + learn AND equip the repurposed `van_kiem_quyet` technique (Task 12 rewrites its content; this task wires the swap — the kit currently equips `ngu_kiem`, so conversion replaces it in the technique slot). HARD gate inside `canPurchaseNode`: `cultivationPath==='kiem_tu' && kiemTu.mode==='hien'` AND no battle active — a mid-combat flip would desync the live participant/provider from PlayerData. Mode-switch nodes are non-refundable and excluded from any dev branch-reset (check the reset op and skip `kiemTuModeSwitch` nodes))
- Test: `src/core/game/GameManager.kiemTuAn.test.ts`

- [ ] **Step 1: failing tests** —
  ```ts
  it('kiem_tu_an invisible + unpurchasable while tram < Lv3', () => {})
  it('visible at tram Lv3 (skillCastCount prereq), purchase flips mode to ngu + learns van_kiem_quyet', () => {})
  it('second purchase impossible; ngu player cannot repurchase', () => {})
  it('purchase rejected while a battle is active (participant desync guard)', () => {})
  it('dev branch-reset does not clear/refund the mode switch', () => {})
  // NOTE: "hien orb nodes grant nothing while mode===ngu" lives in
  // Task 11 — the orb nodes only exist once the tree is authored there.
  // It also stays in the Task-13 invariant suite.
  ```

- [ ] **Step 2: run — FAIL**; **Step 3: implement** — node entry: `{ id:'kiem_tu_an', branchTag:'ngu_kiem', revealWhen:{kind:'skillCastCount',skillId:'tram',level:3}, prerequisites:[{kind:'skillCastCount',skillId:'tram',level:3}], effect:{ kiemTuModeSwitch:'ngu' } }` (authored in the new `KiemTuNodes.ts` this task creates); description carries the permanent/no-refund warning (i18n key). Hien-branch aggregation filters on `mode` — nodes get `kiemTuMode?: 'hien'|'ngu'` field (parallel to phap tu `routeTag`): aggregators skip non-matching nodes.

- [ ] **Step 4: run** `npm run type-check` + scoped vitest.

- [ ] **Step 5: commit** `feat(kiem-tu): kiem_tu_an hidden node + one-way ngu conversion`.

---

### Task 11: Node tree — orb branches + Ngu branch + Cửu Cung

**Files:**
- Rewrite: `src/data/progression/KiemTuNodes.ts` (replace the legacy tree contents with the new hien/ngu tree; keep the file/registration name so `App.vue` registration stays put. **Compile continuity**: `KiemTranSkills.ts` still imports `TRAN_SEQUENCE` from this file and isn't retired until Task 12 — keep a compatibility `TRAN_SEQUENCE` export (or move that single export to its own module) until Task 12 kills producer + consumer together)
- Modify: `src/core/progression/ProgressionNode.ts` — `NodeEffect` additions: `kiemYGrant?: number` (Cửu Cung), `cascadeUnlock?: 'a'|'e'|'d'`, `kiemTuComboModifier?: { minOrbCount: { orb: OrbId; count: number }; bonusDamageMultiplier?: number; bonusAilmentStacks?: number }` (data form; `KiemPhoProvider` converts purchased ones into `KiemPhoComboModifier`s at battle build — priority = authored field, default 0)
- Test: `src/data/progression/KiemTuNodes.test.ts` (rewrite — tree shape, gates, no retired ids, suffix/table consistency)

**Content:**
- Hien branch `kiem_pho`: per-orb growth nodes (~5 each, realm-gated by their orb's unlock realm — `kind:'realm'` prereq) + 1 capstone each authored as `kiemTuComboModifier`.
- Ngu branch `ngu_kiem` (all prereq `kiem_tu_an`, `kiemTuMode:'ngu'`): cascade unlock nodes — `a` @ realm foundation_establishment, `e` @ golden_core, `d` @ nascent_soul (`kind:'realm'` prereqs); per-instance growth nodes; Cửu Cung cluster — 8 outer `kiemYGrant` nodes (insight cost, realm-gated) + `trung_cung` granting +1 `kiemDaoCount` via a new effect field `kiemDaoGrant?: number` with prereq `kind:'nodeCount'` on the 8 outer ids (countRequired:8). **Cap guard is PREFLIGHT**: `purchaseNodeSystem` deducts insight + records the node BEFORE effects apply, so the check cannot live post-purchase — add prereq kind `{kind:'kiemDaoBelowCap'}` evaluated in `NodeSystem.canPurchaseNode` (reads `player.kiemTu` + realmIndex; fails before any deduction). All 9 Cửu Cung nodes carry it — outer Ý-nodes are also unpurchasable at cap (Ý can't be received there, spec K20).

- [ ] **Step 1: failing tests** — tree shape asserts (branch tags, prereq kinds, Cửu Cung nodeCount gate); `kiemYGrant` purchase adds Ý through `gainKiemY` (cap-respecting); `trung_cung` blocked at cap (preflight — insight not deducted); `hien orb nodes grant nothing while mode==='ngu'` (query-time mode filter — moved here from Task 10 since the nodes are authored in this task); no node references a retired id.

- [ ] **Step 2: run — FAIL**; **Step 3: implement** tree + effect fields + purchase wiring (`kiemYGrant`/`kiemDaoGrant` apply through `NguKiemDao` functions — nodes never touch `player.kiemTu` directly).

- [ ] **Step 4: run** `npm run type-check` + `npx vitest run src/data/progression src/core/progression`.

- [ ] **Step 5: commit** `feat(kiem-tu): reimagined node tree — orb branches, ngu branch, Cuu Cung`.

---

## Phase D — Teardown + Hardening

### Task 12: Kill-list teardown (dependency order per spec §7)

**Files:** all touched by removal — follow the spec §7 order exactly:

```text
producers (skill/node defs + grants writing sword-intent / the / old ids)
→ scaling definitions (swordIntentDamageRatio on skill data)
→ DamageCalculator consumer (the ratio read + field on DamageScalingConfig)
→ CombatEntity fields (currentSwordIntent/currentKiemThe/currentKiemYTemp)
→ enums/converters/fixtures (SkillResourceType 'sword_intent',
  RESOURCE_FIELD entry, usesSwordIntentResource, resourceLabel)
→ dead-id sweep
```

**Plus:** `KiemTuResourceSystem.ts`, `KiemYSystem.ts`, `BatKiemThuat.ts`, `KiemTranSkills.ts`, `TRAN_SEQUENCE`, `kiem_khai_thien_mon`, `KIEM_TRAN_SLOT_INDEX`, ghost unequip ids, `KiemTuCombatHud` slider + manual ult button, `onHitEffect` machinery (`OnHitEffectKind`, the 9 on-hit nodes), SwordZone (`grantsSwordZone`, `SwordZone.ts`), `bat_kiem_an` node, `initKiemTuBattleResources`, old `GameManagerTurnBattleOps`/`PlayerHudLayer.updateKiem` read paths (Task 7 already rewrote the bridge — delete leftover old-field readers), `CultivationPathKit` kiem_tu 3-skill tuple.

- [ ] **Step 1:** for EACH spec §7 row: `grep` the id; retire if present; record surviving-consumer links before deleting (skip rows already gone — no-op is fine).

- [ ] **Step 2:** `npm run type-check` after each removal cluster (producers → calculator → entity → enums) — fix only task-caused fallout; pre-existing failures get noted, not silently "fixed".

- [ ] **Step 3:** repurpose `van_kiem_quyet` as the Ngu technique (spec §7 kept-list) — rename/re-scope its description to the phi-kiếm path; exact tier effects are content-pass (keep existing numbers, adjust copy). **Also gate its legacy loot sources**: today it drops from Elite/Boss pools — Task 10 learn+equips it on conversion, so remove or `mode==='ngu'`-gate every old drop source, or non-Ngu players can loot the signature technique.

- [ ] **Step 4:** dead-id sweep test — assert no retired id appears in data/registries (script: grep the kill-list ids across `src/data`, `src/services/save` seeds, i18n).

- [ ] **Step 5: commit** `refactor(kiem-tu): retire legacy sword-intent/kiem-tran/bat-kiem machinery`.

---

### Task 13: Invariant suite + full verification

**Files:**
- Create: `src/core/kiem-tu/invariants.test.ts` (or fold into the per-system test files — one file per INV group is fine)

**Cover spec §10 verbatim:**
1. mode single-owner (hien code paths never read `kiemY`/`kiemDao*`; ngu never reads `preset` — assert via provider construction: hien provider closes over no Ý state).
2. preset shape + cursor bounds.
3. combo determinism (one fire/cast, no chaining, log ≤5).
4. suffix-free data test (Task 5 — assert here too).
5. additive resolution (completing orb's own hit still lands — assert both damages recorded on a combo turn).
6. realm gating (len/orb).
7. hardcore discovery (every combo has a UNIQUE `presetId`; no UI exports a combo list — grep-guard: no `KIEM_PHO_COMBOS` import inside `src/presentation`/`src/components`).
8. ngu gate (reveal/purchase/irreversible/mode filter — Task 10 tests).
9. cascade bounds (guaranteedHit unconditional; rolls only when unlocked; execute is damage-scale — survives SurviveLethalGuard path; break-on-death consumes no RNG — assert RNG call count equals live instances).
10. economy (gain gate at cap, conversion only in gain hook, merge exactly-once + snapshot + kiemY untouched).
11. base monotonic (`kiemDaoBase` never decreases across merges; count ≥1 while ngu).
12. no dead ids in fresh-save content (Task 12 sweep).
13. manual/auto parity (same orb via both modes → identical resolution).
14. `the` isolation (kiem_tu casts never touch `currentThe`; grep `currentThe` in `src/core/kiem-tu` = 0).
15. precursor lock (K3): once `cultivationPath` is chosen, `tram`/`linh_bao`/`huy_quyen` are uncastable/unequippable — table-driven over the full precursor set (guard landed in Task 1 Step 7).

- [ ] **Step 1:** write the invariant tests; **Step 2:** run — green (they codify Tasks 1–12).

- [ ] **Step 3: full verify (P3 full mode):** `npm run type-check` + `npm run build` + `npx vitest run` (whole suite). Stop on first failure, fix, rerun.

- [ ] **Step 4:** `tutienidle-adversarial-qa` quick pass (P4) + `code-review` (P5). Resolve ≥80-confidence findings.

- [ ] **Step 5:** P13/P14 — drive a real battle in the dev server: hien preset cycling + a combo fire + ngu cast with N swords + merge at breakthrough. Worktree browser limits apply — defer to main-checkout check during branch finishing if launch is unreliable; state which was done.

- [ ] **Step 6: commit** `test(kiem-tu): invariant suite + full verification evidence`.

---

## Explicit non-goals

- 37 combo effect authoring (separate design pass — spec §11; this plan ships scaffold multipliers + required presetIds only).
- Orb sub-node / Cửu Cung final numbers (content pass).
- `kiemBarBridge` visual polish beyond the model rewrite.
- Save migration (K19 — none).
- Pháp Tu spec P11 erratum edit (noted in spec §11 — a docs touch-up, not this plan's scope).

---

## G0 Task Card (architecture-worker workflow)

```text
Task / user request: implement Kiếm Tu Reimagined per spec 2026-09-15 (this plan)
Assigned worktree / branch: E:\tutienidle\.agent-worktrees\kiem-tu-reimagined / feat/kiem-tu-reimagined
Requested observable behavior: kiem_tu players get Kiếm Phổ preset-combo combat (hien) and a
  one-way Ngự Kiếm Đạo hidden path (ngu) with per-instance cascade + forge economy;
  legacy sword-intent/kiếm-trận machinery retired.
Single responsibility / invariant: kiem-tu path state+combat+progression contract —
  mode is the single discriminator; hien never reads kiemY/kiemDao*, ngu never reads preset.
Current owner: scattered legacy (KiemTuResourceSystem, KiemYSystem, KiemTranSkills,
  swordIntentDamageRatio in DamageCalculator, CombatEntity.currentSwordIntent...)
Target owner: src/core/kiem-tu/{KiemTuState,KiemPhoSystem,NguKiemDao} + generic engine
  primitives in TurnBattleSystem/CombatSystem/DamageCalculator.
Existing primitives to reuse: TurnSkillDefinition/dynamicBasic channel, HitResolveOptions,
  resolveActionHit landed-hit chain (extracted as resolveDeclaredHit), NodePrerequisite
  evaluators, ProgressionNode effect fields, save-version bump convention.
Missing capability: guaranteedHit, per-impact armor policy, multi-instance skills,
  dynamicBasic provider contract, revealWhen node gate, kiemDaoBelowCap prereq.
Production chain: chooseCultivationPath -> player.kiemTu -> GameManagerTurnBattleOps
  participant build -> dynamicBasic provider -> TurnBattleSystem declare/impact ->
  CombatSystem/DamageCalculator; purchaseNode -> NodeSystem.canPurchaseNode ->
  GameManagerProgressionOps post-purchase dispatch.
State: player.kiemTu persisted (save v62); KiemPhoBattleState is provider-closure
  battle-scoped (resetForBattle at cycle restart); kiemY/kiemDao* written only by
  NguKiemDao ops + realm-advance merge.
Expected files: per plan Tasks 1-13 file lists — each owns rule, calls owner,
  persists state, or tests invariant.
Explicit non-goals: 37 combo effect authoring (separate pass), phap/the tu skill
  content, save migration (K19), final balance pass.
Roadmap phase: post-R14 stable architecture; combat contract R1-R6 maintained —
  this work adds primitives + one domain path, does not change the contract.
Tests/gates: per-task vitest + type-check; Task 13 full P3 + P4 + P5; P14 deferred
  under worktree exception.
Stop condition: 15 invariants green + legacy teardown verified + full suite green.
Unresolved assumptions: none — spec v-final after 5 review rounds.
```

### Q1-Q12 evidence (filled at kickoff; G5 re-verifies)

| Q | Answer — evidence |
|---|---|
| Q1 | Cast preset orbs -> tail-match fires combo payload (extraImpacts); ngu cast = N guaranteed hits w/ per-instance execute/crit/pierce rolls; forge at forgeCost; merge on breakthrough exactly once. Failure: preset rejected out-of-realm; purchase rejected at cap/mid-combat. |
| Q2 | KiemPhoSystem owns cursor/log/match; NguKiemDao owns economy+cascade; TurnBattleSystem owns hit pipeline; DamageCalculator owns mitigation. |
| Q3 | kiemTu: PlayerData write (chooseCultivationPath/purchaseNode/gainKiemY/merge), save v62 persist. Cursor/log: provider closure, resetForBattle. |
| Q4 | participant build in GameManagerTurnBattleOps -> provider -> selectAction/applyActionImpact; purchaseNode facade -> canPurchaseNode -> purchaseNodeSystem. |
| Q5 | Reuse: HitResolveOptions, ActionDamageInfo, TurnSkillDefinition, NodePrerequisite kinds, emblemOnly slot pattern (phap tu emblems). |
| Q6 | New files under src/core/kiem-tu (domain) + src/data/skill|progression (content); no presentation imports. |
| Q7 | extraImpacts carry presetId -> presentation emits; domain resolves outcomes before any playback. |
| Q8 | resolveActionHit options are additive-optional; existing call sites pass {} -> identical behavior. |
| Q9 | manualOptions is a read; resolveManualPick is the command path. No query mutates state. |
| Q10 | Duplicate purchase blocked by owned-check + mode gate + cap preflight; mid-combat flip blocked; break-on-death consumes no RNG for dead instances. |
| Q11 | Legacy paths retired in Task 12 dependency order; TRAN_SEQUENCE compat export retained until consumer dies. |
| Q12 | Each task has failing-test-first + scoped verify; Task 13 invariant suite maps spec SS10 1:1 + INV-15 precursor lock. |
