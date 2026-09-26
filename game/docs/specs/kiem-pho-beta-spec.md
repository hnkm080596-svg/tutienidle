# KIẾM PHỔ BETA — Implementation Spec & Plan

Authority: `pasted-1790267018283.txt` (design doc, sections 0–19). This spec
translates the locked design onto the live codebase surfaces; the design doc
is the contract and this file is the mapping + G0 task card.

## G0 Task Card

| Field | Value |
|---|---|
| taskId | kiem-pho-beta |
| responsibility | Rebuild the visible Kiem Pho (sword_pathway) tree and the six beta combos to the locked design inside the Truc Co beta window |
| inScope | orb_dam / orb_chem identity VFX + ailment identities; six D/C combo semantics; eight visible nodes on two branch views; generic skill-scoped modifier seams; ordering contract; reachability tests |
| outOfScope | bo/hat/quet node branches (removed — see DEC-1); Bo/Hat/Quet orb semantics unchanged; 31 non-beta combos keep structure (renamed only if their pattern uses orb_chem... see DEC-2); realmComboMax tiers; preset strip UX; ngu_kiem subtree untouched |
| productionBoundary | src/data/skill/{KiemPhoOrbs,KiemPhoCombos}.ts, src/data/progression/KiemTuNodes.ts, src/data/vfx/CombatVfxPresets.ts, src/data/buff/KiemPhoBuffs.ts, src/core/kiem-tu/{KiemPhoSystem,KiemPhoProvider,KiemPhoNodeModifiers}.ts, src/core/skill/SkillEffect.ts, src/core/skilldef/LegacySkillAdapter.ts, src/core/battle/turn/TurnSkillAction.ts, src/core/battle/CombatAction.ts, src/core/player/CultivationPathRegistry.ts |
| expectedFiles | the boundary files above + their .test.ts twins + GameManager.kiemPho.test.ts, GameManager.kiemTuTree.test.ts, invariants.test.ts, KiemPhoOrbs.test.ts, KiemPhoCombos.test.ts, KiemTuNodes.test.ts, KiemPhoProvider.test.ts, EarlyGameLoop.ts, QrProbe.test.ts, MortalChapterJourney.test.ts, GameManager.kiemTuNguWay.test.ts, KiemTuPath.way.test.ts, BalanceBaselines.ts (comments) |
| firstProof | BEFORE_WRITE: prove the combo-def chain carries add_stacks/extend/trigger_periodic ops through routeExtraCast -> adaptTurnSkillDefinition -> plan ops -> BuffSystem (audit says yes — verified in SkillResolver/AuthoredOperation/BuffSystem) |
| stopCondition | all beta-window contracts pinned by tests; type-check + scoped vitest + eslint green; commit on devin branch |
| ownedBy | this worker session |

## 1. Beta scope

Release ceiling: `ReleasePolicy.progressionCeilingRealmId === 'foundation_establishment'`
(realmIndex 2 — Truc Co). Reachable orbs: orb_dam (idx1), orb_chem (idx2).
Reachable combo patterns: only the six all-D/C length-3 patterns are combo-
defined (see 3). orb_bo/hat/quet stay realm-locked and unreachable in window.

## 2. Audit — surfaces mapped (design sec.15)

