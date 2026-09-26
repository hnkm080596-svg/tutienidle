# Phap Tu Reimagine — Spec / Audit / Plan

Worker slice of `game/docs/design/phap-tu-reimagine-design.txt` (PHAP TU REIMAGINE
DESIGN AUTHORITY, committed on the base branch). Scope: the beta window
(Luyen Khi -> Truc Co). Ultimate, Phap Tuong and Kim Dan+ content are out of
scope (design sec.101-102). The design doc supersedes the shipped beta where
they conflict — the audit below classifies every surface.

## G0 task card

```text
Task / user request: rework shipped Phap Tu beta to the reimagine design
Assigned worktree/branch: .agent-worktrees/phap-tu-reimagine / phap-tu-reimagine
Requested observable behavior:
  - The is live at LQ: landed Basic primary = +1 The, cap 5, battle-scoped,
    persists across waves, resets on new battle; never from rider/secondary/
    tick/special/passive/proc/reaction.
  - Phap The: at currentThe >= 5 the element Basic resolves its empowered
    variant (checked before cast, no consume, no decay, persists while >= 5):
    Hoa = +1 manual pulse of a pre-existing own-source hoa_an; Thuy = weaker
    secondary hit on one other enemy (no The, no chain); Moc = own-source
    doc_can application +1 stack; Kim = skill-local penetration on that hit;
    Tho = small shockwave on the other enemies (no The, no Trong The, not
    recursive).
  - Special at TC: self-buff Phap Trang, costs % MaxLinhLuc up front (full
    cost or no cast), recast pays full cost and refreshes duration, never
    stacks; no The gate.
  - Linh Luc Ho The (TC): DR = cap x CurrentLL/MaxLL on hostile direct
    damage, consumes no extra LL, LL=0 -> DR=0; unlocked with the Special.
  - MaxLL offensive scaling only via per-payload authoredConversion.
  - Retire: mid-combo chain kit (C/D/E + god-ults), dot/no routes + all
    route machinery, legacy The (+5/+15/cap100/empower@100/consumesAllThe),
    manaShieldPercent path-level grant, route UI/respec refund.
  - Save: persist element/learnedBasic/learnedSpecial/nodeLevels; route
    field dropped; CURRENT_SAVE_VERSION bump (no-migration convention N-v41:
    old saves rejected).
Single responsibility: the spell_pathway (phap tu) kit is {element Basic,
  element Special}; all five riders/specials share generic engine channels.
Current owner: chain kit in data/skill/PhapTuChainSkills.ts, route
  machinery in core/phap-tu/PhapTuRoutes.ts, legacy The economy in
  CultivationPathRegistry.applySpellPathEssenceGains + TBS grantTheFromCast.
Target owner: same owners, new content — SkillDefinition plan pipeline
  (AuthoredOperation) + empowerment variant swap in TBS declare.
Existing primitives to reuse: empowerment swap (TBS L1795-1858, threshold
  check before cast, no consume), emitGrants landed-gate, onLanded
  consequence lane, ailmentInteractions/trigger_buff_periodic,
  scalesWithAilmentStacks read_stacks+late-binding pattern, thanh_tuyen
  buff (+manaRegenPerTurn), holder_turns lifetimes, push_gauge,
  stacks_at_least conditions, consume_buff_stacks, resetBattleScopedResources,
  resourceType+resourceCost cost precheck (SkillExecutor PRECHECK blocked=stop).
Missing capability (new generic primitives, all in skilldef/combat layers):
  - SkillTargetIntent 'other_enemy' / 'other_enemies' (scoped to the landed
    hit's target — legal only inside onLanded).
  - onLanded validation relaxation: allow 'if' (bounded nesting, leaf
    payloads) and 'deal_damage' (secondary intents only).
  - deal_damage 'elementalPenetrationBonus' scalar — payload field legal on
    'skill_hit' profile, threaded resolveHitOptions -> resolveActionHit ->
    calculateSkillBaseDamage (per-element additive penetration).
  - DealDamageOp 'penetrationFromStacks' (read_stacks -> late-bound
    elementalPenetrationBonus; mirrors scaleBuff's coefficient pattern).
  - Authored cost {resourceType, percentOfMax} -> plan.cost resolved via
    statScalars.maxMp at resolve (full-cost precheck unchanged).
  - BuffDefinition.boundToSourceBuffId — marker dies in runPhaseB when the
    source no longer holds the named buff (window-bound marker lifecycle).
  - Capability grant 'periodic_growth' {definitionId, stacks, consume,
    applyAfter} consumed by BuffSystem.emitLifecycleUnit (Sinh Co payoff:
    +1 stack on the next own-source tick, marker consumed, one-shot flag).
  - Capability grant 'on_apply_potency' {definitionId, op, value} consumed
    by BuffSystem.apply (Tam Muoi: own new hoa_an applications get +potency
    while the buff is held — no op-ordering coupling).
  - Stat 'linhLucHoTheCap' + DR application in CombatSystem.resolveAttack
    (pre-ward split, hostile direct damage only).
  - TurnSkillDefinition 'resourceCostPercentOfMax' +
    'landedConsequences' (AuthoredSkillOperation[] spliced FIRST inside the
    primary hit's landed gate — before adapter-emitted ailment ops).
  - SkillCondition 'stacks_below' (negated-at-most form; avoids empty
    else-branches for once-per-window gates).
Production chain: TBS declare -> TurnSkillPlanRuntime.routeCast ->
  LegacySkillAdapter -> SkillResolver -> SkillExecutor -> CombatScheduler
  -> CombatSystemDamageAdapter -> CombatSystem.resolveActionHit.
State: currentThe entity field (reset: resetBattleScopedResources; persist:
  never); Phap Trang/marker buffs (buff2 store, battle-scoped by nature);
  spellPath {element} persisted.
Non-goals: Ultimate slot, Phap Tuong, god-ults, Kim Dan+ content, AI
  emblem channel changes, hidden_spell_pathway (Ngo Dao An kit untouched),
  body/sword ways, save migration code (no-migration convention).
Roadmap phase: phap-tu beta rework per reimagine design authority.
Stop condition: all invariants pinned, P3 quick green, OCR pass, P4 QA,
  >=3 sequential P5 passes clean.
```

