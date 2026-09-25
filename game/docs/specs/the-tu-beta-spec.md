# Thể Tu (body_pathway) Beta Spec — Luyện Khí + Trúc Cơ window

Authority: `game/docs/design/the-tu-body-pathway-design.txt` (THỂ TU — COMBAT
PATH DESIGN AUTHORITY). Beta window = realms `qi_refining` and
`foundation_establishment` (release ceiling `foundation_establishment`).
Kim Đan/Nguyên Anh content is out of scope (design sec.74).

## 1. Audit classification (design sec.72)

Legend: **CURRENT+ALIGNS** (stays verbatim), **CONFLICTS** (must re-author),
**LEGACY** (dead/vestigial, strip or park), **REUSABLE** (chassis kept, payload
re-authored), **MISSING** (net-new seam).

### Skills (`src/data/skill/TheTuSkills.ts`)

| Surface | Verdict | Notes |
| --- | --- | --- |
| `CUONG_QUYEN` def | CONFLICTS | Carries `missingHpBonusPerMissingPercent` + cap at LQ — design forbids missing-HP scaling at Luyện Khí (Huyết Cuồng is post-TC). Multiplier + levelScaling chassis kept. |
| `LOAN_DAU` def | CONFLICTS | Ungated, no HP sacrifice, missing-HP fields on the base def. Re-author: `pay_hp` op + ordered multi-hit + actual-paid scaling. |
| `BAT_TU_BA_THE` def | LEGACY (parked) | Ultimate — not beta content (sec.74). Def stays authored but unreachable; kit.ultimate undefined in beta. |
| `TRAN_AP` def | CONFLICTS | Plain might-multiplier AoE — must gain Max-HP-derived damage as primary scaling. |
| `PHAN_CHINH` def (emblemOnly) | CONFLICTS | Passive-only emblem is wrong. Replaced by `PHAN_CHAN` — a real castable Special (taunt + mark all enemies) plus build-time passive buff. |
| `SON_NHAC` def | LEGACY (parked) | Ultimate-tier protector kit — not beta content. Def stays authored, unreachable. |
| `THE_TU_KIT_BY_ROOT` | CONFLICTS | Grants full 3-skill kits at LQ. Root grants Basic only; Special comes from TC-gated node. |
| `buildTheTuKit` clone seam | REUSABLE | Modifier-baking seam stays; gains new channels + ownership gating. |
| `ung_the` kit + An machinery | CURRENT+ALIGNS | Out of scope, untouched. |

### Nodes (`src/data/progression/TheTuNodes.ts`)

| Surface | Verdict | Notes |
| --- | --- | --- |
| `cuong_chien`/`tran_the` roots + `excludesNode` mutex | REUSABLE | Mutex semantics correct; grants must drop special/ultimate cores. |
| Stat trunk `minor_cuong_khi_huyet` etc. + `TRUNK_FOUNDATION` | CONFLICTS | Raw stat grants (strength/vitality/maxHp/defense/block) — design forbids any stat from the tree (INV-31). Deleted. |
| `minor_cuong_huyet_no`, `major_loan_dau_sat` | CONFLICTS | missingHpBonusBonus ungated at LQ. Channel reusable only inside the Huyết Cuồng window. |
| `minor_cuong_cong_the`, `minor_cuong_sinh_menh`, `minor_tran_the_bi` | CONFLICTS | Stat nodes — deleted. |
| `major_bat_tu_tuc_menh`, `major_son_nhac_bao_bi`, `major_khiem_khich_dien` | LEGACY (parked) | Ultimate/taunt-duration channels are non-beta. Nodes deleted; channels deleted. |
| `minor_phan_chinh_no`/`minor_phan_chinh_cuc` | CONFLICTS→REUSABLE | Taken-ratio deleted; maxHpRatioBonus channel reused as Chấn Cốt. |

### Buffs (`src/data/buff/TheTuBuffs.ts`)