| Design surface | File | Finding |
|---|---|---|
| KiemPhoOrbs | src/data/skill/KiemPhoOrbs.ts | orb_dam x1.0 pure hit; orb_chem x1.2 + applies kiem_thuong(1 stack, chance 1). Both presetId:'slash' — must split into distinct presetIds. |
| KiemPhoCombos | src/data/skill/KiemPhoCombos.ts | 37 flat defs {id,name,pattern,damage,mult}; stub tiers L3=2.5/L4=4/L5=7. The 6 D/C combos carry ids/names from the old scheme and no ailment semantics. No D-C-C / C-D-D entries (already correct). |
| KiemPhoSystem | src/core/kiem-tu/KiemPhoSystem.ts | tail matcher + applyModifiers + derived copies — reusable as-is; needs phase-sort for appended ailmentInteractions (DEC-4). |
| KiemPhoProvider | src/core/kiem-tu/KiemPhoProvider.ts | comboToExtraDef -> TurnSkillDefinition -> routeExtraCast (non-committing plan). progressionOwnerId already inherits completing orb's core level (M-QI-05). Needs to fold new combo fields + skillDefinitionModifiers (DEC-3/5). |
| NodeModifiers | src/core/kiem-tu/KiemPhoNodeModifiers.ts | collector reads effect.swordPathComboModifier; extends to completingOrb predicate + ailmentInteractions append (DEC-6). |
| ProgressionNode | src/core/progression/ProgressionNode.ts | NodeEffect gains skillDefinitionModifiers channel (DEC-5); swordPathComboModifier.minOrbCount becomes optional-with-one-predicate (DEC-6). |
| Composition | src/core/player/CultivationPathRegistry.ts:373 | buildKiemPhoProvider(player, collectKiemPhoComboModifiers(player, nodes)) — extend to pass node-derived skill modifiers (DEC-5). |
| SkillEffect | src/core/skill/SkillEffect.ts | SkillAilmentInteraction union gains {kind:'add_stacks',buffId,stacks} (DEC-7). |
| LegacySkillAdapter | src/core/skilldef/LegacySkillAdapter.ts | adaptAilmentInteractions emits identity-selector ops; forwards armorPolicy from def-level (DEC-8). |
| TurnSkillAction | src/core/battle/turn/TurnSkillAction.ts | TurnSkillDefinition gains armorPolicy{bypassChance?,pierceFractionOnFail?} (DEC-8). |
| VFX | src/data/vfx/CombatVfxPresets.ts + src/core/battle/CombatAction.ts | CombatVfxPreset gains optional `signature` stroke token list (DEC-9); add kiem_orb_dam/kiem_orb_chem + rename 6 beta combo presets. |
| Buffs | src/data/buff/KiemPhoBuffs.ts | kiem_thuong def already correct (per_source, cap 3, refresh, physical dot 0.25) — untouched. |
| KiemTuNodes | src/data/progression/KiemTuNodes.ts | all 30 kiem_pho nodes (5 orbs x [5 statModifier growth + 1 combo capstone]) violate the global invariant or the out-of-scope rule — replaced by 8 node entries (DEC-1). |

## 3. Locked beta combos (design sec.4/7)

| id | pattern | name | semantics (data encoding) |
|---|---|---|---|
| nhat_tuyen | D,D,D | Nhất Tuyến | direct hit only. damage x3.0, no ailment ops. |
| liet_ngan | C,C,C | Liệt Ngân | direct hit x1.8 + ailmentInteractions add_stacks kiem_thuong by KIEM_THUONG_CAP (clamps to cap). No reapply roll. |
| khai_ngan | D,D,C | Khai Ngân | direct hit x1.9 + add_stacks kiem_thuong +1 (typically 2 total on the wound). |
| thau_ngan | C,C,D | Thấu Ngân | direct hit x2.0 + scalesWithAilmentStacks{kiem_thuong, damagePerStack:0.5} scope own. No consume. |
| hoi_tuyen | D,C,D | Hồi Tuyến | direct hit x2.8. No ailment ops (memory is in the recoil flavor). |
| diep_ngan | C,D,C | Điệp Ngân | direct hit x2.2 + trigger_periodic kiem_thuong (canonical BuffSystem.triggerPeriodic — periodic damage resolves through its own rules). |

Forbidden patterns: D-C-C and C-D-D are NOT combos — replay test pins that
they produce no fire (inv.12) and not merely absent-but-suffixable (inv.17).

## 4. Ordering contract (design sec.8)

For a combo completed by orb X on target T, within one resolved cast:
1. finishing orb X resolves (own damage + its own appliesAilments)
2. combo direct hit resolves (incl. scaleBuff reads)
3. combo stack application / cap clamp (add_stacks)
4. duration / local buff modifiers (extend_duration, add_modifier — none on combos in beta)
5. manual periodic triggers LAST (trigger_periodic)

Encoding: authored order on the combo def compiles into onLanded ops in
order; a defensive phase-sort in applyModifiers keeps node-appended
interactions phase-ordered regardless of purchase order (DEC-4).

## 5. Eight beta nodes (design sec.10-12)

Ids = pinyin no diacritics (N2b); branchTag 'kiem_pho'; requiredWay
'sword_pathway'; realm-gated to orb unlock (orb_dam nodes qi_refining,
orb_chem nodes foundation_establishment).

