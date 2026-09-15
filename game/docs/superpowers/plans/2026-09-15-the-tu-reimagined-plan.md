# Thể Tu Reimagined Implementation Plan

**Plan Version:** 2.4 (revised after review — all P0 findings addressed)
**Date:** 2026-09-15
**Status:** Draft (pending user approval)
**Branch/Worktree:** `.agent-worktrees/the-tu-reimagined` (new worktree required — P2 multi-file)
**Primary Spec:** `game/docs/superpowers/specs/2026-09-15-the-tu-reimagined-design.md` (decisions T1–T14, defaults D1–D11, invariants INV-1..15)
**Sibling Specs (conventions only):** `2026-09-14-phap-tu-reimagined-design.md` (APPROVED), `2026-09-15-kiem-tu-reimagined-design.md`

---

## Purpose

Make `the_tu` (Hiện) and `the_tu_an` (Ẩn) playable end-to-end per the approved spec:

- Hiện: two mutually exclusive roots — **Cuồng Chiến** (missing-HP berserker, Bất Tử/Bá Thể) XOR **Trấn Thể** (MaxHP tank, Taunt, Reflection, team ward).
- Ẩn: one reactive kit — **Hộ** (intercept), **Phản** (counter), **Trợ** (follow-up) — fueled by the proc-fuel Thế economy.
- Core rule: **stats decide whether a reactive action can happen; nodes decide what happens on success** (spec §1.3-equivalent governing principle, INV-5/13).

Everything flows from the spec's decision tables; this plan does not re-litigate them. Review-fix changelog is summarized in the appendix.

---

## Prerequisites (read before executing)

- Spec file above — all T#/D#/INV-# references in this plan point at it.
- `game/docs/roadmap.md` — combat-chain phases (R1–R14 contract, P17) and §0.11-B6 hidden-path convention note.
- `game/docs/architecture/architecture-worker-workflow.md` — complete G0/G1 before production edits; carry Q1–Q12 evidence.
- `game/AGENTS.md` + `game/CLAUDE.md` — P1–P17, A1–A12, execution policy.
- Skills at execution: `using-git-worktrees`, `test-driven-development` (every task), `executing-plans`/`subagent-driven-development` per P6. After: `tutienidle-adversarial-qa` (P4 quick), `balance-check`, `code-review` (P5), `verification-before-completion`.

---

## Environment & multi-agent notes (P6) — READ CAREFULLY

- **Sibling worktrees are actively rewriting the seams this plan touches.** Verified drift as of this revision:
  - **phap-tu worktree**: `huy_quyen` + `linh_bao` already authored in `CoreSkills.ts`; `CAST_LEVELING_THRESHOLDS` table already generalizes cast-leveling (`tram`/`linh_bao`/`huy_quyen`); Thế gain is **field-driven** (`theGainOnLandedCast`/`theGainOnCrit` on `TurnSkillDefinition`, not slot-driven +10/+20); `CombatEntity` slimmed (per-element pools, `skillStats`, `timeSinceLastBleedProc` removed — `currentMomentum` still present); `SkillModifier`/`skillModifiers`/`aggregateNodeSkillModifiers`/`getSkillRuntimeStats` removed; `entity.maxThe ?? MAX_THE` cap-read exists.
  - **kiem-tu worktree**: `emblemOnly` field on `TurnSkillDefinition` (emblem slots render but `selectAction`/`selectForcedAction` skip them); `dynamicBasic` provider pattern; `kiemTu.mode` hien/ngu.
- **Conditional rules:** where this plan says "author X", first check whether the sibling merge already landed it (`huy_quyen`, `CAST_LEVELING_THRESHOLDS`, `emblemOnly`, field-driven Thế). If merged, the corresponding step becomes wiring/verification only.
- `git status` before editing. Overlap on `core/battle/turn/**`, `core/combat/CombatSystem.ts`, `core/stats/**`, `core/player/**`, `data/**` → stop and notify the user.
- Re-read every anchored line before editing; line numbers below are main-worktree anchors as of this revision, not frozen truth.

---

## Verified engine anchors (main worktree)

| Seam | File / anchor |
|---|---|
| Path registry | `core/player/CultivationPathKit.ts` — `CultivationPathId`, `CULTIVATION_PATH_KITS` |
| Ritual | `core/game/GameManagerRealmAdvanceOps.ts` `chooseCultivationPath()` — gate + learn + equip technique + `unequip('tram')` (~177-187) |
| Offer UI | `components/panels/QuanKhiPanel.vue` — lists `Object.values(CULTIVATION_PATH_KITS)` (~39) |
| Domains | `core/stats/StatDomain.ts` — `StatDomain` union (~19), `STAT_DOMAIN` map (~36), `DOMAIN_SOURCE_WHITELIST` (~62), `CULTIVATION_PATH_STAT_DOMAINS` (~109) |
| Stat pipeline | `core/stats/StatCalculator.ts` — `deriveAttributeModifiers` universal pass (`vitality→enduranceThreshold` ~181-186), `resolveAttributeTotals` (~312), `registerDomainDeltaDeriver` (~352), `EffectiveStatContext.activeDomains` (~338) |
| Assembly emitter pattern | `core/player/CultivationPathSystem.ts` — `getPhapTuAttunementStatModifiers` (~44) + `registerDomainDeltaDeriver('phap_tu')` (~60); call site `Player.ts` `resolvePlayerFinalStats` (~441, emission ~470) |
| Cast leveling | `core/skill/SkillSystem.ts` — `getHuyKiemLevelForCasts` (~32), `HUY_KIEM_L3_CASTS=10000`, `recordCast` hardcodes `'tram'` (~351) |
| Kit resolution | `GameManager.ts` `resolvePlayerBasicAttack`/`resolvePlayerSpecialUltimate`; `data/skill/TurnBasicAttacks.ts` `BASIC_ATTACKS_BY_BUILD['the_tu'] → GENERIC_PHYSICAL_BASIC` (~51) |
| Auto-cast | `TurnSkillAction.ts` `selectAction` — ult→special→basic priority, ult fires when off-CD (T11 accepts this) |
| Reactive triggers | `BuffTypes.ts` `ReactiveTriggerEffect` (~49-55): `trigger: 'onCastBegin'\|'onImpactLanded'`, `chance`, `appliesDefinitionId`, `queuesFollowUp`; `BuffSystem.rollReactiveTrigger`; call sites TurnBattleSystem ~761 / ~1240 |
| Follow-up queue | `queuedFollowUpActorIds: string[]` on participant + battle; `followUpChainDepth`, `MAX_FOLLOW_UP_CHAIN_DEPTH=4` (~226); `pendingFollowUpBypassActorId` → `isFollowUpBypass` |
| Declare→impact | `declareActorAction` (~681): `selectAction` → `specialAttacks` everyNth swap (~954-969) → `selectTarget(actor, opposingSide)` (~195, ~988 callsite) → `collectTurnTargets` → `affected`. `applyActionImpact` resolves hits; `!hitResult.dodged` gates reactive triggers (~1183/1240) |
| Targeting shapes | `core/battle/CombatAction.ts` — `'single'\|'square'\|'cross'\|'line'\|'row'\|'column'\|'all_lanes'` (AoE basic = `all_lanes`) |
| CC | `resolveActorTurn` ~767-800 — `consecutiveHardCcTurns`, `baTheTriggeredAtTurn`, `clearCcEffects`, `isStunned/isFrozen` via BuffSystem |
| Survive-lethal | `CombatSystem.killIfDead` (~569): `surviveLethalSession {playerEntityId, guard: SurviveLethalGuard, surviveEffects {buffSystem, registry, grantBuffId, cleanseDebuffs}}` — **applies `grantBuffId` on EVERY save (~605-613)**; `core/talent/SurviveLethalGuard.ts`; wiring `GameManagerTurnBattleOps` ~899 |
| Ward | `CombatEntity.currentWard` + `stats.wardMax`; authority `EntityVitalsSystem.spendWard` (CombatSystem delegates ~156); absorb at ~376 (`wardAbsorbed = min(currentWard, finalDamage)`); regen clamps `min(wardMax, …)` (~168) gated by `turnsSinceLastHitLanded`/`WARD_REGEN_DELAY_TURNS=3` |
| Buffs | `Buff {id, sourceId, targetId, stackMode...}` — instances keyed `(id, sourceId)` (`getFromSource`, `removeInstance`); `BuffStackMode='stack'\|'refresh'\|'replace'` is per-source |
| Resources | `CombatTypes.ts` `MAX_THE=100`; `CombatEntity.currentThe`; slot-driven `THE_GAIN_PER_LINK/FINISHER` (~1252-1267, fires for ALL participants — must scope or defer to phap field-driven merge) |
| Retire | `currentMomentum` (CombatEntity + ~60 fixtures), `momentum` in `SkillActionRegistry` RESOURCE map + `resourceType:'momentum'`; `thornsPercent` (StatTypes/StatBlock/affixes/CombatSystem ~448) |
| Techniques | `data/technique/Techniques.ts` — `kim_cang_bat_hoai_the` EXISTS (~150); `ung_the_than_quyet` is new |
| Save | `services/save/saveVersion.ts` `CURRENT_SAVE_VERSION = 61` → 62 |
| Stats naming | real names: `evasionRate` (NOT `evasionRating`), `blockChance`, `blockEffectiveness`, `enduranceThreshold`, `endurancePercent`, `thornsPercent`, `wardMax` |

