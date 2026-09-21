# P7 — M4 Spec: Combat-Role Contract Unification

Status: DRAFT v5 — pending ChatGPT re-review (v1: 5; v2: 5; v3: 3; v4: 1 — two residual stale unlocked lines).
Authority: `docs/p7/mission-graph.md` M4 ("generic loadout retired — Skill save fields, ops, combat reads; mortal role contract `tram`→basic, empty roles; path starter basics authored, path authority resolves starter at initiation; precursor/cast-threshold tables reworked; loadout UI reduced to resolved-role display; full IA is M7").
Depends on: M1 (`ce32f140`), M3 (`e9a0bd32`) — canonical way/technique authority in place; save version 70.

## 1. Problem

Combat consumes a **role contract** — `ResolvedCombatKit { basic, special?, ultimate? }` stamped onto `TurnBattleParticipant` (`CombatBuild.ts:56-70,216-236`) and read by `selectAction`/`selectForcedAction` (`TurnSkillAction.ts:565-670`, `TurnSkillSlotRole = 'basic'|'special'|'ultimate'`). That contract is already resolved by **path authority**: `CultivationPathRuntime.resolveBasic`/`resolveSpecialUltimate` per `(path, way)` pair (`CultivationPathRegistry.ts:331-557`).

Between the player and that contract sits a **second, generic model** — the N-slot Skill Loadout (`Skill.loadoutSlot`/`loadoutSlots`/`equipped`, `equipToSlot`, realm-scaled `getSkillLoadoutSlotCount` 1→5, `setSkillLoadoutSlot`, `SkillLoadoutStrip`/`RadialSkillSelector`). Its actual combat footprint is exactly **one read**: the mortal runtime's `getEquippedInSlot(0)` restricted to cast-leveled basics (`CultivationPathRegistry.ts:335-337`). Every committed-way runtime resolves roles from way kit data, `spellPath.element`, node ownership, emblem markers, or orb presets — never from slots. `getLoadoutSkills`/`getLoadoutEntries`/`getActiveSkills` have **zero production callers**; the scheduler comment claiming slot-ordered auto-cast is stale (the turn scheduler reads participant roles).

The generic model also carries three redundant state flags on every learned skill: `equipped` (passive ON switch — but passives are always learned+`equipWithoutSlot`, so learned≡equipped in practice), `unlocked` (learned flag — always true on live entries, provably redundant; deleted per §4.3a), and the slot indices.

## 2. Current state (measured, M3 commit `38b56a03`)