| node | orb | role | effect |
|---|---|---|---|
| thich_can | dam | Can (minor, maxLevel 5) | skillDefinitionModifiers: orb_dam damageMultiplierPerLevel +0.08; levelGate atLevel5 -> techniqueRank 4 (ngu precedent) |
| nhat_diem | dam | Thuan Thuc (major, 1) | armorPierceFractionOnDam +0.30 (skill-scoped pierce-on-fail only — deterministic, no RNG bypass roll) |
| quy_tuyen | dam | Kiem Ket (major, 1) | swordPathComboModifier completingOrb:'orb_dam' -> bonusDamageMultiplier +0.20 (matches nhat_tuyen/thau_ngan/hoi_tuyen) |
| lien_thich | dam | Lien Thuc (keystone, 1) | swordPathComboModifier minOrbCount{orb_dam,2} -> +0.25 (matches nhat_tuyen/khai_ngan/hoi_tuyen); prereq nhat_diem+quy_tuyen |
| tram_can | chem | Can (minor, 5) | orb_chem damageMultiplierPerLevel +0.08; same levelGate |
| thuong_tham | chem | Thuan Thuc (major, 1) | addAilmentInteractions on orb_chem: add_modifier kiem_thuong {id:'thuong_tham', channel:'periodic_damage', op:'multiply', value:1.25, reapply:'max', lifetime buff_lifetime} — gated on apply result so a resisted Chém never mutates a stale instance |
| luu_ngan | chem | Kiem Ket (major, 1) | swordPathComboModifier completingOrb:'orb_chem' -> append ailmentInteractions extend_duration kiem_thuong +1 (matches liet_ngan/khai_ngan/diep_ngan) |
| lien_tram | chem | Lien Thuc (keystone, 1) | swordPathComboModifier minOrbCount{orb_chem,2} -> append trigger_periodic kiem_thuong (matches liet_ngan/thau_ngan/diep_ngan; the extra trigger on diep_ngan is intentional per design); prereq thuong_tham+luu_ngan |

## 6. Architecture decisions

DEC-1 — All five orb branches are REMOVED entirely: 25 statModifier growth
nodes violate sec.16.A outright, and the 5 combo capstones (orb_<x>_capstone)
are replaced by the new scheme; for orb_bo/hat/quet no legal replacement
content may be authored (sec.18). Orb defs + ORB_UNLOCK_REALM stay — realm
progression unchanged. Orphaned nodeLevels ids in old saves are inert
(nodeLevels is Record<string,number>, shape-validated only; collectors key
off live registry entries). EarlyGameLoop recipe `orb_dam_1` -> `thich_can`.

DEC-2 — The 31 non-beta combos keep their existing ids/names/patterns/
multipliers/presetIds byte-for-byte (out of scope, unreachable in window
except via preset authoring). Only the six beta combos are renamed to the
locked ids; their presetIds follow (kiem_combo_<new id>).

DEC-3 — KiemPhoCombo gains `scalesWithAilmentStacks?` and
`ailmentInteractions?`; comboToExtraDef forwards both onto the extra def.
Derived-combo modifier copies preserve/append these fields.

DEC-4 — applyModifiers phase-sorts derived ailmentInteractions:
add_stacks=0, add_modifier/extend_duration=1, trigger_periodic=2 (stable).
Locks ordering independent of node append order.

DEC-5 — New generic NodeEffect channel `skillDefinitionModifiers:
{ skillId, damageMultiplierPerLevel?, armorPierceFractionOnDam?,
addAilmentInteractions?: SkillAilmentInteraction[], priority? }[]`.
KiemPhoNodeModifiers collects it (skill-scoped, never character-wide);
KiemPhoProvider folds derived copies at every orb def emit point
(resolveBasic/manualOptions/resolveManualPick). Combo extras are
generated action ids — never a `skillId` target — so comboToExtraDef
does not fold them. Orb-
specific predicate `armorPierceFractionOnDam` is a generic armor-pierce
field name (armorPierceFraction) — no orb ids in the seam. Generic, not
node-id-keyed (sec.15 schema principle).

DEC-6 — swordPathComboModifier: `minOrbCount` optional; new optional
`completingOrb: OrbId` (matches last pattern orb) and
`ailmentInteractions?: SkillAilmentInteraction[]` (appended to derived
combo). At least one predicate required. bonusAilmentStacks retained for
non-beta nodes? — old capstones are gone; the field stays in the type for
B/H/Q future use.