---

## Scope

**In scope (spec §11/T14):** path ids + kits + ritual offers (incl. `huy_quyen` Lv3 gate), cast-leveling generalization, stat domains + two-channel derived stats, **four-stat the_tu domain migration** (block/endurance family), both kits, both trees (mortal→Trúc Cơ), Thế proc-fuel economy, Taunt, Hộ, Phản, Trợ, Reflection, Bất Tử passive+manual, Bá Thể unification, momentum + `thornsPercent` retirement, generic-Thế scoping, UI seams, save bump, headless tests, adversarial QA + balance check.

**Out of scope (spec §11):** artifact grants, companion path content, AoE interception, realms beyond Trúc Cơ, `kim_cang_bat_hoai_the` technique-effects authoring beyond what the kit needs, Kiếm Tu spec amendment (roadmap B6 — separate doc task), sibling-worktree changes.

---

## Constraints & assumptions

- **A8:** no path-id/skill-id `if` chains in generic engine code. Path behavior enters via `activeDomains`, marker buffs, and declarative effect fields.
- **A9:** chance formulas live ONLY in the the_tu_an emitter+deriver pair; missing-HP scalar lives ONLY in the damage-field resolution; ward authority lives in the vitals layer. No duplicate formulas in UI/preview/tests.
- **D1:** durations = holder's own turns. Taunt duration = the **taunted enemy's** turns (INV-11).
- **No PlayerData fields added** (path lives in `cultivationPath`; gate reads `skillLevels`; tree reads `ownedNodeIds`). Save v62 bump per spec §2.5 — no migration (dev phase).
- Kit skills are **native `TurnSkillDefinition`s** (BatKiemThuat precedent). Only `huy_quyen` is a `Skill` (mortal loadout + cast-counted).
- **Node→kit modulation** (missing-HP bonus, reflect ratios, ward ratio, etc.) goes through a **kit-modifier collector** resolved at participant build (`collectTheTuKitModifiers(player)` — the `collectKiemPhoComboModifiers`/`KiemPhoNodeModifiers` pattern), NOT through StatModifier — the spec keeps these as mechanic configuration, not character stats.
- Comments English ASCII (P15); UI strings via i18n (P16); `data/**` Vietnamese stays.
- All spec constants used **verbatim** (§3.2, §4.1) — no silent re-tuning.

---

# PHASE A — Foundations (tasks 1–5)

---

### Task 1 — Path ids, domain, kits record, save bump

**Files:**
- `core/player/CultivationPathKit.ts` — `CultivationPathId` += `'the_tu' | 'the_tu_an'`; `CULTIVATION_PATH_KITS` += `the_tu` ("Thể Tu", technique `kim_cang_bat_hoai_the` — EXISTING id, spec §2.4/§13) and `the_tu_an` ("Thể Tu Ẩn", technique `ung_the_than_quyet` — new). `the_tu_an` gets `offerGate` (Task 2).
- `core/stats/StatDomain.ts` — `StatDomain` += `'the_tu_an'`; `CULTIVATION_PATH_STAT_DOMAINS['the_tu_an'] = ['the_tu_an']`; `DOMAIN_SOURCE_WHITELIST` += `the_tu` rows (`data/progression/TheTu*`, `data/skill/TheTu*`, `data/buff/TheTu*`, scoped `data/technique/Techniques.ts` stats rows) + `the_tu_an` rows (`data/progression/TheTuAn*`, `data/skill/TheTuAn*`, `data/buff/TheTuAn*`).
- `services/save/saveVersion.ts` — bump `CURRENT_SAVE_VERSION` **exactly once** from whatever value is on the integrated branch at execution time (61 → 62 if unchanged; if a sibling already bumped, take the next value — never overwrite downward).
- `TurnBattleAdapter` — declares `the_tu`/`the_tu_an` `activeDomains` (spec §3.1 tail).

**Tests:** `CultivationPathKit.test.ts` (ids + kits resolve); `StatDomain.test.ts` (domain map entries).

**Verify:** `npm run type-check` — exhaustive `Record<CultivationPathId,…>` sites surface (`ARTIFACT_ID_BY_CULTIVATION_PATH`, `BASIC_ATTACKS_BY_BUILD`, i18n path labels); fix each explicitly, never silent fallback (A8). `the_tu`/`the_tu_an` have no artifact — confirm the artifact lookup's `undefined` path is already handled (`ArtifactPanel`/`DongFuCommandWheel` guard exists).

---

### Task 2 — `huy_quyen` + ritual gate (conditional on sibling merge)

**Goal (T6, INV-1):** `the_tu_an` offered iff `huy_quyen` Lv3 — live read at offer time.

**Conditional preamble (P6):** the phap-tu worktree already authors `huy_quyen` + `linh_bao` in `CoreSkills.ts` and a `CAST_LEVELING_THRESHOLDS` table ({lv2:1000, lv3:10000}) with a generic `getCastLeveledSkillLevel`. **If merged first:** this task = ritual wiring only. **If not merged:** implement the equivalent here —
- `SkillSystem.ts`: replace the `skill.id === 'tram'` special-case with a data-driven cast-leveling table (`CAST_LEVELING_THRESHOLDS: Record<skillId, {lv2, lv3}>` — sibling convention); `recordCast` auto-levels any id in the table; `upgradeSkill`/`getSkillUpgradeInsightCost` reject cast-leveled skills. `tram`'s flat-damage bonus path unchanged.
- `CoreSkills.ts`: `huy_quyen` (Hủy Quyền) — mortal physical basic, `execution:'attack_speed'`, `resourceType:'none'`, `maxLevel:3`. Learned wherever `tram` is granted (find the starter-skill seam; mirror it — do not invent a grant path).
- `HUY_QUYEN_L3_CASTS = CAST_LEVELING_THRESHOLDS.huy_quyen.lv3` (single number source, sibling convention).

**Ritual (`GameManagerRealmAdvanceOps.chooseCultivationPath`):**
- `CultivationPathKit.offerGate?: { requiresSkillLevel?: { skillId; level } }`; ONE predicate `isCultivationPathOffered(kit, player)` in `CultivationPathKit.ts` — consumed by BOTH the panel list and `chooseCultivationPath` (A9).
- Gate reads `player.skillLevels?.['huy_quyen'] ?? 0` (mirror field, live at offer time).
- On choose `the_tu`: equip `kim_cang_bat_hoai_the`. On `the_tu_an`: equip `ung_the_than_quyet`. Both: `unequip('tram')` + `unequip('huy_quyen')` (+ `linh_bao` if it exists post-merge — check what phap does).
- `QuanKhiPanel.vue`: offer list filters through `isCultivationPathOffered` — gated path hidden or disabled-with-reason (check existing UX; prefer disabled + i18n reason).

**Tests:** cast-leveling table (huy_quyen Lv2@1k, Lv3@10k, mirror sync); ritual offers both paths; `the_tu_an` rejected below Lv3 / accepted at 3; both mortal skills unequipped; techniques equipped; save round-trips new path ids.

---

### Task 3 — Stat model: chance stats + the_tu domain migration (full §3)

**3a. New stats — ONLY the three chance stats become `StatType`s** (`StatTypes`, `StatBlock`, `StatMetadata`, `StatLabels`):

| Stat | Domain | Formula (spec §3.2 verbatim) |
|---|---|---|
| `counterChance` | `the_tu_an` | `str×0.004 + dex×0.004` |
| `protectChance` | `the_tu_an` | `vit×0.004 + dex×0.003` |
| `followUpChance` | `the_tu_an` | `dex×0.004 + int×0.003` |

