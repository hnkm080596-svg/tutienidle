# Phap Tu Reimagined for Turn-Based Combat — Design Spec

Date: 2026-09-14
Status: APPROVED — plan: `../plans/2026-09-15-phap-tu-reimagined-plan.md`.
Context: builds on `2026-09-14-stat-system-reimagined-design.md`
(D1–D21) and the ATB turn engine. Replaces the realtime-era Phap Tu
architecture (5 parallel element branches, per-element The resources,
unwired Element Loadout / chain engine / adjacency, orphan reaction
kit) with a single-authority path model: 1 element + respecable route,
one The pool burned by the ultimate, and a hidden Phap Tu An path
unlocked by mortal-skill mastery.

## 1. Decisions locked with the user (brainstorm 2026-09-14)

| # | Decision |
|---|---|
| P1 | **One element, permanent.** The 5 element root nodes become mutually exclusive (`excludesNode`). Today a player can buy multiple element roots; the new model locks exactly one. |
| P2 | **Two visible routes: `dot` and `no`.** Route is a *stance on the shared 3-skill kit* — not a separate kit, not per-element. Route mechanics live in ONE owning module (`PhapTuRoutes`), applied at effective-skill resolution — never re-authored per skill or scattered across node modifiers (A2). |
| P3 | **Route is freely switchable out of combat, but route-tagged node investment refunds only 75%.** Switching route auto-resets the previous route's `routeTag` nodes and refunds 75% of their actual paid insight (uses the `devResetBranch`-family refund accounting — actual paid, not nominal). Shared (untagged) nodes are untouched. The 25% sink is the cost of respec. |
| P4 | **Resources: MP = shield only + one The pool.** No skill costs MP (unchanged). `maxMp`/`manaRegenPerTurn`/`manaShieldPercent`/`reactionEffectPercent` stay `domain: 'phap_tu'` gated stats per the stat spec. One shared The pool 0–100 — per-element The (Hoa/Kim/Tho The, Huyet Pha) is RETIRED (already dead in the turn engine: `grantsHoaThePerCast` & co. sit in `UNSUPPORTED_SKILL_FIELDS`). |
| P5 | **The loop: basic/special landed hits build The; the ultimate burns it.** The ultimate slot keeps ONE skill: below the The threshold (or without the phap-tuong unlock node) it casts its normal (chain-E) form; at ≥100 The WITH the node owned the cast becomes the phap-tuong (amped) form and consumes the pool. No separate burner button — "vẫn một skill/slot, nhưng khi đủ 100 thế/pháp tướng thì amp lên". |
| P6 | **Phap Tu An = a separate, mutually-exclusive, permanent path.** Choosing An means no element, no route, no The pool. Kit is fixed: basic = random element basic; special = fires basic X times; ultimate = passive multicast (Ogre-Magi style). Its payoff is the reaction engine. |
| P7 | **An is a separate PATH offered at the Initiation Ritual, not a node/conversion inside the phap_tu tree.** `CultivationPathId` gains `'phap_tu_an'`. The ritual's path-choice layer offers it iff `linh_bao` is already Lv3 (>= `MORTAL_SKILL_L3_CASTS` casts) at that moment — the same live read Kiem Tu does for `tramCasts` in `chooseCultivationPath` (GameManagerRealmAdvanceOps). Miss it and `phap_tu_an` is unreachable for that character — nothing later re-opens the offer. Contrast: Kiem An is a ROUTE inside `kiem_tu`; Phap An is a first-class path id — intentional asymmetry (Kiem An may migrate to the same shape when The Tu lands). |
| P8 | **No conversion exists, so no refund question exists.** Because An is chosen at the ritual, a `phap_tu` player can never become An post-ritual — the inert-element/no-refund machinery is deleted, not answered. |
| P9 | **Reactions redesigned rule-driven on sinh/khac, replacing the 10 authored pairs.** The 5 elements produce exactly 10 unordered pairs = 5 sinh + 5 khac (adjacent vs non-adjacent in the cycle — no remainder). Two rule classes on top of the existing `WuxingRelations` (`SINH_CYCLE`/`KHAC_PAIRS`): khac pair coexisting on a target → **Khac Che** (consume both ailments → burst scaling with consumed stacks × `reactionEffectPercent`); sinh pair → **Cong Minh** (no consume — feeds the generated/"child" ailment: potency/duration amp or short zone buff). Bespoke pair effects (LavaZone, Thieu Huyet maxHP burn, khai_son…) are retired; a per-pair override is only added back when a pair earns one (A8). |
| P10 | **Elemental ailments still apply in BOTH routes; `no` weakens them.** Identity stays elemental — route `no` reduces application chance, never strips ailments (they feed DoT fallback and keep element flavor). |
| P11 | **The gate is the ritual, full stop.** Eligibility is not stored — `player.cultivationPath === 'phap_tu_an'` IS the record, set by the same permanent path write as every other path. Post-ritual `linh_bao` casts never re-open the offer (mortal skills stay in the list and remain castable; their casts just stop mattering). |
| P12 | **Design targets the post-stat-reimagine codebase.** Stat names used below are the NEW ones (`might`, `manaRegenPerTurn`, gated `phap_tu` domain, per-turn cadence). Implementation waits for/merges with the `stat-system-reimagined` worktree state. |
| P13 | **The consume is conditional on the unlock node.** At ≥100 The the phap-tuong form resolves only if `linh_ngo_<godUltId>` is owned; without it the ult casts the base form and The is UNTOUCHED — never partially consumed, no player-trap. `THE_ULT_THRESHOLD` is a constant 100, not `MAX_THE`; banking past it is a deliberate stockpile enabled by cap-raising nodes (consume always takes ALL). |
| P14 | **RouteProfile = skillFactors + statModifiers.** DoT tick scaling flows through the existing `ailmentPotencyPercent` stat (A9 — one lever, one owner), never a parallel route tick. `no` additionally gains `critTheGain` — crits feed The, making the burst loop self-accelerating (the route's second hook). |
| P15 | **Multicast is basic-slot-only.** `ngo_dao_hon_don` never procs on `da_phap_lien_tuyen`'s fires — the special is exactly X casts; per-cast `MAX_MULTICAST` bounds chains. An's special can therefore never exceed X fires per action. |
| P16 | **No save migration.** The project is in development — pre-release saves are not carried (user ruling 2026-09-14). |

## 2. Path state model — one authority

```text
PhapTuState {                    // phap_tu (hien) path state only —
                                 // 'phap_tu_an' is a separate
                                 // CultivationPathId with its own
                                 // tree/state, designed later (§5.3)
  element: ElementType | null    // null until element pick
  route:   'dot' | 'no' | null   // stance; null until picked at the
                                 // element-root purchase — there is
                                 // no default (user ruling)
}
```

- `element` is set by the element root node purchase; the 5 roots gain
  pairwise `excludesNode` (they currently have none — multi-element
  builds die here, P1). Element pick and route pick are ONE ATOMIC
  CORE TRANSACTION: `selectPhapTuElement(player, element, route)`
  validates both halves and commits them together — the UI's blocking
  modal is only an input collector, never the guarantee. The state
  `element != null && route === null` is not creatable through the
  API (a crash mid-modal simply means the transaction never
  committed — INV-13). Neutral ×1.0 exists only for the
  `route===null` pre-pick state (INV-11).
- `route` flips freely out of combat (P3) — a UI toggle, not a node.
- Ownership: `PhapTuState` lives on `PlayerData` (persisted), mutated
  only through `GameManager` path ops (A3 — one writer). It is
  `phap_tu`-path state only — `phap_tu_an` holders never read it
  (they own no element, route, or The — §5).
- `currentThe` is NOT part of `PhapTuState`. It lives where it already
  lives — on the battle-runtime `CombatEntity` (optional field, `?? 0`
  reads) — a BATTLE-SCOPED resource (§3.2), never persisted, never on
  `PlayerData`, never in a save snapshot.
- Tree visibility is owned by the path-selection layer, not this spec
  — this spec assumes the phap_tu tree is visible to any player who
  holds that path, and invisible to everyone else. `phap_tu_an` gets
  its own tree module with its own spec (§5.3).

## 3. The visible kit (hien) — skills, The, ultimate

### 3.1 Three slots, shared kit

`CHAIN_SKILL_IDS[element] = [basic, special, ultimate]` — unchanged
data, unchanged slots. Route modifies HOW the kit resolves (§4); it
never changes which skills exist.

### 3.2 The pool

- `currentThe` 0–`MAX_THE` (base 100 — existing constant; `Truong The`
  nodes may raise the cap above 100 for a bigger banked burn — §7).
- Gain: basic landed hit +5, special landed hit +15, `no`-route crit
  bonus (§4; tunable constants `THE_GAIN_BASIC`/`THE_GAIN_SPECIAL`/
  `THE_GAIN_CRIT`; the old +10/+20 link/finisher constants retire with
  the chain model). No decay WITHIN a battle — the pool is a spend
  gauge, not upkeep. Gains land per LANDED cast — AoE/multi-target
  casts still grant once per cast, not per target.
- **Battle-scoped, full stop:** `currentThe` resets to 0 at every
  battle start (construction of the player's `CombatEntity`). One rule
  covers every boundary — battle end, retreat, death, and save/load
  all inherit it: the field never leaves the battle runtime and is
  never persisted, so a save can never carry banked The. The old
  "persists across kills in a farm session" behavior is retired
  deliberately — it let a player farm The on trash and open a boss
  fight with a free Phap Tuong (INV-14).
- `phap_tu_an` holders never accrue it (their kit has no `theGain*`
  fields and no The surface — P6).
- Turn hook: gains land through the existing turn resource pipeline;
  `applyTurnStartDeltas` handles any future turn-start adjustments.

### 3.3 Ultimate — one slot, two forms

The `ultimate` chain slot holds the chain-E skill (`hoa_ha_cuu_thien`,
`kim_luan_tran_ap`, …). At cast time:

```text
currentThe >= THE_ULT_THRESHOLD AND phap-tuong node owned:
    consume ALL currentThe → resolve as the phap-tuong form
otherwise:
    resolve as the normal chain-E form — The UNCHANGED
    (stays banked; excess gain wasted at cap; never a partial consume)
```

- `THE_ULT_THRESHOLD` is a CONSTANT (100), not `MAX_THE` — a player
  whose cap is raised to 150 may cast at 100+ and burns ALL current
  The; banking past the threshold is the stockpile the cap-raise
  exists for (P13).
- The **phap-tuong form re-uses the god-ult data**
  (`PHAP_TU_ULTIMATE_IDS`: `tat_phuong_giang_the`, `kim_phat_thu_sat`…)
  — a DISTINCT id list from the chain-E ults (`hoa_ha_cuu_thien`,
  `kim_luan_tran_ap`…), one per element, already authored and
  save-referenced. Route picks the amped *behavior* (§4): `dot` →
  detonate flavor; `no` → raw nuke scaled by The burned.
- The unlock node (`linh_ngo_<godUltId>`) gates the phap-tuong form —
  re-authored in the §7 tree shape (the `buildThuanBranch` machinery
  dies, THIS node concept survives — §8). Without it the ult casts the
  base form even at 100+ The, and The is NOT consumed (P13 — sitting
  at cap only wastes further gains).
- **Cast identity stays with the slot, not the payload** (INV-18):
  cooldown, cast count, and mastery/telemetry all record under the
  EQUIPPED chain-E skill id. The phap-tuong form is a resolution
  variant — a payload swap at cast resolution — never its own skill
  cast; god-ult ids never appear in `skillCastCounts` and their
  cooldowns are never read (the swap consumes the slot's cooldown
  once). Presentation gets the swap as data (different resolved
  payload), not a special render path.

## 4. Route mechanics — one module

`core/phap-tu/PhapTuRoutes.ts` owns `PHAP_TU_ROUTES`:

```ts
interface RouteProfile {
  // skill-level factors — applied at effective-skill resolution
  directMultiplier: number        // scales 'damage' effect multipliers
  ailmentChanceFactor: number     // multiplies authored ailmentChance
  ailmentStackBonus: number       // extra stacks on successful application
  empoweredUlt: 'detonate' | 'nuke'  // phap-tuong behavior selector

  // stat-level modifiers — emitted as universal StatModifiers while
  // the route is active (normal pipeline; DoT ticks already scale off
  // `ailmentPotencyPercent` — the route feeds the ONE existing stat,
  // never a parallel tick lever — A9)
  statModifiers: StatModifier[]

  // named route mechanics beyond stat lines
  critTheGain?: number            // The granted per direct-hit crit
}
PHAP_TU_ROUTES: {
  dot: { directMultiplier 0.85, ailmentChanceFactor 1.25,
         ailmentStackBonus +1,
         statModifiers { ailmentPotencyPercent +30%,
                         ailmentDurationPercent +20% },
         empoweredUlt 'detonate' }
  no:  { directMultiplier 1.15, ailmentChanceFactor 0.50,
         ailmentStackBonus 0,
         statModifiers { criticalRate +8%, criticalDamage +25% },
         critTheGain 3,
         empoweredUlt 'nuke' }
}
```

(Numbers are first-pass and explicitly tunable — like the stat spec,
this spec fixes TOPOLOGY, not final coefficients.)

- All stats emitted in `statModifiers` are EXISTING universal stats
  (`ailmentPotencyPercent`, `ailmentDurationPercent`, `criticalRate`,
  `criticalDamage` — all already in `StatBlock`); the route introduces
  no new stat keys.
- `ailmentChanceFactor` multiplies the authored `ailmentChance` at
  skill resolution; the result then flows through the application's
  EXISTING arithmetic (`+elementApplicationPercent`, `min(1, …)` clamp
  in `SkillEffectSystem`) — the route adds no second clamp.
- `critTheGain` counts DIRECT-HIT crits only — never DoT ticks, never
  reaction bursts (which are An-only anyway) — and grants **once per
  cast action**: a cast landing ≥1 direct-hit crit gains +N once, same
  per-cast rule as basic/special gains. An AoE crit on 5 targets is
  still +3, not +15 (INV-15).
- The dot/no The-generation asymmetry is INTENTIONAL: `no`'s payoff IS
  the burn (nuke scales with The spent → it self-accelerates), while
  `dot`'s payoff is the ailment engine (detonate scales with stack
  pool more than The). Flagged as a balance lever, not an oversight.
- skillFactors apply at the effective-skill resolution choke point
  (the same resolution the turn converter consumes — the converter
  needs no route awareness); statModifiers emit through the normal
  modifier pipeline as a route-tagged source. Both halves live in
  `PhapTuRoutes` — one owner, one rule (A2).
- **Detonate** (`dot` empowered ult):
  - Definition: ALWAYS resolves its direct component + the element's
    normal ailment application; then consumes every **DoT ailment** —
    ailment WITH a tick component; pure-utility ailments
    (defence-down, slow, stun…) are never consumed, the detonate is a
    scalpel not a cleanser — on each target for their remaining tick
    damage × `DETONATE_AMP` (tunable constant owned by
    `PhapTuRoutes`, flat — it does not scale with The spent; the
    burn's payoff IS the consume), and re-seeds a FIXED 1 stack of
    each ailment it consumed (same ids only — it never invents new
    ailments; the re-seed is a fixed 1 at the ailment's AUTHORED
    duration — not the consumed stack's remaining duration, so the
    detonate loop does not decay — and `ailmentStackBonus` does NOT
    apply: it is not an application event). Re-seeded potency is
    RECOMPUTED against the caster's current stats at re-seed time —
    fresh-application potency semantics minus the side effects; it
    never inherits the consumed stack's stale potency snapshot.
  - Edge cases: on a clean/immune target the consume+re-seed half is
    simply 0 — the cast is never wasted.
  - **Mono-element reality:** hien is mono-element (P1) — in
    production the only ailments detonate can ever consume are the
    caster's own element's. Its burst ceiling is one element's stack
    pool, never a multi-element fireworks read.
  - **Re-seed is reaction-silent:** re-seeded stacks are restoration,
    not application events — they never fire §6 reactions (vacuous in
    v2 since hien is mono-element, but pinned so a future
    mixed-element route cannot double-dip).
- **Nuke** (`no` empowered ult): single hit, damage × (1 + theBurned /
  100 × `NUKE_THE_COEFF`) — The is the multiplier (`NUKE_THE_COEFF`
  tunable constant owned by `PhapTuRoutes`). The multiplier is LINEAR
  in The burned by design — `Truong The` cap-raise nodes are a linear
  payoff-additive, not diminishing; balance owns the slope.

### 4.1 Route-tagged nodes and the 75% refund

`ProgressionNode` gains `routeTag?: 'dot' | 'no'` (data-level, no
engine coupling). Nodes carrying a routeTag are only purchasable while
the matching route is active and only produce effects while it stays
active (query-time filter — same "(registry, nodeLevels)" derivation
principle, never push-style). **Topology: 3 spec nodes per route per
element branch, 5 levels each** — 6 route-tagged nodes per element;
enough for a real respec sink, small enough to keep the branch
readable.

`switchRoute(newRoute)`:
1. allowed only out of combat
2. for every routeTag node of the OLD route: reset level → 0 and
   refund `floor(actualPaid × 0.75)` insight (actual paid via
   `nodeFreePurchaseRecord` — the existing honest-refund rule)
3. `currentThe` resets to 0 — banked The never crosses a route switch
   (a `dot`-banked pool can never feed a `no` nuke; INV-16).
   Defense-in-depth: The is battle-scoped anyway (§3.2), but the rule
   is pinned so no future persistence change resurrects the exploit.
4. set `route = newRoute`

Switching A→B→A pays the 25% tax in BOTH directions and requires
re-purchasing the A nodes — stated explicitly in the switch-preview
UI copy (§11).

**Topology rule (INV-19):** a shared (untagged) node MUST NOT list a
route-tagged node among its prerequisites — otherwise switching
routes would orphan the dependent shared node (route node resets to
0 while its dependent stays purchased = prerequisite-invalid state).
The ban is enforced by the tree-integrity test, not by runtime
cascade resets.

## 5. Phap Tu An — hidden PATH

Phap An is its own `CultivationPathId` (`'phap_tu_an'`), a third path
card at the Initiation Ritual — not a node, not a conversion, not a
mode of `phap_tu`. It carries no element pick, no route, no The pool;
its kit and future node tree are wholly its own.

### 5.1 The offer gate

Mortal-stage skills (P7):

```text
linh_bao (Linh Bao) — NEW mortal skill, spirit bolt.
  type active, maxLevel 3, cast-count auto-level identical to 'tram'
  (Lv2 @1000, Lv3 @10000 totalExperience; insight-upgrade barred).
  damageType 'primordial' — pre-elemental spirit power, fits the
  pre-path fantasy. ('primordial' is an EXISTING damage type — the
  converter already maps it to `kind: 'primordial'` and
  `primordialPower` is an existing stat; nothing new is introduced.)
huy_quyen (Huy Quyen) — NEW mortal skill, blood fist.
  Same level rule. physical damage — precursor to The Tu (future).
```

The offer is evaluated live at the ritual, twice, from the same read:

- **Display:** the path-choice layer lists `phap_tu_an` only when
  `(player.skillCastCounts?.['linh_bao'] ?? 0) >= MORTAL_SKILL_L3_CASTS`
  — a sealed/hidden path card that simply never renders otherwise.
- **Authority:** `chooseCultivationPath('phap_tu_an', player)` re-checks
  the same predicate and rejects otherwise — presentation may hide,
  the core always enforces.

No eligibility flag is persisted: `player.cultivationPath ===
'phap_tu_an'` IS the record (the same contract as `kiemTuRoute` — the
outcome write itself is the authority, nothing to desync). Post-ritual
`linh_bao` casts cannot reopen the choice because the choice no longer
exists — `chooseCultivationPath` already rejects once
`player.cultivationPath` is set.

### 5.2 Scope and exclusivity

- Cultivation paths are already mutually exclusive — a Kiem Tu (or
  Kiem An) who grinds `linh_bao` to Lv3 gains nothing; the offer only
  exists inside their own ritual and is gone forever after it.
- The path card names the kit and carries an explicit permanent
  warning — the choice is informed, not blind (P8: there is no refund
  concept because there is no conversion).
- An has no element, no route, no The — hien's element mutex,
  `routeTag` gating, The bar, and `phapTu` state are simply not its
  mechanics. MP shield still applies (path-level, not element-level).

### 5.3 An kit — three fixed slots

| Slot | Skill | Resolution |
|---|---|---|
| basic | `van_phap_tuy_tam` | composite-pick: resolves as a uniform-random pick among the 5 element basics (existing `compositePicks` machinery — generalize `poolType` from `'reaction_path'` to an element-pool). Each cast lands a random element → mixed ailments accumulate naturally. |
| special | `da_phap_lien_tuyen` | fires the basic X times in one action (X=3 baseline), each fire independently re-rolled — multi-element barrage. Uses the follow-up/repeat resolution path, not a damage multiplier. |
| ultimate — "dao passive" | `ngo_dao_hon_don` | always-on passive occupying the ult slot — HUD renders it as a passive emblem, NOT a button (An intentionally has no active ult moment; its agency lives in the multicast storm — user ruling). Every BASIC-slot cast rolls `multicastChance` (25% baseline) to re-execute +1 extra cast; re-casts roll again, hard-capped at `MAX_MULTICAST=3`. The special's X fires are NOT basic casts and never proc it (P15) — `da_phap_lien_tuyen` is exactly X fires, no storm. |

- **An's node tree is its own module, designed later and deeper**
  (user ruling — "một cây kĩ năng riêng được thiết kế sau sâu hơn").
  This rework ships the path + kit only; `PhapTuAnNodes.ts` lands as a
  stub now and gets its own spec. The tree's expected growth axes are
  recorded so the kit does not paint the future spec into a corner:
  multicast chance, extra special count, `reactionEffectPercent`, and
  `attunement` growth — the omni-element scalar feeding every element
  power the random basic resolves AND MP via the gate (attunement is
  an existing attribute; its base value is owned by the stat system,
  and node-granted amounts are balance-pass concerns). **One scalar
  doing both jobs is intentional** (user ruling): An is the
  concentrated path — no split investment. Escape hatch: the An tree
  may still gain dedicated `manaShieldPercent`/`maxMp` nodes later if
  the balance pass needs defense tuned independently. An owns no
  per-element `*Power` line.
- Each `van_phap_tuy_tam` pick resolves AS the chosen element basic —
  damage type, element tag, and ailment all come from the picked
  skill's authored definition, evaluated against the caster's CURRENT
  stats. An's element powers are whatever attunement/gear derive them
  to be (normally symmetric); element-branch `*Power` nodes are
  hien-only investment An can never buy.
- Repeat fires (special) and multicast re-casts (passive) record casts
  under the COMPOSITE skill id only — the picked element-basic ids
  never gain cast counts. They are borrowed definitions, not owned
  skills; element-basic cast metrics cannot be polluted by An play.
- An carries **no The pool**, **no route**, **no element** —
  `phapTu` state belongs to `phap_tu` only and is never read for An.
  MP shield still applies (it is path-level, not element-level).
- All 5 element skills stay learned-but-dormant data for the pool —
  An never "owns" them; the composite pick resolves their definitions.

## 6. Reactions — sinh/khac rule engine

Replaces the 10 authored `ElementReaction` pairs with two rule classes
driven by a NEW `WuxingRelations` primitive (`SINH_CYCLE`,
`KHAC_OVERCOMES`, `relationOf`, `khacOvercomer` — created by the plan;
the existing `ELEMENT_REACTIONS` table's `relation` metadata confirms
the 5-sinh/5-khac split but the standalone primitive does not exist
yet):

```text
On a target holding ailments of 2 distinct elements:
  pair is khac  → KHAC CHE: consume both ailments; burst =
      (stacks(newcomer) + stacks(incumbent))   // consumedStacks =
                                             // TOTAL stacks the pair
                                             // consumed — pinned formula
      × sourcePower × KHAC_CHE_COEFF
      × (1 + reactionEffectPercent);
      damage element = the KHAC element — the one doing the
      overcoming (per KHAC_PAIRS, deterministic); the burst
      element is a PAIR property, not a cast property: casting
      Hoa into a target holding Kim bursts as Hoa, and casting
      Kim into that same Hoa ALSO bursts as Hoa
  pair is sinh  → CONG MINH: no consume; the generated ("child")
      ailment gains +potency/+duration for its remaining life.
      v1 LOCKED (user ruling): potency+duration amp ONLY — no
      zone buff, no self-buff; anything richer is a future spec,
      not a tuning knob.
```

- `sourcePower` = the caster's effective power of the KHAC element —
  for An this derives from `attunement` (one scalar feeding all five),
  so An's burst scales with its single growth axis. `KHAC_CHE_COEFF`
  is a tunable constant; f is LINEAR in consumed stacks by design —
  any sublinear/piecewise shape is a balance-pass decision, not an
  implementation detail.
- The burst is real elemental damage: the target's resistance to the
  KHAC element applies normally — mono-resist enemies blunt An's
  reactions (a strategic texture, not a bug).
- **Participation ≠ initiation:** a pair forms from elements
  COEXISTING on the target regardless of who applied them — an
  enemy's own Hoa can be the incumbent An's Kim reacts against (An is
  a combo-amplifier, not just a self-combo engine). But only a
  PLAYER-ORIGINATED eligible application event may INITIATE reaction
  resolution — enemy ailments participate as incumbents, enemies never
  trigger (INV-8, D21).

- Every unordered distinct-element pair is exactly one of the two —
  total coverage of the old 10 pairs by 2 rules (A8: no per-pair
  `if reactionId ===` in the engine; pair-specific flavor, if ever
  wanted, is a data-level override keyed on the pair, not a branch).
- **3+ ailments on one target — two-phase order (INV-17):** reactions
  resolve per NEWLY-APPLIED ailment,
  in TWO PHASES: first every CONG MINH (sinh) pair in canonical
  `ElementType` index order, then every KHAC CHE (khac) pair in the
  same order. Ordering is gameplay-visible (a khac that consumed the
  newcomer would silently cancel its sinh benefits), so the rule is a
  DESIGN decision, not an accident of enum order: generation resolves
  before destruction — a newcomer always gets to generate before it
  can be consumed; destruction is the finisher. Each pair resolves its
  own rule; a khac resolution consumes BOTH ailments, so any later
  pair naming a consumed ailment is skipped. One newcomer may
  therefore trigger several reactions (one per incumbent, ≤4 distinct
  elements) but never more than one khac consume involving itself.
- **No per-action reaction cap is added in v2.** The structural bound
  above (≤ #incumbents per newcomer, each pair once per application
  event) already limits An's worst case — e.g. a 3-cast multicast
  burst can at most fire a handful of reactions, and khac consumes
  shrink the incumbent set. The balance pass owns the payload ceiling;
  this is the flagged PEAK-PAYLOAD adversarial test case (§10 #7 + the
  multicast storm are the stress vectors). If a cap is later wanted it
  lives in `TurnReactionManager` (a per-action counter), never in
  `PhapTuRoutes` — one owner even for future work.
- Reactions stay `phap_tu`-domain-gated (`reactionEffectPercent` —
  stat spec D19, covering both `phap_tu` and `phap_tu_an` holders) and
  remain PLAYER-EXCLUSIVE (D21): only An's mixed-element barrage
  creates coexisting multi-element ailments. Hien players are
  mono-element → reactions literally cannot fire for them. This
  exclusivity is DELIBERATE, not inherited: hien = mono-element
  mastery, An = omni-element chaos — the split IS the identity. Should
  a future mixed-element hien route ever exist, the domain gate
  already permits it.
- `TurnReactionManager` keeps the detection/timing role; the pair
  resolution table is what changes.

## 7. Node tree — new shape

```text
phap_tu root (path start)
├── element roots ×5 (MUTEX — P1): hoa_linh_ngo / moc/thuy/kim/tho
│   └── per-element branch:
│       ├── power growth (elementPower, ~10 lv)
│       ├── ailment-leaning growth (potency/duration/chance)   } both exist;
│       ├── damage-leaning growth (mult/crit/skillDamage)      } route decides which pay off
│       ├── special unlock node (realm-gated)
│       ├── phap-tuong unlock node (linh_ngo_<godUltId>)
│       ├── The nodes: Tu The (gain rate — shared)
│       └── route-tagged spec nodes — 3 per route (dot×3 + no×3, 5 lv each);
│           the Truong The line (raise MAX_THE above 100 — banks a
│           bigger burn) is part of the `no` tag set, not shared:
│           cap-growth is a linear nuke multiplier (§4 nuke), which is
│           `no`-route payoff — intentional asymmetry, Detonate stays
│           non-The-scaling (user ruling)
```

`phap_tu_an` has NO presence in this tree — it is a separate
CultivationPathId with its own node module (`PhapTuAnNodes.ts`,
deferred spec — §5.3).

Both unlock nodes are authored via one generic
`buildUnlockNode(kind: 'special'|'godUlt', element)` builder — the
`thuan_*` variant machinery dies entirely, no node type is reused.
The threshold itself stays a constant (P13) — no node moves it;
`Truong The` raises the CAP, which is a different lever.

Removed from the tree: `keystoneReaction`/`keystonePure` XOR pair,
`lap_dao_thuan_*`, the B/D-position chain unlock nodes (the old
5-position chain is already condensed to 3 slots — only the special
and god-ult unlock nodes survive, re-authored), `reaction_path_unlock_*`,
Thế Mãn nodes (The is spent, not a sustained state).

## 8. Kill list — retired machinery

| Item | Fate |
|---|---|
| Per-element The (Hoa/Kim/Tho The, Huyet Pha) + `SkillRuntimeStats` The fields (`hoaTheGainPerCast`, `kimThe*`, `huyetPha*`, `thoThe*`, `thuyThe*`, `poisonRoot*`, `earthAoe*`…) | retired — the fields already sit in `UNSUPPORTED_*_FIELDS`; remove from converter lists + runtime stats |
| Element Loadout (`ElementLoadout`, `canEquipElement`, slot table) | retired — hien is mono-element, An is all-elements-by-random |
| Chain POSITION machinery (`ChainStateSystem`, link/finisher gain rules, `setChainDefinition`) | retired — the per-element `[basic, special, ultimate]` table stays as slot data but is RENAMED `PHAP_TU_KIT_IDS` (chain concept dead, name must not imply otherwise); only the link-position logic dies |
| `phap_tu_reaction_special`/`_ultimate` + `reaction_empowerment` buff + `compositePicks.poolType 'reaction_path'` | replaced by the An kit + `phap_tu` domain `reactionEffectPercent` |
| `AdjacencySystem` stub / Da Phap adjacency | superseded by An |
| `skillImpactPercent` (no consumer) | retired with the tree rework |
| 10 authored reaction pairs | replaced by §6 rules |
| `thuan_*` node builders (`buildThuanBranch`, `THUAN_VARIANTS`) | replaced by §7 tree — the god-ult unlock node CONCEPT survives, re-authored in the new branch shape |
| Đại Ngũ Hành Chân Quyết `attackRange` combat modifier | already retired by stat spec D16 |

Kept: `CHAIN_SKILL_IDS` 3-skill chains, `PHAP_TU_ULTIMATE_IDS` (as
phap-tuong forms), ailment buff data, realm passives (retune numbers),
Ngũ Hành Quyết techniques (MP stats via `phap_tu` gate), and the
specific `reaction_*` buffs the new rules still reference — EXCLUDING
`reaction_empowerment`, which is retired above.

**Dead-id hygiene (no migration, but live references must die with the
data):** `reaction_empowerment` is currently referenced outside the
reaction kit — `BossBuffs.ts` re-uses the player-kit buff id on a boss
(pre-existing coupling defect) and `Companions.ts` names it in a
comment. The kill list's retirement must migrate/remove those
references; fresh saves must never contain retired ids via default
loadouts, unlock lists, or `skillCastCounts` seeds.

## 9. Save/migration surface

- `PlayerData.phapTu` gains `{ element, route }` — `phap_tu`-path
  state only. `CultivationPathId` gains `'phap_tu_an'`; the persisted
  `player.cultivationPath` write IS the An record — no separate
  eligibility/mode field exists (§5.1). An's own path state, if its
  future tree needs any, is owned by that tree's spec.
- **No save migration is designed** — the project is in development
  and pre-release saves are not carried (P16 — user ruling
  2026-09-14). Mechanism: a load-time save-version check REJECTS
  pre-rework saves with a clear error — never a silent wipe, never a
  partial load (fail-safe, not half-load).
- `skillCastCounts`/`skillLevels` already persist `totalExperience`
  mirrors — `linh_bao`/`huy_quyen` ride the same channel. The mirror
  feeds the ritual-time evaluation (§5.1).

## 10. Invariants (tests/QA)

1. **Element mutex:** a player can never hold two element roots
   (purchase-time exclusion + a state invariant check).
2. **Route single-owner:** effective-skill resolution applies exactly
   one `RouteProfile`, sourced only from `PhapTuRoutes` — no node,
   skill, or buff may re-implement route semantics. Route-tagged nodes
   carry their OWN effects (not route semantics); they are merely
   active only while their tag matches — this invariant forbids
   re-authoring route behavior, not route-conditional node content.
3. **75% refund:** switching route refunds exactly `floor(actualPaid×
   0.75)` on old-route `routeTag` nodes; shared nodes and their levels
   are untouched; free-purchase records stay honest.
4. **The loop:** only landed basic(+5)/special(+15)/crit(+3, `no`
   route) casts add The; the ult consumes ALL The — including any
   excess above the 100 threshold banked via a raised `MAX_THE` — and
   resolves the phap-tuong form ONLY when `currentThe >= 100` AND the
   unlock node is owned; otherwise it casts the base form and The is
   untouched. Consume is all-or-nothing, exactly once per cast.
5. **An gate:** `chooseCultivationPath('phap_tu_an', …)` returns false
   unless `linh_bao` is already Lv3 at ritual time; the path card is
   hidden otherwise; post-ritual `linh_bao` casts never reopen the
   offer (no path can be chosen twice); `phap_tu_an` holders carry no
   element, no route, no The — `phapTu` state is not theirs.
6. **An basic uniformity:** `van_phap_tuy_tam` picks uniformly among
   the 5 element basics — no weighting, no repetition exclusion
   (special's X fires re-roll independently).
7. **Multicast bounds:** `ngo_dao_hon_don` rolls only on BASIC-slot
   casts (never on `da_phap_lien_tuyen`'s fires), may re-proc on its
   own re-casts, hard-capped at MAX_MULTICAST — never unbounded, and
   the special never exceeds X fires per action.
8. **Reaction exclusivity:** reactions require ≥2 distinct elements'
   ailments on one target — unreachable without an An player's barrage
   (hien is mono-element by construction; enemies can HOLD mixed
   ailments An applies but never ORIGINATE reactions — D21).
9. **Mortal skills:** `linh_bao`/`huy_quyen` level ONLY by cast count
   (`upgradeSkill` rejects them like `tram`); the `linh_bao` Lv3 read
   at ritual time is the sole An gate.
10. **MP shield unchanged:** `manaShieldPercent` still routes post-ward
    damage to MP in both hien and an (path-level, not element-level).
11. **Neutral route:** `PhapTuRoutes` produces a neutral profile
    (×1.0 everywhere) whenever `route===null` or the player is not a
    `phap_tu` holder — route state is never absent, only inert.
12. **No dead ids in fresh saves:** no retired skill/buff/node id
    appears in fresh-save-loadable content — default loadouts, unlock
    lists, `skillCastCounts` seeds, enemy/ally buff data (the
    `reaction_empowerment` BossBuffs/Companions references die with
    the kill list).
13. **Atomic element+route:** `element != null` implies
    `route != null` — always and only via `selectPhapTuElement` (one
    transaction); no code path can create a picked-element/null-route
    state.
14. **The is battle-scoped:** `currentThe` is 0 at every battle start;
    it is never persisted and never survives a battle boundary —
    farming trash to open a boss with a free Phap Tuong is impossible
    by construction.
15. **Crit The is per-cast:** `critTheGain` grants at most once per
    cast action regardless of target/hit count.
16. **Route switch clears The:** `switchRoute` sets `currentThe` to 0 —
    banked The never crosses routes.
17. **Two-phase reaction order:** for one application event, all sinh
    pairs resolve before all khac pairs, each in canonical
    `ElementType` index order — ordering is a design rule, not enum
    accident.
18. **Ultimate identity:** cooldown, cast count, and telemetry record
    under the equipped chain-E skill id; the phap-tuong form is a
    resolution variant — god-ult ids never appear in
    `skillCastCounts`.
19. **No shared→route dependency:** no shared node lists a
    route-tagged node in its prerequisites (tree-integrity test
    enforces — a violated tree fails validation, not runtime).
20. **RNG authority:** every An-kit randomness — composite pick,
    multicast roll, and any ailment roll the new code performs — goes
    through the turn engine's injectable RNG (never `Math.random()`
    inside kit resolution), so combat stays deterministic under a
    seeded test.

## 11. Residual notes / open details

- Route coefficient table (§4) is topology-fixed, numbers-tunable —
  balance pass owns final values; implementers do not invent new axes.
- `Cong Minh` v1 is potency+duration amp only (user ruling — a zone or
  self-buff is a different mechanic with different owner/state/VFX,
  not a coefficient; anything richer needs its own spec).
- The `dot` route's bonuses COMPOUND (chance×stacks×potency×duration,
  then detonate spends the remainder) — `directMultiplier 0.85` alone
  is probably not the full tradeoff. Balance methodology is pinned:
  measure damage-per-action over 5/10/20-turn windows, never judge on
  a single cast.
- The hidden path must be DISCOVERABLE, not a wiki trap: no locked
  card tease, but at least one in-game hint exists (NPC/lore/tutorial
  line of the form "one who pushes Linh Bao to its limit before the
  Initiation Ritual may see a road others cannot") — hidden, not
  unadvertised-forever.
- `CHAIN_SKILL_IDS` is renamed `PHAP_TU_KIT_IDS` in the kill-list
  pass — the data stays `[basic, special, ultimate]` per element but
  the chain CONCEPT is dead; keeping "CHAIN" in the name invites
  future agents to design around a retired system.
- `huy_quyen` ships data + cast-leveling now but unlocks nothing until
  the The Tu path exists — it is deliberately pre-seeded (P7) and must
  not gate anything yet.
- Water loses `thuyThePercent` (its 0.75 mitigation cap) with the
  per-element The retirement — Thuy's defense identity must be carried
  by its ailment (`te_cong`) and route kit instead; flagged so the
  BALANCE PASS does not silently drop the only defensive element lever
  (owner: balance pass — user ruling, no replacement spec'd here).
- `passive_nguyen_anh_minh_triet` (the empty Nguyen Anh realm passive,
  `passiveModifiers: []`) gets authored content during this rework —
  it is no longer parked.
- Mortal skill loadout economy: Pham Nhan has limited loadout slots —
  grinding 3 precursor skills to Lv3 is intentionally a long-haul
  preparation, matching "hidden path" weight.
- Naming: `dot`/`no` route ids, `van_phap_tuy_tam`, `da_phap_lien_
  tuyen`, `ngo_dao_hon_don`, `phap_tu_an`, `linh_bao`, `huy_quyen` —
  Vietnamese labels live in i18n per P16. Keep "An" the CONCEPT (the
  hidden-path suffix — Kiem An / Phap An / The An) distinct from
  `phap_tu_an` the CultivationPathId, which means Phap An specifically
  in this doc; player-facing strings must not blur the two. `linh_bao`'s
  label is settled as "Linh Bạo" — it lands on the Pham Nhan
  tutorial surface, the most-read strings in the game, so it is
  pinned here rather than left to UI authoring.
- UI debt acknowledged: The bar (including its behavior under a
  Truong-The-raised cap — fill vs threshold marker), phap-tuong state
  indicator, route PICK at element-root purchase + route toggle (with
  a switch-preview showing refund math — "you regain X, lose Y
  insight"), the sealed `phap_tu_an` path card in the Initiation
  Ritual (renders only when eligible, names the kit, carries the
  permanent warning), An HUD (dao passive as emblem, no dead ult
  button; the emblem's tooltip must explain basic-slot-only
  multicast), and the `linh_bao` Lv3 progress surface all need
  presentation work in the implementation plan (P14 will verify
  visually).