DEC-7 — SkillAilmentInteraction union gains
`{ kind:'add_stacks', buffId, stacks }`. Adapter compiles to
add_buff_stacks identity-selector op. (No gateOnApplyResult on that op
member — combos never self-apply, so no gate needed; documented
limitation.)

DEC-8 — TurnSkillDefinition gains `armorPolicy?: { bypassChance?,
pierceFractionOnFail? }`; adaptDamageOp forwards onto the authored op
(same field name on AuthoredOperation already). pierceFractionOnFail
without bypassChance = deterministic partial pierce, no RNG consumed.
SkillResolver.armorPolicyFor already prefers each.armorPierce when present.

DEC-9 — CombatVfxPreset gains `signature?: readonly VfxStroke[]` where
VfxStroke = 'point'|'line'|'converge'|'crescent'|'arc'|'scar'|'pulse'|
'ring'|'wave'. Data-only vocabulary (renderer unchanged — ActionImpactVfx
is shape-generic; signature is a descriptive contract the renderer may
consume later and tests pin now). New presets: kiem_orb_dam
(point->line->converge, silver/cool-blue), kiem_orb_chem
(crescent->arc->scar, silver + restrained dark-red). Six beta combo
presets renamed to kiem_combo_<new id> with distinct signatures;
non-beta preset ids unchanged (kiem_combo_<old id> stays, since combo
ids stay).

## 7. Numbers (balance-deferred, first-pass)

Per design sec.12: combo multipliers nhat_tuyen 3.0, hoi_tuyen 2.8,
thau_ngan 2.0 (+0.5/stack), diep_ngan 2.2, khai_ngan 1.9, liet_ngan 1.8.
Nodes: Can +8%/level maxLevel 5 (insightCost 1, upgradeCost {1,2},
levelGate techniqueRank 4 at L5 — ngu growth precedent); Nhat Diem
pierce 0.30; Thuong Tham x1.25 periodic via multiply 0.25 add? —
channel periodic_damage operation 'multiply' value 1.25 (reapply 'max'
bounded — not stackable); Quy Tuyen +0.20; Lien Thich +0.25;
Luu Ngan +1 turn. Non-beta combos keep old stub tiers.

## 8. Test plan (design sec.14, all 18)

| # | invariant | test home |
|---|---|---|
| 1 | node->skill only: zero statModifiers on kiem_pho branchTag | KiemTuNodes.test.ts (new guard) + grep |
| 2 | modifier matches intended skill not just node | KiemPhoProvider.test: thich_can buffs orb_dam def only |
| 3 | deterministic unlock | KiemPhoOrbs.test (existing, kept) |
| 4 | nhat_diem pierces only ITS hit | provider test: derived orb def has armorPolicy, combo extra does not inherit it |
| 5 | combo direct hit does not self-apply kiem_thuong | adapter/plan test on nhat_tuyen extra def |
| 6 | liet_ngan reaches cap via BuffSystem addStacks | battle-level: stacks==3 after CCC on clean target |
| 7 | khai_ngan +1 stack | battle-level |
| 8 | thau_ngan reads live same-source stacks, no consume | battle-level: stacks unchanged after hit; damage scales |
| 9 | diep_ngan triggers one periodic via canonical system | battle-level: extra dot damage event on combo turn |
| 10 | ordering phases | plan-step order on derived def + battle event order |
| 11 | progressionOwnerId inherits completing orb core level | KiemPhoProvider.test (existing shape, retained) |
| 12 | D-C-C / C-D-D produce no combo | matcher test |
| 13 | orb preset signature difference | VfxPreset test: kiem_orb_dam vs kiem_orb_chem signature tokens differ geometrically |
| 14 | no hidden HUD combo hint | INV-7 grep-guard retained + name meta guard |
| 15 | combo targets completing action's target | existing applyExtraImpact behavior; battle test asserts targetIds |
| 16 | B/H/Q out of scope but seam is generic | type-level: swordPathComboModifier predicates use OrbId union; no D/C hardcode in system/provider |
| 17 | reachability: every pattern fires, no premature | replay all 37 patterns through recordCastAndMatch asserting null until final cast then fire |
| 18 | seam generalizes to B/H/Q | data-level: predicate expressed as OrbId, not literal combo ids |