| Surface | Today | Reads |
|---|---|---|
| `Skill` fields | `loadoutSlot?: number`, `loadoutSlots?: number[]`, `equipped: boolean`, `unlocked: boolean` (+level/experience/totalExperience/selectedSpecializationId) | `loadoutSlot(s)` → `getEquippedInSlot` (mortal basic only), strip UI; `equipped` → `getPassiveSkills`/`getActiveSkills`/`getEquippedInSlot` filters; `unlocked` → `equipToSlot`/`setSkillLoadoutSlot` learned-checks (always true on live entries — redundant) |
| `SkillManager` | `getEquippedInSlot`, `getLoadoutEntries`, `getLoadoutSkills`, `getActiveSkills` (equipped actives), `getPassiveSkills` (equipped passives) | passive modifiers via `getScaledPassiveModifiers` (**sole live consumer**); slot reads = mortal runtime + strip + RadialSkillSelector; `getActiveSkills`/`getLoadout*` = no production callers |
| `SkillSystem` | `equipToSlot`/`unequipFromSlot`/`equipWithoutSlot`/`unequip`; `learn`, `upgradeSkill`, `recordCast`, `selectSpecialization`, `progressionOf` | ritual kit grant (`equipToSlot(index)`), passive grants (`equipWithoutSlot`), `unequipSkillIds` strip |
| `SkillLoadoutSlots.ts` | `REALM_SLOT_TABLE` mortal:1 → tribulation:5, `MAX_SKILL_LOADOUT_SLOTS=5` | `setSkillLoadoutSlot` validation, `SkillLoadoutStrip` locked-slot render |
| Ops | `progressionOps.setSkillLoadoutSlot` (realm-validated + K3 precursor gate), `unequipSkill` | `useLoadoutActions`, `App.vue` (3 tram writes), `EarlyGameBootstrap` |
| Mortal combat | `createMortalRuntime`: `getEquippedInSlot(0)` ∩ `CAST_LEVELING_THRESHOLDS` → authored basic, else `tram`; `resolveSpecialUltimate → undefined` | the ONLY combat slot read |
| Way kits | `way.skillIds` → `learnSkill` + `equipToSlot(index)` at ritual; `way.unequipSkillIds` → `unequip` (sword: all 3 precursors; body: tram+huy_quyen; spell: none declared); `way.passiveSkillIds` → learn + `equipWithoutSlot` | kit grant ritual only — runtimes never consult slots |
| Precursor leveling | `CAST_LEVELING_THRESHOLDS` {tram,linh_bao,huy_quyen}: lv2=1000, lv3=10000 casts; `recordCast` auto-levels via `totalExperience`; mirrors `player.skillCastCounts`/`skillLevels` | offer gates (`requiresSkillLevel`→skillLevels huy_quyen Lv3 hidden_body, `requiresSkillCastLevel`→cast counts linh_bao Lv3 hidden_spell, tram Lv3 hidden_sword via `skillCastCount` node gate); `HUY_KIEM_L3_CASTS`/`HUY_QUYEN_L3_CASTS` aliases |
| Boot/restore | `EarlyGameBootstrap`/`App.vue.onNewCharacter`: learn tram+linh_bao+huy_quyen, `setSkillLoadoutSlot(0,'tram')`; `onRestoreOk`: idempotent tram-to-slot-0 + precursor learn | starter state |
| `SkillProgressionState` | `unlocked, equipped, loadoutSlots` + progression fields | `progressionOf`/`getResolvedSkill` projection (skilldef seam) |
| UI | `SkillLoadoutStrip` (5-slot row, locked tiers, spec chips, opens RadialSkillSelector), `RadialSkillSelector` (all-learned-active picker), `useLoadoutActions.setSkillLoadoutSlot`/`unequipSkill`, `SkillDetailView` (cast progress + Cam Ngo upgrade — unaffected) | skill-path panel |
| Save | `save.skills: Skill[]` (id + full instance fields); `validateIdEntries` id-only; restore re-derives authored fields (`GameManagerSaveRestore.ts:268-322`) | version 70 |

## 3. Scope

**In scope**

- Retire the generic loadout model: `Skill.loadoutSlot`, `loadoutSlots`, `equipped`; all equip/slot ops; `SkillLoadoutSlots.ts`; `way.unequipSkillIds`; `SkillProgressionState.equipped`/`loadoutSlots` (§4.1-4.3).
- Mortal role contract: `player.mortalBasicSkillId` + `setMortalBasicSkill` op; mortal runtime reads it; precursor whitelist moves to skill-domain authority (§4.4-4.5).
- **Path starter basics**: `way.starterBasicSkillId` authored (`linh_bao`→spell_pathway, `huy_quyen`→body_pathway); the way's `resolveBasic` falls back to the starter until the element/root kit supersedes it (§4.5b).
- Ritual grant re-shape: `way.skillIds`/`passiveSkillIds` learn-only; precursor strip + `mortalBasicSkillId` clear, with a pinned preserve-on-failure invariant (§4.6).
- Passives = always-on while learned (`getPassiveSkills` filters `type==='passive'` only — membership is the learned authority, §4.3a/§4.7).
- Resolved-role display read honoring the FULL kit composition (`emblemSlots` + `buildDynamicBasic` presence), not just nominal basic/special/ultimate (§4.8).
- Save v71: retired-key rejection on skill entries + `mortalBasicSkillId` validation (§4.9).

