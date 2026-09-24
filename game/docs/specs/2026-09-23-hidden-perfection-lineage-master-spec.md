# BETA-HIDDEN — Hidden Perfection Lineage — Master Spec + Migration Census + Decomposition

Status: v1 — worker-authored master spec (BETA-HIDDEN-A skeleton contract)
Law: `docs/design/2026-09-23-hidden-perfection-lineage.md` (918 lines, FINAL /
LOCKED, user-authored). Where this spec and existing code/docs conflict, the
design doc wins. Design-internal contradictions are flagged in §9 (Ruling
Questions), nowhere else.
Census base: `origin/beta/rc` @ `9aa29a46` (the design-doc commit). Save
version at census time: `CURRENT_SAVE_VERSION = 81`
(`src/services/save/saveVersion.ts`). The implementing mission reads the
merged base's version at impl time and bumps to CURRENT+1 — never hardcode.

Mission split (coordinator contract):

| Mission | Owns |
|---|---|
| **BETA-HIDDEN-A** (this spec + skeleton) | Lineage state machine, effective-cap calculation, breakthrough gate/reward refactor, discovery/visibility framework, save shape + migration of all persisted hidden state, legacy-authority retirement it owns (§7 owner column), §17 skeleton pins as tests |
| **HIDDEN-B** | Mortal §9 Ancient Beast trial + Qi §10 Quán Thể / Thiên Địa Chi Kiều realm mechanics |
| **HIDDEN-C** | Foundation §11 Chu Thiên 0/36 normal-track replacement + §12 Nghịch Chu Thiên hidden mechanic (RNG + pity) |

B and C run in parallel against the merged skeleton. The interfaces they
consume are pinned in §8.

---

## 1. Vocabulary

- **Breakthrough type** — exactly two: `normal` and `hidden`. The breakthrough
  *action* is shared (Quán Khí ritual for `mortal`, Trúc Cơ tribulation for
  `qi_refining`); the type is RESOLVED, never chosen by the player (§4 §20).
- **Hidden lineage** — the strict-prefix chain of Hidden Body completions,
  one per canonical realm, gated to the player's CURRENT realm.
- **Hidden Body** — a per-realm achievement record produced ONLY by that
  realm's hidden mechanic (§9/§10/§11+§12). At most one per realm (§14).
- **Realm Entry Passive** — the `REALM_PASSIVES` permanent-stat grant at realm
  entry (`src/data/realm/RealmPassives.ts`: `nhap_dao` / `kien_co`). NOT the
  way-reward passive skill (`syncRealmPassive`, `realmRewards.passiveSkillId`),
  which is a different channel and unchanged by this feature.
- **Five main stats** — `MAIN_STAT_KEYS` = strength / dexterity / intelligence
  / attunement / vitality (Lực / Mẫn / Trí / Khí / Thể). The hidden-body
  reward is +10pp on these stats' CAP. Raw Body combat stats
  (maxHp / might / defense / hpRegenPerTurn) are flat reward channels and are
  never scaled by the hidden-body bonus (design §5.3).

## 2. State model (owned by A)

### 2.1 Persisted slice

One new PlayerData field — `hiddenPerfection` — the sole persisted hidden
authority (§3.5: one canonical authority; legacy fields never compete).

```ts
// src/core/realm/hidden/HiddenPerfection.ts (NEW module)

export interface HiddenPerfectionState {
  /**
   * The lineage latch. true at character creation; a committed NORMAL
   * breakthrough writes false once, permanently. There is no write path
   * back to true (§3, §17 strict-prefix pins).
   */
  lineageActive: boolean
  /**
   * Audit record of which realm transition closed the lineage (the realm
   * the player departed). Absent while active.
   */
  lineageClosedByRealmId?: string
  /**
   * Realms whose Hidden Body completed, push order = completion order.
   * The completedHiddenBodyCount of design §6 is derived as
   * `.length` of this list — never a separate stored scalar.
   */
  completedHiddenBodyRealmIds: string[]
  /**
   * Realms ENTERED via a committed Hidden Breakthrough (e.g. 'qi_refining'
   * when the mortal hidden path committed Quán Khí). The recorded type
   * that RealmPassives grant-time selection and historical surfaces read.
   */
  hiddenBreakthroughRealmIds: string[]
  /**
   * Sparse per-realm hidden progress. A record exists only for a realm
   * whose hidden mechanic has produced state (discovered or progressed).
   */
  realms: Record<string, RealmHiddenState>
}

export interface RealmHiddenState {
  /** The realm's hidden mechanic surface has been revealed (§4 line A). */
  discovered: boolean
  /** The realm's Hidden Body achievement committed (canonical record). */
  bodyCompleted: boolean
  /** Set at lineage closure on every non-completed record; inert forever. */
  frozen: boolean
  /**
   * Realm-mechanic internals — a discriminated union owned by B/C modules.
   * The skeleton owns the SLOT and the dispatch contract only (§6.3).
   */
  mechanic?: RealmHiddenMechanicState
}
```

`RealmHiddenMechanicState` is a discriminated union extended by B/C:

```ts
export type RealmHiddenMechanicState =
  | { kind: 'ancient_beast_trial'; /* …B-owned fields… */ }
  | { kind: 'quan_the'; /* …B-owned fields… */ }
  | { kind: 'nghich_chu_tian'; /* …C-owned fields, incl. per-level pity… */ }
```

The skeleton ships the union EMPTY (zero members declared is not valid TS —
see §2.4 for the shipped contract) plus the registration/validation seams; B/C
append their members with their own module-owned validators.