## 1. Audit classification

Classification per dispatch taxonomy: CURRENT+ALIGNS / CONFLICTS /
LEGACY-SUPERSEDED / REUSABLE / MISSING.

### 1.1 The economy

| Surface | Class | Disposition |
|---|---|---|
| `MAX_THE=100` (CombatTypes) | LEGACY-SUPERSEDED | spell_pathway cap becomes 5 via resolveMaxThe; keep constant for other pool users (hidden_body kit declares own caps) |
| `resolveMaxThe` + `theCapPerLevel` node effect | LEGACY-SUPERSEDED | pathway -> flat 5; remove truong_the aggregation + `theCapPerLevel` effect field |
| `theGainOnLandedCast` field + TBS `grantTheFromCast` + adapter grants | REUSABLE | keep mechanism; authored value becomes 1 on element basics only |
| `theGainOnCrit`, `SPELL_ESSENCE_GAIN_CRIT=3`, `tu_the_<el>` nodes, `aggregateTurnSkillResourceModifiers`, `turnSkillResourceModifiers` effect | LEGACY-SUPERSEDED | delete — design: only landed Basic primary grants The |
| `SPELL_ESSENCE_GAIN_BASIC=5` / `SPECIAL=15` | CONFLICTS | replaced by flat +1 on basic; specials/ults grant 0 (field absent) |
| `consumesAllThe` + `theBurned` + `theScaling` (phap-tu consumers only) | LEGACY-SUPERSEDED | retire with empowered ults; keep machinery ONLY if another path still authors it (census: PhapTuEmpoweredUlts is the sole content producer; machinery itself is generic and stays, unused) |
| `empowerment{theThreshold, empowered}` + TBS declare swap | REUSABLE | becomes the Phap The channel: threshold 5, attached to element basic at build, no consumesAllThe on variants |
| `SPELL_EMPOWERMENT_ESSENCE_THRESHOLD=100` | LEGACY-SUPERSEDED | replaced by PHAP_THE threshold = pathway cap (5) |
| `the_man_<element>` permanent buffs (ThuanHeBuffs) | DEAD | The-man sync was retired M13 and never ported; delete the five defs |
| `the_thuc_tinh` realm-reward node (+1 gain, +10 cap/level) | CONFLICTS | delete node + the grantedNodeLevels entry that awards it (gain is now baseline; cap is fixed) |
| `resetBattleScopedResources` (currentThe=0 on build/restart) + wave persistence | CURRENT+ALIGNS | unchanged — already correct semantics |
| `theBarBridge` (threshold 100, empowered flag) | CONFLICTS | reader max/threshold -> 5; PHAP THE indicator = element basic has empowerment && currentThe >= 5 |

### 1.2 Kit + skills

| Surface | Class | Disposition |
|---|---|---|
| `SPELL_KIT_IDS` [basic, special, ultimate] triples | CONFLICTS | becomes [basic, special] pairs; index-2 chain-E ults retired |
| Chain B/C/D/E defs + god-ults (PhapTuChainSkills.ts) | LEGACY-SUPERSEDED | file rewritten: keep element basic ids (N5 display names unchanged: Hoa Cau Thuat etc. — they become THE basic); C/D/E and ult payloads deleted; new specials authored |
| PhapTuRouteSkills.ts (4 fire dot-route skills) | LEGACY-SUPERSEDED | delete file + SPELL_ROUTE_SKILL_IDS + Skills.ts registration |
| PhapTuEmpoweredUlts.ts + PHAP_TU_ULTIMATE_IDS + `applySpellPathEmpowerment` | LEGACY-SUPERSEDED | delete; empowerment attaches at build to basics now |
| `SPELL_BASICS`/linh_bao starter basic | CURRENT+ALIGNS | pre-element starter stays; gets the +1 The gain like any spell basic; no empowerment rider (no element) |
| `resolveSpecialUltimate` (emblem-first) | REUSABLE | special resolves learned specialId; ultimate slot resolves undefined (nothing authored) |
| `collectUnsupportedSkillSemantics` gate | REUSABLE | unchanged |
| `manaScalingRatio` on payloads | REUSABLE | IS the authoredConversion channel (sec.29-30); remains authored per-payload |
| TurnSkillDefinition damage/ailment/appliesBuffs/`ailmentInteractions` | REUSABLE | all stay generic |

### 1.3 Routes

| Surface | Class | Disposition |
|---|---|---|
| `SpellPathRoute`/`route` field on SpellPathState | LEGACY-SUPERSEDED | SpellPathState -> { element: ElementType \| null }; commit function drops route arg; validator drops atomic pair rule |
| PhapTuRoutes.ts (RouteProfile, SPELL_PATH_ROUTES, applyRouteToEffectiveSkill, applyRouteToTurnSkill, getRouteStatModifiers, resolveRouteProfile, ailmentStackBonus/applicationFactor routing) | LEGACY-SUPERSEDED | delete file; `resolveMaxThe` moves/keeps as pathway->5 in PhapTuPath.ts |
| `routeTag` on ProgressionNode, `isNodeRouteActive`, switchRoute/previewRouteSwitch, ROUTE_SWITCH_REFUND_RATE (75%), 'phap_tu_route' BuildStatChannel, `routeProfileProvider` dep | LEGACY-SUPERSEDED | delete end-to-end |
| Route UI: NodeInspector route-pick modal, NodeTreePanel route switcher/preview, useProgressionActions.switchSpellPathRoute, route i18n keys | LEGACY-SUPERSEDED | delete; element pick commits element-only |
| `selectSpellPathElement(element, route)` | CONFLICTS | signature -> (element) |
| `GameManagerRealmAdvanceOps` / realmRewards spellPath refs | LEGACY-SUPERSEDED for route part | breakthrough grant no longer awards the_thuc_tinh |

