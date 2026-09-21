# P7 — M2 Spec: Realm-Entry Passive Ownership Migration

Status: ACCEPTED — ChatGPT review SPEC_PASS (v3).
Authority: `docs/p7/mission-graph.md` M2; `docs/p7/decisions.md` D2; `docs/p7/system-inventory.md` (FOLD — realm-entry passive skill reward).
Depends on: M1 (`ce32f140`) — canonical path/way identity in place; save version 68.

## 1. Problem

Realm-entry passive skills have two owners, both wrong:

1. `Technique.passiveSkillIdsByRealm` — a technique carries the realm→passive ladder; `GameManagerRealmAdvanceOps.syncRealmPassive` resolves it through the **equipped** technique at each realm-entry seam. The way — the identity the player actually committed to — has no say.
2. `Technique.innateSkillId` — a technique carries a passive learned+equipped on equip. `equipTechnique` treats it as an implicit way-kit member; the way's `skillIds` kit cannot express it.

The way is the progression authority (D2/D7). A reward granted at realm entry must be declared by the way's reward channel, not smuggled through whatever technique happens to be equipped.

### Behavior honest-baseline (not a pure no-op migration)

This is an ownership migration with intentional corrections, not a strict zero-change port:

- **The ladder is effectively dead for path players today.** `syncRealmPassive` reads the *equipped* technique. `chooseCultivationPath` equips the way technique *before* the realm-entry sync, and the only technique carrying `passiveSkillIdsByRealm` is `tu_linh_quyet` — which the path player has just unequipped. So no normal post-path player ever receives `passive_linh_khi_cam_ung` or any later realm passive. M2 declares the ladder on every way's `realmRewards`, which **newly delivers** those passives. That is the intended D2 target state (realm rewards actually granted), not drift.
- **`innateSkillId` semantics change** from "grant whenever this technique is equipped" to "grant at way initiation" (declared). The ordinary player flow is equivalent — way techniques are equipped exactly once, at initiation — but the lifecycle contract is different: re-equipping a way technique later no longer re-grants the passive, and the passive no longer depends on technique state.
- **`passive_thai_hu_kiem_y` loses its only grant path.** `thai_hu_kiem_quyet` is an orphaned technique (no way equips it — `hidden_sword_pathway.techniqueId` is `van_kiem_quyet`); its innate could only fire if a player manually equipped the orphan. After M2 it is authored-unused, as in the original assessment — a content question for a later mission, not an ownership one.

## 2. Current state (measured, M1 commit)

| Field | Sites | Reads |
|---|---|---|
| `Technique.passiveSkillIdsByRealm` | declared on `tu_linh_quyet` only (Techniques.ts:242) — `qi_refining`→`passive_linh_khi_cam_ung`, `foundation_establishment`→`passive_truc_co_y_chi`, `golden_core`→`passive_kim_dan_chi_quang`, `nascent_soul`→`passive_nguyen_anh_minh_triet`, `soul_transformation`→`passive_hoa_than_chi_uy`, `void_refinement`→`passive_luyen_hu_bo`, `body_integration`→`passive_hop_the_chi_khu`, `mahayana`→`passive_dai_thua_dao_tam`, `tribulation`→`passive_do_kiep_chi_tam` | `syncRealmPassive` (GameManagerRealmAdvanceOps.ts:341); `useTechniqueSections` realm-passive display row |
| `Technique.innateSkillId` | `ngo_dao_chan_quyet`→`ngo_dao_hon_don` (:91), `ngu_kiem`→`passive_kiem_tam_lanh_liet` (:128), `thai_hu_kiem_quyet`→`passive_thai_hu_kiem_y` (:159), `kim_cang_bat_hoai_the`→`passive_kim_cang_y_chi` (:186) | `equipTechnique` (GameManagerRealmAdvanceOps.ts:113); `useTechniqueSections` innate display row; `QuanKhiPanel.sealedKitSkillNames` (QuanKhiPanel.vue:78-86 — hidden-way offer card kit list) |
| `PathWayDefinition.realmRewards` | `spell_pathway` declares `foundation_establishment → { techniqueId: 'dai_ngu_hanh_quyet_truc_co', artifactId: 'ngu_hanh_chau' }` | `grantCultivationPathRealmReward` (CultivationPathSystem.ts:173) — technique/artifact only; **one production caller: `TribulationOutcomeService`** (the BreakthroughOutcomeService mention is a comment). No initiation call site — the ritual grants the way technique directly, not through this op. |
| Way `techniqueId` | `sword_pathway`→`ngu_kiem`, `hidden_sword_pathway`→`van_kiem_quyet`, `spell_pathway`→`dai_ngu_hanh_chan_quyet`, `hidden_spell_pathway`→`ngo_dao_chan_quyet`, `body_pathway`→`kim_cang_bat_hoai_the`, `hidden_body_pathway`→`ung_the_than_quyet` | `chooseCultivationPath` learns+equips it post-commit |