**Field-location ruling:** the state lives under ONE record
`player.hiddenPerfection` rather than scattered flat fields, matching the
`bodyProgression` / `bodyPerfection` record convention. The design doc's
names (`hiddenLineageActive`, `completedHiddenBodyCount`) map as
`hiddenPerfection.lineageActive` and
`hiddenPerfection.completedHiddenBodyRealmIds.length`.

### 2.2 Derived reads (all in `HiddenPerfection.ts`; consumers never reach into
the record)

```ts
isHiddenLineageActive(player): boolean
getCompletedHiddenBodyCount(player): number        // realmIds.length
isHiddenBodyCompleted(player, realmId): boolean
isHiddenRealmDiscovered(player, realmId): boolean
isHiddenRealmFrozen(player, realmId): boolean
getRealmHiddenState(player, realmId): RealmHiddenState | undefined
getHiddenBreakthroughRealmIds(player): readonly string[]
```

### 2.3 Mutators (the ONLY write paths)

```ts
/**
 * One-way latch. No-op when already closed. Freezes every realm record
 * whose bodyCompleted is false; completed records stay unfrozen (their
 * rewards are already granted and permanent — §3 historical-survival).
 * `closedByRealmId` = the realm being departed at commit.
 */
closeHiddenLineage(player, closedByRealmId): void

/**
 * Writes discovered=true for the realm record (creates it). Idempotent.
 * HARD GATE inside: isHiddenLineageActive && realmId === player.realmId
 * && !frozen && isAuthoredHiddenRealm(realmId). A gated call returns
 * false and writes nothing — discovery can never leak post-closure.
 */
discoverHiddenRealm(player, realmId): boolean

/**
 * Commits the Hidden Body achievement for the CURRENT realm. HARD GATE:
 * isHiddenLineageActive && canProgressHiddenBody(realmId). Idempotent.
 * Pushes realmId onto completedHiddenBodyRealmIds and sets bodyCompleted.
 * This is the ONLY function that may write bodyCompleted (§3.5 single
 * authority).
 */
completeHiddenBody(player, realmId): boolean
```

```ts
/**
 * Whether realmId's Hidden Body may be progressed right now:
 *   lineageActive && getRealmIndex(realmId) === getRealmIndex(player.realmId)
 *   && isAuthoredHiddenRealm(realmId) && !frozen
 *   && strictPrefixSatisfied(realmId)
 * strictPrefixSatisfied: every authored hidden realm strictly before
 * realmId in canonical REALMS order is already bodyCompleted. Skipping a
 * realm's hidden body (early normal breakthrough) fails closed for that
 * realm AND all later realms — a state the latch already enforces at the
 * source (an early normal breakthrough closes the lineage globally).
 */
canProgressHiddenBody(player, realmId): boolean
```

### 2.4 Authored registry + mechanic dispatch

```ts
// src/data/realm/HiddenBodyRealms.ts (NEW, data layer)
/**
 * The authored per-realm Hidden Body catalog — one entry per realm that
 * declares a hidden mechanic. Order = canonical realm order. Entries are
 * declarative (realmId, mechanicKind, i18n display refs); mechanics
 * register their runtime modules against mechanicKind.
 * B: mortal -> 'ancient_beast_trial', qi_refining -> 'quan_the'
 * C: foundation_establishment -> 'nghich_chu_tian'
 */
export const HIDDEN_BODY_REALMS: readonly HiddenBodyRealmDefinition[]
```

The skeleton ships all three entries (mortal / qi_refining /
foundation_establishment) with their `mechanicKind` ids declared and NO
runtime mechanic modules behind them — B/C attach implementations. The
registry needs no function bodies; it is the authored "which realms have
hidden bodies at all" list the strict-prefix read consumes.

`RealmHiddenMechanicState` shipping shape: the skeleton declares it as an
interface-free opaque slot typed `Record<string, unknown>` PLUS a required
`kind` string — i.e. `{ kind: string } & Record<string, unknown>` — because
no mechanics exist at skeleton time. B/C narrow it to their unions. Persisted
mechanic payloads validate via a kind→validator dispatch map
(`HIDDEN_MECHANIC_STATE_VALIDATORS`) that B/C register entries into;
skeleton ships the map empty and the validator treats "kind present but
unregistered" as a shape issue (fail closed).

## 3. Effective main-stat cap (owned by A)

```ts
// src/core/stats/StatCap.ts
export const HIDDEN_BODY_CAP_BONUS_PER_REALM = 0.10 // +10pp additive (§6)

/** normalMainStatCap × (1 + 0.10 × completedHiddenBodyCount) — see §6.
 * Canonical integer rule: Math.floor. All authored caps (10/30/100 and the
 * ×2/index ladder) produce exact integers under every reachable count, so
 * floor binds only fractional FUTURE caps (never over-grants; float noise
 * like 30×1.3 = 39.000000000000004 already lands right). */
export function getEffectiveMainStatCap(player: PlayerData): number
// (reads getMainStatCap(player.realmId) × getCompletedHiddenBodyCount(player))
```

Design §6: the bonus raises the CAP only — it does not fill stats and does
not remove any stat already earned (raising the cap can never reduce a
current value; nothing else in the spec needs a "cap enforcement sweep").

**Consumers switched to the effective read (the canonical cap surface):**

| Consumer | File | Note |
|---|---|---|
| `allocateAttributePoint` | `GameManagerProgressionOps.ts` | primary stat investment |
| pill clamp / random-stat candidates | `core/pill/PillSystem.ts` (`clampMainStatIncrease`, candidate filters) | pills gain headroom under raised cap — desired (cap is the rule everywhere it applies) |
| hidden-eligibility all-5-at-cap check | `HiddenLineage.ts` (new) | reads effective cap |
| `allFiveMainStatsAtCap`-style readers | `data/breakthrough/BreakthroughGrades.ts` | retires with §7 item 4 |