### 1.4 Tree (PhapTuNodes.builders.ts + PhapTuBasicNodes.ts + PhapTuRealmRewardNodes.ts)

Rule (sec.73-75): nodes may only modify SKILL-OWNED mechanics (basic rider /
Phap Trang / skill conversion / ailment). Banned: generic character stats
(might/def/hp), route nodes, combo nodes. Audit of beta nodes under this rule:

| Node family | Class | Disposition |
|---|---|---|
| Element roots `*_linh_ngo` (unlock basic) | CURRENT+ALIGNS | unchanged |
| `linh_ngo_<special>` @ golden_core granting [special, ult] | CONFLICTS | realm gate -> 'foundation_establishment'; grants [specialId] + `linhLucHoTheCap` statModifier (the Ho The unlock); drop ult grant; linh_ngo_<godUlt> node removed (Ultimate out of scope) |
| `tu_the_<el>` / `truong_the_<el>` / routeTag nodes (3 dot + 3 no) | LEGACY-SUPERSEDED | delete |
| `the_thuc_tinh` rewardOnly node | CONFLICTS | delete |
| ailment nodes (`ailmentPotencyPercent`, `ailmentDurationPercent`, `elementApplicationPercent`) | ALIGNS | ailment = skill-owned per rule — keep |
| `skillDamagePercent`, `criticalRate`, `criticalDamage`, `finalDamagePercent`, `<el>Power` growth nodes | CONFLICTS | generic stat channels banned — REWORK to skill-owned channels |
| capstones `selectsSpecialization` (tu_* point / tan_* AoE variants) | ALIGNS | modifies the basic itself = skill-owned — keep; ensure variant defs still legal under new ops |
| Basic-node power ring otherwise | REWORK | see Plan slice 5 for the replacement modifier set |

Replacement for banned stat nodes (skill-owned, per design): keep ailment
family; convert damage-leaning nodes onto per-skillId channels — extend
`TurnSkillResourceModifier`-style channel into a generic
`spellSkillModifiers`?? DECISION: reuse `turnSkillResourceModifiers` pattern —
add `skillCombatModifiers` on NodeEffect: { skillId, coefficientBonus?,
manaScalingRatioBonus?, riderPenetrationBonus?, riderCoefficientBonus? }
consumed at battle build inside resolveAuthoredBasic/resolveSpecialUltimate
on the element's own skill ids (skill-owned by construction — applies to the
element basic/special only). Banned stats removed; counts shrunk to keep the
tree honest. (Exact per-node set in implementation; every kept node maps to
rider/ailment/conversion/cost/duration channels.)

### 1.5 Stats / save / misc

| Surface | Class | Disposition |
|---|---|---|
| `manaShieldPercent` modifier `phap_tu_ho_the` (0.25 path-level leak) | LEGACY-SUPERSEDED | remove; manaShieldPercent mechanic itself stays for legacy consumers — check census |
| `linhLucHoTheCap` stat | MISSING | new StatType + StatMetadata clamp [0..~0.75]; domain 'spell' |
| `resolveAttack` DR slot | MISSING | DR = cap x currentMp/maxMp applied to finalDamage before ward split; no MP drain |
| `CURRENT_SAVE_VERSION` 84 | CONFLICTS | bump -> 85 (no-migration convention) |
| `validateSpellPathPersistedState` element+route atomic pair | CONFLICTS | validate element only |
| Auto-cast `selectAction` | REUSABLE | verify special participates (affordability check via hasResourceFor — percent cost must precheck correctly; no hidden HP rules) |
| `manaRegenPerTurn` tick (ResourceTurnHook) | REUSABLE | Thanh Tuyen rides it |

## 2. Spec decisions (binding for this slice)

D1. Empowerment IS Phap The. `empowerment{theThreshold:5}` attaches to the
converted element basic at battle build (`resolveAuthoredBasic`,
spell_pathway + element committed). TBS declare swap = the design's
"checked BEFORE cast": below 5 -> base def; >=5 -> empowered variant;
nothing consumed, nothing decays; dropping below 5 mid-window impossible
in beta (no spender exists) but the engine semantics are still correct —
the threshold is re-checked every declare.