### `syncRealmPassive` seams (the only call sites)

1. `chooseCultivationPath` — mortal→`qi_refining` transition inside the ritual (GameManagerRealmAdvanceOps.ts:265).
2. `BreakthroughOutcomeService.breakthrough` — every successful minor breakthrough.
3. `TribulationOutcomeService` — major-realm victory.

There is **no post-load seam**; do not describe one.

### `ownedContent` coverage today

| Way | its technique's `innateSkillId` | declared in `ownedContent.skillIds`? |
|---|---|---|
| `sword_pathway` | `passive_kiem_tam_lanh_liet` | **no** |
| `hidden_sword_pathway` | none (`van_kiem_quyet` has no innate) | — |
| `spell_pathway` | none | — |
| `hidden_spell_pathway` | `ngo_dao_hon_don` | **yes** (`HIDDEN_SPELL_PASSIVE_ID`) |
| `body_pathway` | `passive_kim_cang_y_chi` | **no** |
| `hidden_body_pathway` | none | — |

## 3. Scope

**In scope**

- Add `passiveSkillId?: string | null` to `CultivationPathRealmReward` (`null` = explicit suppression).
- Introduce the **shared canonical passive ladder** — one authored constant consumed at **composition time** to build each way's `realmRewards` (deduplicated authoring, way-overridable — D2's locked shape). Runtime resolves the way record only.
- Re-point `syncRealmPassive` to `getActiveWayDefinition(player)?.realmRewards?.[realm.id]?.passiveSkillId`.
- Add `PathWayDefinition.passiveSkillIds?: readonly string[]` — initiation-granted passives delivered by `chooseCultivationPath` after the path/way commit.
- **Remove** `Technique.passiveSkillIdsByRealm` and `Technique.innateSkillId` (fields, all four data declarations, the `equipTechnique` grant branch).
- Migrate the three display consumers (`useTechniqueSections` ×2 rows, `QuanKhiPanel.sealedKitSkillNames`).
- Extend the initiation template preflight and the ownedContent contract (§4.6).
- Pin `grantCultivationPathRealmReward` return semantics and the reward-record contract (§4.7).
- Bump save version 68 → 69 (§4.8); correct the stale mission-graph M8 note.

**Out of scope** — `RealmPassiveSystem` / `syncRealmStatPassive` (the permanent stat-modifier system — a different concept sharing the word "passive", disposition KEEP; do not merge); `equipWithoutSlot` semantics; new skill authoring; balance tuning; `thai_hu_kiem_quyet`'s orphan status (content decision for a later mission — this mission only removes the field it carried).

### Per-way `passiveSkillIds` mapping