`getMainStatCap(realmId)` stays the realm-base accessor; the effective read
wraps it. UI stat-cap display (attribute panel "x / cap" reads) consumes the
effective read — being at effective cap is factual state, not a leak.

## 4. Breakthrough eligibility + rewards refactor (owned by A)

### 4.1 The two gates

The breakthrough ACTION gate is unchanged and applies to both types
(§1 "all ordinary requirements"):

```ts
canTriggerBreakthrough(player) // UNCHANGED: realmLevel >= CORE_REALM_LEVEL(12)
                               // + qi_refining chapterClear; release policy
                               // unchanged
```

Type resolution (NEW, `HiddenLineage.ts`):

```ts
type BreakthroughType = 'normal' | 'hidden'

/**
 * Resolved at the breakthrough COMMIT site (and snapshotted on the
 * committed outcome record, §4.3). Returns 'hidden' iff ALL of:
 *   realmLevel >= EXTENDED_REALM_LEVEL(18)
 *   isHiddenLineageActive(player)
 *   isHiddenBodyCompleted(player, player.realmId)
 *   every MAIN_STAT_KEYS stat >= getEffectiveMainStatCap(player)
 *   canTriggerBreakthrough(player)  // ordinary requirements
 * Otherwise 'normal'. Design §1/§4.1.
 */
resolveBreakthroughType(player): BreakthroughType
```