D2. Thế income = `theGainOnLandedCast: 1` on spell-path basics (element
basic AND the pre-element starter — the rule "Basic primary landed = +1"
doesn't key on element). Empowered variants carry the same field (the
empowered cast is the basic's cast). Specials carry no theGain fields.
`emitGrants` fires on any landed damage op -> every rider damage/consequence
op lives INSIDE the primary hit's landed gate, so a rider landing when the
primary missed can never mint Thế. Secondary hits (Thuy/Tho) never carry
their own grants.

D3. Hoa pulse semantics: "pre-existing" = the instance existed before this
cast's applications. Implemented by ORDER: the variant's landed lane runs
`trigger_buff_periodic{selector: identity(hoa_an, source=self,
target=loop_target)}` BEFORE the apply_buff op (adapter emits
landedConsequences first inside the landed gate). Max 1 pulse: one authored
op = one `periodic_requests_committed` emission on the resolved instance.
No consume, no duration loss: trigger buff periodicity does neither.

D4. Thuy secondary: `if target_hit_landed(primary)` -> `deal_damage
(target: 'other_enemy', element: water, coefficient 0.5x authored, canMiss,
canCrit normal)` inside onLanded; it MAY apply the element ailment via its
own onLanded apply_buff (design says "co the apply"). "other_enemy" =
first living enemy (enemiesOf order) != loop target; empty -> op resolves
to zero targets = no-op (no chain, max 1).

D5. Tho shockwave: `deal_damage(target: 'other_enemies', element: earth,
coefficient ~0.4x)` inside the same landed gate. No Tho ailment authored
on the shockwave op; no Trong The application (that channel gates on the
primary hit's lane only — shockwave hits carry no marker ops). Non-
recursive: the shockwave op has no onLanded damage children.

D6. Moc: empowered variant's doc_can apply_buff authored with stacks +1
over the base (single ops list; the base def's ailment application is
cloned with stacks bumped by the variant builder).

D7. Kim: empowered variant's deal_damage carries flat
`elementalPenetrationBonus` (authored points on the Resistance scale;
initial authored value 25). "Skill-local" by construction — the field lives
on that payload only.

D8. Specials (Trang buffs): TurnSkillDefinition, targetScope 'self', no
damage, `resourceType 'mana'` + new `resourceCostPercentOfMax` (authored
percent, initial uniform 0.30 -> TBD flag), appliesBuffs -> self buff def
(lifetime holder_turns N=3 same family all five, onReapplyStacks 'keep' +
onReapplyDuration 'refresh' => recast never stacks, refreshes). Cost
ordering falls out of the executor: plan.cost precheck (full cost or
blocked, no cooldown) -> consume_resource op settles first -> apply_buff
settles after. Recast pays full cost again (design sec.43 — NOTE: the
dispatch summary said "full refund + refresh"; the doc's full-cost-again
reading wins; flagged in openQuestions).

D9. Linh Luc Ho The: stat `linhLucHoTheCap` (domain 'spell', authored 0.25
initial — balance TBD) on the linh_ngo_<special> node. DR implemented in
CombatSystem.resolveAttack before the external-ward/ward/manaShield split:
`hpDamage-family incoming = finalDamage x (1 - cap x currentMp/maxMp)`.
Reads the DEFENDER's stats at hit time (live CurrentLL -> live DR; LL=0
-> DR=0; consumes nothing). Scope: this code path is hostile direct
damage (skill_hit/attacks); Special self-cost/DoT/env paths never enter
resolveAttack.

D10. Window-bound markers: BuffDefinition.boundToSourceBuffId — in
BuffSystem.runPhaseB, an instance whose source no longer holds the named
definition dies (killed like expiry). kim_liet / sinh_co / sinh_co_chu /
trong_the / trong_the_da_bi all bind to their Trang buff.

D11. Marker mechanics:
- kim_liet ('marker', maxStacks 3, add/keep): the KIM basic (normal AND
  empowered) carries read_stacks -> late-bound elementalPenetrationBonus
  (stacks x authored perStack) + onLanded `if stacks_at_least(self, kim_y)
  -> apply kim_liet +1 on loop_target` (reads before hit, adds after
  landing, dies with window). Base pierce = 0 when the window is off —
  self-gating.
- trong_the ('marker', maxStacks authored T, e.g. 3) + trong_the_da_bi
  ('marker', maxStacks 1): the THO basic's onLanded —
  `if stacks_at_least(self, trong_nhac)` ->
    `if stacks_below(loop, trong_the_da_bi, 1) -> apply trong_the +1`;
    `if stacks_at_least(loop, trong_the, T) -> [consume_buff_stacks all,
      push_gauge(loop, -delayFraction), apply trong_the_da_bi]`.
  Once-per-target-per-window via the used marker (which also blocks
  further stack adds). Delay = negative gauge push (ActionGauge authority).
- sinh_co ('marker', maxStacks 1) on the target + sinh_co_chu ('marker',
  self-side once-flag): the MOC basic's onLanded — `if
  stacks_at_least(self, van_moc) AND stacks_below(self, sinh_co_chu, 1)` ->
  [apply sinh_co on loop, apply sinh_co_chu on self]. Conjunction via
  nested if (one level). Payoff: sinh_co carries capability grant
  'periodic_growth' {definitionId: doc_can, stacks: 1, consume: true,
  applyAfter: 'sinh_co_done'?} — SIMPLER: no used-marker on target needed;
  the source-side sinh_co_chu already makes the plant once-per-window, so
  payoff = consume the marker (+1 stack). BuffSystem.emitLifecycleUnit:
  before computing a periodic unit, scan the HOLDER's instances for a
  'periodic_growth' grant matching the unit's definitionId AND whose
  grant-instance sourceId == the ticking instance's sourceId; on match:
  tickingInstance.stacks += n (clamped maxStacks), remove the marker
  instance, continue ticking with grown stacks.
- van_moc window buff + tam_muoi window buff + kim_y + trong_nhac +
  thanh_tuyen: holder_turns=3 (same family), keep/refresh.

D12. Tam Muoi Chan Hoa: capability grant 'on_apply_potency' on the
tam_muoi buff — BuffSystem.apply consults the SOURCE's active grants; when
the applied instance's definitionId matches, attach a BuffModifierPayload
{channel 'potency', op multiply, value, lifetime buff_lifetime} to the new
instance at apply time. Only NEW applications get it (existing instances
never touched); no second bonus pulse (that would be a rider — banned).

D13. Thanh Tuyen Duong Linh: applies existing 'thanh_tuyen' buff (+8 flat
/+10% manaRegenPerTurn, domain 'spell') — ResourceTurnHook ticks it next
valid turn; no instant refund; no on-basic +MP.

D14. Element intent intents: `other_enemy` / `other_enemies` resolve via
entityQuery.enemiesOf minus scope.loopTargetId; legal ONLY inside
onLanded scope (resolver/validation rejects elsewhere — they have no
anchor at top level).

D15. Rider gate shape: all Phap The riders authored inside
`deal_damage.onLanded` of the primary op (the existing per-landed-hit
gate — misses/dodges skip the whole lane). Window mechanics (kim_liet/
trong_the/sinh_co) also sit in landed lanes (they are hit consequences),
gated internally by their `if` conditions — so they fire on both normal
and empowered variants (both defs carry them; variant builder preserves
them by cloning).

D16. Save: SpellPathState { element: ElementType | null }.
commitSpellPathElement(element). validateSpellPathPersistedState drops
route. CURRENT_SAVE_VERSION 84 -> 85. No migration code (N-v41: old saves
rejected). learnedBasic/learnedSpecial: verify existing persistence — the
SkillManager learned set is already persisted; spellPath keeps only
element. (Check: dispatch asked to persist learnedBasic/learnedSpecial —
that is the skillManager.skills map, already saved.)

D17. UI (sec.86-92):
- theBarBridge: reader returns {current, max:5, threshold:5,
  phapTheActive: current>=5 && basic empowerment present} gated on
  'spell.essence_pool' capability; dots render filled/current; "PHAP THE"
  indicator from the active flag.
- NodeInspector: route pick deleted — element root click calls
  selectSpellPathElement(element) directly.
- NodeTreePanel: route button group + preview removed.
- Special slot preview: technique tooltip gains the Trang line (cost %
  MaxLL + duration + one-line effect) — author on the Skill def via
  existing tooltip channel; the "he qua thu" consequence text is authored
  in the def description (i18n keys).
- Auto-combat: no hidden HP safety rules — selectAction unchanged; the
  percent-cost flows through hasResourceFor on the LIVE plan path
  (precheck handles); verify auto picks special when it is the only
  ready/affordable slot — see openQuestions if special needs an
  auto-cast toggle.

## 3. Implementation plan (slices)

Slice A — retirement (task 2): delete route machinery end-to-end
(PhapTuRoutes, routeTag/isNodeRouteActive/switchRoute/previewRouteSwitch/
refund, 'phap_tu_route' channel, routeProfileProvider dep, route UI,
route i18n), legacy Thế (+5/+15, theGainOnCrit, tu_the/truong_the/
the_thuc_tinh nodes, aggregateTurnSkillResourceModifiers + field,
SPELL_ESSENCE_GAIN_*, empowerment@100/consumesAllThe/theScaling/detonate
content, applySpellPathEmpowerment), chain C/D/E + god-ult skills +
PhapTuRouteSkills + PhapTuEmpoweredUlts + PHAP_TU_ULTIMATE_IDS,
manaShieldPercent leak, SPELL_KIT_IDS -> pairs, linh_ngo_<godUlt> node,
save shape + version bump. Fix all consumers/test files.
Verification: type-check + existing suite adjusted.

Slice B — engine primitives (task 3 + 4 foundations): intents
other_enemy/other_enemies; onLanded 'if' + secondary deal_damage
relaxation; elementalPenetrationBonus chain (op -> payload -> adapter ->
HitResolveOptions -> calculateSkillBaseDamage); penetrationFromStacks
(scalesWithAilmentStacks sibling); cost percentOfMax; stacks_below
condition; boundToSourceBuffId; 'periodic_growth' + 'on_apply_potency'
capabilities; linhLucHoTheCap stat + resolveAttack DR.

Slice C — content (tasks 3 + 4): element basics get
theGainOnLandedCast:1 + window mechanics + empowerment variants via
buildPhapTheVariant(element, baseDef) at resolveAuthoredBasic; 5 new
special defs; new buff defs (trang windows + markers); SpellPathState
{element}; selectSpellPathElement signature.

Slice D — tree rework (task 5) + UI (task 6): node audit rework per
1.4 (remove banned stat nodes; add skill-owned channel nodes via the new
per-skillId combat-modifier channel IF introduced — else keep ailment/
capstone/unlock only); linh_ngo_<special> to foundation_establishment +
linhLucHoTheCap grant; theBarBridge + NodeInspector/NodeTreePanel route
removal + PHAP THE indicator + special preview text.

Slice E — pins (task 7) then gates (8) + commit/push (9).

## 3a. Concrete file/symbol map

### New files

- `src/data/skill/PhapTuSkills.ts` (replaces PhapTuChainSkills.ts as the
  kit file): 5 element basics (reuse existing B-tier ids/names — N5),
  5 specials (tam_muoi_chan_hoa / thanh_tuyen_duong_linh /
  van_moc_sinh_co / kim_y_ngung_phong / trong_nhac), no ults, no chain
  tiers C/D/E.
- `src/data/buff/PhapTuTrangBuffs.ts`: trang windows (tam_muoi, van_moc,
  kim_y, trong_nhac — thanh_tuyen already exists in ThuanHeBuffs) +
  markers (sinh_co, sinh_co_chu, kim_liet, trong_the, trong_the_da_bi).
- `src/core/battle/turn/TurnBattleSystem.phapThe.test.ts` (or a
  dedicated spec file under an existing test convention) — the
  invariant pins in section 4.
- `src/data/progression/PhapTuNodes.builders.test.ts` adjustments live
  in existing files (PhapTuNodes.reimagined.test.ts etc.).

### Deleted files

- `src/data/skill/PhapTuRouteSkills.ts` + `PhapTuRouteSkills.test.ts`
- `src/data/skill/PhapTuEmpoweredUlts.ts`
- `src/data/skill/PhapTuUltimates.ts` (PHAP_TU_ULTIMATE_IDS)
- `src/core/phap-tu/PhapTuRoutes.ts` + `PhapTuRoutes.test.ts`
- `src/core/progression/NodeSystem.route.test.ts` (route-member tests)
- `src/core/battle/turn/TurnBattleSystem.detonate.test.ts` (detonate
  content retired) — check whether it pins the generic mechanism only;
  if the op survives (generic), rewrite the test on a synthetic def.
- `src/core/battle/turn/TurnBattleSystem.empowerment.test.ts` /
  `GameManager.empowerment.test.ts` — rewrite to pin Phap The semantics
  (threshold 5, no consume).
- `src/core/battle/turn/TurnBattleSystem.theResource.test.ts` — rewrite
  to pin the new +1 economy.

### Modified files (by slice)

Engine primitives (slice B):
- `src/core/skilldef/AuthoredOperation.ts`: SkillTargetIntent +=
  'other_enemy'|'other_enemies'; SkillCondition += {kind:'stacks_below',
  target, definitionId, max}; deal_damage += elementalPenetration?:
  ScalarExpression + penetrationFromStacks?: {definitionId, perStack};
  ActiveSkillDefinition cost += {percentOfMax} variant (SkillDefinition.ts).
- `src/core/skilldef/SkillDefinitionRegistry.ts`: onLanded validation —
  allow 'if' (bounded nesting) and 'deal_damage' whose target is a
  secondary intent; validate new condition/op fields; percentOfMax cost
  legality.
- `src/core/skilldef/SkillResolver.ts`: resolveIntentSet new intents
  (enemiesOf minus scope.loopTargetId; other_enemy = first living of
  that set); 'stacks_below' condition compile; elementalPenetration fold
  -> payload field + late binding; penetrationFromStacks -> read_stacks +
  late-bound penetration (mirrors scaleBuff L1036-1055); cost percentOfMax
  resolved via statScalars['maxMp'] (capture added in collectStatScalars).
- `src/core/skilldef/SkillExecutor.ts`: unchanged if plan.cost.amount
  stays a concrete number post-resolve (confirm during implementation;
  PRECHECK unchanged).
- `src/core/battle/contracts/operations.ts`: DealDamageOperation payload
  += elementalPenetrationBonus legal on 'skill_hit' profile (extends the
  existing legacy_dot-only field).
- `src/core/battle/runtime/scheduler/CombatScheduler.ts`: periodicBridge
  validation — keep legacy_dot-only there; add the skill_hit legality on
  the operation validator side (or wherever the profile check lives).
- `src/core/battle/runtime/scheduler/adapters/CombatSystemDamageAdapter.ts`:
  map payload.elementalPenetrationBonus -> HitResolveOptions.
- `src/core/combat/CombatSystem.ts`: HitResolveOptions +=
  elementalPenetrationBonus; resolveActionHit passes it into
  calculateSkillBaseDamage; resolveAttack applies Ho The DR before the
  external-ward split.
- `src/core/combat/ElementDamageCalculator.ts`: calculateSkillBaseDamage/
  component calc += optional penetration override (additive).
- `src/core/stats/StatTypes.ts` + `StatMetadata.ts` + `StatLabels.ts`:
  'linhLucHoTheCap' stat, clamp [0,1], label.
- `src/core/buff2/BuffDefinition.ts`: boundToSourceBuffId?: BuffDefinitionId;
  CapabilityGrantDefinition union += 'periodic_growth' {definitionId,
  stacks, consume} + 'on_apply_potency' {definitionId, channel, op, value};
  capability validator registration wherever grants are validated.
- `src/core/buff2/BuffSystem.ts`: runPhaseB boundToSourceBuffId sweep;
  emitLifecycleUnit periodic_growth hook; apply() on_apply_potency hook.
- `src/core/battle/turn/TurnSkillAction.ts`: TurnSkillDefinition +=
  resourceCostPercentOfMax?: number; landedConsequences?:
  AuthoredSkillOperation[] (spliced first inside the primary hit's
  onLanded lane); penetrationFromStacks + elementalPenetrationBonus fields
  if authored on legacy defs (decide: keep these on the authored layer
  only — the variant builder emits authored ops, so the legacy def may
  only need landedConsequences + costPercent). theGainOnCrit/empowerment
  fields: empowerment STAYS (now used by basics); theGainOnCrit removed
  if no other content uses it (census says phap-tu only — remove field +
  grant branch in emitGrants/TBS grantTheFromCast; keep consumesAllThe/
  theScaling generic machinery dormant or remove if zero producers).
- `src/core/skilldef/LegacySkillAdapter.ts`: map resourceCostPercentOfMax
  -> authored cost percentOfMax; splice landedConsequences first inside
  the primary hit's onLanded; drop removed field mappings.
- `src/core/battle/turn/TurnSkillPlanRuntime.ts`: no change expected
  (grants/hooks already generic); verify.

State/save (slice C):
- `src/core/phap-tu/PhapTuState.ts`: SpellPathState {element} only;
  commitSpellPathElement (rename from commitSpellPathElementRoute).
- `src/core/phap-tu/PhapTuPath.ts`: validateSpellPathPersistedState drops
  route; SPELL_PATHWAY.statModifiers removes phap_tu_ho_the
  (manaShieldPercent); realmRewards drops the_thuc_tinh; capabilities drops
  'spell.empowered_ult' (ult retired); subpaths drops route; ownedContent
  drops route/ult ids.
- `src/core/phap-tu/PhapTuRoutes.ts`: deleted (resolveMaxThe moves to
  PhapTuPath.ts, spell_pathway -> 5).
- `src/services/save/saveVersion.ts`: CURRENT_SAVE_VERSION 84 -> 85.
- `src/core/player/CultivationPathRegistry.ts`: spell_pathway runtime —
  resolveBasic attaches theGainOnLandedCast:1 + empowerment variant
  (buildPhapTheVariant) when element committed; resolveSpecialUltimate
  returns {special} only (no ult, no empowerment attach); remove
  applySpellPathEssenceGains/applySpellPathEmpowerment/
  routeProfileProvider usage; resolveMaxThe -> 5.
- `src/core/player/CultivationPathRuntime.ts`: drop routeProfileProvider
  dep member (deps interface cleanup).
- `src/core/game/GameManagerProgressionOps.ts`: selectSpellPathElement
  signature (element only); remove switchRoute/previewRouteSwitch calls
  into NodeSystem; RESPEC lists stay (node ids change).
- `src/core/game/GameManagerRealmAdvanceOps.ts`: drop the_thuc_tinh grant
  path (via PhapTuRealmRewardNodes edit).
- `src/core/progression/NodeSystem.ts` + `ProgressionNode.ts`: remove
  routeTag/isNodeRouteActive/switchRoute/previewRouteSwitch/
  ROUTE_SWITCH_REFUND_RATE/aggregateTurnSkillResourceModifiers/
  turnSkillResourceModifiers/theCapPerLevel.
- `src/core/progression/NodeBranchViews.ts`: remove route branch split if
  present.

Data (slice C/D):
- `src/data/skill/PhapTuChainSkills.ts`: rewritten -> PhapTuSkills content
  (rename file or keep name? Keep file name churn minimal: rewrite in
  place as PhapTuChainSkills.ts with new content? Cleaner: new file
  PhapTuSkills.ts + delete the chain file — check Skills.ts imports).
- `src/data/skill/Skills.ts`: SPELL_KIT_IDS -> [basic, special] pairs;
  registration of new skills; drop route/ult ids.
- `src/data/skill/TurnSkillDisplayMeta.ts`, `SkillIconManifest.ts`,
  `CombatVfxPresets.ts`, `BalanceBaselines.ts`: scrub retired ids.
- `src/data/buff/ThuanHeBuffs.ts`: remove the_man_<element> dead defs.
- `src/data/progression/PhapTuNodes.builders.ts`: rewrite branches —
  remove tu_the/truong_the/routeTag/godUlt nodes; linh_ngo_<special>
  realm -> foundation_establishment, grants [specialId] + linhLucHoTheCap
  modifier.
- `src/data/progression/PhapTuBasicNodes.ts`: keep ailment/
  application/potency/duration + capstones; remove generic-stat nodes
  (skillDamagePercent/criticalRate/criticalDamage/finalDamagePercent/
  <el>Power).
- `src/data/progression/PhapTuRealmRewardNodes.ts`: remove the_thuc_tinh.
- `src/data/progression/PhapTuNodes.ts`: registry assembly update.
- `src/core/stats/StatDomain.ts` / StatDomain.test.ts: 'phap_tu_route'
  channel removal if declared there.
- locales (`src/locales/*.json` or wherever skillPath routes keys live):
  remove route keys, add Trang/marker strings if needed (P16 - i18n via
  useI18n; Vietnamese strings live in locale files, not comments).

UI (slice D):
- `src/presentation/bridges/theBarBridge.ts` + test: threshold/max -> 5,
  empowered flag from element-basic empowerment presence + currentThe>=5.
- `src/game/scenes/combat/PlayerHudLayer.ts` / `CombatScene.ts`: PHAP THE
  indicator render (consume bridge; check consumer shape first).
- `src/components/panels/skill-path/NodeInspector.vue`: remove route-pick
  modal; element root commits element-only.
- `src/components/panels/skill-path/NodeTreePanel.vue`: remove route
  switcher/preview + NODE_ROUTE_TONE + SpellPathRoute imports.
- `src/composables/useProgressionActions.ts`: remove
  switchSpellPathRoute; selectSpellPathElement signature.
- `src/components/panels/CharacterPanel.vue` / wherever spellPath.route
  renders: drop route display.
- Special tooltip/preview surface: wherever the special slot lists the
  skill (CombatSkillPanel/SkillPathPanel) — add cost%/duration lines via
  existing tooltip channel.

Tests (rewrite/adjust):
- `src/core/player/CultivationPathContract.test.ts`,
  `CultivationPathKit.test.ts`, `GameManager.phapTuAnPath.test.ts`,
  `GameManager.cultivationPathRewards.test.ts`, `GameManager.deadIds.test.ts`,
  `PhapTuNodes.reimagined.test.ts`, `PhapTuBasicNodes.test.ts`,
  `PhapTuRealmRewardNodes.test.ts`, `NodeSystem.test.ts`,
  `NodeSystem.way.test.ts`, `NodeBranchViews.test.ts`,
  `theBarBridge.test.ts`, `NodeTreePanel.test.ts`,
  `NodeInspector.test.ts`, `SkillPathPanel.test.ts`,
  `LegacySkillAdapter.test.ts/.converter.test.ts`,
  `SkillDefinitionRegistry.test.ts`, `SkillResolver.test.ts`,
  `Skills.rhythm.test.ts`, `Skills.chain.test.ts`,
  `Skills.costInvariant.test.ts`, `LegacySkillCoverage.test.ts`,
  `StatDomain.test.ts`, `StatMetadata.test.ts`, `StatLabels` refs,
  `EnemyStatInput.test.ts`, `TurnBattleSystem.skillPlan.test.ts`,
  `TurnBattleSystem.camCong.test.ts`,
  `TurnBattleSystem.stacksPerAffectedTarget.test.ts`,
  `CombatSystem.hitOutcomes.test.ts`, `CombatSystem.manaShield.test.ts`,
  `PlayerStatAssembly.test.ts`, `SaveSystem` shape tests,
  `simulation/*` tests touching chain ids.

## 4. Invariant test list (dispatch contract -> tests)

1. The income: +1 iff a Basic primary hit lands; 0 on miss/dodge; never
   from secondary hit-only, rider-only, ailment tick, Special, passive,
   proc, reaction, companion. Multi-target/multi-hit casts still +1.
2. Cap 5; persists across wave transitions; resets on battle restart/
   repeat.
3. Phap The: variant swap iff currentThe>=5 at declare (pre-cast; a cast
   landing the 5th stack is NOT empowered); no consume/decay.
4. Hoa rider: pulses ONLY a pre-existing own-source hoa_an; exactly once
   per cast; no consume/no duration loss; no pulse when none existed.
5. Thuy rider: secondary hit on a DIFFERENT enemy; no The income from it;
   no chain beyond 1; no-op with a single enemy.
6. Moc rider: own-source doc_can application gains +1 stack (only that
   application — other sources' instances untouched).
7. Kim rider: penetration applies to that hit only (skill-local);
   unaffected hits unchanged.
8. Tho rider: shockwave hits other enemies only; no The; no trong_the
   stacks from shockwave; non-recursive (no further onLanded chains).
9. Special: cost before buff (insufficient LL -> no cast, no buff, no
   cooldown commit); exact %MaxLL charged; recast = full cost again +
   duration refresh, never stacks; no The gate.
10. Kim Liet: stacks read BEFORE the hit, added AFTER landing; cap ~3;
    wiped when kim_y ends (dispel/expiry), even mid-window timing.
11. Trong The: threshold -> delay pushes gauge exactly once per target per
    window; markers die at window end.
12. Sinh Co: first own-source doc_can application per window marks; next
    own tick gains +1 stack then marker consumed; no re-mark same window.
13. Tam Muoi: new own hoa_an applications during window get +potency;
    pre-existing instances unchanged; no extra pulse.
14. Thanh Tuyen: regen increases from next valid tick; no instant LL.
15. Ho The: DR = cap x currentMp/maxMp on hostile direct damage; no extra
    LL consumed; LL=0 -> 0 DR; unavailable before linh_ngo_<special>
    (LQ player takes unreduced damage).
16. Route machinery removed: no routeTag/route/isNodeRouteActive/
    switchRoute remains; old saves rejected by version bump.
17. Save round-trip: spellPath {element} persists; learnedBasic/
    learnedSpecial round-trip via skills map; nodeLevels intact.
18. MaxLL scaling: only per-payload authoredConversion — no generic
    %MaxLL damage channel.

## 5. Q1-Q12 evidence

- Q1 observable behavior: section above (G0) + invariant list.
- Q2 owner: SkillDefinition plan pipeline owns cast effects; TBS owns
  declare/commit/Thế grant; BuffSystem owns marker/window lifecycle +
  periodic payoff; CombatSystem owns DR; NodeSystem owns node gating.
  One owner per rule preserved.
- Q3 state lifecycle: currentThe writer=TBS grant + resetBattleScoped;
  markers live/die in BuffSystem (boundToSourceBuffId); spellPath.element
  persisted (validator + select op); learned skills via SkillManager.
- Q4 production chain: G0 card lists it; the plan lane is the live player
  path (routeCast), engine-unit lane is test-only for this content.
- Q5 reused primitives: listed per surface (empowerment, onLanded gate,
  trigger_buff_periodic, scaleBuff pattern, holder_turns, push_gauge,
  thanh_tuyen buff, cost precheck).
- Q6 dependency direction: new ops/fields added at foundations
  (AuthoredOperation/operations/BuffDefinition/StatTypes) and consumed
  upward — no domain importing presentation.
- Q7 timing/gameplay/presentation: riders are plan ops (domain commit);
  UI reads readTheBar projection only.
- Q8 consumers preserve semantics: rider ops all land inside landed gates
  (grant-integrity); percent cost flows through the same PRECHECK;
  penetration additive inside the existing mitigation read.
- Q9 queries: readTheBar/projection read-only; previewRouteSwitch deleted.
- Q10 duplicates/failures: cost precheck blocks partial casts; marker
  once-flags prevent double payoff; consume clears stacks; recast
  refreshes (no stacked copies).
- Q11 old paths: route machinery + chain kit + empowered ults deleted,
  not shadowed; empowerment machinery reused for Phap The; engine-unit
  lane keeps legacy fields (generic) but no phap-tu rider content.
- Q12 scope/stop: file map in slices; stop = pins + gates.

## 6. Domain modules (triggered)

- C1: hit/DoT/marker changes use DamageAdapter/BuffSystem authorities —
  new fields ride existing payloads (DealDamageOperation.elemental
  PenetrationBonus, BuffModifier channels, capability grants).
- C2: stats — linhLucHoTheCap registered in StatTypes/StatMetadata;
  recompute identical input twice = same DR (pure read of stats).
- C3: all authored content passes adapter->resolver->executor; new ops
  rejected by validation outside legal scope (test).
- C4: riders resolve target/source context through scope.loopTargetId +
  selectors (never captured ids).
- C5: durations — holder_turns family for Trang; boundToSourceBuffId for
  markers; document clocks in defs.
- C6: variation via authored ops + capability payloads; no wayId branches
  introduced (other_enemy/other_enemies are generic intents; riders are
  data).
- S: save bump + rejection (no migration); spellPath validator updated;
  no async changes.
- L: element commit via selectSpellPathElement (domain op); unlock via
  node realm gate (headless rule).
- U: bar/inspector/tooltip changes use existing bridges/i18n.

## 7. openQuestions (for coordinator report)

1. Dispatch paraphrase says Special recast = "full refund + refresh";
   design sec.43 says recast PAYS FULL COST AGAIN + refreshes. Implemented
   the doc. Flag for confirmation.
2. CURRENT_SAVE_VERSION head value was 84 (dispatch guessed 86) — bumped
   to 85.
3. Rider ops gated on primary LANDED (miss => no rider); design says
   "sau primary hit" — landed-only chosen for consistency with the Thế
   miss rule; confirm.
4. Uniform Special cost 30% MaxLL, Trang duration 3 holder turns,
   linhLucHoTheCap 0.25, Kim pierce 25, Thuy secondary coefficient 0.5x,
   Tho shockwave 0.4x, trong_the threshold 3, kim_liet cap 3 — all TBD-
   flagged authored numbers pending balance.
5. Banned-stat tree nodes need the replacement channel decision
   (spell-owned per-skillId modifier channel vs cut-only); plan picks the
   conservative path: keep ailment/application/potency/duration +
   capstones + unlocks, cut generic-stat nodes, and add per-skillId
   coefficient/conversion channels only where the mechanic already exists
   (authoredConversion scaling on the payload). Deferring a broad new
   channel unless a kept mechanic needs it.
6. Ultimate slot resolves undefined for spell_pathway — UI must tolerate
   the missing ult (verify CombatSkillPanel renders empty slot).