| Surface | Verdict | Notes |
| --- | --- | --- |
| `KHIEM_KHICH_DEBUFF` + `tauntSourceId` redirect | REUSABLE | Chassis kept as Phản Chấn's taunt payload. |
| `PHAN_CHINH_BUFF` (per-hit `takenRatio` reflect) | CONFLICTS | Per-hit reflect + takenRatio is wrong. Re-authored as `PHAN_CHAN_BUFF`: once-per-action Max-HP-ratio reflect w/ marked ratio. |
| `BAT_TU_BA_THE_BUFF`, `SON_NHAC_BUFF`, `SON_NHAC_HO_THE_BUFF` | LEGACY (parked) | Stay authored; unreachable in beta. |
| `CHAN_AN` mark | MISSING | New marker debuff: pure mark, no DoT/stat-down/consume/self-damage. |

### Combat seams

| Surface | Verdict | Notes |
| --- | --- | --- |
| `runLandedHitProcs` → `rollReactiveTrigger('onImpactLanded')` per-hit reflect | CONFLICTS | Fires per hit; design needs once-per-hostile-action aggregation. |
| `DealDamageOperation` `damageProfile` dispatch (open string) | REUSABLE | New `'sacrifice'` profile plugs into `CombatSystemDamageAdapter`. |
| `ops_result_sum` read step | REUSABLE | Reads the sacrifice op's settled `hpDamage` (= actual HP paid). |
| Late-binding (`late`) on op payload fields | REUSABLE | `var`-referencing coefficients evaluate at EXECUTE, post-read — exact fit for paid-HP payoff. |
| `sourceMaxHpRatio` damage channel | MISSING | New field: authored `deal_damage` → op payload → `ActionDamageInfo` → `calculateBaseDamage` raw-base addend (pre-mitigation). |
| `instances.each` multi-hit + `hitPolicy.guaranteedHit` + `armorPolicy` | REUSABLE | Ordered multi-hit + Phá Kình pierce. |
| `resolveTakenWindow` natural-action gate (`'normal'|'skill'`) | REUSABLE | Same gate decides reflect eligibility. |
| `applyDirectDamage` actual-applied return | REUSABLE | Vitals truth = actual HP paid. |
| Vitals `sacrifice` reason | MISSING (small) | New `VitalsChangeReason` member for self-pay telemetry. |
| `grantsBuffsAtBuild` passive-on-learn | REUSABLE | Phản Chấn's passive lands when the special enters the kit. |
| Once-per-action reflect aggregation | MISSING | Queue in `CombatProcSystem` keyed by holder; flush at action end. |
| `armorPierceFraction` def field → authored `armorPolicy` | MISSING (small) | Phá Kình bakes pierce onto Cuồng Quyền's clone. |

### Persistence / save shape

| Surface | Verdict | Notes |
| --- | --- | --- |
| `player.nodeLevels` (root/core/node levels) | CURRENT+ALIGNS | Persists root choice, core levels, node levels — no save-shape change, no version bump. |
| Taunt/mark durations, reflect flags, missing-HP | N/A | Battle-local by construction — never persisted (correct). |

### UI (`components/panels`)

| Surface | Verdict | Notes |
| --- | --- | --- |
| `SkillPathPanel` tree-tag selection (`wayNodeTreeTag`) | REUSABLE | `'the_tu'` tag selects a bespoke panel. |
| `NodeTreePanel` (Ngự Kiếm spine style) | CONFLICTS for 'the_tu' | Design forbids the evolution spine for body_pathway; hidden way keeps it. |
| `NodeInspector` purchase flow | CURRENT+ALIGNS | Reused as-is. |
| `TheTuTreePanel` (root cards, realm separators, sealed silhouette, Phong ấn) | MISSING | New component. |
| `TurnSkillDisplayMeta` `phan_chan` entry | MISSING | New id needs display meta. |

## 2. Beta spec

### 2.1 Kit resolution

- Root nodes (`cuong_chien` XOR `tran_the`, `excludesNode` mutex — existing,
  persisted via `player.nodeLevels`) grant ONLY the basic skill core:
  `cuong_chien → [cuong_quyen]`, `tran_the → [tran_ap]`.
- `TheTuKit` becomes `{ basic: TurnSkillDefinition; special?: TurnSkillDefinition;
  ultimate?: TurnSkillDefinition }`. `resolveSpecialUltimate` returns
  `{special: kit.special, ultimate: kit.ultimate}` (undefined slots — the
  `collectClones` lane already tolerates undefined).