**Out of scope** — `upgradeSkill`/`recordCast`/cast mirrors (`skillCastCounts`/`skillLevels` stay — they are prerequisite mirrors, not loadout); offer-gate mechanisms; node `unlocksSkillIds` learning; specialization select; skilldef `SkillDefinition` redesign; Technique model (M3); equipment `equipped`/bag slots (different domain); technique-gated node prerequisites (M6); SkillPathPanel/RealmPanel IA and TechniquePanel removal (M7); new skills or balance tuning.

## 4. Design

### 4.1 Retired `Skill` surface

```ts
// Skill loses:
- loadoutSlot?: number
- loadoutSlots?: number[]
- equipped: boolean
- unlocked: boolean          // the learned flag — see §4.3a
// Skill keeps: id/name/description/type/target/effects/execution/...
//   level/experience/totalExperience, selectedSpecializationId,
//   specializations, passive* fields, ...
```

- `learn()` becomes pure membership insert: `if (manager.has(id)) return false; manager.add(structuredClone(skill) + xp defaults)` — no state flags to write.
- `SkillProgressionState` drops `equipped`, `loadoutSlots`, `unlocked`; `progressionOf` stops projecting them.
- Every skill data entry's `unlocked: false` + `equipped: false` lines are swept (mechanical; templates never declare them true).

### 4.2 Retired ops + manager surface

| Retired | Replacement / fate |
|---|---|
| `SkillSystem.equipToSlot` | deleted — no role-write exists anymore |
| `SkillSystem.unequipFromSlot` / `unequip` | deleted — nothing is equipped to un-equip |
| `SkillSystem.equipWithoutSlot` | deleted — passives are active on learn (§4.7) |
| `SkillManager.getEquippedInSlot` | deleted — mortal runtime reads `player.mortalBasicSkillId` (§4.5) |
| `SkillManager.getLoadoutEntries` / `getLoadoutSkills` | deleted — zero production callers |
| `SkillManager.getActiveSkills` | deleted — zero production callers |
| `SkillManager.getPassiveSkills` | kept, re-pointed: `type==='passive'` (learned) — sole consumer `getScaledPassiveModifiers` |
| `progressionOps.setSkillLoadoutSlot` | deleted — replaced by `setMortalBasicSkill` (§4.5) |
| `progressionOps.unequipSkill` | deleted |
| `SkillLoadoutSlots.ts` (`REALM_SLOT_TABLE`, `getSkillLoadoutSlotCount`, `MAX_SKILL_LOADOUT_SLOTS`) | deleted — role count is fixed (3), not realm-scaled |
| `useLoadoutActions.setSkillLoadoutSlot` / `unequipSkill` | replaced by `setMortalBasicSkill` |
| `PathWayDefinition.unequipSkillIds` + all way values | deleted — precursor strip is moot: post-path roles resolve from kit authority; precursors stay learned but can never occupy a role |
| `CultivationPathRuntimeDeps.skillManager` Pick `getEquippedInSlot` | narrows to `'get' \| 'has'` |

### 4.3 Passives: learned = active (contract pin)

`getScaledPassiveModifiers` comment already states the intent: *"MỌI passive skill đang unlocked … luôn có hiệu lực 1 khi mở khoá"*. The `equipped` flag was the only thing standing between that comment and reality, and every passive grant path (ritual `passiveSkillIds`, `syncRealmPassive`, node grants, quest grants) already learned-then-equipped — there is no authored "learned but intentionally off" passive. Locked: **learned passives always apply**; `getPassiveSkills` filters `type==='passive'` only. The `unequipSkill` passive off-switch is deleted with the op (no UI exposed it for passives anyway — `SkillLoadoutStrip` never listed them).

### 4.3a Learned-state authority — manager membership, `unlocked` deleted

`unlocked` was the learned flag by convention but is **provably redundant**: `learn()` always sets `true`, templates ship `false`, and no writer ever clears it post-learn — every live entry is `unlocked: true`. Rather than sweep every membership-read consumer (`assertNgoDaoKitLearned`, Ngộ Đạo multicast, capability `hasSkill`, `syncRealmPassive` idempotence, `selectSpecialization`, `upgradeSkill`, `getSkillUpgradeInsightCost`) to a second flag check, **the field is deleted**: manager membership ≡ learned, the single authority. `syncRealmPassive`'s `!has(id)` re-grant check, capability predicates, and kit asserts are automatically correct — an entry the manager holds IS learned. The v71 boundary rejects any saved entry carrying `unlocked` (§4.9), so no false-entry can exist to be half-read.