Consequences of the resolution rule (all spec'd, none optional):
- Lv12–17 attempts can only ever be normal (the 18 leg kills hidden).
- A Lv18+ attempt with hidden body complete but stats below effective cap
  resolves NORMAL — and its success closes the lineage (§3 strict semantics).
- A hidden-eligible player cannot elect normal: there is no type picker
  (§4.1 no-leak and §2 "exactly two types"). Flagged in §9 as RQ-1.
- A failed attempt (tribulation defeat) commits no realm write; the type
  resolution is advisory on the record only — defeat semantics are
  unchanged for both types (§4.4).

### 4.2 Commit sites — the only two places a realm transition writes

| Site | File | Resolves type where |
|---|---|---|
| Mortal → Qi (Quán Khí ritual) | `GameManagerRealmAdvanceOps.chooseCultivationPath` — the mortal realm-write block | **at commit**, inside the write block, before passive syncs |
| Qi → Foundation (Trúc Cơ tribulation) | `TribulationOutcomeService.resolveVictory` — the realm-write block | **at `TribulationDirector.start()`**, snapshotted onto `active.breakthroughType` → `committedOutcome.breakthroughType` (same seam `grade` already rides) |

Rationale for the asymmetry: the mortal ritual's committed write happens at
path choice (`chooseCultivationPath`), not inside the Quán Khí tribulation
run — its victory is announcement-only (existing `resolveVictory`
early-return). Resolving at the write keeps one rule: *the type is evaluated
on live state at the moment the realm transition commits*; for the
tribulation the live state is sealed inside the run, so the start-time
snapshot IS commit state.

### 4.3 Committed-record shape

`CommittedTribulationOutcome` gains `breakthroughType: BreakthroughType`
(stamped at `start()` alongside `grade`). For `foundation_establishment`
targets the existing `facts.grade` record additionally gains
`'great_dao'` when `breakthroughType === 'hidden'` — see §7 item 7 for the
grade reconciliation (the Đại Đạo tier survives as the hidden-perfection
RECORD; its old gating inputs retire).

### 4.4 Rewards at commit (§8)

| Type | Realm write | Lineage | Realm Entry Passive | Other consequences |
|---|---|---|---|---|
| normal | realmId/Level/ cultivation reset (unchanged) | `closeHiddenLineage(player, departedRealmId)` | normal `buildModifiers` variant | unchanged (unequip, technique seal, path reward, gift moments, entitlement, announcements) |
| hidden | same realm write | **preserved** — no closure write | **enhanced** variant (`buildEnhancedModifiers`) | same ordinary consequences; the recorded grade at `foundation_establishment` entry is `'great_dao'` (fires the existing `pham_cot`→`pham_nhan_chi_cot` conversion + entitlement suppression — §7.7) |

**Enhanced Realm Entry Passive contract** — `RealmPassiveDefinition` gains
`buildEnhancedModifiers?: (player) => StatModifier[]`. Selection inside
`RealmPassiveSystem.grantRealmPassive` reads the persisted entry record
(`hiddenPerfection.hiddenBreakthroughRealmIds.includes(realmId)`), so the
idempotent re-sync call sites (`syncRealmStatPassive` at minor breakthroughs
and restores) need no signature change: the committed record IS the variant
key. A realm with no authored enhanced variant falls back to its normal
builder (fail-safe, not a leak — by construction a hidden entry record can
only exist for realms whose hidden body exists).

Authored enhanced strengths (BALANCE §18 — NON-CANONICAL placeholders,
marked in code and here until the balance pass):

| Realm | Passive | Normal strength | Enhanced placeholder (non-canonical) |
|---|---|---|---|
| qi_refining | Nhập Đạo | `breakthroughGrade × 0.03` on maxHp/hpRegenPerTurn + spell maxMp/manaRegenPerTurn | authored scalar `NHAP_DAO_ENHANCED_PERCENT = 0.30` on the same stat set |
| foundation_establishment | Kiến Cơ | `KIEN_CO_MAIN_STAT_PERCENT[foundationType]` (0/0.05/0.10/0.20) | authored `KIEN_CO_ENHANCED_MAIN_STAT_PERCENT = 0.20` on the five main stats |

Nhập Đạo note (design §8.2): the normal passive scales by
`breakthroughGrade`; the enhanced variant is authored independently (the
placeholder above) — "authored separately and stronger", no universal
multiplier anywhere.

### 4.5 Defeat paths

- Normal-attempt defeat: unchanged (`resolveDefeat` — cultivation loss,
  spirit stone loss, KIẾP THƯƠNG debuff). Lineage untouched (§3.2).
- Hidden-attempt defeat: identical ordinary defeat consequences; the
  `greatDaoOpportunityLost` permanent-loss write RETIRES (§7.6) — a failed
  hidden attempt loses nothing beyond the defeat; retry resolves hidden
  again while eligibility holds.
- Breakthrough **challenge profile**: the same tribulation/ritual for both
  types (design defines no separate hidden challenge). Grade difficulty /
  chapter composition are untouched.

### 4.6 Announcements + panels

- `resolveVictory`'s foundation announcement already renders the committed
  grade (`FOUNDATION_LABELS[grade]`) — hidden shows ĐẠI ĐẠO automatically.
- Mortal hidden: the Quán Khí path-choice commit surfaces the enhanced
  Nhập Đạo via the granted passive (visible earned state — not a leak).
- `BreakthroughRequirementPanel` requirement rows stay ordinary-only
  (`getBreakthroughRequirements` unchanged; QI-D6 already enforces
  hidden-inputs-never-rows). The hidden requirements appear NOWHERE as a
  checklist — §4.1 lists nothing to render pre-discovery, and post-
  discovery surfaces are B/C-owned (the discovered realm's own hidden
  surface may state lineage/hidden-breakthrough status informatively).

## 5. Discovery & visibility framework (owned by A) — design §4.1/§4.2/§6.2

Contract rules (spec-level, enforced via tests + reviewer attack):

1. **Absence-only rendering**: hidden surfaces render only inside
   `isHiddenRealmDiscovered(player, realmId)` / the equivalent lane gate —
   no placeholder rows, no "???", no silhouettes, no disabled buttons, no
   requirement lists naming hidden entities, and no engine-recognizable
   absence ("unlock later") may name them.
2. **Level alone is not discovery**: reaching Lv18 emits nothing; discovery
   is written only by the realm's hidden mechanic (`discoverHiddenRealm`),
   gated on lineageActive + current realm + unfrozen.
3. **Closed lineage is undiscoverable**: `discoverHiddenRealm` fails closed
   once `lineageActive === false` — post-closure discovery is structurally
   impossible, not merely unlikely (§17 pin).
4. **Historical disclosure**: discovered records may display completed
   hidden bodies and the earned enhanced passives non-actionably. A
   completed realm's discovery row remains visible after closure (§4.2).
5. **Frozen is silent**: frozen records render identically to closure — a
   realm surface may show its own frozen record only if it was discovered
   pre-closure; undiscovered realms never render.

Skeleton ships: the predicates + mutators above, plus retirement of the
existing leak surfaces (§7.8). B/C own the actual discovered UI surfaces
inside this contract.

## 6. Save shape + migration (owned by A)

### 6.1 Version

`CURRENT_SAVE_VERSION + 1` read at impl time off the merged base. Dev policy
is hard rejection of older versions (`saveShapeValidation.ts` version check +
PER-06 pin) — **no data translators are written**; "migration" means the new
canonical fields + retirement of legacy fields, exactly as every prior
version bump in this repo.

### 6.2 Shape validation (`validateHiddenPerfectionPersistedState`)

Module-owned validator the save boundary delegates to (same convention as
`validateBodyProgressionPersistedState`): required record; `lineageActive`
boolean; arrays of canonical realm-id strings, unique;
`lineageClosedByRealmId` optional-canonical; per-realm records require
boolean flags + mechanic dispatch via `HIDDEN_MECHANIC_STATE_VALIDATORS`
(unknown kind = issue; absent = fine).

### 6.3 Integrity preflight (`assertHiddenPerfectionIntegrity`)

Same seam as `assertBodyProgressionIntegrity` /
`assertBodyPerfectionIntegrity` (`GameManagerSaveRestore.ts` preflight
block). Fails closed on:
- `bodyCompleted`/`discovered`/`frozen` on a realm absent from
  `HIDDEN_BODY_REALMS` (no hidden content is authored there);
- strict-prefix violation: a record at realm index i while some authored
  hidden realm j < i lacks `bodyCompleted`;
- `frozen === true` while `lineageActive === true` (freeze can only be
  written by closure);
- `bodyCompleted === true && frozen === true` (completed records never
  freeze);
- `hiddenBreakthroughRealmIds` containing an unreached realm (index >
  player's) or a realm whose entry could not have been hidden — pinned to
  `getRealmIndex(id) <= getRealmIndex(player.realmId)` AND the source
  realm's hidden body completed (hidden entry into R requires the
  predecessor authored realm's body). A realm index-0 entry is impossible
  (mortal has no predecessor — nothing may record it).
- `!lineageActive && lineageClosedByRealmId === undefined` and vice versa.

### 6.4 Default + defaults-integrity

`createDefaultHiddenPerfection()` zero state: lineageActive true, empty
records/arrays. New PlayerData field declared in `createDefaultPlayer` per
the Pinia convention (required field, factory-produced).

## 7. §19 Legacy census — every authority audited, with verdicts

Convention: **[A]** skeleton retires/lands this now; **[B]**/[C]** the
mechanic mission owns; **[keep]** stays live unchanged. Old save versions
are rejected by policy — "retire" means removal/rewrite in the new version,
not runtime translation.

| # | Item (design §19) | Evidence (base `9aa29a46`) | Verdict + spec'd action | Owner |
|---|---|---|---|---|
| 1 | Lv18-only-normal-breakthrough assumptions | `EXTENDED_REALM_LEVEL=18` consumed only by the retiring surfaces (meridian-9 `requiredRealmLevel:18`, zhou_tian capacity cap, great_dao arm). `canTriggerBreakthrough` has no Lv18 assumption. | No such assumption exists as a breakthrough gate. `EXTENDED_REALM_LEVEL` becomes the hidden-gate constant. | [A] consumes |
| 2 | Body-completion prerequisites on Normal Breakthrough | `canTriggerBreakthrough` gates are `[level≥12]` (mortal) and `[level≥12, chapterClear]` (qi). `resolveKienCoGrade` body/meridian/pill inputs are QUALITY inputs (resolve strength, never admission). `mortalPerfectionAchieved` snapshot at `GameManagerRealmAdvanceOps.ts:366` is not a gate. | Confirmed: no admission gate exists today. Spec: the surviving quality axes (§7.7) may NEVER become admission gates — recorded as an invariant here and pinned by test. | [A] pins |
| 3 | Nine-node meridian completion | `MERIDIANS` 9 entries; `ky_kinh_thien_dia_chi_kieu` (`Meridians.ts`) — `pageRealmId qi_refining`, `requiredRealmLevel:18`, `thongMachDanCost:40`, `requiresThienDiaChiKieu:true`. `isComplete` = openedIds ≥ 9. | **RETIRE the 9th entry** — §10.1: normal Qi body is Bát Mạch 8/8; the Thiên Địa Chi Kiều node is the hidden BODY STATE (§10.2), not a meridian row. `MERIDIANS.length`→8; `requiresThienDiaChiKieu` field deleted; `THIEN_DIA_CHI_KIEU_MATERIAL_ID` + aux usage deleted; `meridianChapter.auxCurrency` removed; `MeridianSection.vue` 9th row dies with the entry; `GREAT_DAO_MERIDIAN_COUNT` dies with §7.7. | [A] |
| 4 | `requiresThienDiaChiKieu` / material-gated Thiên Địa Chi Kiều | `MeridianChapter.ts:83` aux gate + `MeridianSection.vue:79` `requiresAux` row + material `thien_dia_chi_kieu` (`materials.ts:75`, 5% on `huyet_mong`). | **RETIRE the whole material-gated path** — §10.2 non-canonical. Material entry deleted; `huyet_mong` signature drop line for it deleted (the beast's `tinh_hoa_pham_the` line + channel survive — §7.6); UI `requiresAux` plumbing removed. | [A] |
| 5 | Chu Thiên 0..360 + Tiểu/Đại gates + capacity formulas | `ZhouTianChapter.ts` (`circulation` 0..360, `ZHOU_TIAN_CAPACITY_PER_REALM_LEVEL=20`, Tiểu=180/Đại=360 derived milestones, empty stat deltas), `ZhouTianSection.vue`, `bodyProgression.zhou_tian` slice. | **[C] owns the replacement** — §11: Chu Thiên 0/36 authored nodes with flat/base rewards replaces the scalar; Tiểu/Đại survive at most as lore names, not gates. Skeleton leaves chapter untouched; C declares its own slice migration in its spec. | [C] |
| 6 | Hidden-material registries claiming transformation authority | `BODY_PERFECTION_REALM_MATERIALS` (all-empty), `player.bodyPerfection` slice, `recordBodyPerfectionMaterialDiscovery`, `perfectBodyRealm` op (`GameManagerRealmAdvanceOps.ts:662`), `isBodyPerfectionRevealed` + `BodyPerfectionSection.vue`, `getBodyPerfectionMultiplier` + `collectEffectiveBodyBaseStatDeltas` scaling channel, `HiddenMaterialChannels` (hidden_beast + grotto kinds). | **RETIRE the perfection-material transformation authority wholesale** — dormant today (all lists empty) AND colliding with the new canonical authority (§15: external materials never drive transformation). Removed: `bodyPerfection` slice, its validators/integrity pair, the multiplier channel (`collectEffectiveBodyBaseStatDeltas` reverts to raw `collectBodyBaseStatDeltas`), the section + reveal gate, the funnel call inside `notifyMaterialGained`, `perfectBodyRealm`, the realm-materials registry. `HiddenMaterialChannels` infra (banded-kill spawn substitution / grotto settle emission) SURVIVES as generic hidden-acquisition plumbing — it emits loot, it does not transform; B/C may reuse it for hidden inputs. RQ-2 flags the wholesale retirement for coordinator confirmation. | [A] |
| 7 | `great_dao_seed` / `pham_nhan_chi_cot` / grade-system reconciliation | `resolveKienCoGrade` arms: earth (`truc_co_dan` + 3 tiers), heaven (6/6 + ≥6 meridians), great_dao (9/9 + `pham_cot` + `mortalPerfectionAchieved` + Lv18 + all-5-at-normal-cap + `!greatDaoOpportunityLost`). `great_dao_seed` material: census-tagged breakthrough-scoped, 0.01% `bandit.bossRewards` drop, **consumed by nothing** (no resolver/pill/recipe reads it). `pham_cot` talent: creation easter egg, −75% cult speed. `pham_nhan_chi_cot`: +75%, non-rollable, granted by the great_dao-victory conversion (`TribulationOutcomeService:278`). | **Reconcile:** the four-tier FoundationType ladder survives as the foundation **quality-record** axis for NORMAL breakthroughs (earth/heaven stay non-gating quality inputs — the only live reads are `highestFoundationAchieved` → `KIEN_CO_MAIN_STAT_PERCENT` strength + the announcement label). The **great_dao arm retires as an eligibility computation**: its inputs (9 meridians, material gate, `pham_cot`, `mortalPerfectionAchieved`, `greatDaoOpportunityLost`, all-5-at-NORMAL-cap) are the old hidden model. Under the new law `'great_dao'` is written exactly one way — `breakthroughType:'hidden'` commits it. `pham_cot` survives unchanged; `pham_nhan_chi_cot` survives as the hidden-foundation reward conversion (now fired by the canonical hidden breakthrough — the easter egg rides the lineage). `great_dao_seed` RETIRES: dead weight — material entry + drop line + `BREAKTHROUGH_SCOPED_MATERIAL_IDS` membership + `breakthroughRealmId` tag removed. `mortalPerfectionAchieved` RETIRES (only the great_dao arm read it). `greatDaoOpportunityLost` RETIRES (permanent loss is incompatible: hidden defeat is survivable, retryable; the field's only write was that defeat arm). `highestFoundationAchieved`, `FOUNDATION_LABELS`, `KIEN_CO_MAIN_STAT_PERCENT`, `breakthroughGrade` (1–6 Bậc Nhập Đạo → Nhập Đạo strength + RealmPressure), `REALM_PASSIVES`, `BREAKTHROUGH_TALENT_POOLS` entitlement + its great_dao suppression — all SURVIVE. | [A] |
| 8 | Hidden UI leaks | `MeridianSection.vue` 9th row (dies with item 3); `BodyPerfectionSection.vue` + `isBodyPerfectionRevealed` (dies with item 6); `hiddenBeastKills` (no UI); `thien_dia_chi_kieu`/`great_dao_seed` descriptions deliberately opaque (die with items 4/7); `FOUNDATION_LABELS` announcement (legit post-commit display); `getBreakthroughRequirements` (already normal-only). | Skeleton retires the two rendering surfaces; §5 contract pins absence-only rendering for the rest. | [A] |
| 9 | Save states permitting lineage re-entry | `hiddenPerfection.lineageActive` is the SOLE lineage authority; `closeHiddenLineage` is the only write and is one-way; integrity preflight rejects frozen-active or prefix-violating states; retired fields cannot imply lineage. | New field + latch + validators land in skeleton; pinned by §17 tests. | [A] |
| 10 | Generic 6/6→7/7 equivalence | `BODY_REFINEMENT_TIERS` is 6 authored entries; nothing extends it. §9's "Luyện Thể · Bậc 7 — Phàm Cốt" is a DISPLAY label for the completed Mortal Hidden Body, not a 7th investable tier. | Spec: hidden bodies never extend chapter progress counters; the display label is owned by B's surface. Pin: `getBodyChapterProgress('body_refinement').total` stays 6 post-completion. | [B] honors, [A] pins test |
| 11 | Percent Body rewards replacing required flat/base contributions | Retired authorities emitting percent: `KIEN_CO_MAIN_STAT_PERCENT` (survives as realm passive — legal authored passive, not a Body channel), meridian `percentAtFullTier` (authored normal chapter content — survives), `BODY_PERFECTION_BONUS_PER_REALM` multiplier on body deltas (RETIRES with item 6). New hidden channels grant +10pp MAIN-STAT CAP (not %-stats) and Chu Thiên 0/36 authored flat/base rewards (C). | Boundary spec'd: hidden bodies never emit StatModifier percent on the five main stats; percent rewards survive only where the design does not touch them (realm passives, meridian chapter). | [A] + [C] |
| 12 | `hiddenBeastKills` / huyết mông channel semantics | `HiddenBeastSystem` banded-kill spawn substitution; `hiddenBeastKills: Record<channelId, number>`; `hiddenChannelCycles` per-site grotto counters. | **SURVIVES as infra** (item 6) minus the retired material line. §9's Ancient Beast is a DIFFERENT mechanism (whole-battle replacement on random stage start, semantically immortal) — B owns it and does NOT reuse spawn-substitution semantics for it (a trial, not a loot beast). | [A] retires the material line; [B] owns the new mechanism |

### 7.1 Retirement/conservation summary table

| Persisted field / authority | Fate at the new version |
|---|---|
| `player.hiddenBeastKills`, `ProductionSiteState.hiddenChannelCycles` | KEEP (generic channel infra state) |
| `player.bodyPerfection` (slice, validators, multiplier, UI) | RETIRE (superseded by hidden bodies) |
| `player.mortalPerfectionAchieved` | RETIRE (superseded by effective-cap gate) |
| `player.greatDaoOpportunityLost` | RETIRE (incompatible permanent loss) |
| `player.highestFoundationAchieved` + FoundationType + labels | KEEP — great_dao now written only by hidden breakthrough |
| `player.breakthroughGrade` (1–6) | KEEP (Nhập Đạo strength + Realm Pressure input) |
| `grantedRealmPassiveIds` + `player.modifiers` passive entries | KEEP — already-granted passive modifiers persist verbatim (§3.1 historical rewards survive); the enhanced variant only alters FIRST-grant strength on future entries |
| `resolveKienCoGrade` earth/heaven arms | KEEP as non-gating quality computation; great_dao arm retires |
| `pham_cot`, `pham_nhan_chi_cot`, conversion block | KEEP — conversion condition reads `grade === 'great_dao'` which now means hidden |
| `great_dao_seed`, `thien_dia_chi_kieu` materials + drop lines + census tags | RETIRE (dead inputs under the new law) |
| `zhou_tian` chapter + slice + ZhouTianSection | [C]-owned replacement at ITS version bump |
| `MERIDIANS[8]` (9th) + `requiresThienDiaChiKieu` + meridian aux channel | RETIRE |

## 8. Decomposition contracts — interface pins for HIDDEN-B and HIDDEN-C

All paths below are `game/src/…` post-skeleton. B and C consume the merged
skeleton; both must be able to land in either order without touching the
other's files.

### 8.1 Shared framework (both missions consume)

```ts
// src/core/realm/hidden/HiddenPerfection.ts
HiddenPerfectionState, RealmHiddenState, createDefaultHiddenPerfection,
validateHiddenPerfectionPersistedState, assertHiddenPerfectionIntegrity

// src/core/realm/hidden/HiddenLineage.ts
isHiddenLineageActive, closeHiddenLineage, getCompletedHiddenBodyCount,
isHiddenBodyCompleted, completeHiddenBody, canProgressHiddenBody,
discoverHiddenRealm, isHiddenRealmDiscovered, isHiddenRealmFrozen,
getRealmHiddenState, getHiddenBreakthroughRealmIds,
resolveBreakthroughType, isHiddenBreakthroughEligible

// src/data/realm/HiddenBodyRealms.ts
HIDDEN_BODY_REALMS, isAuthoredHiddenRealm, hiddenBodyRealmOf (index helpers)

// src/core/stats/StatCap.ts
getEffectiveMainStatCap, HIDDEN_BODY_CAP_BONUS_PER_REALM

// src/services/save boundary
validateHiddenPerfectionPersistedState + assertHiddenPerfectionIntegrity
wired beside the body validators; HIDDEN_MECHANIC_STATE_VALIDATORS dispatch
map (kind -> validator fn) for mechanic-slice payloads.
```

### 8.2 HIDDEN-B contract (Mortal §9 Ancient Beast + Qi §10 Quán Thể)

**Writes/state:** `hiddenPerfection.realms.mortal.mechanic` (kind
`'ancient_beast_trial'`, internals B-owned — encounter counters allowed but
completion only via `completeHiddenBody`), `realms.qi_refining.mechanic`
(kind `'quan_the'` — REQUIRED fields pinned: `active: boolean`,
`progress: number`, `required: number`; `bodyCompleted` ⟺ `thienDiaChiKieu`
state per §10.2 — the design's named state IS the shared `bodyCompleted`
flag; no second flag may exist).

**Consumed seams:**

```ts
// src/core/cultivation/CultivationSystem.ts — inside addCultivation, before
// the clamp writes player.cultivation. Skeleton ships a no-op default.
/**
 * Final-gain routing seam (§10.3): receives the canonical POST-modifier
 * cultivation amount; returns the amount that lands on realm cultivation.
 * The skeleton default returns `amount` unchanged. B replaces it with the
 * Quán Thể divert (progress += amount while active; overflow 100% to realm
 * cultivation within the same settlement). MUST be total-conserving
 * (returned <= amount; the diverter owns the remainder as progress) and
 * offline-equivalent (addCultivation is the shared online+offline writer —
 * the offline settle already routes through it).
 */
divertFinalCultivationGain(player: PlayerData, amount: number): number

// src/core/game/GameManagerTurnBattleOps.ts — beginBattleCycle entry seam.
// Skeleton ships the call site + a no-op resolver.
/**
 * Whole-battle replacement seam (§9.2): before a stage battle commits,
 * the hidden-mechanic registry may substitute the ENTIRE battle with the
 * Ancient Beast trial. Returns a replacement plan { enemyId,
 * survivalRounds } or undefined. Skeleton default returns undefined.
 * Contract for B: fires only on ordinary stage starts while the player is
 * mortal + lineage active + mortal body normal-complete + prefix satisfied
 * (canProgressHiddenBody); the replaced battle MUST be settlement-isolated
 * (no stage victory/unlock/loot/perfect-clear/auto-farm progression/kill
 * credit), use semantically-immortal enemy semantics (survive X canonical
 * rounds, NOT huge HP), cease rolls after completion.
 */
resolveHiddenBattleReplacement(player: PlayerData, stage: Stage): HiddenBattlePlan | undefined
```

Settlement-isolation note for B: stage-victory/unlock/perfect-clear writes
live in `StageWaveSystem`/stage-progress paths and loot in
`BattleLootSystem` — B wraps or bypasses them under the trial, per the
existing abandon/defeat teardown conventions; the trial enemy list is the
plan's enemy, not the wave pool.

**Discovery:** B writes `discoverHiddenRealm(player,'mortal')` at the FIRST
fired replacement event (the event IS the discovery — §9.1 no static
unlock); `discoverHiddenRealm(player,'qi_refining')` when Lấy Khí Quán Thể
first becomes actionable (lineage + meridian prerequisite per §10.4).

**i18n/UI:** Vietnamese strings via `useI18n()`/`i18n.global.t`; the
"Luyện Thể · Bậc 7 — Phàm Cốt" label is display-only (never a real 7th
tier).

### 8.3 HIDDEN-C contract (Foundation §11 Chu Thiên + §12 Nghịch Chu Thiên)

**Writes/state:** replaces `bodyProgression.zhou_tian` semantics per §11 —
C declares the new normal chapter state (`completed: 0..36` + authored
flat/base reward application) and its own save validation inside the
existing chapter contract (`BodyChapterDefinition`). `realms.
foundation_establishment.mechanic` kind `'nghich_chu_tian'` — REQUIRED
pinned fields: `completed: number` (0..36), `pityByLevel: number[]`
(per-current-level pity counters), `active: boolean` (discovered and
unfrozen while progressing). `completeHiddenBody` fires at Nghịch 36/36.

**Consumed seams:**

```ts
// Same §8.1 framework + the BodyChapter registry contract
// (BodyChapterDefinition — invest/progress/isComplete/validatePersisted/
// integrityIssues/collectBaseStatDeltas). The 0/36 chapter owns its RNG at
// the ATTEMPT seam (§12: consume Tinh Hoa Pháp Thể + Linh Thạch, roll
// canonical per-level success, failure increments current-level pity,
// thresholded pity = guaranteed success on the PAID attempt, pity persists
// per level and does not transfer).
```

**Chapter-identity ruling for C:** the 0/36 replacement may keep the
`zhou_tian` chapter id and swap the persisted `{circulation}` slice shape,
or introduce a new chapter id — C's spec decides; either way the save
version bumps on C's merge and the §19 zhou_tian remnants die there.

### 8.4 Parallel-safety matrix

| Surface | A | B | C |
|---|---|---|---|
| `HiddenPerfection.ts` / `HiddenLineage.ts` | owns | read-only | read-only |
| `HiddenBodyRealms.ts` | owns registry | no edits | no edits |
| mechanic validator map entries | ships empty | `ancient_beast_trial` + `quan_the` | `nghich_chu_tian` |
| `MERIDIANS` + meridian chapter + MeridianSection | retires 9th | no edits | no edits |
| `ZhouTianChapter` + `zhou_tian` slice | untouched | untouched | owns replacement |
| `CultivationSystem.addCultivation` | adds seam + no-op | fills divert | untouched |
| battle-cycle replacement seam | adds seam + no-op | fills | untouched |
| `bodyProgression` registry | untouched | untouched | owns chu_tian edits |
| PlayerData / save shape | hiddenPerfection + retires | mechanic payloads only | mechanic + chapter slice |
| i18n keys | `hidden.*` namespace skeleton | `hidden.mortal.*`, `hidden.qi.*` | `hidden.foundation.*` |
| save version | A bumps on merge | B re-bumps if it merges later | same |

Conflict surface is limited to the mechanic validator map and PlayerData
field list — disjoint keys/fields, no edit conflicts.

## 9. Ruling questions for the coordinator (design-internal only)

None of these block the skeleton; each has a spec'd default this document
implements unless ruled otherwise.

- **RQ-1 — hidden-forced at commit.** When all hidden requirements hold, the
  attempt resolves `hidden`; the player cannot elect a normal breakthrough
  (§2 "exactly two", §4.1 no picker). Default: forced (no opt-out authored
  anywhere in the design).
- **RQ-2 — wholesale BodyPerfection retirement.** The dormant material-
  perfection authority is retired entirely rather than left dormant,
  because §19 requires one canonical authority and §15 denies materials
  transformation authority. Alternative: keep the dormant slice as inert
  code (costs a competing authority).
- **RQ-3 — `huyet_mong` survives** minus its `thien_dia_chi_kieu` drop
  (still a hidden-beast channel dropping `tinh_hoa_pham_the`); the Ancient
  Beast is a separate mechanism and does not reuse it.
- **RQ-4 — type-resolution timing asymmetry.** Tribulation realms snapshot
  the type at `director.start()`; mortal resolves at `chooseCultivationPath`
  commit (the actual write). Single rule: evaluate at the committed write.
- **RQ-5 — enhanced passive placeholders** ship as authored non-canonical
  values (§8 table) pending the §18 balance pass: Nhập Đạo +0.30 flat on
  its stat set; Kiến Cơ +20% on the five main stats (parity with the old
  Đại Đạo tier).
- **RQ-6 — `hiddenBreakthroughRealmIds` records the ENTERED realm**
  (`qi_refining` for the mortal hidden commit, `foundation_establishment`
  for the Qi hidden commit). Passive selection reads the entered realm.

## 10. §17 verification pins — skeleton-owned test plan

Each line maps to a named vitest block (skeleton ships all of them; B/C add
their realm-mechanic pins in their own suites):

| §17 pin | Skeleton test |
|---|---|
| Lv11 normal breakthrough unavailable | `canTriggerBreakthrough` false at level 11 (existing coverage retained) |
| Lv12 normal eligible | true at 12 (existing) |
| Lv13–18 cultivation continues | `addCultivation` accrual unchanged; divert seam no-op identity |
| Lv17 hidden unavailable | `resolveBreakthroughType` → 'normal' at 17 with all else true |
| Lv18 alone insufficient | 'normal' at 18 with lineage + no body + at-cap (each missing arm falsifies hidden) |
| failed normal does not close | tribulation defeat leaves `lineageActive` |
| successful normal closes | ritual/tribulation commit writes closure + freezes unfinished records |
| successful hidden preserves | hidden commit: lineage stays active; hiddenBreakthroughRealmIds recorded; enhanced passive granted |
| normal needs no body | normal commit succeeds with zero hidden progress (gate ignores hidden state) |
| historical bonuses survive | post-closure granted modifiers + completedHiddenBodyRealmIds unchanged |
| strict-prefix | `canProgressHiddenBody('qi_refining')` false until mortal complete; saves violating prefix rejected at integrity preflight |
| skipping fails closed | closed lineage ⇒ discovery/body/progress writes all fail |
| post-closure no discovery | `discoverHiddenRealm` false post-closure |
| freeze | records frozen at closure stay readable-but-inert; mutators no-op |
| cap ×1.0/×1.1/×1.2/×1.3 | `getEffectiveMainStatCap` across 0–3 completions at every authored realm (floor rule pinned incl. float-noise cases) |
| cap-without-fill | raising the cap does not write baseStats |
| B/C realm pins | B/C suites (their mechanics' §17 lines are theirs) |

## 11. Out of scope (explicit)

- The three realm mechanics' internals (Ancient Beast rounds/immortality,
  Quán Thể divert threshold/behavior, Chu Thiên 0/36 + Nghịch RNG/pity
  tables) — B/C own.
- Any merged-branch save translation (rejected by policy).
- §18 balance numbers (all placeholders marked non-canonical).
- Realm content beyond Trúc Cơ (release ceiling unchanged).
- i18n/UI for hidden surfaces (framework only; B/C own their surfaces).