Plus updated tests: node ids orb_dam_1.. -> thich_can etc. in
GameManager.kiemTuTree / kiemTuNguWay / KiemTuPath.way / invariants /
EarlyGameLoop / QrProbe / MortalChapterJourney; combo ids in
KiemPhoProvider/invariants/GameManager.kiemPho/coreLevelChain.qa;
removed-node guards in KiemTuNodes.test.

## 9. Non-goals (design sec.18)

No player-wide StatModifiers on kiem_pho nodes; no node-id/combo-id checks
in engines; no stat mutate-restore; no catalog mutation; no combo HUD
hints; no Special/Ultimate/Kiem Tu resource; no B/H/Q content; no redesign
of the 37-pattern count, combo length gates, Hidden Sword, other trees.

## 10. Q1-Q12 evidence

- Q1 (observable behavior): D/C orb casts tail-match six combos producing
  extra declared impacts with the semantics in sec.3; nodes modify skill
  defs only (never stat pool); D-C-C/C-D-D silently no-combo.
- Q2 (one owner): combo mechanics KiemPhoSystem+KiemPhoProvider;
  buff writes BuffSystem via plan ops; node effects
  collectKiemPhoComboModifiers + skillDefinitionModifiers collector.
- Q3 (state lifecycle): cast log lives in provider battle state
  (resetForBattle); node levels in player.nodeLevels; buffs in BuffSystem
  store — no new persisted state.
- Q4 (production chain): CultivationPathRegistry.buildKiemPhoProvider
  line 373 -> provider.resolveBasic/onCastResolved ->
  TurnBattleSystem.applyExtraImpact -> planPipeline.routeExtraCast.
- Q5 (existing primitives): SkillAilmentInteraction union, identity
  selectors, gateOnApplyResult, scaleBuff, armorPolicy payload, addStacks
  clamp, triggerPeriodic canonical path — all reused; new fields are
  small extensions of those seams.
- Q6 (dependency direction): data->core only; collector+provider stay in
  core/kiem-tu; SkillAilmentInteraction lives in core/skill — no
  presentation imports.
- Q7 (timing/gameplay/presentation): VFX signature is data consumed by
  generic renderer; combos resolve in battle pipeline, VFX is playback.
- Q8 (consumer semantics): every consumer of KIEM_PHO_COMBOS /
  KIEM_TU_NODES / KIEM_PHO_ORBS enumerated in expectedFiles; simulation
  recipe node id updated.
- Q9 (queries observational): reachableKiemPhoComboIds stays read-only.
- Q10 (dup/stale/fail): resisted apply -> gateOnApplyResult no-ops
  modifier; resisted finishing Chem -> add_stacks/trigger no-op on absent
  instance (addStacks resolves no instance -> {0,0}); replay matcher
  resets per fire.
- Q11 (old path): removed 20 orb_* nodes have no live consumers besides
  tests/sim recipes (enumerated); kiem_thuong def unchanged.
- Q12 (scope proof): files map to sec.2 boundary; verify via type-check +
  scoped vitest (listed suites) + eslint changed files.

## 11. Domain modules

- C1-C7 triggered: vitals/buff/event counts exercised by battle-level
  combo tests; StatBlock untouched by nodes (C2); authored defs pass
  production adapter (C3); source context = caster for per_source
  kiem_thuong (C4); turns explicit in extend_duration (C5); no id
  branches (C6); impact contract preserved via routed extras (C7).
- S: N/A — no save schema change (nodeLevels Record tolerates orphans;
  current-schema only per S6).
- E: N/A — no economy.
- L: L1/L2 — combos progress headlessly; L3 composition root registered;
  L4 fire-once-per-log semantics already pinned.
- U: U5 comments ASCII-only; VFX data-only; no UI changes.

## 12. Deferred / open questions

- Renderer consumption of `signature` strokes: deferred (data-only for
  beta; ActionImpactVfx remains shape-generic).
- B/H/Q orb node content: deferred (post-beta decision).
- Exact combo multipliers / node magnitudes: first-pass numbers in sec.7,
  balance pass deferred per design.
- Save migration for orphaned orb_* nodeLevels: intentionally not
  written (S6/E8 — dev saves may break schema-wise).
- Bổ/Hất/Quét old combo ids preserved even though names carry the old
  vocabulary — visible-name rework for non-beta combos deferred (they are
  unreachable in window anyway).