`STAT_DOMAIN` += all three. **Cap contract (review P0.1 — locked):** emitters and the delta deriver emit **uncapped raw linear values** — `REACTIVE_CHANCE_CAP = 0.60` is registered as `max` in `STAT_METADATA` for the three stats and applied ONLY at final probability consumption/display via `clampStatValue` (roll site + UI read the stat through it). Never clamp inside the emitter or deriver: `calculateEffectiveStats` composes `resolvedBase + tempModifiers + derived(attributeDelta)` — a clamped base plus a negative delta would drop off cap early (raw 0.80 → clamp 0.60 → delta −0.05 gives 0.55 instead of the correct 0.75→0.60). Stored values may exceed 0.60; that is correct.

**3b. Two-channel emission (spec §3.2 — BOTH channels, not just the deriver):**
- **Assembly**: `getTheTuAnReactiveStatModifiers(player, totals)` beside `getPhapTuAttunementStatModifiers` in the cultivation-path emission module — reads `resolveAttributeTotals` output, emits `domain:'the_tu_an'` modifiers, only when `player.cultivationPath === 'the_tu_an'`; wired into `resolvePlayerFinalStats` (Player.ts ~470) next to the phap emission.
- **Mid-battle**: `registerDomainDeltaDeriver('the_tu_an', …)` at module load — re-emits deltas on attribute change; runs only when `activeDomains` contains `the_tu_an`.
- One constants module owns the six `THE_TU_AN_*_PER_POINT` values + cap (spec §3.2 names verbatim).

**3c. the_tu domain migration (spec §3.3 — all four stats):**
- `STAT_DOMAIN` += `blockChance`, `blockEffectiveness`, `enduranceThreshold`, `endurancePercent` → `'the_tu'`.
- Move `vitality→enduranceThreshold` OUT of `deriveAttributeModifiers` (~181-186) into the same two-channel pattern with `domain:'the_tu'`: assembly emitter `getTheTuEnduranceStatModifiers` (wired in `resolvePlayerFinalStats`, gated on `cultivationPath === 'the_tu'`) + `registerDomainDeltaDeriver('the_tu', …)`.
- **Universal-source sweep (spec §3.3 bullet 1):** grep every authored grant of the four stats — equipment affixes (`data/equipment/affixes.ts`), buffs, nodes, realm passives, technique effects. Each is either dropped or re-emitted `domain:'the_tu'` + whitelisted. Non-the_tu entities lose block/endurance from gear — intended.
- Consequence locked by spec: `the_tu_an`/`kiem_tu`/`phap_tu`/mortals/enemies get `enduranceThreshold = 0` from attributes; `evasionRate` stays universal. Regression test asserts exactly this per path.
- `the_tu_an` never blocks (no block stats reachable) — dodge + reactive answers only.