### 4.4 Mortal role contract — persisted pick

```ts
// PlayerData — new optional field, declared in createDefaultPlayer as
// `mortalBasicSkillId: undefined` (Pinia toRefs key convention).
mortalBasicSkillId?: string
```

- **Contract:** mortal combat roles = `{ basic: resolved mortal pick, special: none, ultimate: none }` — unchanged from today (mortal runtime already returns `resolveSpecialUltimate → undefined`).
- **Legal values:** `MORTAL_PRECURSOR_SKILL_IDS` members (`'tram' | 'linh_bao' | 'huy_quyen'`); absent → `'tram'`.
- **Lifetime:** valid only while `cultivationPath` is unset. The ritual clears it at commit (same block as the realm promotion); post-path saves carrying it are corrupt (preflight §4.9).

### 4.5 Precursor authority + `setMortalBasicSkill`

`MORTAL_PRECURSOR_SKILL_IDS` moves out of `kiem-tu/KiemTuState.ts` (a path module owning a mortal concept) into a new leaf **`core/skill/MortalPrecursors.ts`** (imports nothing):

```ts
export const MORTAL_PRECURSOR_SKILL_IDS = ['tram', 'linh_bao', 'huy_quyen'] as const
export const MORTAL_DEFAULT_BASIC_ID = 'tram'
export function isMortalPrecursorSkillId(id: string): boolean
```

- Contract test asserts `Object.keys(CAST_LEVELING_THRESHOLDS)` equals the precursor set — the two authorities may not drift.
- `progressionOps.setMortalBasicSkill(player, skillId): boolean` — the **only role write** in the game. Guards in order: `player.cultivationPath === undefined` (the K3 precursor gate — post-path players can never write a precursor basic); `isMortalPrecursorSkillId(skillId)`; `skillManager.has(skillId)` (learned — membership is the authority, §4.3a). Writes `player.mortalBasicSkillId = skillId`.
- Mortal runtime `resolveBasic` re-points: `const pick = player.mortalBasicSkillId; authoredId = pick && isMortalPrecursorSkillId(pick) && deps.skillManager.has(pick) ? pick : MORTAL_DEFAULT_BASIC_ID` → `resolveAuthoredBasic` chain unchanged (`BASIC_ATTACKS_BY_BUILD`/`GENERIC_PHYSICAL_BASIC` fallbacks stay).
- `KiemTuState`'s export is deleted; its 3 consumers (`KiemTuPath` ×2 `unequipSkillIds` — deleted anyway; `GameManagerProgressionOps` K3 gate — becomes `setMortalBasicSkill` guard; tests) re-point.

### 4.5b Path starter basics (mission-graph requirement)

Two precursors are **path-flavored** — `linh_bao` (Linh Bảo, spirit treasure → spell) and `huy_quyen` (Hủy Quyền, destroy fist → body); their hidden-way offer gates already encode that pairing. Authored on the way:

```ts
// PathWayDefinition — optional; absent = the way's kit fully owns
// basic resolution from the moment of initiation (sword's orb
// machinery, both hidden ways' fixed kits).
starterBasicSkillId?: string
```

- `SPELL_PATHWAY.starterBasicSkillId = 'linh_bao'`; `BODY_PATHWAY.starterBasicSkillId = 'huy_quyen'`; all other ways declare none.
- **Supersede rule:** the starter is a *fallback* basic, not an override — the way's own kit resolution wins the moment it can resolve:
  - `createSpellPathwayRuntime.resolveBasic`: element kit basic (element picked) → **starter** → `BASIC_ATTACKS_BY_BUILD` → `GENERIC_PHYSICAL_BASIC`. Today's dead-basic window between ritual and `selectSpellPathElement` closes — the player fights with linh_bao.
  - `createBodyPathwayRuntime.resolveBasic`: `resolveBodyKit()?.basic` (a root node purchased) → **starter** → `GENERIC_PHYSICAL_BASIC`.
