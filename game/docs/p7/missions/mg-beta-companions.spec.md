# M-G — Beta Companion Roster — Spec

Status: v3 (post spec-review R2: stacking contract pinned per def; buffs.test aggregate + ChiHienQuan integration tests added to the change surface; stale evidence-map row fixed)
Date: 2026-10-01
Depends on: master `fb87ce52` (post-M-D ledger)
Mission graph row: **M-G — Beta companion roster** — "`than_nong` (healer) + `khai_minh` (buffer) definitions; existing-10 disposition stays 'future content'." Depends on M9 (companion availability / ring-2 gating), which is merged.

---

## 1. Context and intent

The companion domain ships a 10-definition MVP roster — every entry is a DPS or tank kit; no healer and no party buffer exists. M-G adds the two beta support definitions the mission graph names. The mission graph also assigns the existing-10 the disposition **"future content"** (and M9's locked inputs retain them for post-Beta): they stay in the definition catalog so owned/grandfathered instances keep resolving, but they must NOT be newly acquirable in Beta — the Beta-acquirable pool is exactly `{than_nong, khai_minh}`.

Non-goals: balance tuning of numbers (deferred to the dedicated balance phase per user direction), new companion systems (no loadouts, no equipment, no node trees — the file header documents these as intentionally absent), authored rate-table changes (the existing grade-filter renormalization is the rate mechanism), save-shape changes or migration of any kind (explicitly out of scope), UI work beyond routing the exchange tab to the Beta pool and display metadata.

## 2. Current state — evidence map

| Concern | Today | File |
|---|---|---|
| Roster | Exactly 10 defs, grades 4/3/2/1/0 — all DPS/tank kits | `data/companion/Companions.ts` |
| Definition shape | `CompanionDefinition`: fixed basic/special/ultimate `TurnSkillDefinition` kit, `unlockThresholds` per gated slot, `constellationPerks` | `Companions.ts` L43-57 |
| Unlock | `isCompanionSkillUnlocked` — realm-index compare then realmLevel; basic always unlocked | `core/companion/CompanionProgression.ts` |
| Gacha | `effectiveCompanionRates` filters/renormalizes by grades present in the pool; `pickDefinitionOfGrade` uniform within grade. The pool is chosen by the CALLER — `GameManagerCompanionOps.pullCompanion` passes the whole `COMPANIONS` array today | `core/companion/CompanionGacha.ts` L34-59; `GameManagerCompanionOps.ts` L101 |
| Exchange | `exchangeCompanion` resolves any id from `COMPANIONS`; `DuyenPhanTab` renders exchange rows from all `COMPANIONS` — both are acquisition surfaces | `GameManagerCompanionOps.ts` L143; `DuyenPhanTab.vue` L74 |
| Catalog consumers (stay full) | owned-instance resolution (`CompanionPanel`, `CompanionCombat`, `CombatBuild`, `Player`), save validation (`saveShapeValidation` L641-647 requires owned `definitionId` ∈ catalog), art (`CombatPresentationCatalogue`) | respective files |
| Ally buff target | `appliesBuffs[].target: 'allies_except_self'` resolves via `resolveBuffApplicationTargets` from battle arrays. NO companion uses it today — the proven precedent is the The Tu player kit `SON_NHAC` (`allies_except_self` + `externalWardGrant`); companion participants ride the same TBS resolution, so the channel is available but the new defs are its first companion users | `core/battle/turn/TurnBattleSystem.ts` L2566; `data/skill/TheTuSkills.ts` L113-127 |
| Heal channel | `hpRegenPerTurn` is a live `StatType` — ticks HP at the holder's own turn start, clamped to maxHp, amplified by healing-received modifiers (D18/INV-13). A `statModifiers` buff granting flat `hpRegenPerTurn` = HoT on the holder's cadence | `core/stats/StatTypes.ts` L53; `TurnBattleSystem.ts` L1638; `CombatSystem.healing.test.ts` |
| Party stat buffs | `statModifiers` might/defense percent — formation buffs + `kim_giap`/`dia_tru` precedents | `data/buff/buffs.ts`, `data/buff/ThuanHeBuffs.ts` |
| Ally ward | `externalWardGrant:{sourceMaxHpRatio}` on an appliesBuffs entry + marker def (`grantsExternalWard` capability, per_target+latest) → REPLACE ward pool sourced to caster maxHp, existence-bound to marker via `reconcileExternalWard` — proven `son_nhac_ho_the` channel | `TurnBattleSystem.ts` L2546, L692; `data/buff/TheTuBuffs.ts` L93 |
| Pure-support skill shape | `targetScope:'self'`, `targeting:{shape:'single'}`, no `damage` — `son_nhac` precedent | `data/skill/TheTuSkills.ts` L113 |
| Buff registration | `LIVE_BUFFS` aggregate in `data/buff/buffs.ts` → `BUFF_REGISTRY` (battle); `PERSISTENT_BUFF_REGISTRY` auto-includes non-periodic defs (harmless: no persistent caller applies them) | `data/buff/BuffRegistry.ts` |
| Display names | `TURN_SKILL_DISPLAY_META` — all 10 existing companions already carry authored entries (block L125-258); M-G adds the same for the 2 new defs | `data/skill/TurnSkillDisplayMeta.ts` |
| Periodic heal | `PeriodicHealDefinition` (flat `amount`) exists but has **zero production users** in `src/data` — spec decision below prefers the established `hpRegenPerTurn` stat channel | `core/buff2/BuffDefinition.ts` L75 |
| Constellation perks | dia/thien defs MUST carry perks at exactly ranks 2/4/6 (roster test pinned); perk kinds: `stat` / `skill_override` (whitelisted overrides: `cooldownTurns`, `damageMultiplierPercent`, `healPercentOfDamage`) | `Companions.roster.test.ts` L115 |
| Threshold convention | Higher grade ⇒ earlier special unlock — hoang qi_refining 1-6, huyen **mortal** 10-14, dia mortal 6-8, thien mortal 4; ultimates all foundation-tier | `Companions.ts` |

**Spec-time note (corrected in v2):** NO existing companion uses `allies_except_self` or `externalWardGrant` — `kim_quang_thanh_nhan` applies `giap_ran` to `action_targets` (enemies), which is the correct usage. The only proven precedent for ally-scoped appliesBuffs + ward grants is the The Tu player kit (`SON_NHAC`). Companion participants ride the same TBS resolution path, and the new TBS tests are the FIRST companion evidence for the channel.

## 3. Target design

Two new entries appended to `COMPANIONS` (12 total in the catalog: hoang 4 / huyen 4 / dia 3 / thien 1 / tien 0). No engine, save, or rate-table changes — data + one new buff-data file + display metadata + acquisition-surface rerouting.

### 3.0 Catalog vs Beta pool (the "future content" contract)

`COMPANIONS` remains the **full definition catalog** — the sole resolution source for owned instances, save validation, combat build, and art. `Companions.ts` additionally exports:

```ts
export const BETA_COMPANION_IDS: readonly string[] = ['than_nong', 'khai_minh']
export const BETA_COMPANIONS: readonly CompanionDefinition[] =
  COMPANIONS.filter((d) => BETA_COMPANION_IDS.includes(d.id))
```

`BETA_COMPANIONS` is the **sole acquirable pool**. Exactly three consumers switch to it — every other consumer stays on `COMPANIONS`:

| Consumer | Change | Reason |
|---|---|---|
| `GameManagerCompanionOps.pullCompanion` (L101) | `rollCompanionPull(player.companions, BETA_COMPANIONS, …)` | gacha is an acquisition surface |
| `GameManagerCompanionOps.exchangeCompanion` (L143) | `BETA_COMPANIONS.find(...)` | exchange is an acquisition surface; a non-beta id returns `unknown_definition` — honest for "not in the acquirable pool" |
| `DuyenPhanTab.vue` groups (L74) | `BETA_COMPANIONS.filter(grade …)` | presentation must mirror the acquirable pool — offering an exchange row for a non-acquirable def would be a UI lie |
| save validation, `CompanionPanel`, `CompanionCombat`, `CombatBuild`, `Player`, `CombatPresentationCatalogue` | unchanged — full `COMPANIONS` | grandfathered owned instances must keep resolving |

**Beta effective rates (pinned):** pool grades `{huyen, dia}` → `effectiveCompanionRates` renormalizes to `{hoang:0, huyen:2/3, dia:1/3, thien:0, tien:0}`. Pity (`PITY_ELEVATED_WEIGHTS` filtered to present grades: only dia qualifies) → **the 30-pull pity deterministically rolls `khai_minh`**. This is the existing mechanism's natural outcome — no rate-table authoring — and is asserted in tests.

### 3.1 `than_nong` — Thần Nông (healer) — grade `huyen`, growthRate 0.05

The Divine Farmer / herbalist archetype: wood-themed healer whose support rides the proven `hpRegenPerTurn` regen cadence — each healed ally recovers at the start of *their own* turn (thematically "the medicine works over time"), participates in healing-received amplifiers, and requires no new periodic machinery.

- `baseStats: { maxHp: 105, might: 9, speed: 102 }` — support statline: low might, modest hp/speed (huyen peers: 90-150 hp / 10-16 might).
- `unlockThresholds`: special `{ mortal, 12 }` (huyen convention: mortal-tier special), ultimate `{ foundation_establishment, 3 }` (huyen convention: 1-5).
- `basic: than_nong_basic` — wood elemental hit, multiplier 0.9, single target, `presetId: 'wood_spikes'`. A healer still attacks on off-cooldown turns.
- `special: than_nong_hoi_phuc_thuat` — cooldown 4, `targetScope:'self'`, `targeting:{shape:'single'}`, no damage, `presetId:'holy_radiance'`; `appliesBuffs: [{ definitionId:'than_nong_hoi_phuc', target:'allies_except_self' }]`.
- `ultimate: than_nong_than_dang` — cooldown 8, same support shape; `appliesBuffs: [{ definitionId:'than_nong_than_dang_hoi_phuc', target:'allies_except_self' }]` — stronger HoT that also cleanses control on landing (`clearsCcOnApply` on the def — an existing `BuffDefinition` field, zero engine work).
- No `constellationPerks` (huyen defs carry none in the current roster — only dia/thien do).

### 3.2 `khai_minh` — Khai Minh (buffer) — grade `dia`, growthRate 0.06

The Khai Minh beast — nine-headed guardian of Kunlun. Party-wide stat reinforcement as the special; the ultimate places a protective ward marker on every ally (Kunlun shelter) through the proven `externalWardGrant` channel.

- `baseStats: { maxHp: 180, might: 12, speed: 94 }` — guardian statline between `huyen_vu` (260/14/90) and `kim_quang_thanh_nhan` (160/21/106).
- `unlockThresholds`: special `{ mortal, 8 }` (dia convention: mortal 6-8), ultimate `{ foundation_establishment, 5 }`.
- `basic: khai_minh_basic` — physical hit, multiplier 1.0, single target, `presetId:'claw'`.
- `special: khai_minh_ho_ve_thuat` — cooldown 5, `targetScope:'self'`, `targeting:{shape:'single'}`, no damage, `presetId:'holy_radiance'`; `appliesBuffs: [{ definitionId:'khai_minh_ho_ve', target:'allies_except_self' }]` — might% + defense% party buff.
- `ultimate: khai_minh_thanh_an` — cooldown 8, same support shape; `appliesBuffs: [{ definitionId:'khai_minh_thanh_ho', target:'allies_except_self', externalWardGrant:{ sourceMaxHpRatio: 0.25 } }]` — each ally gains a marker + a REPLACE ward pool equal to 25% of Khai Minh's live maxHp, existence-bound to the marker.
- `constellationPerks` (dia-required at exactly 2/4/6):
  - rank 2 `stat`: `maxHp` percent 15 (bigger ward base + survivability — the ward scales off its maxHp, so this compounds the ultimate).
  - rank 4 `skill_override` slot `special`: `{ cooldownTurns: 4 }` (cd 5→4, mirroring `huyen_vu`'s rank-4 pattern).
  - rank 6 `stat`: `might` flat 8 (mirroring `huyen_vu`'s rank-6 pattern — its basic remains the only damage source).

### 3.3 New buff definitions — `data/buff/CompanionBuffs.ts` (new file)

One new data file per the one-domain-per-file convention (`KiemPhoBuffs`, `ThuanHeBuffs`, `TheTuBuffs`), spread into the `buffs` aggregate. Four defs:

| id | kind | scope | stacking | lifetime | payload |
|---|---|---|---|---|---|
| `than_nong_hoi_phuc` | buff | per_source | `maxStacks:1, onReapplyStacks:'keep', onReapplyDuration:'refresh'` | holder_turns 4, **fixed** | `statModifiers: [{ stat:'hpRegenPerTurn', flat: 12 }]` |
| `than_nong_than_dang_hoi_phuc` | buff | per_source | `maxStacks:1, keep, refresh` | holder_turns 5, fixed | `statModifiers: [{ stat:'hpRegenPerTurn', flat: 24 }]`, `clearsCcOnApply: true` |
| `khai_minh_ho_ve` | buff | per_source | `maxStacks:1, keep, refresh` | holder_turns 5, fixed | `statModifiers: [{ stat:'might', percent: 0.12 }, { stat:'defense', percent: 0.12 }]` |
| `khai_minh_thanh_ho` | marker | per_target + latest | `maxStacks:1, onReapplyStacks:'replace', onReapplyDuration:'refresh', replaceInstanceOnReapply:true` | holder_turns 6, fixed | `capabilities: [{ id:'khai_minh_thanh_ho.marker', type:'marker', payload:{ grantsExternalWard:true } }]` |

Pinned conventions:

- **Stacking (R2 pin):** stat/regen buffs use `maxStacks:1` + `keep`/`refresh` — a recast refreshes duration in place, never stacks (the `kim_giap`/`dia_tru`/formation-buff convention). The ward marker mirrors `son_nhac_ho_the` field-for-field (`replace` + `replaceInstanceOnReapply`) so a recast replaces the marker instance and refreshes the ward pool to the latest grant — marker and pool always share one owner (INV: existence-bound reconcile).

- **`scaling:'fixed'` on every friendly buff** — `ailment_scaled` would let the ally's own ailment-duration/resist stats shorten or resist a *friendly* buff; The Tu made the same choice for all holder-turn state buffs (comment at `TheTuBuffs.ts` L7-10).
- **No `application` block** — unconditional apply (friendly buffs must never be resist-rolled against the ally; `kim_giap`/`dia_tru`/formation buffs omit it identically).
- `dispellable: false` — matches every existing ally-side buff (`kim_giap`, formation buffs, `son_nhac`).
- Flat heal/regen numbers are first-pass placeholders explicitly **deferred to the balance phase** — same posture as the M-F `baseGains` placeholders.
- `khai_minh_thanh_ho` is a marker (like `son_nhac_ho_the`): `per_target` + `sourceOwnership:'latest'` binds the ward pool to the marker instance — `reconcileExternalWard` clears the pool when the marker expires.
- `than_nong`'s heal rides `hpRegenPerTurn` (established stat path, tested regen cadence) rather than `PeriodicHealDefinition` (zero production users; periodic defs are also excluded from the persistent registry — not needed here, but the stat path is the smaller coherent choice).

### 3.4 Display metadata

Six `TURN_SKILL_DISPLAY_META` entries (one per new skill id) — names/descriptions authored inline in the existing companion block (all 10 current companions already have entries; the two new defs get the same treatment — unknown-id fallback never engages).

### 3.5 What does NOT change

- `COMPANIONS` existing 10 definitions — byte-identical (all 12 remain resolvable for owned instances, save validation, combat build, and art — "future content" gates acquisition only).
- `CompanionGacha` mechanism — rates auto-adapt by grade (`effectiveCompanionRates`); `tien` still filters to 0. No authored rate-table changes.
- `CompanionInstance` save shape — `definitionId` resolves at runtime; **no migration** (user directive).
- Roster invariants beyond the count update: uniqueness, threshold↔skill pairing, reachable realms, perk-rank rules all hold by construction.

## 4. Files

| File | Why |
|---|---|
| `data/companion/Companions.ts` | +2 definitions appended; `BETA_COMPANION_IDS` + `BETA_COMPANIONS` exports |
| `data/buff/CompanionBuffs.ts` (new) | 4 authored `BuffDefinition`s |
| `data/buff/buffs.ts` | spread `COMPANION_BUFFS` into the `LIVE_BUFFS` aggregate |
| `data/buff/buffs.test.ts` | aggregate-length pin 62 → 66 (hard-pinned at L155) |
| `core/game/GameManagerCompanionOps.ts` | pull + exchange consume `BETA_COMPANIONS` |
| `components/panels/worker-lodge/DuyenPhanTab.vue` | exchange rows consume `BETA_COMPANIONS` |
| `data/skill/TurnSkillDisplayMeta.ts` | 6 display entries |
| `data/companion/Companions.roster.test.ts` | count 10→12, grade counts 4/3/2/1/0 → 4/4/3/1/0; new-def + beta-pool assertions |
| `data/buff/CompanionBuffs.test.ts` (new) | def-shape invariants (fixed scaling, no application block, marker capability) |
| `core/companion/CompanionProgression.test.ts` | real-def kit gating + khai_minh perk clone |
| `core/battle/turn/TurnBattleSystem.companionSupport.test.ts` (new) | real-def casts: ally heal, cleanse, party buff, ward grant |
| `core/game` companion ops tests | beta-pool gating: pull yields only beta ids, exchange rejects non-beta ids |
| `components/panels/ChiHienQuan.integration.test.ts` | the ONLY existing DuyenPhanTab harness (no dedicated tab test file exists): row/button count assertions `COMPANIONS.length` → `BETA_COMPANIONS.length` (3 sites ~L373/L398/L422); maxed-row fixture owns `than_nong` instead of `COMPANIONS[0]`; exchange-spend fixture `duyenPhan` ≥ `EXCHANGE_COST.huyen` (30) |

## 5. Invariants → tests

1. `COMPANIONS` length 12; grade counts `{hoang:4, huyen:4, dia:3, thien:1, tien:0}`; all existing ids unchanged (regression — roster diff limited to appends).
2. `BETA_COMPANIONS` = exactly `[than_nong, khai_minh]`, every id resolves in `COMPANIONS`, and `BETA_COMPANION_IDS` stays the single source (derived export — no duplicated def objects).
3. **Acquisition gating**: `pullCompanion` only ever yields `than_nong`/`khai_minh` across many seeded rolls; `exchangeCompanion('ho_ly_tinh')` (existing, non-beta) returns `unknown_definition`; `DuyenPhanTab` renders exactly 2 exchange rows. Effective beta rates = `{huyen:2/3, dia:1/3}` and a 30-pull pity deterministically rolls `khai_minh`.
4. **Grandfathering**: an owned instance of a non-beta def still resolves its kit/stats through `companionToCombatEntity`/`resolveCompanionSkillKit` and passes `saveShapeValidation` — "future content" gates acquisition, never resolution.
5. `than_nong.special/ultimate` and `khai_minh.special/ultimate` carry no `damage`; their `appliesBuffs` target `allies_except_self` and resolve in `BUFF_REGISTRY`.
6. Both heal defs modify `hpRegenPerTurn` with `scaling:'fixed'` and no `application` resistance block; ultimate heal def sets `clearsCcOnApply`.
7. `khai_minh_thanh_ho` is `per_target`/`latest` marker with `grantsExternalWard` capability; the ultimate application carries `externalWardGrant.sourceMaxHpRatio > 0`.
8. `khai_minh.constellationPerks` = exactly ranks [2,4,6] with valid kinds/fields.
9. Threshold pairing per roster rules; thresholds reachable (mortal realmLevel ≤ realm maxLevel; foundation id valid).
10. `isCompanionSkillUnlocked`/`resolveCompanionSkillKit` resolve the new thresholds: special locked at mortal 11 / open at mortal 12 (than_nong); khai_minh special open at mortal 8; khai_minh rank-4 override yields `cooldownTurns:4` on the resolved clone while the definition stays 5 (no mutation).
11. TBS-level: casting `than_nong_hoi_phuc_thuat` lands `than_nong_hoi_phuc` on each living ally and NOT on the caster (son_nhac appliesBuffs test pattern); the buffed ally heals `flat` at the start of their next turn (hpRegenPerTurn cadence — `turnRegen` precedent).
12. TBS-level: `than_nong_than_dang` heals the bigger amount and clears a control-bearing instance on landing (`clearsCcOnApply` — cleanse fixture pattern).
13. TBS-level: `khai_minh_thanh_an` lands the marker on allies and writes an `externalWard` pool ≈ `khai_minh.stats.maxHp × 0.25` on each; caster gets none.
14. `DuyenPhanTab` renders exactly `BETA_COMPANIONS.length` exchange rows/buttons — the 10 future-content defs produce no exchange affordance (verified in `ChiHienQuan.integration.test.ts`, the existing mount-through-WorkerLodgePanel harness — there is no dedicated DuyenPhanTab test file).

## 6. Resolved at spec time

- **Catalog vs Beta pool split** (R1 finding): `COMPANIONS` = full catalog; `BETA_COMPANION_IDS` + derived `BETA_COMPANIONS` = the sole acquirable pool; exactly three acquisition consumers (pull, exchange, DuyenPhanTab rows) reroute. Beta effective rates `{huyen:2/3, dia:1/3}` and pity→`khai_minh` pinned — no rate-table authoring.
- **Stacking contract pinned per def** (R2 finding): stat/regen buffs `maxStacks:1` + `keep`/`refresh`; ward marker mirrors `son_nhac_ho_the` (`replace` + `replaceInstanceOnReapply`) so recasts refresh marker+pool atomically.
- **Aggregate + integration-test surfaces added** (R2 findings): `buffs.test.ts` hard-pins 62 → 66; `ChiHienQuan.integration.test.ts` is the sole existing DuyenPhanTab harness — its `COMPANIONS.length` assertions and `COMPANIONS[0]` fixtures move to the beta pool.
- **Heal channel = `hpRegenPerTurn` statModifier**, not `PeriodicHealDefinition` — established, production-proven cadence; periodic heal has no authored user and adds scheduler machinery for identical flat-amount semantics.
- **Grades: than_nong huyen / khai_minh dia** — healer stays attainable, the party-buffer is the premium dia pull and exercises the required perk channel. Alternative (both huyen) rejected: leaves dia untouched in the beta pool and wastes the mandatory-perk surface.
- **`clearsCcOnApply` on the ultimate heal** — cleanse flavor through an existing def field, no new mechanism.
- **Ally buffs use `scaling:'fixed'`, no `application` block** — friendly buffs must not be shortened/resisted by the holder's own ailment stats (The Tu precedent).
- **4 new buff ids in a dedicated `CompanionBuffs.ts`** — one-domain-per-file; aggregate spread keeps `BUFF_REGISTRY` authoritative.
- **No ally-debuff companion precedent exists** (v1's `ban_thuy_ngua` claim removed — that symbol does not exist in the base; `giap_ran` is used correctly enemy-facing on `kim_quang_thanh_nhan`). The ally-scoped appliesBuffs + ward channel's only proven user is the The Tu `SON_NHAC` player kit; the new TBS tests are the first companion evidence.