| Way | `passiveSkillIds` | Source today |
|---|---|---|
| `sword_pathway` | `['passive_kiem_tam_lanh_liet']` | `ngu_kiem.innateSkillId` |
| `hidden_sword_pathway` | none | `van_kiem_quyet` has no innate |
| `spell_pathway` | none | — |
| `hidden_spell_pathway` | `['ngo_dao_hon_don']` | `ngo_dao_chan_quyet.innateSkillId` |
| `body_pathway` | `['passive_kim_cang_y_chi']` | `kim_cang_bat_hoai_the.innateSkillId` |
| `hidden_body_pathway` | none | — |

## 4. Design

### 4.1 Reward channel

```ts
export interface CultivationPathRealmReward {
  techniqueId?: string
  artifactId?: ArtifactId
  // Realm-entry passive grant, delivered by syncRealmPassive. null = the
  // way explicitly suppresses the canonical ladder for this realm.
  passiveSkillId?: string | null
}
```

### 4.2 Shared canonical ladder — composition-time dedup, not a runtime fallback

One authored constant — the `tu_linh_quyet` ladder **verbatim**:

```ts
export const CANONICAL_REALM_PASSIVE_LADDER: Readonly<Record<string, string>> = {
  qi_refining: 'passive_linh_khi_cam_ung',
  foundation_establishment: 'passive_truc_co_y_chi',
  golden_core: 'passive_kim_dan_chi_quang',
  nascent_soul: 'passive_nguyen_anh_minh_triet',
  soul_transformation: 'passive_hoa_than_chi_uy',
  void_refinement: 'passive_luyen_hu_bo',
  body_integration: 'passive_hop_the_chi_khu',
  mahayana: 'passive_dai_thua_dao_tam',
  tribulation: 'passive_do_kiep_chi_tam',
} as const
```

A composition helper builds each way's reward table so the **resolved way record literally contains the passiveSkillId** — D2 requires `way → realmRewards[realm] → passiveSkillId`; there is no runtime fallback:

```ts
// Builds a way's realmRewards: canonical ladder per realm, overlaid by
// the way's own records (techniqueId/artifactId merge in; a way-level
// passiveSkillId string replaces the canonical pick; null suppresses it).
export function composeRealmRewards(
  overrides: Record<string, CultivationPathRealmReward> = {},
): Record<string, CultivationPathRealmReward>
```

- Result: for every ladder realm `R`, `result[R].passiveSkillId = canonical` unless `overrides[R].passiveSkillId` is a string (override) or `null` (suppressed); `techniqueId`/`artifactId` from overrides merge into the same record. Non-ladder realms in overrides pass through as-is.
- All six ways call it: `realmRewards: composeRealmRewards()` for the five with no extra records; `spell_pathway: composeRealmRewards({ foundation_establishment: { techniqueId: 'dai_ngu_hanh_quyet_truc_co', artifactId: 'ngu_hanh_chau' } })`.
- `getActiveWayDefinition` stays the only runtime way resolver (fail-closed: mortal/way-less/corrupt pair → `undefined` → no passive of any kind, canonical or otherwise).

### 4.3 `syncRealmPassive` re-point

```ts
syncRealmPassive(player: PlayerData) {
  const realm = getCurrentRealm(player.realmId)
  if (!realm) return
  const way = getActiveWayDefinition(player)
  const passiveSkillId = way?.realmRewards?.[realm.id]?.passiveSkillId
  if (!passiveSkillId) return
  // unchanged tail: skillManager.has → return; template missing →
  // return; skillSystem.learn(template) + equipWithoutSlot
}
```

Fail-closed by construction: no active way → no record → no grant. `null`/absent `passiveSkillId` → no grant. Mortal at `mortal` realmId → not a ladder key anyway, but the way-less guard now rejects before the realm check matters.

### 4.4 Way initiation passives

```ts
interface PathWayDefinition {
  // ... existing fields
  passiveSkillIds?: readonly string[]  // passives granted at initiation, equipWithoutSlot
}
```

`chooseCultivationPath`, after the existing `skillIds` learn/equip loop, using the same authorities as `syncRealmPassive` (learned skills live in `SkillManager`, not `PlayerData`):