- `resolveBodyKit` reads `deps.getNodeLevel('core_loan_dau'|'core_phan_chan')`:
  special joins the kit iff its core node is owned (level ≥ 1). No ultimate in
  beta (`kit.ultimate` stays undefined; `buildSurviveSources` is removed — it
  only existed for `bat_tu_ba_the`, which is never in the kit).
- `major_loan_dau` / `major_phan_chan` nodes (`requiredRealmId:
  'foundation_establishment'`) carry `grantsSkillCoreIds` for the special —
  realm gate + ownership record in one node.

### 2.2 Cuồng Quyền (Basic, LQ, Cuồng Chiến)

- Single-target physical hit. High might conversion (coefficient 1.4,
  tuned — balance-flagged per §3.6; the original 1.1 text was updated
  2026-09-25 to match the shipped value + levelScaling). **Never** HP
  cost. **No** missing-HP fields on the base def.
- Trọng Quyền node → `cuongQuyenCoefficientBonus` (additive coefficient per
  node level, baked onto the clone's `operations[deal_damage].coefficient`).
- Phá Kình node → `cuongQuyenArmorPierce` (fraction per level, baked onto the
  clone as authored `armorPolicy.pierceFractionOnFail` with `bypassChance: 0` —
  always-on flat pierce; rides the v1.6 declared-intent contract).

### 2.3 Loạn Đấu (Special, TC, Cuồng Chiến)

- Operations: `[pay_hp{maxHpRatio, into:'hpPaid'}, deal_damage{...}]`.
- `pay_hp` is a new authored op. The resolver lowers it to:
  `deal_damage{target: source, damageProfile:'sacrifice', coefficient:maxHpRatio,
  canCrit:false, canMiss:false}` + `read{ops_result_sum([payOpId],'hpDamage')
  → var}`.
- `CombatSystemDamageAdapter` profile `'sacrifice'`:
  `paid = min(maxHp * coefficient, currentHp - 1)` (floored at leaving 1 HP;
  paid ≤ 0 → `CombatOperationSkip`), applied via
  `vitals.applyDamage(reason:'sacrifice')` — the settled `hpDamage` IS the
  actual paid amount, and the read captures it. Self-pay never lands a hit gate
  (`landed === undefined` for non-hit profiles).
- The damage op's coefficient late-binds
  `base + var(hpPaid) * bonusPerHpPaid` (var = non-foldable → EXECUTE-time
  eval, post-read). Ordering is structural: pay → read → hit. Payoffs use
  actual paid — INV-9/10/11.
- 1-HP edge (pinned 2026-09-25): a cast at exactly 1 HP pays 0 — the op
  skips and the cast still commits at base coefficient. The sacrifice is a
  cost, not a gate; the berserker edge (free cast at maximum missing-HP
  state) is intentional for beta. Whether the cast should instead be
  gated below 2 HP is a BETA-BALANCE ruling.
- Ward/flat channel (pinned 2026-09-25): sacrifice and reflection ride
  the flat/direct-vitals channels and bypass ward entirely. A warded
  caster pays through its own ward (self-inflicted); a warded attacker
  takes unmitigated reflect. Internally consistent and intentional for
  beta — revisit in BETA-BALANCE if ward interaction is wanted.
- Ordered multi-hit: `instances: { count: N, perInstanceOptions: true }` —
  existing per-instance settle = sequential hits into the same target.
- Huyết Sát node → `loanDauPaidBonusPerHpPaidBonus` (adds to the per-paid-HP
  ratio baked on the clone).
- **Huyết Cuồng** (passive unlocked by learning Loạn Đấu): `buildTheTuKit`
  bakes `missingHpBonusPerMissingPercent`/`missingHpBonusCap` onto the
  `cuong_quyen` + `loan_dau` clones **only**, only when the special core is
  owned. Kit-local: normal attacks/equipment/companion/DoT/generic damage
  never read it (the fields live only on kit defs — INV-13).
  Cuồng Ý node → existing `missingHpBonusBonus` channel (per-level add).

### 2.4 Trấn Áp (Basic, LQ, Trấn Thể)

- `targetScope: 'enemy'`, `targeting: 'all_lanes'` — hits every valid enemy.
- Primary scaling: caster Max HP — new scalar channel `sourceMaxHpRatio`
  (authored `deal_damage` field → `DealDamageOperation.payload` →
  `ActionDamageInfo` → `resolveActionHit` → `calculateBaseDamage` adds
  `source.stats.maxHp * ratio` into the physical raw base **before**
  mitigation). A small might multiplier remains as the secondary term.
- Trọng Thế node → `tranApMaxHpRatioBonus` (adds to the ratio on the clone).
- Trấn Kình node → `tranKinhWeakenRatio` (0.15/level): the clone gains an
  `appliesAilments` landed-gate debuff `tran_kinh` (no DoT; a
  `finalDamagePercent` penalty on the marked enemy, stacked at
  `1 + ratio/TRAN_KINH_WEAKEN_RATIO` → L1 −0.30 … L5 −0.90). Beta model:
  one-holder-turn weaken window covering the enemy's next hostile turn —
  accepted deviation from the design's consume-on-next-hit wording
  ("Không cần duration dài"): the buff engine has no next-action-damage
  consume channel and adding one is deferred to BETA-BALANCE where the
  magnitude curve is re-tuned anyway (design also allows deferring the
  whole node without breaking the Trấn fantasy).

### 2.5 Phản Chấn (Special, TC, Trấn Thể)

- Real castable special (`specialSlot`), cooldown. **Zero** direct damage —
  no `deal_damage` op.
- `appliesBuffs`: `[khiem_khich (taunt, existing), chan_an (mark, new)]` with
  target `'action_targets'` → lands on every affected enemy. `chan_an` =
  ailment/debuff marker, per_target + latest, dispellable, mark-only.
- Passive (unlocked when the special core is owned — `grantsBuffsAtBuild:
  [PHAN_CHAN_BUFF]`): `reactive_trigger` payload `reflectsDamage:
  {maxHpRatio, markedMaxHpRatio, markedBy:'chan_an'}`.
- **Once-per-action reflect (CombatProcSystem rework):** the `reflectsDamage`
  branch stops emitting per-hit. Instead `queueReflect` accumulates per holder
  into a pending map (multi-hit merges — one pending entry per holder per
  action window). `flushReflects()` drains at action end: amount =
  `holder.maxHp * (marked ? markedMaxHpRatio : maxHpRatio)` (+ `takenRatio`
  support deleted — no beta consumer), emitted as `deal_damage{profile:
  'reflection', canCrit:false, canMiss:false}` targeting the attacker.
- Eligibility: `runLandedHitProcs` gains an `eligible` flag — the plan hook
  passes `declared.actionSource === 'normal' || 'skill'` (same law as
  `resolveTakenWindow`, INV-9 parity). Reactive/bypass/follow-up sources never
  queue.
- Rules honored: max ONE per hostile action (pending map + per-action flush);
  AoE that hpDamages triggers (the AoE's landed gate calls the same path);
  ward/miss/dodge → nothing (existing `hpDamage > 0` gate); DoT/environmental/
  self/reflect → never queued (no landed gate / self-target / 'reflection'
  profile has no gate); reflect rolls no hit/crit (`canMiss/canCrit:false`),
  consumes no turn (op, not action), never recurses (reflection profile → no
  gate → no re-queue), never consumes Chấn Ấn; post-mortem retaliation —
  a holder killed by the triggering hit still reflects at the flush (the
  authored amount derives from holder.maxHp, never live vitals; legacy
  semantics and the Trấn Thể tanking fantasy), while a dead *attacker*
  always skips (no target).
- Flush site: `TurnBattleSystem.applyActionImpact` tail (before
  `resolveAllyActionWindow`), gated on `runtime !== undefined` — covers plan
  casts; the legacy lane never had reflect (no `rollReactiveTrigger` call
  there) so nothing is lost. Chấn Cốt node → `reflectMaxHpRatioBonus`
  (existing channel, adds to base ratio); Trấn Ấn node →
  `reflectMarkedRatioBonus` (new channel, adds to marked ratio).

### 2.6 Node tree (re-authored, `TheTuNodes.ts`)

Topology (design sec.56), all nodes `requiredCultivationPath:'body'` +
`requiredWay:'body_pathway'` + `branchTag:'the_tu'`:

```
cuong_chien (root, LQ, grants core_cuong_quyen)   tran_the (root, LQ, grants core_tran_ap)
   ├─ minor_trong_quyen  (cuongQuyenCoefficientBonus)   ├─ minor_trong_the   (tranApMaxHpRatioBonus)
   └─ minor_pha_kinh     (cuongQuyenArmorPierce)         └─ minor_tran_kinh   (tranKinhWeakenRatio)
   ──── Trúc Cơ ────                                    ──── Trúc Cơ ────
   major_loan_dau (TC, grants core_loan_dau)             major_phan_chan (TC, grants core_phan_chan)
   ├─ minor_huyet_sat    (loanDauPaidBonus)              ├─ minor_chan_cot    (reflectMaxHpRatioBonus)
   └─ minor_cuong_y      (missingHpBonusBonus)           └─ minor_tran_an     (reflectMarkedRatioBonus)
```

`bodyKitModifiers` channel inventory after rework:
`cuongQuyenCoefficientBonus`, `cuongQuyenArmorPierce`,
`loanDauPaidBonusPerHpPaidBonus`, `missingHpBonusBonus` (Huyết Cuồng
efficiency), `tranApMaxHpRatioBonus`, `tranKinhWeakenRatio`,
`reflectMaxHpRatioBonus`, `reflectMarkedRatioBonus`.
Deleted channels: `reflectTakenRatioBonus`, `sonNhacWardRatioBonus`,
`tauntTurnsBonus`, `batTuDurationBonus` (non-beta).
No node grants raw stats anywhere (INV-31); node levels are modifier levels —
`getSkillCoreLevel` stays the sole skill-level authority (INV-33).

### 2.7 UI (`TheTuTreePanel.vue`)

- `SkillPathPanel`: when `wayNodeTreeTag === 'the_tu'`, center column renders
  `TheTuTreePanel` instead of `NodeTreePanel` (tag-driven selection, no new
  way predicate — same resolver law). Hidden way keeps `NodeTreePanel`.
- Panel contract: two root cards (`CUỒNG CHIẾN` / `TRẤN THỂ`); pre-choice both
  are selectable (purchase = commit); post-choice the abandoned root shows
  `Đã bỏ con đường này` and the chosen root's column renders:
  `──── Luyện Khí ────` separator → Basic skill card (role/realm/scaling
  labels from display meta) → its two modifier nodes → `──── Trúc Cơ ────`
  separator → Special card — sealed silhouette `[ ??? ] Chưa đủ cảnh giới`
  when realm < foundation_establishment, purchasable major node when at TC →
  its two modifier nodes → `──── Kim Đan ────` `Phong ấn` placeholder.
- Node cards emit the same `select` event → `NodeInspector` unchanged.
- Skill cards emit the same `select` event → `NodeInspector` (unified
  surface: the inspector renders realm/prerequisite lock reasons for the
  sealed special, which `NativeCoreDetail` cannot).

## 3. Implementation plan

| # | File | Change |
| --- | --- | --- |
| 1 | `data/buff/TheTuBuffs.ts` | `CHAN_AN_DEBUFF` (new marker); `PHAN_CHINH_BUFF` → `PHAN_CHAN_BUFF` (id `phan_chan`, payload `{maxHpRatio, markedMaxHpRatio, markedBy:'chan_an'}`); keep SON_NHAC/BAT_TU authored. |
| 2 | `core/proc/ProcCapabilities.ts` | `reflectsDamage` payload: `{maxHpRatio; markedMaxHpRatio?; markedBy?: BuffDefinitionId}`; drop `takenRatio`. |
| 3 | `core/proc/CombatProcSystem.ts` | reflectsDamage branch → `queueReflect` into `pendingReflects` map; `flushReflects()` emits one reflect per holder; eligibility flag threaded. |
| 4 | `core/battle/turn/TurnBattleSystem.ts` | `runLandedHitProcs` deps gains `eligible` param; flush call at `applyActionImpact` tail (runtime-gated); remove `buildSurviveSources` override path. |
| 5 | `core/battle/turn/TurnSkillPlanRuntime.ts` | `onLandedGateEntered` passes eligibility (`declared.actionSource === 'normal' \|\| 'skill'`). |
| 6 | `core/skilldef/AuthoredOperation.ts` + `SkillDefinitionRegistry.ts` | New `pay_hp` authored op `{maxHpRatio: ScalarExpression, into: string}` + validation; `deal_damage` gains `sourceMaxHpRatio?: ScalarExpression`. |
| 7 | `core/skilldef/SkillResolver.ts` | `pay_hp` → sacrifice deal_damage op + `ops_result_sum` read; `sourceMaxHpRatio` fold/late onto op payload. |
| 8 | `core/battle/contracts/operations.ts` | `DealDamageOperation.payload.sourceMaxHpRatio?: number`. |
| 9 | `core/battle/.../CombatSystemDamageAdapter.ts` | `'sacrifice'` profile (floor at currentHp-1, `applyDirectDamage` reason `'sacrifice'`); `sourceMaxHpRatio` → `ActionDamageInfo`. |
| 10 | `core/battle/ActionImpactSystem.ts` + `core/combat/CombatSystem.ts` + `core/combat/DamageCalculator.ts` | `sourceMaxHpRatio` on `ActionDamageInfo`; physical raw base += `source.stats.maxHp * ratio` pre-mitigation. |
| 11 | `core/combat/EntityVitalsSystem.ts` | Add `'sacrifice'` to `VitalsChangeReason`. |
| 12 | `data/skill/TheTuSkills.ts` | Re-author CUONG_QUYEN/LOAN_DAU/TRAN_AP/PHAN_CHAN; park BAT_TU/SON_NHAC; `TheTuKit` optional slots; `buildTheTuKit` rebake (new channels + ownership gating). |
| 13 | `core/the-tu/TheTuKitModifiers.ts` | Channel inventory swap (add 5, delete 4). |
| 14 | `data/progression/TheTuNodes.ts` | Re-author tree per sec.2.6 (delete stat trunk + stat/ultimate nodes). |
| 15 | `core/player/CultivationPathRegistry.ts` | `resolveBodyKit` special gating via core ownership; drop `buildSurviveSources`. |
| 16 | `core/skilldef/LegacySkillAdapter.ts` | `armorPierceFraction` field → `armorPolicy` on authored op (if used for Phá Kình — else bake `instances.each.armorPierce` directly). |
| 17 | `data/progression/SkillCoreNodes.ts` + `data/skill/TurnSkillDisplayMeta.ts` | Add `phan_chan` core id + display meta entries (new node ids too). |
| 18 | `components/panels/skill-path/TheTuTreePanel.vue` + `SkillPathPanel.vue` + i18n | Bespoke tree; tag-selected. |
| 19 | `core/the-tu/TheTuPath.ts` | `ownedContent` skill/buff id lists updated (phan_chan/chan_an). |
| 20 | Tests | `GameManager.theTuKit.test.ts` rework + new `the-tu-beta` test files per pin list. |

## 4. Pin tests (required list)

1. Root mutex persistence: `cuong_chien` purchase blocks `tran_the` + survives
   re-resolution.
2. Cuồng Quyền: no HP cost (caster hp unchanged), no missing-HP scaling at LQ
   (equal output at full vs low HP modulo variance → assert identical base).
3. Loạn Đấu ordering: pay → new missing-HP → damage (hit coefficient reads
   post-pay `hpPercent` — assert damage scales with the NEW state).
4. Loạn Đấu 1-HP floor: full-HP cast at 1 HP → paid = 0/skip, never self-kills.
5. Loạn Đấu actual-vs-nominal: caster at 30% HP paying 50%-maxHP ratio →
   payoffs use 30%-of-max, not 50%.
6. Huyết Cuồng kit-only: reflect/missing-HP bonus on kit defs; normal attack
   and a non-kit skill show no missing-HP bonus.
7. Trấn Áp: damage scales with caster maxHp (two stats blocks differing only
   in maxHp → different damage), hits all valid enemies.
8. Phản Chấn: taunt + `chan_an` on ALL enemies after cast; enemy single-target
   selection redirects to the Trấn Thể holder.
9. Reflect: once per action (multi-hit → exactly one reflect op), AoE trigger,
   full-ward/miss → none, DoT tick → none, reflect does not recurse, marked
   attacker takes marked ratio = holder.maxHp × markedMaxHpRatio.

## 5. Deferred (design sec.74 — non-beta)

Kim Đan/Nguyên Anh nodes, Ultimate timing + Bất Tử Bá Thể/Sơn Nhạc final forms
(defs + buffs parked, unreachable), intercept/ally-ward/team-protector
mechanics, artificial resource/stance/respec economy, endgame tree, all
coefficient/duration/count balancing (tunable constants flagged `TUNABLE`).