- **Authored-read pin (no literal authority):** runtimes resolve the starter through the committed way definition — `getActiveWayDefinition(player)?.starterBasicSkillId` — never a hard-coded id literal inside `resolveBasic`. Changing the authored way value changes combat.
- Starter defs resolve through `resolveAuthoredBasic` with the learned-check (`has(id)` — §4.3a) — boot teaches all three precursors, so the check is defensive.
- Post-path starter casts keep flowing through `recordCast` (the precursor is in the basic role) — correct: cast counts are skill-leveling state, orthogonal to which role emitted them.
- This is an **intentional behavior delta**, not byte-identical: spell players pre-element and body players pre-root now use the starter basic instead of `GENERIC_PHYSICAL_BASIC`.

### 4.6 Ritual grant re-shape

`chooseCultivationPath`'s kit block becomes:

```ts
// way.skillIds — learn-only (runtimes resolve roles; no slot equip).
way.skillIds?.forEach((skillId) => this.deps.progressionOps.learnSkill(skillId))
// way.passiveSkillIds — learn-only (passives active on learn).
for (const passiveId of way.passiveSkillIds ?? []) { learnSkill(passiveId) }
// mortal-basic pick is mortal-scoped state — cleared with the mortal realm.
player.mortalBasicSkillId = undefined
```

- The `way.unequipSkillIds` loop and the field itself are deleted from `PathWayDefinition`, `KiemTuPath` (both ways), `TheTuPath` (both ways) — nothing needs stripping: post-path `resolveBasic` never consults precursors (starter basics resolve through `resolveBasic` itself, §4.5b — no equip step).
- Pre-commit template checks for `skillIds`/`passiveSkillIds` stay, **plus** `way.starterBasicSkillId` resolves a template (atomicity contract unchanged).
- **Starter learnedness pin:** inside the commit block (post-`applyPathChoice`), `learnSkill(way.starterBasicSkillId)` runs alongside the kit grant — idempotent for the normal case (boot already taught it), and it repairs a save whose starter entry is missing. A successful initiation always yields a learned starter; membership ≡ learned (§4.3a), so no `unlocked:false` repair case exists.
- **Atomicity pin (F5):** `mortalBasicSkillId` is cleared only inside the commit block (post-`applyPathChoice`, same region as the realm promotion). Every pre-commit rejection path — wrong pair, failed offerGate, missing technique/skill/passive/starter template, occupied technique holder — leaves `mortalBasicSkillId` **byte-identical**; a dedicated test joins the existing zero-mutation ritual assertions.

### 4.7 Shared role-composition seam — one authority for build + display