```ts
for (const passiveId of way.passiveSkillIds ?? []) {
  if (!this.deps.skillManager.has(passiveId)) {
    const template = this.deps.skillTemplates.get(passiveId)
    if (!template) continue  // unreachable: preflight rejects first
    this.deps.skillSystem.learn(template)
    this.deps.skillSystem.equipWithoutSlot(passiveId)
  }
}
```

`equipTechnique` drops the `innateSkillId` branch entirely — techniques become pure stat/mechanics carriers for progression purposes.

### 4.5 Display consumers

- `useTechniqueSections` — the two rows reading `innateSkillId` / `passiveSkillIdsByRealm` are **removed** (the technique panel no longer shows passive information; the passive is way-owned content, surfaced through way/skill surfaces like every other kit passive). No re-point: the technique display has no business rendering way-owned rewards.
- `QuanKhiPanel.sealedKitSkillNames` — re-pointed to the way declaration: `[...(way.skillIds ?? []), ...(way.passiveSkillIds ?? [])]`. Strictly more correct than today (reads the declaration of record instead of a technique snapshot) and is the only UI whose job is displaying the way's kit.

### 4.6 Atomicity + ownership contracts

- **Template preflight** — `chooseCultivationPath` currently validates `way.techniqueId` template, `technique.innateSkillId` template, and every `way.skillIds` template *before* `applyPathChoice`. The `innateSkillId` check is replaced by: every `way.passiveSkillIds` template must exist in `skillTemplates`, checked in the same pre-commit block. Zero-mutation on any missing template (existing test pattern extends).
- **ownedContent subset** — a way's `passiveSkillIds` must be a subset of its `ownedContent.skillIds` (the declaration of record for what the way owns). Contract-tested. This requires adding `passive_kiem_tam_lanh_liet` → `sword_pathway.ownedContent.skillIds` and `passive_kim_cang_y_chi` → `body_pathway.ownedContent.skillIds` (`ngo_dao_hon_don` is already declared on `hidden_spell_pathway`; the other three ways grant no initiation passive). The **shared realm ladder is excluded** from ownedContent — it is shared by all six ways, not any way's exclusive content; the contract asserts `passiveSkillIds ⊆ ownedContent.skillIds`, not `realmRewards[*].passiveSkillId ⊆ …`.

### 4.7 `grantCultivationPathRealmReward` semantics

The function stays the technique/artifact delivery op (sole production caller: `TribulationOutcomeService`); the passive channel is delivered by `syncRealmPassive`, whose three seams cover every realm entry while the grant op only runs at tribulation. Pin the contract:

- **Return semantics**: `true` = the committed way has a `realmRewards[realmId]` record (of any field kind); `false` = none. A passive-only record returns `true` even though this op delivers nothing for it — the way *did* promise a realm reward; delivery of that field lives elsewhere. Tests asserting record-presence update accordingly.
- **Record contract**: `realmRewards[realmId]` is valid iff at least one of `techniqueId | artifactId | passiveSkillId` is `!== undefined`. `passiveSkillId: null` counts as a declared field — it is a deliberate suppression directive — even though runtime grants nothing for it. Contract-tested over all composed tables.

### 4.8 Save compatibility

Save version **68 → 69**, same mechanism as M1 (v67→v68): persisted-shape cuts bump the version, old saves rejected, no migration, no translator. Rationale: M1 established the phase pattern — each persisted-shape change bumps; M2 removes two fields from the persisted `Technique[]` snapshot shape, so the written schema changes. (Pre-M2 payloads would load harmlessly — `validateIdEntries` checks only `id` — but the phase policy is reject-on-shape-change, and consistency with it beats relying on inert-extras tolerance.) `mission-graph.md`'s stale "M8 — save version bump (v68)" note is corrected: v68 belongs to M1; M8 owns whatever final version decision the accumulated cuts require.

## 5. Guarantees