**Tests:** `StatCalculator.theTu.test.ts` — assembly emission only for the_tu_an; delta deriver live path; formulas vs attribute totals; **cap-at-consumption regression**: raw 0.80 stored, delta −0.05 → `clampStatValue` still 0.60; delta −0.25 → 0.55; wrong-domain modifier rejection (dev throw); the four-stat gate; `enduranceThreshold` per-path matrix; INV-13 audit test: no authored content emits chance-stat modifiers (scan `TheTu*` data files' StatModifier stats).

---

### Task 4 — Retire `currentMomentum` + scope generic Thế (conditional)

**Goal (D7, §7.13):** remove `currentMomentum`, `MAX_MOMENTUM`, `grantsMomentumPerHit`, `resourceType:'momentum'`, `SkillActionRegistry` `momentum` entry, `heavy_impact` content if present (spec §7.13 names it). ~60 fixture sites — mechanical sweep.

**Conditional:** if the phap-tu field-driven Thế merge landed (`theGainOnLandedCast`/`theGainOnCrit`), the slot-driven +10/+20 grants no longer exist — Task reduces to verifying no unconditional grant fires for non-phap participants. If NOT merged: gate the two gain calls at ~1252-1267 on `actor.activeDomains.has('phap_tu')` (extract `grantTheForSlot` helper if it keeps both sites consistent).

**Tests:** `theResource` scope — phap gains, others don't (whichever regime is live); momentum grep-zero in `src/`.

---

### Task 5 — Retire `thornsPercent` (T12)

StatTypes, StatBlock, `data/equipment/affixes.ts` entries, `CombatSystem` thorns block (~448-454), labels/metadata/policy refs, fixtures. `wardBreakDamagePercent` (tho_tu) untouched. Grep-zero at end.

---

# PHASE B — Thể Tu Hiện (tasks 6–13)

---

### Task 6 — `the_tu` kit data + buffs + kit resolution

**`src/data/skill/TheTuSkills.ts`** — native `TurnSkillDefinition`s:

```ts
// Cuồng Chiến — root 'cuong_chien'
CUONG_QUYEN   basic    damage {physical ×1, missingHpBonusPerMissingPercent: 0.02, missingHpBonusCap: 2.0}  // §3.4 fields
LOAN_DAU      special  damage {physical ×2 + same scalar fields}, cooldown 4 — NO self-cost (review fix #4)
BAT_TU_BA_THE ultimate cooldownTurns 8, appliesBuffs [bat_tu_ba_the self 3 holder-turns]
               // NO autoCastable flag — selectAction MAY auto-fire at full HP (T11 accepted)

// Trấn Thể — root 'tran_the'
TRAN_AP       basic    damage {physical ×0.8}, targeting {shape:'all_lanes'}
PHAN_CHINH    special  { emblemOnly: true }  — emblem marker, never selectable (spec §7.10)
SON_NHAC      ultimate cooldownTurns 6, appliesBuffs [son_nhac self, son_nhac_ho_the allies_except_self+wardGrant, khiem_khich all_enemies]
```

- `THE_TU_KIT_BY_ROOT: Record<'cuong_chien'|'tran_the', {basic, special, ultimate}>`.
- **`emblemOnly`**: new field on `TurnSkillDefinition` (name matches the kiem-tu worktree convention — if that merge landed, reuse it). `selectAction`/`selectForcedAction` skip emblem slots; `phan_chinh`'s permanent buff application happens at participant build (Task 14's marker-apply seam covers it — emblem defs list `grantsBuffIds` or the build applies `PHAN_CHINH_BUFF` when the emblem is slotted; pick the existing-convention approach at impl).
- **`src/data/buff/TheTuBuffs.ts`**: `bat_tu_ba_the` (3 holder-turns, `durationPolicy:'fixed_holder_turns'`, `clearsCcOnApply`, `displacementImmune` marker), `phan_chinh` (permanent; carries `reflectsDamage` reactive effect — Task 8), `son_nhac` (`fixed_holder_turns`; self DR `finalDamageReductionPercent` — verify stat exists else add as the_tu-gated), `son_nhac_ho_the` (`fixed_holder_turns` + `uniquePerTarget`; ward marker — Task 11), `khiem_khich` (Taunt debuff — `ailment_scaled`, Task 10), `ung_the` + `ho_mon`/`phan_mon`/`tro_mon`/`tu_the`/`bach_ung` (`fixed_holder_turns` on all holder-turn marker/state buffs — shells now, mechanics Phase C).
- **`BuffTypes.ts` + `BuffSystem.ts`**: the `durationPolicy` primitive (see Task 11's contract) — authored here because every the_tu def above depends on it.
- **Kit resolution**: `GameManager.resolvePlayerBasicAttack`/`resolvePlayerSpecialUltimate` `the_tu` branch — owned root (`getNodeLevel(player,'cuong_chien'|'tran_the') > 0`) → kit; none → `GENERIC_PHYSICAL_BASIC` only (INV-3). `the_tu_an` → fixed Ẩn kit.
- `TurnSkillDisplayMeta` + i18n entries for all ids.
- **`collectTheTuKitModifiers(player)`** (new, `core/the-tu/` or data-adjacent module matching where `KiemPhoNodeModifiers` lives): aggregates node-level-scaled kit modifiers — `{ missingHpBonusBonus, reflectMaxHpRatioBonus, reflectTakenRatioBonus, sonNhacWardRatioBonus, tauntTurnsBonus, batTuDurationBonus, ... }` — applied to **participant-local def clones** at participant build (kit defs + `phan_chinh` def clone passed directly to `BuffSystem.apply`). This is the ONLY node→kit channel (INV-5 spirit: nodes modulate consequences; nothing here touches chance stats — impossible anyway, they're stat-gated). **Never mutate registry/singleton definitions** — a shared-def mutation leaks node state across participants, battles, and tests.

**Tests:** kit resolution per root + fallback; `LOAN_DAU` deals damage with NO self-cost; emblem slot never selected but buff applied at build; `BASIC_ATTACKS_BY_BUILD['the_tu']` unchanged (pre-root fallback).

---

### Task 7 — Missing-HP scalar on the damage contract (spec §3.4 verbatim)

**NOT a stat.** `ActionDamageInfo`/`TurnSkillDefinition.damage` gains:

```ts
missingHpBonusPerMissingPercent?: number  // +X% damage per 1% missing HP
missingHpBonusCap?: number                // cap on the total bonus multiplier
```

Resolution inside the hit pipeline, reading live `actor.entity.currentHp/maxHp` **at impact** (per-hit recompute — spec §3.4: "resolved at impact, recomputes per hit"): `bonus = min(cap, missingFraction × perPercent × 100)`; `scaledDamage × (1+bonus)`. Applies only to actions whose damage carries the fields — authored on `cuong_quyen`/`loan_dau`; node bonuses land via `collectTheTuKitModifiers` adjusting the def copies at build (never a stat, never engine-wide).

**Tests:** `TurnBattleSystem.missingHp.test.ts` — full HP ×1; 50% missing → scaled per field; cap respected; **multi-hit/multi-target re-reads live HP before EACH hit** — if actor HP changes between impacts (e.g. a Reflection event between hit A and hit B), the next hit uses the NEW missing-HP ratio (Berserk×Reflection integration test); actions without the field unchanged; node-adjusted def copy increases the scalar.

**Files:** `ActionImpactSystem.ts`/`TurnSkillAction.ts` (type), `TurnBattleSystem.ts` (resolution site — where `scaledDamage` feeds `resolveActionHit`; also charge-resolve path if trivially reachable), `TheTuSkills.ts`.

---

### Task 8 — Reflection (Trấn Thể, D4/INV-8)

- `ReactiveTriggerEffect` += `reflectsDamage?: { maxHpRatio: number; takenRatio: number }` (literal fields on the effect — authored on `phan_chinh`; node scaling adjusts the **def clone** via `collectTheTuKitModifiers`, not stats).
- `BuffSystem.rollReactiveTrigger(entity, trigger, registry, context?: { attacker?: CombatEntity; hpDamage?: number })` — returns `reflectRequests: { attackerEntity, amount }[]` where `amount = hpDamage × takenRatio + holder.stats.maxHp × maxHpRatio`. BuffSystem stays pure (A6): TurnBattleSystem executes each request via `combat.applyModifiedDirectDamage(attacker.entity, amount, holder.entity, 'reflection')` — add `'reflection'` to that method's damage-tag union (precedent: `'thorns'`, `'ward_break'`).
- Fires only inside the existing `!hitResult.dodged && hpDamage > 0` block (taken-only — D4/INV-8). No new windows opened; the reflect damage event is terminal (no reactive triggers on the attacker side for it).

**Tests:** taken → reflect lands (both ratio components); ward-absorbed-fully → none; dodged → none; reflect kill → real kill via vitals; no counter/reflect chain from the event; node-adjusted ratio applies.

**Files:** `BuffTypes.ts`, `BuffSystem.ts`, `TurnBattleSystem.ts` (~1240 call site), `CombatSystem.ts`, `TheTuBuffs.ts`.

---

### Task 9 — Bất Tử + Bá Thể (result-object survival contract)

**Goal (T11, D10, INV-4/5):** lethal → HP 1 → `bat_tu_ba_the` 3 holder-turns + ult CD consumed. Manual cast unchanged (auto-castable — **NO `autoCastable` field; T11 explicitly accepts auto-fire at full HP**).

**1. Generalize the survive session (`CombatSystem` ~569-633):** `surviveLethalSession` gains an ordered `sources: SurviveLethalSource[]` (the existing `guard`+`surviveEffects` pair becomes source #1 adapter — talent path unchanged):

```ts
type SurviveLethalResult =
  | { survived: false }
  | { survived: true; grantBuffId?: string; grantBuffDurationOverride?: number; cleanseDebuffs?: boolean }

interface SurviveLethalSource {
  trySurvive(entity: CombatEntity): SurviveLethalResult
}
```

`killIfDead` iterates sources; first `survived:true` → HP=1 + apply that result's `grantBuffId`/`grantBuffDurationOverride`/`cleanseDebuffs` only (apply via `BuffSystem.apply(..., durationOverride)` — M10 channel). **No grant when the result omits it** — this is the review-#6 fix: a free survive while the buff is already active returns bare `{survived:true}`, so the buff can never be refreshed by repeat lethals.

**2. `TheTuBatTuSurvival` source** (new module, e.g. `core/the-tu/TheTuBatTuSurvival.ts` or matching sibling layout) — constructed with `{ participantUltimateSlot, buffPoolAccessor, batTuDuration }` where `batTuDuration = 3 + collectTheTuKitModifiers(player).batTuDurationBonus` resolved at participant build (review P0.2 — the manual-cast `appliesBuffs` application carries the SAME resolved `durationOverride`, so passive and manual activation never drift):
- `bat_tu_ba_the` active on holder → `{survived:true}` (no grant, no CD touch — duration NOT refreshed).
- Else if ult slot exists AND `remainingCooldownTurns === 0` → set `remainingCooldownTurns = slot.skill.cooldownTurns`, return `{survived:true, grantBuffId:'bat_tu_ba_the', grantBuffDurationOverride: batTuDuration, cleanseDebuffs:true}`.
- Else → `{survived:false}` (talent source later in the chain may still save — D9).

**3. Wiring** (`GameManagerTurnBattleOps` ~899): player is `the_tu` + owns `cuong_chien` → the Bất Tử source is inserted BEFORE the talent guard (order = D9's "extra life after ult exhausted").

**4. Bá Thể (D10/INV-5):**
- `bat_tu_ba_the` def carries `clearsCcOnApply: true` — the buff-application path (Task 11's `appliesBuffs` resolution AND the survival-grant path) runs `clearCcEffects` when applying a def with the flag (generic field on `BuffDefinition`).
- `resolveActorTurn` CC branch (~781): if holder has active `bat_tu_ba_the` → `ccBlocked=false`, `consecutiveHardCcTurns` NOT incremented (suppressed, not reset — resuming accumulation after expiry is the spec reading), hard CC effects on the holder are ignored for blocking purposes.
- `displacementImmune` marker effect type on the buff — flag only; no turn-engine displacement consumer exists today (document; don't invent one).

**Tests:** `batTu.test.ts` — lethal at low HP → survives at 1, buff 3 own-turns, ult CD started; **repeat lethal while buffed → survives WITHOUT refreshing duration or touching CD** (the review-#6 case); lethal on-CD no-talent → dies; talent stacks as second line; manual cast works; auto `selectAction` DOES pick it when off-CD (assert the T11-accepted behavior — do not gate); CC suppressed + apply-cleanse.

---

### Task 10 — Taunt (rewritten per review)

**Correct semantics (D6/INV-11, spec §5.2/§7.4):**
- `khiem_khich` is a **debuff on the acting enemy**; its `Buff.sourceId` = the taunter's entity id.
- `selectTarget(actor, opposingSide, opts?)`: FIRST check `actor`'s own buff pool for an active `khiem_khich` instance → resolve `sourceId` → find the living participant in `opposingSide` whose `entity.id === sourceId` → return it (forced). Dead/missing taunter → fall through to positional. Player-side tanks taunt enemies; the check is symmetric (any actor carrying the debuff targets its source — no path check needed, A8).
- **Newest-wins** (INV-11): instances are `(id, sourceId)`-keyed so two tanks produce two instances. Mechanism: `khiem_khich` def declares `uniquePerTarget: true` (new `BuffDefinition` field) — `BuffSystem.apply` removes ALL existing instances of that id regardless of source before adding the new one. Newest application wins by construction; no recency field needed.
- **Scripted `specialAttacks` exempt** (D6): the everyNth swap at ~954-969 marks the action (`action.scriptedSpecial = true` or a declared flag); the `selectTarget` call site passes `{ ignoreTaunt: true }` for it — the special keeps its positional target AND its damage multiplier. AoE shaping unchanged (taunt only moves the primary target pick; `collectTurnTargets` shape logic untouched).
- Duration = the debuffed **enemy's** own turns (holder-turn convention — the holder IS the enemy).
- Bosses tauntable unless authored `tauntImmune` — add a flag check only if a boss authors it; default tauntable.

**Tests:** forced target on the enemy's OWN pool (not the tank's); expiry → positional; two sequential taunters → newest source wins (not priority order); dead taunter → positional; scripted everyNth → positional target kept + multiplier intact; AoE primary re-aims to taunter with shape intact; boss taunted.

**Files:** `TurnBattleSystem.ts` (`selectTarget` + declare call site), `BuffTypes.ts` (`uniquePerTarget`), `BuffSystem.ts` (apply path), `TheTuBuffs.ts` (`khiem_khich` def: debuff, `uniquePerTarget:true`, duration authored).

---

### Task 11 — `son_nhac`: `appliesBuffs` + external-ward contract

**1. `appliesBuffs?: TurnBuffApplication[]`** on `TurnSkillDefinition` (migrate the singular `appliesBuff` — few call sites; keep ONE field name):

```ts
interface TurnBuffApplication {
  definitionId: string
  target: 'self' | 'action_targets' | 'allies_except_self' | 'all_enemies'
  durationOverride?: number                        // review P0.2 — node-scaled durations land here
  externalWardGrant?: { sourceMaxHpRatio: number }
}
```

`applyActionImpact` resolves each application's target set (`self`→[actor]; `action_targets`→declared.affected; `allies_except_self`→same-side living ≠actor; `all_enemies`→opposing living) and applies via `BuffSystem(p.buffs).apply(def, actor.entity, p.entity, registry, application.durationOverride)` — `BuffSystem.apply` already accepts `durationOverride` (M10 ARCH-008, BuffSystem.ts:33-38). `clearsCcOnApply` honored here too (Task 9).

**Node-duration delivery (review P0.2):** buff durations are `BuffDefinition` properties, not skill-def fields — `batTuDurationBonus`/`tauntTurnsBonus` from `collectTheTuKitModifiers` reach runtime ONLY through `durationOverride`: participant build clones the `SON_NHAC`/`BAT_TU_BA_THE` applications with `durationOverride = base + nodeBonus`. Without this the node bonuses die inside the collector.

**Duration policy primitive (review P0, final):** "3 holder-turns" is skill *semantics*, not "base ailment duration 3" — the generic formula `(override ?? def.duration) × resistMultiplier × (1 + ailmentDurationPercent)` must not scale these buffs (a caster's own `ailmentResistPercent` shrinking their own Bất Tử is nonsense; an ally's resist shrinking `son_nhac_ho_the` likewise). Add to `BuffDefinition`:

```ts
durationPolicy?: 'ailment_scaled' | 'fixed_holder_turns'   // default undefined = 'ailment_scaled' (backward compat)
```

In `BuffSystem.apply`: `fixed_holder_turns` uses `baseDuration` unscaled — skips both `resistMultiplier` and `ailmentDurationPercent`. Authored `fixed_holder_turns`: `bat_tu_ba_the`, `tu_the`, `bach_ung`, `son_nhac`, `son_nhac_ho_the` (all holder-turn state/protection buffs). `khiem_khich` stays `ailment_scaled` — enemy ailment resist legitimately shortens Taunt (it's a debuff on the enemy). Node durations still compose: `durationOverride = 3 + batTuDurationBonus` → `fixed_holder_turns` → exactly 4 holder-turns from either manual cast or lethal trigger.

**2. External ward contract (locked — spec §5.2/§7.11/D3):**

`CombatEntity.externalWard?: { sourceId: string; amount: number }` — a **separate, protection-only pool** granted by an external source, distinct from `currentWard`/`wardMax`:

- **Source-tagged, not a bare number** (review P1.3): `sourceId` = the granting participant's entity id. A second protector's grant REPLACES the record wholesale; when one grant's marker disappears, only that source's pool is cleared — protects against two-protector cross-clearing (participant-generic mechanics even though companion paths are out of scope).
- **Protection-only, never spendable** (review P1.2): `externalWard` is an absorb pool for *incoming* damage only. `spendWard`/`EntityVitalsSystem.spendWard` and ward-fuel consumers (e.g. the `currentWard`-reading skill at TurnBattleSystem ~1224) stay native-only — Sơn Nhạc ward is the tank's protection, not fuel for allies' ward-spend skills. Do NOT add a `getSpendableWard`/`getTotalWard` accessor.
- Grant: `externalWard = { sourceId: tank.entity.id, amount: max(0, tank.stats.maxHp × ratio) }` — **replace**, never stack (recast refreshes to full; INV-12).
- **Consume with split accounting** (review P0.2 — locked): the absorb site (~376) computes `externalWardAbsorbed = min(externalWard.amount, remaining)` first, then `nativeWardAbsorbed = min(currentWard, remaining)`. `result.wardAbsorbed = external + native` (UI/events keep the total). **Ward break gates on the NATIVE component only**: `if (nativeWardAbsorbed > 0 && target.currentWard <= 0 && wardBreakDamagePercent > 0)` — an external-only absorb with `currentWard = 0` must NOT trigger ward break (~461). ExternalWard also doesn't feed ward-break damage magnitude (`wardMax`-scaled — it's not the holder's ward).
- **Why a separate pool is required** (not optional): `wardRegenPerTurn` clamps `currentWard` to `wardMax` (~168) — an over-cap grant in `currentWard` would silently shrink, and allies with `wardMax=0` would hold nothing. The external pool is exempt from `wardMax` and from regen.
- **Existence-bound lifecycle, per-source reconcile** (review P1.1): `son_nhac_ho_the` carries `uniquePerTarget: true` — newest grant replaces older-source markers, so marker and `externalWard` always share one owner (external ward is newest-replaces by design). Reconcile after ANY pool mutation (expiry/dispel/replace/manual remove): `if (entity.externalWard && !pool.getFromSource('son_nhac_ho_the', entity.externalWard.sourceId)) entity.externalWard = undefined` — keyed to the CURRENT source's instance, never "any marker with the same id" (a surviving source-A marker must not resurrect source-B's spent pool). Keyed on the effect field `grantsExternalWard: true` so it stays data-driven. `turnsSinceLastHitLanded` gate unaffected.

**Tests:** allies ≠ tank get `externalWard` = ratio × tank.maxHp (tank excluded — INV-12); recast replaces (lower recast lowers the pool); absorb order external-first; **ward-break: native 0 + external absorbs → NO proc; native 50 + external 20, hit 100 → external+native depleted → proc exactly once** (review P0.2); removal paths: expiry AND dispel AND replace all clear the pool; two-source scenario — source A's marker removed doesn't clear source B's pool; over-`wardMax` amounts persist (no regen clamp); zero-wardMax allies hold the full grant; `currentWard` untouched; `spendWard` consumers never see externalWard.

**Files:** `TurnSkillAction.ts`, `TurnBattleSystem.ts`, `CombatEntity.ts`, `CombatSystem.ts` (absorb split + ward-break gate), `EntityVitalsSystem.ts` (unchanged — spendWard stays native-only), `BuffSystem.ts`/turn-layer removal path (reconcile hook), `TheTuBuffs.ts`, `TheTuSkills.ts`.

---

### Task 12 — `TheTuNodes.ts` + gates + root mutex (spec §8.1 verbatim)

**`data/progression/TheTuNodes.ts`** — the_tu section (realm-gated `qi_refining` roots, `foundation_establishment` deeper):
- Roots `cuong_chien`/`tran_the` — `excludesNode` mutex pair (INV-2). Gate in wherever `bat_kiem_an`-style/path gates live (`getGateResult`/`NodeSystem` — find the centralized gate table).
- Trunk stat nodes (str/vit/def/maxHp% — `domain:'the_tu'` modifiers; block stats legal here post-migration).
- Branch nodes — only spec-listed categories: missing-HP scalar increases, Bất Tử duration/leech/kill-extend, `loan_dau` riders; `tran_ap` debuff riders (slow/attack-down/defense-shred — **NO taunt-on-hit, not in spec**), reflection ratios, taunt duration/soften, `son_nhac` ward ratio/DR. All via `collectTheTuKitModifiers` surface or `domain:'the_tu'` statModifiers — never chance stats.
- **`data/progression/TheTuAnNodes.ts`** — Ẩn section (Task 20 authors content; file can be created here or there — pick one task, don't split).
- `data/technique/Techniques.ts` — `kim_cang_bat_hoai_the` exists; author `ung_the_than_quyet` (new, the_tu_an-side permanent-buff technique — no gated-chance emissions, INV-13).

**Tests:** mutex gate; path gates; whitelist conformance for every authored modifier; node→collector→kit-def flow (buying a scalar node changes the built def); **duration delivery + policy: node +1 Bất Tử → manual cast grants exactly 4 holder-turns AND lethal auto-trigger grants 4 (no drift); `fixed_holder_turns` ignores `ailmentDurationPercent` +100% and `ailmentResistPercent` 75% (still exactly 3/4); `khiem_khich` stays `ailment_scaled` — its tests use neutral resist/duration fixtures; node +1 Taunt → N+1 enemy turns**; no chance-stat modifiers anywhere in the files (INV-13 arch test).

---

### Task 13 — Hiện e2e + regression

`GameManager.theTuE2E.test.ts` — ritual → path → root → battle: cuong kit scales by missing HP; tran kit taunts + reflects + wards; Bất Tử trigger + manual cast; Bá Thể CC behavior; save/restore parity. Regression scope: `npx vitest run src/core/battle/turn src/core/combat src/core/stats src/core/game`.

---

# PHASE C — Thể Tu Ẩn (tasks 14–21)

---

### Task 14 — Ẩn kit + marker wiring

**`TheTuSkills.ts` +=** `THAM_THE` (basic, physical ×1 — on-hit Thế income via Task 15 economy marker or the `theGainOnLandedCast` field if that merge landed — prefer the authored field when available), `TU_THE` (special, appliesBuff `tu_the` self), `BACH_UNG` (ult, appliesBuff `bach_ung` self — **auto-castable per T11-equivalent auto semantics; spec D11's "manual = ult timing" refers to manual mode, not a cast gate**), payloads `PHAN_KICH`/`TRO_KICH` (physical single-target defs).

**Markers** (`TheTuBuffs.ts` — shells authored in Task 6, now with effects): `ung_the` (permanent, `theEconomy` fields), `ho_mon`/`phan_mon`/`tro_mon` (each carries its `reactiveProc` spec — Task 15), `tu_the` (`procCostFlatDelta`), `bach_ung` (`freeProcs`, `payloadUpgrade` fields — spec §6.1 "counter hits +break"-style authored content; no invented damage multipliers — author what the spec says: free procs + payload upgrade riders defined on the buff).

**Battle build**: `the_tu_an` participants get `ung_the` + each owned root's marker (`getNodeLevel(player,'ho_mon'|'phan_mon'|'tro_mon')>0`) at the same seam as the formation buff (~997). Trấn Thể's `phan_chinh` buff applies here too (emblem→buff application, Task 6).

**Tests:** kit slots populated; markers match owned roots; emblem buff applied; chance stats live on the entity.

---

### Task 15 — Thế proc-fuel economy (corrected math)

**Transactions (spec §4.1 verbatim):**

```ts
const THE_PROC_COST         = 15
const THE_PROC_GAIN         = 20   // credited on success — net +5 (NOT cost+gain)
const THE_GAIN_ON_EVADE     = 8
const THE_GAIN_ON_HIT_TAKEN = 6
const THE_GAIN_ON_BASIC     = 4
const THE_GAIN_PER_ROUND    = 5
```

- Attempt: `currentThe >= effectiveCost` required to roll; **`currentThe -= effectiveCost` on attempt**; success → `currentThe += THE_PROC_GAIN` (net `+5`); failure → nothing (net `−15`). **Review-#8 fix: success credits `THE_PROC_GAIN` only — no cost refund on top.**
- Effective cost = `THE_PROC_COST − Σ procCostFlatDelta (buffs) `, min 0 — `bach_ung`'s `freeProcs` ⇒ 0 (success then nets the full +20).
- `ung_the` marker carries `{ type:'theEconomy', gainOnEvade, gainOnHitTaken, gainOnBasicHit, gainPerRound }` — read via a `BuffSystem` effect query (new read method returning matching effects; BuffSystem stays mutation-free for resources — the turn layer applies `entity.currentThe` deltas, clamped to `entity.maxThe ?? MAX_THE`).
- **`maxThe` cap authority (review P0.2 — owned, not borrowed):** if the phap merge already landed `entity.maxThe`, reuse it. Otherwise THIS task introduces the minimal channel: `CombatEntity.maxThe?: number`, baked at participant build as `MAX_THE + collectTheTuAnMechanicModifiers(player).maxTheBonus`. Every Thế transaction clamps via `const cap = entity.maxThe ?? MAX_THE` — single expression, one site style. `resetBattleScopedResources` zeroes `currentThe` but `maxThe` persists (participant-build configuration, not battle state). No second field/function if the sibling authority exists.
- **Basic-income channel invariant (review P1):** `THE_GAIN_ON_BASIC` arrives through EXACTLY ONE channel — if the field-driven Thế merge landed: `THAM_THE.theGainOnLandedCast = 4` and `ung_the.gainOnBasicHit` is omitted; otherwise: `THAM_THE` has no gain field and `ung_the.gainOnBasicHit = 4`. Never both (+8). Which regime is live is decided once at implementation start by `git status`/merge check — not per-callsite.
- Income sites: dodge branch of the hit loop (+evade to the dodging participant); `hpDamage>0` (+hitTaken to the target); own basic lands ≥1 hit (+basic per the single channel above); round boundary at the `actedThisRound` reset (~694-700) → +perRound per marker holder.
- **Income→proc ordering (locked — review P1.6):** for each hit the sequence is `resolve hit → classify outcome → grant that outcome's income → THEN resolve the Phản/onEvade window`. The just-earned income funds the same hit's reactive check: `currentThe = 10`, taken → +6 → 16 ≥ 15 → Counter rolls. Same for the dodge side (+8 then the onEvade check). Two implementations that both "match the table" differ only here — this locks the order.
- **Proc resolution** — `resolveReactiveProcs(battle, holder, trigger, ctx)` on TurnBattleSystem: iterates the holder's `reactiveProc` effects matching `trigger` → cost check → spend → roll `clampStatValue(effect.chanceStat, holder.entity.stats[effect.chanceStat])` → success: credit gain + execute `queuedAction` (queue entry, Task 16); failure: nothing. Typed event per attempt (log + tests).

**Files:** `BuffTypes.ts` (`theEconomy` + extended `reactiveTrigger` fields: `chanceStat?: StatType`, `theCost?: number`, `theGainOnSuccess?: number`, `queuedAction?: { payloadSkillId, actionSource, targetMode }`), `BuffSystem.ts` (effect query), `TurnBattleSystem.ts`, `TheTuBuffs.ts`, `CombatTypes.ts`.

**Tests:** each income event; attempt spends; success net +5; failure −15; zero-pool skips roll entirely; `tu_the` discount; `bach_ung` free (net +20 on success); cap; **basic income = exactly +4 (channel-invariant test — whichever regime is live, never +8)**; **`maxThe`: base 100, node +20 → cap 120 (115 + 20 gain → 120), battle restart → `currentThe` 0, `maxThe` still 120**; battle-reset incl. auto-repeat.

---

### Task 16 — Typed queue entries + composite trigger context + `onEvade` + reactive-bypass turn contract

- `queuedFollowUpActorIds` → `queuedFollowUps: TurnQueuedFollowUp[]` (per-participant, mirroring current shape):
  ```ts
  interface TurnQueuedFollowUp {
    actorId: string
    executionKind: 'natural_turn' | 'reactive_bypass'   // review P0.1
    actionSource: 'normal'|'skill'|'counter'|'follow_up'|'intercept'|'generic'
    payloadSkill?: TurnSkillDefinition          // resolved at queue time via injected resolver (A6)
    targetIds?: string[]
    triggerContext?: {                          // composite — review #11
      origin: 'enemy_hit' | 'ally_action'
      intercepted?: boolean                     // came through a Hộ substitution
      outcome?: 'taken' | 'evaded'              // hit outcome on the reactor
    }
  }
  ```
  Composite (not a flat enum): the signature chain Hộ→EVA→Counter produces `{origin:'enemy_hit', intercepted:true, outcome:'evaded'}` — nodes can read each axis independently (spec §6.2.2 intent: node variants swap payloads on context).
- **Reactive-bypass turn contract (review P0.1 — the biggest remaining blocker).** Today the whole turn lifecycle runs inside `declareActorAction` BEFORE `isFollowUpBypass` is read — `totalTurnsElapsed++` (~686), `actedThisRound` mutation + round completion (~694-704), charge advance, `onCastBegin` triggers, CC check, buff/DoT tick, HP/MP/ward regen, resource deltas, `tickCooldowns`. With that ordering a Counter silently: burns Bất Tử duration, ticks cooldowns, regenerates, advances `turnsSinceLastHitLanded`, and can complete a round (granting `+THE_GAIN_PER_ROUND`). A Hộ→Counter→Trợ chain could strip a 3-holder-turn buff without the holder ever taking a natural turn — "holder's own turns" stops meaning anything.
  **Locked:** `executionKind: 'reactive_bypass'` branches at the **top of `declareActorAction()`** (when the dequeued `pendingFollowUpEntry` is a reactive entry) into a path that does NONE of: `totalTurnsElapsed`, `actedThisRound`/round completion, `BuffSystem.update` duration/DoT ticks, `tickCooldowns`, HP/MP/ward regen, `turnsSinceLastHitLanded`, ordinary per-turn resource deltas, charge-state advance. **But bypass preserves the declare→impact split (review P0.1, second form):** the branch builds and **returns a `TurnDeclaredAction`** — payload def, `actionSource`, `triggerContext`, `affected`, `scaledDamage` — and the normal `applyActionImpact()` resolves hits/damage/effects exactly as for natural turns. Bypass means "no holder-turn lifecycle", never "damage inside declare" — a second damage path outside `applyActionImpact` would fork the authority that VFX/playback, logging, kill handling, Reflection, and the hit-result contract all hang off. Chain-depth bookkeeping stays where the existing queue already tracks it (`followUpChainDepth` increment/cap). **All queued follow-ups are bypass** — verified: no `data/**` content uses `queuesFollowUp` today (mechanism-only seam, exercised only by `followUpQueue`/`reactiveTrigger` test files), so there is no legacy lifecycle to preserve; `executionKind` exists on the type for future natural-turn interrupts but every current producer emits `reactive_bypass`.
- Migrate `queueFollowUpTurn`/`dequeueFollowUpActor`/`pendingFollowUpBypassActorId` → `pendingFollowUpEntry`; payload resolution: entry.payloadSkill → `TurnSelectedAction` (bypass `selectAction`); `targetIds` override `affected` — dead/invalid targets → drop cleanly; `triggerContext` lands on the emitted action/impact event.
- **`onEvade` window**: `ReactiveTriggerEffect.trigger` union += `'onEvade'` (and `'onAllyTargeted'`, `'onAllyActionComplete'` for Tasks 17-18). Call site: the `else` (dodged) branch of the hit loop → `resolveReactiveProcs(battle, target, 'onEvade', {attacker: actor, outcome:'evaded', intercepted: wasIntercepted})`. The `!dodged` gate for landed-path triggers is unchanged (R3 relaxation is scoped to this new trigger only — spec §7.3).

**Files:** `TurnBattle.ts`, `TurnBattleSystem.ts`, `TurnBuffSystem.ts`, `BuffTypes.ts`.

**Tests:** existing followUpQueue suite still green; payload turn executes def damage on recorded targets; dead-target drop; chain depth 4; `onEvade` fires only on dodge; composite context populated correctly through an intercept→dodge→counter chain; **bypass-lifecycle invariants: a Counter leaves `remainingCooldownTurns`, buff `remainingTurns`, `roundsElapsed`, `totalTurnsElapsed`, `actedThisRound`, `turnsSinceLastHitLanded`, and regen pools untouched; a 4-deep Hộ→Counter→Trợ chain hits `MAX_FOLLOW_UP_CHAIN_DEPTH` while running zero holder-turn lifecycles.**

---

### Task 17 — Hộ intercept (INV-10)

- Window: top of `applyActionImpact` (post-declare/pre-impact — substitution mutates `declared.affected` before the hit loop; presentation reads post-substitution).
- Preconditions (spec §6.2.1 verbatim): actor enemy-side; `affected.length === 1`; the target is player-side and **not** the protector; protector alive + carries a `ho_mon` marker + `currentThe >= effectiveCost`.
- Selection: candidates = player-side participants with the marker (≠ original target); **nearest to the attacker by Chebyshev rolls — exactly one roll** (D5: "nearest to the attacker rolls first, one substitution per action"). On success → `affected[0]` replaced by the protector; record `{intercepted:true, interceptorId}` for the impact event + the composite triggerContext downstream.
- The substituted hit resolves fully vs the protector — dodge/ward/block/`onEvade`+`onImpactLanded` procs all live (the Hộ→EVA→Counter chain).
- AoE actions: `affected.length > 1` → no window (out of scope v2).
- Marker effect shape: `{ type:'reactiveProc'-style trigger:'onAllyTargeted', chanceStat:'protectChance', theCost, theGainOnSuccess }` — resolved through the same `resolveReactiveProcs` (Task 15).

**Tests:** substitution + full defensive resolution on protector; only nearest rolls (two candidates — far one's pool untouched); insufficient Thế → no roll; multi-target action → no window; protector dead → none; original-target-as-protector excluded.

---

### Task 18 — Phản + Trợ wiring

- `phan_mon` marker: two `reactiveProc` effects — `trigger:'onImpactLanded'` + `trigger:'onEvade'`, each `{ chanceStat:'counterChance', theCost:15, theGainOnSuccess:20, queuedAction:{ payloadSkillId:'phan_kich', actionSource:'counter', targetMode:'attacker' } }`. `targetMode:'attacker'` resolves `targetIds=[actor.id]` at queue time.
- `tro_mon` marker: `{ trigger:'onAllyActionComplete', chanceStat:'followUpChance', ...same economy fields, queuedAction:{ payloadSkillId:'tro_kich', actionSource:'follow_up', targetMode:'triggering_targets' } }`. Trigger point: end of `applyActionImpact` when actor is player-side and the action dealt ≥1 hit — scan OTHER alive player-side participants for the marker → proc → queue vs **all of the triggering action's `affected` targets still alive at queue time** (spec §6.2.3 says "the triggering action's targets" — plural; an ally AoE queues Trợ against the whole landed set, not just `affected[0]`). Never on self-actions or reactive actions (INV-9 — `actionSource` check on the triggering action).
- **Payload resolver injection**: `TurnBattleSystem` gains a constructor-injected `payloadSkillResolver?: (id: string) => TurnSkillDefinition | undefined` (reactionPathPool pattern — data→core import direction preserved). `GameManagerTurnBattleOps` builds the map from `THE_TU_AN_PAYLOADS`.
- Reactive actions never open new windows by default (INV-9): payload turns carry `actionSource` ≠ normal → the `onAllyActionComplete`/`onImpactLanded`/`onEvade`/`onAllyTargeted` scans skip them. A node may opt in later via an authored flag — not authored now.
- `counterable`/`counterSkillId` on `TurnSkillAction`: **stay dead** (INV-15). Do not wire.

**Tests:** counter on taken AND on dodge (context distinguishes); **fully absorbed hit (hpDamage=0, not dodged) → NO Phản roll — the `onImpactLanded` window is gated by `hpDamage > 0`, same rule as Reflection's "taken"**; income-before-window ordering (10 Thế → taken +6 → Counter rolls this hit; same for +8 onEvade); follow-up queues ALL live affected targets of an ally AoE; no self/reactive triggers; Thế accounting; depth cap; payload on dead attacker drops.

---

### Task 19 — `bach_ung` + `tu_the` semantics

- `bach_ung` buff fields: `{ type:'reactiveEconomy', freeProcs: true, payloadUpgrade?: <authored rider> }` — the spec's example is "counter hits +break"; author the buff to carry the upgrade data (e.g. `payloadBonusDamageRatio` or a `grantsAilmentOnPayload` rider — pick the concrete spec-listed rider; **do not invent a damage multiplier constant** — review #12). Implementation: `resolveReactiveProcs` reads `freeProcs` (cost→0); the payload-turn resolution reads upgrade fields from the caster's pool.
- `tu_the` buff: `procCostFlatDelta: -5` (3 self-turns) — flat deltas sum across sources, floor 0.
- Both durations = holder's own turns (D1).

**Tests:** free procs during window (spend 0, success still +20); authored upgrade rider applies on payload turn; tu_the cost −5 (min 0); expiry restores.

---

### Task 20 — `TheTuAnNodes.ts` authoring

Roots `ho_mon`/`phan_mon`/`tro_mon` (non-mutex — T9): each root's purchase is what plants the marker at battle build (Task 14 reads `getNodeLevel`). Trunk economy nodes route through ONE locked channel (review P1.7 — not a choice): **`collectTheTuAnMechanicModifiers(player)`**, resolved at participant build beside `collectTheTuKitModifiers`, returning `{ maxTheBonus, procCostDelta, procGainBonus, evadeGainBonus, takenGainBonus, basicGainBonus, roundGainBonus }` — baked into the participant's economy config/marker application. NOT `StatModifier`, NOT global buff-def mutation. Branch nodes per spec examples: intercept→ally ward, intercept +Thế, post-evasion heavy counter (payload swap via context read — the composite context's `outcome:'evaded'` axis), counter +break/crit riders, tro_kich heal/buff variants, Trợ cost variants. Realm gates: roots `qi_refining`, deeper `foundation_establishment`.

**Tests:** purchase → marker present next battle; realm gating; INV-13 audit extends to this file; context-conditional payload variants resolve.

---

### Task 21 — Ẩn e2e

`GameManager.theTuAnE2E.test.ts` — gated ritual → `ho_mon`+`phan_mon` → battle: enemy hits ally → nearest intercept roll → counter on the taken/evaded outcome with correct composite context → Thế flows → `bach_ung` window. Solo Ẩn: no Hộ/Trợ windows (spec §6.3 — assert, don't fix). Save/restore parity.

---

# PHASE D — Integration & finish (tasks 22–24)

---

### Task 22 — UI integration

- `QuanKhiPanel` offer gating (Task 2 seam) + path labels i18n.
- `SkillPathPanel.vue` — `showTree` += `the_tu`/`the_tu_an`; branch/tree display meta.
- `CombatBuildHud`/skill bar — Thế display for `the_tu_an` via a kit flag (`usesTheResource: true` on `CultivationPathKit`) — data-driven, no UI path-id checks; Ẩn emblem/passive-slot presentation reuses the `emblemOnly` convention.
- **externalWard presentation (review P1.2 — locked: separate layer).** The HUD shows externalWard as its own shield layer/bar ("Sơn Nhạc Hộ Thể"), NOT merged into the native ward bar — it is a protection-only pool, not spendable Ward, so folding it into the ward bar would falsely imply it fuels ward-spend skills. Reads `entity.externalWard?.amount` directly; the hit result keeps `wardAbsorbed` as the total for damage-float text and gains `externalWardAbsorbed` so the layer can animate its own consumption. Vitals `wardBefore/wardAfter/maxWard` stay native-only.
- Artifact panels — `the_tu`/`the_tu_an` absent from `ARTIFACT_ID_BY_CULTIVATION_PATH` → verify graceful (existing `undefined` handling).

### Task 23 — Docs sync

- `roadmap.md` §0.11 — delivered scope; combat-chain contract notes if the reactive/intercept/dodge-side windows changed the R-contract (P17 — same-change reference update).
- Spec file — status → Implemented; record the composite `triggerContext` encoding (spec's flat enum → plan's object superset) + the externalWard contract as the spec's "implementation detail flagged" resolution.

### Task 24 — Final verification

1. `npm run type-check` + `npm run build` + `npx vitest run` (FULL — save version + cross-cutting combat).
2. `tutienidle-adversarial-qa` quick (P4) → `docs/qa/`.
3. `balance-check` (new formulas/constants/tree).
4. `code-review` (P5) on aggregate diff.
5. P13/P14: Vue-panel changes only — defer browser check per worktree exception, state it.

---

## Ordering & dependencies

- 1–3 first; 4–5 independent. Phase B: 6 → 7,8 → 9 → 10,11 → 12 → 13. Phase C: 14 → 15 → 16 → 17,18 → 19,20 → 21. (17 needs 15+16; 18 needs 16.)
- Parallelizable (P6/subagents): Task 5 sweep and Task 12/20 data authoring vs engine tasks (disjoint files).
- Conditional-order rule: re-check sibling merges at each task start (huy_quyen, emblemOnly, field-driven Thế, CombatEntity slimming).

---

## Review-fix appendix (v2 changes from v1)

| # | Finding | Resolution |
|---|---|---|
| 1 | Assembly emitter missing; wrong constants | Task 3: `getTheTuAnReactiveStatModifiers` wired at `resolvePlayerFinalStats` + delta deriver; spec §3.2 constants verbatim |
| 2 | Only `enduranceThreshold` moved | Task 3c: all four stats gated `the_tu` + universal-source sweep + per-path regression matrix |
| 3 | Missing-HP became a stat | Task 7: `damage` fields only; node scaling via kit-modifier collector |
| 4 | `loan_dau` invented self-cost | Removed — no `selfCost` field |
| 5 | `autoCastable:false` vs T11 | Field dropped; test asserts auto-cast fires it |
| 6 | Survive source could refresh buff | Result-object contract; active-buff path returns bare `{survived:true}` |
| 7 | Taunt inverted/newest/scripted | Task 10 rewritten: actor's-own-pool read, `uniquePerTarget` newest-wins, scripted-special `ignoreTaunt` |
| 8 | Refund double-counted | Success credits `THE_PROC_GAIN` only (net +5) |
| 9 | Ward lifecycle/authority | `externalWard` pool: replace-on-recast, consume-first, expiry-clears, `wardMax`-exempt |
| 10 | Wrong technique id | `kim_cang_bat_hoai_the` (existing) for `the_tu` |
| 11 | Flat context enum | Composite `triggerContext {origin, intercepted?, outcome?}` |
| 12 | Unspec'd content/typos | tran_ap taunt-on-hit dropped; bach_ung uses spec-listed riders only; `evasionRate` |
| — | Reviewer lacked sibling-worktree context | Conditional notes: `huy_quyen`/`CAST_LEVELING_THRESHOLDS`/`emblemOnly`/field-driven Thế may already be merged |

## v2.1 changes (second review pass)

| # | Finding | Resolution |
|---|---|---|
| P0.1 | Cap clamped in emitter → delta drops off cap early | Emitters + deriver emit raw; `STAT_METADATA.max = 0.60`; `clampStatValue` at roll/display only; regression test added |
| P0.2 | externalWard absorb false-fires ward break | Split `externalWardAbsorbed`/`nativeWardAbsorbed`; ward break gates on native only; `result.wardAbsorbed` stays the total |
| P1.1 | missing-HP test contradicted per-hit recompute | Test re-reads live HP before EACH hit (Berserk×Reflection integration) |
| P1.2 | externalWard read-authority ambiguous | Protection-only pool — `spendWard`/consumers stay native-only; no `getTotalWard` accessor |
| P1.3 | Cleanup only on natural expiry; bare number | `externalWard {sourceId, amount}`; existence-bound reconcile on ANY removal path (expiry/dispel/replace) |
| P1.4 | Trợ narrowed to affected[0] | `triggering_targets` — all live affected of the triggering action |
| P1.5 | absorbed≠taken untested | `hpDamage>0` gate + explicit test |
| P1.6 | income↔proc ordering undefined | Locked: outcome income credited BEFORE that outcome's reactive window |
| P1.7 | Task 20 channel left as "pick" | `collectTheTuAnMechanicModifiers` — single locked channel, participant-build baked |
| P1.8 | Registry def mutation risk | Participant-local def clones only, passed to `BuffSystem.apply` |

## v2.2 changes (third review pass)

| # | Finding | Resolution |
|---|---|---|
| P0.1 | Bypass still ran the whole turn lifecycle before `isFollowUpBypass` was read — reactive procs would burn buff durations, tick cooldowns/regen, complete rounds | `executionKind` on queue entries; `reactive_bypass` branches at the TOP of `declareActorAction` — no turn counter, no round tracking, no buff/DoT/cooldown/regen ticks, no charge advance; real action, not a real turn. Lifecycle-invariant tests added |
| P0.2 | `batTuDurationBonus`/`tauntTurnsBonus` had no delivery channel — durations live on `BuffDefinition`, reachable only via `definitionId`/`grantBuffId` | `TurnBuffApplication.durationOverride` + `SurviveLethalResult.grantBuffDurationOverride` — both ride the existing M10 `BuffSystem.apply(durationOverride)` channel; manual and lethal-grant Bất Tử share one resolved duration |
| P1.1 | Reconcile keyed to "any marker" could resurrect another source's pool | `son_nhac_ho_the` gets `uniquePerTarget`; reconcile keyed to `externalWard.sourceId` |
| P1.2 | externalWard invisible to HUD (vitals events are `currentWard`-only) | Separate "Sơn Nhạc Hộ Thể" shield layer reading `entity.externalWard`; `externalWardAbsorbed` on hit results for layer animation |

## v2.3 changes (fourth review pass)

| # | Finding | Resolution |
|---|---|---|
| P0.1 | Bypass wording implied damage inside `declareActorAction` — would fork the declare→impact authority | Bypass skips ONLY the lifecycle; still builds+returns a `TurnDeclaredAction` resolved by `applyActionImpact` |
| P0.2 | `maxTheBonus` dead if phap merge absent | Plan owns the fallback: `CombatEntity.maxThe` baked at build (`MAX_THE + bonus`); reuse sibling authority if present; single `entity.maxThe ?? MAX_THE` clamp |
| P1 | Basic income could fire through both channels (+8) | Exactly-one-channel invariant: field OR marker, decided once by merge check |
| P1 | `durationOverride` is pre-modifier, not absolute | Superseded by v2.4 — `durationPolicy` primitive added |

## v2.4 changes (fifth review pass)

| # | Finding | Resolution |
|---|---|---|
| P0 | "3 holder-turns" wasn't actually 3 turns — ailment resist/duration stats scaled it (a caster's own resist shrinking their own Bất Tử) | `BuffDefinition.durationPolicy: 'ailment_scaled' \| 'fixed_holder_turns'` (default scaled, backward compat); all the_tu holder-turn buffs authored `fixed_holder_turns`; `khiem_khich` stays scaled (enemy resist legitimately shortens Taunt) |
| — | Version header stale; save-version hardcoded 62 | Header → 2.4; Task 1 bumps `CURRENT_SAVE_VERSION` exactly once from the integrated branch's live value |