The nominal `{basic, special, ultimate}` from `resolveBasic`/`resolveSpecialUltimate` is **not** the whole contract: `CombatBuild` additionally carries `emblemSlots` (hidden_sword overrides) and `buildDynamicBasic` (sword's real basic — the static resolveBasic return is an inert filler). To avoid a second copy of that precedence (the drift class M4 exists to remove), the composition is extracted into **one pure seam consumed by both** `resolveCombatBuild` and the UI accessor:

```ts
// core/player/CultivationPathRoles.ts (leaf — imports only types)
// The FULL participant-kit shape — a lossy subset would force
// consumers to re-resolve and drift back apart.
export interface CombatRoleComposition {
  /** Nominal basic — stamped under the dynamic provider for sword ways. */
  basic: TurnSkillDefinition
  /** True when runtime.buildDynamicBasic owns the real basic (sword ways). */
  basicIsDynamic: boolean
  special?: TurnSkillDefinition           // emblem-precedence resolved
  ultimate?: TurnSkillDefinition          // emblem-precedence resolved
  reactivePayloads?: Record<string, TurnSkillDefinition>  // hidden_body channel
  maxThe?: number                         // kit-declared The cap (CombatBuild:243)
}
export function resolveCombatSkillRoles(
  player: PlayerData,
  runtime: CultivationPathRuntime,
): CombatRoleComposition {
  const su = runtime.resolveSpecialUltimate(player)
  const emblem = runtime.emblemSlots?.()
  return {
    basic: runtime.resolveBasic(player),
    basicIsDynamic: runtime.buildDynamicBasic !== undefined,
    special: emblem?.special ?? su?.special,
    ultimate: emblem?.ultimate ?? su?.ultimate,
    reactivePayloads: su?.reactivePayloads,
    maxThe: su?.maxThe,
  }
}
```

- `resolveCombatBuild` consumes it: `kit.basic/special/ultimate/reactivePayloads` come straight from the composition; `entity.maxThe` reads `composition.maxThe` (the `specialUltimate?.maxThe` line collapses into it); `kit.buildDynamicBasic` factory binding stays on the build for ops to mint; `kit.emblem` is **deleted** — the emblem precedence now lives inside the seam, so the participant build and `collectClones` read already-resolved roles.
- `progressionOps.getResolvedSkillRoles(player)` decorates the same result for display — `basicIsDynamic` → `{kind:'dynamic', label}` where the label comes from the runtime (`describeDynamicBasic?(): { name: string }`, new optional member; sword ways return their authored label — copy pinned in the plan); otherwise `{kind:'def', def}` + `skillManager.get(def.id)` when the id is a learned skill (level/specialization rows). Special/ultimate render the seam's resolved defs. **Zero precedence logic in the accessor** — it cannot diverge from combat.

UI consequences:

- `SkillLoadoutStrip` → resolved-role display: three role cards (`Căn Bản`/`Đặc Biệt`/`Tuyệt Kỹ` vocabulary) showing name/level/icon; empty roles render a muted state; `dynamic` basics render their label card. The mortal **basic** card opens a small chooser listing the learned precursors (3 items) → `setMortalBasicSkill`. Specialization chips render under an opened role card only when `entry.skill?.specializations` exists. No realm-scaled locked tiers, no empty-slot counters.
- `RadialSkillSelector` deleted (its "pick any learned active into a slot" job no longer exists).
- `SkillDetailView` unchanged (cast progress + Cảm Ngộ upgrade read learned skills, not roles).
- `App.vue` writes: `onNewCharacter`/`EarlyGameBootstrap` → `learnSkill` ×3 only (no slot write; resolution defaults to tram). `onRestoreOk` → idempotent precursor `learnSkill` only (the tram-to-slot-0 repair disappears — there is no slot to repair).
- `useAppLifecycle` test mock's `setSkillLoadoutSlot` entry re-points.

### 4.8 Cast-threshold surface (the "rework" pinned)

The mission-graph "precursor/cast-threshold tables reworked" resolves to **ownership clarification, not curve change**:

- `CAST_LEVELING_THRESHOLDS` stays the **leveling authority** (lv2 1000 / lv3 10000, `recordCast` auto-level via `totalExperience`, `skillCastCounts`/`skillLevels` mirrors, `getCastLeveledSkillLevel`, `HUY_KIEM_L3_CASTS`/`HUY_QUYEN_L3_CASTS` aliases, `SkillDetailView` progress) — all unchanged.
- `MORTAL_PRECURSOR_SKILL_IDS` in `core/skill/MortalPrecursors.ts` owns exactly the **mortal-selectable** basic set — previously the same set was implied twice (table keys + KiemTuState list + `in CAST_LEVELING_THRESHOLDS` gate). One list, contract-tested against the table keys. Post-path starter authority is a separate concern: `PathWayDefinition.starterBasicSkillId` (§4.5b) — a precursor may be starter-authored for one way, but the two sets are NOT declared equal (`tram` is starter for no way).
- `recordCast`'s per-skill counting is unchanged. Precursor casts happen in **two windows**: while the precursor is the mortal basic pick, and post-path while it is the way's starter fallback (spell/body until element/root supersedes). The write-side guard (`setMortalBasicSkill` mortal-only) bounds the first window; role resolution owns the second — neither uses an equip gate.

### 4.9 Save contract — v71

- `CURRENT_SAVE_VERSION` 70 → **71**; v70 rejected (dev-phase no-migration policy, same as M2/M3).
- `save.skills` entries: `loadoutSlot`/`loadoutSlots`/`equipped`/`unlocked` no longer exist on the type. `validateIdEntries` is id-only and tolerates extra fields — and `GameManagerSaveRestore` `structuredClone`s the entry, so a v71 payload carrying retired keys would survive restore and re-persist through `skillManager.getAll()`. **Pinned:** the skills validator additionally REJECTS entries carrying `'loadoutSlot' | 'loadoutSlots' | 'equipped' | 'unlocked'` keys (retired keys = corrupt payload, never sanitized-then-loaded).
- `player.mortalBasicSkillId` preflight: absent → OK; present → must be a `MORTAL_PRECURSOR_SKILL_IDS` member **and** `player.cultivationPath` must be absent (post-path presence = corrupt → reject).
- `createDefaultPlayer` declares `mortalBasicSkillId: undefined` (Pinia key convention).

### 4.10 What is explicitly NOT changing

- `CultivationPathRuntime` interface shape (deps Pick narrows by one member; one optional `describeDynamicBasic` display member added — presentation only).
- Way-runtime kit resolution for committed paths (element kit, orbs, body kits, emblems, hidden kits) — already path-authority; only the starter-basic fallback is added (§4.5b).
- `skillCastCounts`/`skillLevels` mirror machinery, `recordCast`, `upgradeSkill`, `getSkillUpgradeInsightCost`, `selectSkillSpecialization`, node `unlocksSkillIds` learning, `assertNgoDaoKitLearned`.
- `Skill.type`, `SkillExecutionPolicy`, specialization model.
- Combat scheduling/`selectAction`/`selectForcedAction`/manual forced picks — they already read roles.
- Equipment `equipped`/bag `getEquippedInSlot` — different domain, untouched.

## 5. Acceptance

- `Skill` carries no `loadoutSlot`/`loadoutSlots`/`equipped`/`unlocked`; `SkillProgressionState` likewise.
- No `equipToSlot`/`unequipFromSlot`/`equipWithoutSlot`/`unequip`/`setSkillLoadoutSlot`/`unequipSkill`/`getEquippedInSlot`/`getLoadout*`/`getActiveSkills`/`getSkillLoadoutSlotCount`/`MAX_SKILL_LOADOUT_SLOTS`/`unequipSkillIds` references in production (equipment-bag `getEquippedInSlot` excepted — different type).
- Mortal battle uses the persisted basic pick (tram default; linh_bao/huy_quyen selectable); mortal special/ultimate stay empty.
- `setMortalBasicSkill` rejects: post-path, non-precursor, unlearned id.
- `spell_pathway` resolves its authored `starterBasicSkillId` (`linh_bao`) as basic until an element is picked; `body_pathway` resolves `huy_quyen` until a root node exists — both read through `getActiveWayDefinition`, not literals; a successful ritual guarantees the starter is learned.
- `resolveCombatSkillRoles` is the single composition seam for `resolveCombatBuild` and `getResolvedSkillRoles`; sword ways display a `dynamic` basic label; hidden_sword emblem overrides surface in display.
- Ritual grants kit skills learned-only; way defs carry no `unequipSkillIds`; `mortalBasicSkillId` cleared at commit **and preserved byte-identical on every pre-commit failure path**.
- Learned passives (manager membership) apply without flags; `getScaledPassiveModifiers` totals unchanged.
- `SkillLoadoutStrip` renders the resolved roles (no realm-slot table); mortal basic chooser switches the pick.
- Save v71: fresh mortal save carries no `mortalBasicSkillId`; a post-path save carrying it rejects; skill entries carrying retired keys reject; literal v70 payload rejects.
- `npm run verify` green. **Intended delta:** spell-pre-element and body-pre-root combat builds now resolve the starter basic (was `GENERIC_PHYSICAL_BASIC`) — every other resolved role is byte-identical to M3. Balance/sim baselines that fight inside those windows may shift; any drift is documented in `docs/balance/`.