- Way-committed passive selection — technique swap can never change which passive a player gets at a realm (closes the "equip `tu_linh_quyet` → different ladder" hole, and fixes the dead-ladder defect where path players received nothing).
- One ladder authored once — deduplicated at composition; per-way override/suppression is data, not copy-paste; the way record is the single runtime source (no bypass authority).
- `innateSkillId` grant → declared way content — visible in `ownedContent`, template-preflighted, atomic with initiation.
- Idempotent delivery — `skillManager.has` short-circuit preserved at both seams.
- Fail-closed — way-less/corrupt pairs resolve no way → no passive grant of any kind.
- Path/way isolation preserved — no way reads another's rewards; the shared ladder is compose-time data only.
- Honest behavior delta documented — ladder activation for path players is the D2 intent, not drift.

## 6. Test contract

- `syncRealmPassive` resolves the way record: a sword player at `qi_refining` gains `passive_linh_khi_cam_ung` — idempotent on repeat call.
- Composition: a test-only override (`passiveSkillId: 'x'`) replaces the canonical pick in the composed table; `passiveSkillId: null` suppresses it; a way's own `techniqueId`/`artifactId` merges without touching the passive.
- Way-less/corrupt pair → `getActiveWayDefinition` undefined → **no grant** (explicitly asserts the canonical ladder does not leak to way-less players).
- `chooseCultivationPath` grants `way.passiveSkillIds` — sword/body/hidden-spell deliver their passive; `equipTechnique` alone no longer grants any passive.
- Preflight: a way whose `passiveSkillIds` references a missing template → `chooseCultivationPath` returns false, zero mutation (path/way, technique, skills all untouched).
- `realmRewards` record contract: every composed record has at least one of `techniqueId | artifactId | passiveSkillId` — contract test over all six ways.
- `passiveSkillIds ⊆ ownedContent.skillIds` contract test per way; shared ladder explicitly not required in ownedContent.
- `grantCultivationPathRealmReward`: returns `true` for a passive-only record; `false` for no record.
- UI: `sealedKitSkillNames` lists `ngo_dao_hon_don` for `hidden_spell_pathway` (declaration-sourced); `useTechniqueSections` emits no passive rows.
- Save: v68 payload rejected; v69 payload accepted.
- Regression: existing initiation/tribulation/breakthrough tests pass with the way-owned channel.

## 7. Dispositions

| System | Disposition | Rationale |
|---|---|---|
| `realmRewards.passiveSkillId` channel | REPLACE (extends KEEP'd reward channel) | correct owner for realm-entry rewards |
| `CANONICAL_REALM_PASSIVE_LADDER` + `composeRealmRewards` | NEW (compose-time dedup of `tu_linh_quyet.passiveSkillIdsByRealm`) | one author, way-resolved records |
| `Technique.passiveSkillIdsByRealm` | RETIRE | wrong owner; ladder moves to composed way records |
| `Technique.innateSkillId` | RETIRE | wrong owner; becomes `way.passiveSkillIds` |
| `equipTechnique` passive branch | RETIRE | implicit kit member; declared instead |
| `useTechniqueSections` passive rows | RETIRE | way-owned content doesn't belong on technique display |
| `QuanKhiPanel.sealedKitSkillNames` | KEEP (re-pointed) | reads declaration of record now |
| `RealmPassiveSystem` (stat passives) | KEEP | different concept, already correctly owned |
| `passive_thai_hu_kiem_y` | KEEP-authored (grant path retired) | orphan technique's innate; no way claims it — authored-unused pending a content mission |
| `thai_hu_kiem_quyet` | unchanged (orphan status out of scope) | content decision, not ownership |

## 8. Non-goals

Merging the two passive concepts; passive balance; new passives; technique model rework (M3); loadout UI (M7); post-Trúc Cơ ladder content (the ladder already spans all nine authored realms — delivery beyond implemented realms is unreachable, authoring stands verbatim); save translators.
