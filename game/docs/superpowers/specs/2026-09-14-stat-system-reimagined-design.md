# Stat System Reimagined for Turn-Based Combat — Design Spec

Date: 2026-09-14
Status: APPROVED-by-user-brainstorm (chat); implemented per plan
`docs/superpowers/plans/2026-09-14-stat-system-reimagined-plan.md`.
Context: the realtime→turn-based mechanical conversion (2026-09-04 stat
conversion + turn mechanism spec 2026-09-10) renamed stats and cadences but
kept the realtime-era stat inventory. This spec re-imagines the stat system
for ATB turn-based combat with path-owned resources.

## 1. Decisions locked with the user (brainstorm 2026-09-14)

| # | Decision |
|---|---|
| D1 | Speed stays the dominant ATB tempo stat BY DESIGN. Balance lever = opportunity cost: speed sources must be scarce and never bundled with power. |
| D2 | Every action is a skill; there is no separate basic-attack scaling. `attack` (now `might`, D14) remains the universal damage base for ALL damage types (already true: `baseAttackPlusPower` — physical = ATK, elemental = ATK + elementPower, primordial = ATK + primordialPower). |
| D3 | Skill cost = per-skill cooldown + path-resource requirements (hoa the, sword intent, ...). There is no universal MP cost. |
| D4 | MP is Phap Tu's signature resource and IS the mana shield. MP stats stay `StatType` (the stat system manages them) but are only modifiable through a path-owned gate. The absorb ratio is authored by Phap Tu nodes/skills, not a universal stat. |
| D5 | Ward is the top absorb layer: absorbs damage 1:1 until depleted (capacity authored by the granting skill/buff). While ward fully absorbs a hit, the hit is NOT "taken" — no on-hit-taken effects (thorns, on-being-hit procs) fire. LoL-style shield semantics. |
| D6 | DoT bypasses all shield layers (already true — `applyDotDamage` goes straight to HP after dotRes) and never triggers thorns/on-hit-taken effects. DoT is not a "hit". |
| D7 | The 5 attributes stay (load-bearing in 3 mechanisms: derivation, ~46 attributeScaling skill declarations, point-allocation progression lever). Re-mapped to one clean axis each; speed removed from ALL attributes. |
| D8 | Periodic stats tick on the owner's own turn (already the M8 cadence). Per-second field names get renamed to per-turn. |
| D9 | `int` additionally derives `ailmentPotencyPercent` (Thần Thức = control/DoT axis). |
| D10 | Path-gated stats remain in `StatType`/`Stats`/`calculateStats` — isolation is enforced by a gate on modifier delivery, not by leaving the type system. Preserves `manaScalingRatio` (reads `stats.maxMp`) and the whole modifier pipeline. |
| D11 | `leechPercent` heals on **actual HP damage dealt** (`hpDamage`), not pre-absorb `finalDamage` — "gây thực bao nhiêu hút lại trên tỉ lệ đó". |
| D12 | `attunement` DOES feed MP — Linh Căn -> maxMp/manaRegen scaling emitted by the Phap Tu system through its gate (not via the generic attribute derivation). |
| D13 | DoT economy is fully closed: **every** damage-reduction mechanic is worthless vs DoT except `dotResistancePercent`. Ward, MP shield, block, endurance, evasion, armor, `finalDamageReductionPercent` — none apply to DoT. `finalDamageMultiplier` leaves the DoT path entirely (see §4). |
| D14 | `attack` is renamed — universal damage base, not "basic attack". New name: **`might`** (vi label: Sức mạnh). `${element}Power` names unchanged; formula becomes `might + firePower`. |
| D15 | Non-combat meta stats are **gated to their domain** (same mechanism as path stats), not evicted — consistent with D10. |
| D16 | `attackRange` retires — realtime residue. Reach is a skill property (`ActionTargeting`), not a character stat. Zero reads in `core/battle/turn/` (§3.5). |
| D17 | A percent/multiplier **of a stat** is a modifier op on that stat (`{stat, percent}`), never a separate StatType. Retires `maxMpPercent`/`manaRegenPercent`; prevents future stat-of-stat sprawl. Meta stats that multiply NON-stat quantities (affix deltas, realm passive magnitudes, production speed) still need StatTypes — they have no target stat. *Verified: `StatModifier.percent`/`multiplier`/`flat` already exist and flow through `runPipeline` (`StatCalculator.ts`).* |
| D18 | **One stat per mechanic, not per content.** A StatType must be a reusable lever on a shared mechanic; a ratio only one piece of content uses belongs in that content's authored effect. Retires `poisonRecoveryPercent` (served only the Doc Can buff — its heal becomes an authored trigger on the buff). Adds the generic lever `healingEffectivenessPercent` with a hard scope rule: **leech is not healing.** `healingEffectivenessPercent` amplifies HP-restoring effects received that are NOT damage-derived — `hpRegenPerTurn` ticks, direct heal skill effects, authored recovery triggers (Doc Can). `leechPercent` is leech's SOLE lever (output = `hpDamage x leechPercent`, full stop); healingEffectivenessPercent never modifies leech output — the two mechanics stay fully separate to prevent double-dipping and blurred identity. Never affects ward/MP absorb, mitigation, or non-HP pool regen either. |
| D19 | `reactionEffectPercent` -> **gate `phap_tu`**. Element reactions exist only inside the hidden Phap Tu path (Phap Tu an — the secret path, not openly selectable). Its real sources (PhapTuNodes, `reaction_empowerment` — a PLAYER self-buff of that path's ultimate, housed in `BossBuffs.ts` by filename only) are phap_tu emitters; the whitelist entry covers that file+stat pair. |
| D20 | `blockChance`, `blockEffectiveness`, `enduranceThreshold`, `endurancePercent` are **earmarked for a future `the_tu` domain** (block/endurance = The Tu identity) — that domain is designed later; until it exists they remain universal (no ownerless gate). *Residual: when `the_tu` lands, these migrate universal -> gated and every current universal source (affixes, buffs, nodes) must be re-authored — a separate migration spec, out of scope here.* |
| D21 | **Enemy OUTGOING damage on their own turn = hit + DoT only** — no reactions, no other initiated damage mechanics. Reactive defender-side mechanics (thorns, on-being-hit retaliation) are out of scope and unaffected. `reactionEffectPercent` leaves `EnemyStatInput` entirely (invalid enemy input, not merely ungated). Enemy Phap Tu identity afterward = MP shield + hit + DoT; mechanical depth comes from skills (MP-shield interactions, DoT patterns), not reactions — reactions are player-path-exclusive. |

## 2. Stat classification — the "gate" model

`StatType` stays one union; `Stats` stays one record; `calculateStats` stays
the single formula authority. What changes is a **domain registry** that
classifies every stat and a **delivery rule** enforced at the pipeline input.

```text
STAT_DOMAIN: StatType -> 'universal' | 'phap_tu' | 'production'
                       | 'cultivation' | 'equipment_meta' | 'artifact'
                       | 'realm' | <domain per gated stat>

StatModifier gains: domain?: string  (absent = 'universal')

Delivery rule (in calculateStats/calculateEffectiveStats):
  - universal stat + any-domain modifier     -> accepted
  - gated stat + matching-domain modifier    -> accepted
  - gated stat + wrong/absent domain         -> REJECTED LOUDLY
    (dev/test: throw; production: reject + report — never silently
    dropped or silently applied — A8)
```

Runtime gate behavior by environment: dev/test **throws** (the bug is
caught at the first failing call); production **rejects the modifier and
reports** through the diagnostics channel (console error + collected
violation record) — a missing buff is recoverable, a silently-corrupted
stat pool is not.

Isolation protects only the gated stats: a Phap Tu node buffing `might` or
`firePower` is legitimate and required (its skills scale off element power),
so universal stats accept modifiers from every domain. A universal modifier
can never move a gated stat.

`domain` is **authorial intent**: any source may author a modifier tagged
with a gated domain (e.g. a realm passive authored `domain: 'phap_tu'` still
grants `maxMp` — dead value for non-Phap Tu players but legal). Runtime only
checks domain match; **content-time validation** is what stops arbitrary
content from reaching into another domain.

### 2.1 The source->domain whitelist (load-bearing, specified)

```text
DOMAIN_SOURCE_WHITELIST: domain -> predicate entries
  'phap_tu' -> [
    { file: 'data/progression/PhapTu*.ts' },
    { file: 'data/buff/PhapTu*.ts' },
    { file: 'data/realm/RealmPassives.ts',
      stats: ['maxMp', 'manaRegenPerTurn'] },
    { file: 'data/technique/Techniques.ts',
      stats: ['maxMp', 'manaRegenPerTurn'] },
    { file: 'data/buff/BossBuffs.ts',
      stats: ['reactionEffectPercent'] },
  ]
  'production' -> [ { file: 'src/core/production/**' } ]
  ... one entry per gated domain
```

Each entry is a **predicate**, not a plain path: an optional `stats`
allow-list scopes the grant to specific stats inside a mixed file
(`RealmPassives` may grant MP stats for Phap Tu but nothing else
gated).

- Lint = an **architecture test** (same family as
  `tests/architecture/i18nKeyParity.test.ts`) scanning every authored
  `StatModifier` in `data/**`. Per modifier it checks
  `WHITELIST[modifier.domain]` — one map covers both directions:
  a modifier carrying `domain: 'cultivation'` inside `PhapTuNodes.ts`
  fails because that file is absent from the cultivation entries.
  CI/build-time, not dev-mode runtime — a violation fails the build.
- **Scope of the lint: authored data only.** System-emitted modifiers
  (PhapTuSystem, runtime-generated) cannot be file-scanned — they are
  protected by the runtime gate alone. The lint prevents *authoring*
  violations; the gate prevents *programmatic* injection.
- Adding a new gated domain or a new emitter for an existing domain =
  one whitelist line — a deliberate, explicit act, not a hidden burden.

The gate governs **modifier delivery only** — never base values. Authored
`baseStats` (enemy Phap Tu boss with `maxMp`, `manaShieldPercent` baked in)
are not modifiers and are not gated. This is an intentional, documented
hole: base values are authorial; authoring discipline is the only control
on them.

Why a delivery gate instead of separate records (rejected alternative):
keeps one pipeline, one Stats shape, one save schema, `manaScalingRatio` and
all attribute derivation working; isolation is a rule on modifiers, not a
second stat system.

## 3. Stat inventory — fate of every existing StatType

**Audit verdict (all ~62 current StatTypes reviewed):** the inventory is
not bloated by dead stats — `attackRange` is the only fully dead one.
Three more retire for classification reasons (redundant/bespoke, not
dead): `maxMpPercent`, `manaRegenPercent`, `poisonRecoveryPercent`.
The disease is *classification*: path stats, stat-of-stat multipliers and
domain knobs all sat in one flat union. Every surviving stat below now
has a declared domain or an explicit "stays universal" rationale.

- Retire (4): `attackRange` (dead), `maxMpPercent`, `manaRegenPercent`
  (redundant with modifier ops — D17), `poisonRecoveryPercent`
  (one-content bespoke ratio — D18).
- Re-classify (11): 4 phap_tu-gated (incl. `reactionEffectPercent`,
  D19) + 5 domain-gated meta + 2 renames. Earmarked: 4 block/endurance
  stats for a future `the_tu` domain (D20).
- Stays universal — verified multi-source/multi-path, NOT path stats in
  disguise: `skillDamagePercent` (equipment pool + Kiem Tu nodes + a
  Phap Tu node + enemies), the status economy stats, and niche levers
  `chanceToIgnoreResistance` + `wardBreakDamagePercent` — the latter is
  watch-listed: it survives only because shield-retaliation is a real
  mechanic axis with plausible second sources; if it stays one-source
  it folds into its granting node (D18).
- Legitimate pairs, not duplication: `blockChance`/`blockEffectiveness`,
  `enduranceThreshold`/`endurancePercent`, `accuracyRating`/`evasionRate`,
  `finalDamagePercent`/`finalDamageReductionPercent` — each pair is two
  independent build axes of one mechanic.
- Element triple (15 stats) + `primordialPower`: justified — per-element
  offense/defense/penetration is the ngu hanh identity.

### 3.1 Universal combat stats (unchanged semantics)

| Group | Stats |
|---|---|
| Vitals | `maxHp`, `hpRegenPerTurn` |
| Tempo | `speed` |
| Offense | `might` (renamed `attack`, D14), `criticalRate`, `criticalDamage`, `accuracyRating`, `skillDamagePercent`, `finalDamagePercent` |
| Defense | `defense`, `evasionRate`, `blockChance`*, `blockEffectiveness`*, `enduranceThreshold`*, `endurancePercent`*, `criticalAvoidance`, `finalDamageReductionPercent` (*earmarked `the_tu`, D20) |
| Ward | `wardMax`, `wardRegenPerTurn` (renamed from `wardRegenPerSecond`), `wardBreakDamagePercent` |
| Status economy | `ailmentResistPercent`, `ailmentPotencyPercent`, `ailmentDurationPercent`, `elementApplicationPercent`, `dotResistancePercent`, `chanceToIgnoreResistance` |
| Sustain | `leechPercent`, `thornsPercent`, `healingEffectivenessPercent` (new, D18) |
| Elements | `{wood,fire,earth,metal,water}{Power,Resistance,Penetration}` + `primordialPower` |

(The `Position` group is retired — `attackRange` leaves the stat
inventory entirely, §3.5/D16. Reach lives on skills.)

### 3.2 Path-gated stats (stay StatType, `domain: 'phap_tu'`)

| Stat | Note |
|---|---|
| `maxMp` | MP pool — Phap Tu shield pool (defensive resource, §5) |
| `manaRegenPerTurn` (renamed from `manaRegenPerSecond`) | own-turn cadence (M8 already ticks it per-turn) |
| `manaShieldPercent` | absorb ratio — authored via Phap Tu nodes through the gate; universal sources can no longer grant it |
| `reactionEffectPercent` | reaction damage amp (D19) — reactions only exist in the hidden Phap Tu path |

Phap Tu-owned sources (node/talent system, Phap Tu buffs, the path's own
scaling rules) are the intended emitters of `domain: 'phap_tu'` modifiers.
Other sources may still author phap_tu-tagged grants (authorial intent, §2 —
e.g. a realm passive's `maxMp` entry); the source->domain whitelist lint
governs who may author which domain.

### 3.3 Attributes (stay StatType; re-mapped derivations)

| Attribute | Axis | Derives into |
|---|---|---|
| `strength` (Căn Cốt) | force/body | `might`, `defense` |
| `dexterity` (Thân Pháp) | finesse | `accuracyRating`, `evasionRate`, `criticalRate` — **speed removed** |
| `intelligence` (Thần Thức) | mind/control | `criticalDamage`, `ailmentResistPercent`, `ailmentPotencyPercent` (new) |
| `attunement` (Linh Căn) | Phap Tu | 6 element powers (flat + per-tag Increased, unchanged); + MP via Phap Tu gate (D12, §5) |
| `vitality` (Thể Chất) | survival | `maxHp`, `hpRegenPerTurn`, `enduranceThreshold` |

After the re-map, **no attribute derives speed**. Speed sources become
equipment affixes, buffs, technique modifiers, realm passives and nodes only
— tempo is bought with real slots, not with free point allocation (D1).

**Speed scarcity enforcement (D1):** opportunity cost must be structural,
not aspirational. `EquipmentStatPolicy` pools place `speed` in the same
rollable pools as competing desirable stats (crit/defense/offense lines) —
taking speed means giving up a rival affix. Concrete rule for the
data-validation test: a pool containing `speed` must also contain >=2
stats from the competitive set {offense amps, crit stats, defense stats}
— i.e. speed may never be the only desirable roll in its pool.

**Attribute pairing is intended (MAD by design):** every build invests a
primary + secondary attribute pair — crit builds need dex (rate) + int
(damage), DoT builds need int (potency) + att (element), etc. No single
attribute is self-sufficient; vitality/strength remain the non-build
fallbacks.

`deriveAttributeModifiers` emits universal modifiers; attributes themselves
stay universal stats so existing content (affixes, meridians, nodes, pills)
keeps working.

### 3.4 Non-combat meta stats — gated to domain owners

| Stat | Gate domain |
|---|---|
| `speedMultiplier` -> **rename `productionSpeedMultiplier`** | `production` |
| `cultivationPercent` | `cultivation` |
| `affixDeltaPercent` | `equipment_meta` |
| `artifactGradeMultiplier` | `artifact` |
| `realmPassivePercent` | `realm` |

Rationale: same gate mechanism as path stats — the modifier stays in the
pipeline, but only the owning domain's channel can deliver it. If during
implementation a domain proves to need no modifiers at all (read-only base
value), it may instead leave `StatType`; that is an implementation detail,
not a design fork. (`speedMultiplier` is renamed because its name collided
with combat `speed` — it is the production-domain tempo knob.)

### 3.5 Retired

| Stat | Fate |
|---|---|
| `manaShieldPercent` (as universal) | absorbed into Phap Tu gate (3.2) |
| `maxMpPercent`, `manaRegenPercent` | **retired — stat-of-stat multipliers.** `StatModifier.percent` on `maxMp`/`manaRegenPerTurn` expresses the same thing through the existing pipeline (D17). Sources (Techniques.ts MP tiers, `ThuanHeBuffs.linh_tai`) re-author as `{stat, percent, domain:'phap_tu'}` modifiers. |
| `poisonRecoveryPercent` | **retired — bespoke one-content stat** (served only the Doc Can buff; D18). Doc Can's heal becomes an authored trigger on the buff itself; the heal output scales with the receiver's `healingEffectivenessPercent`. |
| `attackRange` | **retired — realtime residue.** Zero reads in `core/battle/turn/`; reach is a skill property (`ActionTargeting.shape` + radii anchored at the primary target), not a character stat. Surviving readers are dormant M13 Battle-typed helpers (ArtifactSystem/tests). `attackRangeRanks` enemy input and `PLAYER_BASE_RANGE_RANKS` normalization die with it; Đại Ngũ Hành Chân Quyết's +2 range is re-authored as a targeting modifier or dropped (implementation decision). |
| (names) `manaRegenPerSecond`, `wardRegenPerSecond` | renamed `*PerTurn` — values unchanged |

## 4. Hit semantics — three outcomes, not two

`CombatSystem.resolveActionHit`/`resolveAttack` gain an explicit outcome
level:

```text
miss      — accuracy/dodge roll fails: nothing lands
absorbed  — lands, but ward + MP shield absorb everything (hpDamage == 0)
taken     — hpDamage > 0
```

Full pipeline (complete order — armor/resistance sits inside the base
damage step; shown for self-containedness):

Damage pipeline (heals run on a separate pipeline, see below):

```text
base damage (armor/resistance mitigation per component)
-> skill multipliers
-> crit roll (criticalRate vs defender criticalAvoidance)
   -> criticalDamage multiplier
-> blockChance roll -> blockEffectiveness reduction
-> endurance% (only while defender HP above enduranceThreshold)
-> finalDamageMultiplier (attacker finalDamagePercent x
   defender finalDamageReductionPercent) -> floor(min 1)
-> ward absorb (1:1) -> MP shield absorb (% ratio, gated) -> HP
```

- `criticalRate - defender.criticalAvoidance` (subtractive, floor 0) is
  the effective crit chance — current formula, unchanged.
- `skill multipliers` = the skill's authored damage multipliers plus
  `skillDamagePercent` — same layer as today. (`might + elementPower`
  composition happens at the base-damage step upstream, not here.)
- `floor(min 1)` applies to `finalDamage` PRE-shield; `hpDamage` may
  still be 0 after full absorb (D5).

Heal pipeline (separate from the damage pipeline above):
`authored heal amount -> receiver.healingEffectivenessPercent -> HP`
(D18). Receiver-side stat; applies to hpRegen ticks, direct heal
effects, authored recovery triggers; never to leech, ward/MP regen,
shields.

Trigger semantics — both sides, explicitly:

| Trigger family | Gates on |
|---|---|
| attacker `on-hit` (landed: ailment application rolls, on-hit procs) | **landed** (absorbed OR taken) |
| attacker `on-damage-dealt` (leech, damage-proportional procs) | **taken** (`hpDamage > 0`) |
| defender `on-hit-taken` (thorns, on-being-hit procs) | **taken** (`hpDamage > 0`) |

Rules:

- **"Taken" is the only outcome that fires defender-side on-hit-taken
  effects and attacker-side damage-proportional effects.** `thornsPercent`
  and `leechPercent` read `hpDamage`, not `finalDamage`. (Current bug:
  both fire/heal on the full pre-absorb value — D11.)
- **Ailment application still rolls on a landed hit even when fully
  absorbed** — application is not damage-taken. Ward tanks hits but does
  NOT grant status immunity; DoT can still burn HP under a full ward.
  This is the intended shield/status interaction.
- `timeSinceLastHitTaken` keys on *landed* hits — being attacked still
  delays ward regen, full absorb does not grant free regen uptime. DoT
  never touches it. It already counts the holder's own turns
  (`WARD_REGEN_DELAY_TURNS`); rename to `turnsSinceLastHitLanded` for the
  new vocabulary.
- **On-hit bonus damage procs** (e.g. "on hit: +20 damage") on the SAME
  target fold into the hit's damage before shield absorb — one
  resolution, one absorb pass. Procs targeting OTHER entities resolve
  as separate hits through the full pipeline (may be absorbed, may
  break ward and fire `wardBreakDamagePercent`), and never
  recursively fire on-hit triggers — no proc chains.
- **Non-damage on-hit effects** (ailment application, self-heal, buff
  grant) are not "hits" — the proc-chain rule does not apply to them.

### 4.1 DoT path — closed economy (D13)

```text
applyDotDamage: rawDamage -> dotResistancePercent (with metal
                Kim Thế penetration) -> HP
```

Complete lever table — every stat's DoT interaction, explicitly:

| Stat | Affects DoT? |
|---|---|
| `ailmentPotencyPercent` | yes — tick damage |
| `elementApplicationPercent` | yes — application chance only |
| `ailmentDurationPercent` | yes — duration only |
| `dotResistancePercent` (defender) | yes — only mitigation |
| penetration (metal Kim Thế) | yes — pierces dotRes |
| `wardMax`/`manaShieldPercent` | **no** — shields are hit mechanics |
| `defense`/armor, `*Resistance` | **no** |
| `evasionRate`, `blockChance`, `endurance*` | **no** |
| `finalDamagePercent` / `finalDamageReductionPercent` | **no** — `finalDamageMultiplier` removed from DoT path |
| `leechPercent` | **no** — leech is a hit mechanic; Doc Can's authored recovery trigger is the DoT-sustain exception (D18) |
| `healingEffectivenessPercent` | **no** — DoT ticks are damage, not healing received |
| `reactionEffectPercent` (gated `phap_tu`, D19) | **no** — amplifies the reaction burst; ailments applied afterward run on this table |
| `thornsPercent`, on-taken procs | **no** — DoT never triggers them |

- DoT ticks on the afflicted entity's own turn (M8); the attacker is not
  the tick trigger — one more reason DoT does not leech.
- `wardBreakDamagePercent` fires when the ward pool reaches 0 during
  absorb — unchanged (hit path only).

## 5. MP as Phap Tu defensive resource — semantics

> **Amended (2026-09-15) per Phap Tu Reimagined ruling:** MP is the
> SHIELD pool only — no skill spends MP. Phap Tu's combat resource is a
> path-specific pool (The / per-skill costs under D3). The only
> `resourceType: 'mana'` skills (`phap_tu_reaction_special`,
> `phap_tu_reaction_ultimate`) are legacy machinery owned by the Phap Tu
> rework, not a live MP sink.

- MP is the mana-shield pool: post-ward hit damage is redirected into MP at the authored
  `manaShieldPercent` ratio until MP reaches 0; remainder hits HP.
  (`manaShieldPercent` gated to `phap_tu`; nodes author the ratio.)
- MP regen ticks on the owner's turn via the existing vitals authority
  (field rename only).
- `manaScalingRatio` (skills scaling off `stats.maxMp`) keeps working —
  `maxMp` remains a StatType.
- `attunement` feeds MP (D12) via an explicit ordering contract —
  `resolveAttributeTotals()` is a shared helper running ONE
  `runPipeline` pass over base + persistent modifiers and returning the 5
  attribute values. At assembly (`PlayerStatAssembly`), the Phap Tu
  system reads those totals and emits its `domain: 'phap_tu'` modifiers
  BEFORE `calculateStats` runs — attribute derivation still happens
  exactly once inside `calculateStats` (INV-6 intact; the pre-pass reads
  totals, it does not derive). Mid-battle attunement deltas re-emit the
  gated delta via the SAME mechanism the delta pass already uses:
  `calculateEffectiveStats` computes per-attribute deltas, then emits
  `deriveAttributeModifiers(delta)` (universal, existing) AND
  `deriveDomainModifiers(domain, delta)` for each registered domain —
  the delta contract is generalized, not violated: it derives only
  deltas, never the base. Option A (buffs re-authoring the MP half of
  every attunement grant) is rejected — it duplicates the conversion
  ratio into every piece of content.

  `deriveDomainModifiers` contract: a domain may register a
  `deltaDeriver(attributeDeltas, context) -> StatModifier[]` with the
  stats module. `calculateEffectiveStats` invokes a domain's deriver
  only when the entity's `activeDomains` includes that domain (the
  battle adapter declares it from cultivationPath; entities without a
  domain declaration — enemies, companions — run no domain derivers).
  This scopes attunement->MP to Phap Tu entities: a non-Phap-Tu entity
  receiving a mid-battle attunement buff cannot leak `maxMp` /
  `manaRegenPerTurn`. A domain that registers nothing is a no-op
  (`production`, `cultivation`, etc. have no attribute-reactive stats
  and stay silent). Only `phap_tu` registers initially.
- No live content spends MP: the only `resourceType: 'mana'` skills in
  `data/` are `phap_tu_reaction_special` and `phap_tu_reaction_ultimate`,
  both retired by the Phap Tu rework.
- Enemy Phap Tu exists: authored enemy `baseStats` may set `maxMp`,
  `manaShieldPercent`, `manaRegenPerTurn` directly — the gate governs
  modifiers, not base values (§2). Enemy *modifiers* (buffs, scaling)
  follow the same domain rule as everyone's; `EnemyStatInput` rejects
  gated stats arriving through modifier-shaped channels (report, not
  silent clamp).

## 6. Migration surface (implementation outline, not scope creep)

| Area | Change |
|---|---|
| `core/stats/StatTypes.ts` | add `STAT_DOMAIN` registry + `StatModifier.domain`; renames |
| `core/stats/StatCalculator.ts` | delivery-gate validation; new derivation table (speed out, ailmentPotency in) |
| `core/stats/StatBlock.ts`, `StatMetadata.ts` | renames; gated-stat metadata |
| `core/equipment/EquipmentStatPolicy.ts`, `data/equipment/affixes.ts` | remove gated stats from rollable pools |
| `core/combat/CombatSystem.ts` | three-outcome hit semantics; thorns/leech on `hpDamage`; MP-shield reads gated stat; DoT loses `finalDamageMultiplier` |
| `core/stats/resolveAttributeTotals` (new helper) | one `runPipeline` pass -> 5 attribute totals; feeds path-gate emission |
| Renames (same pass) | `attack`->`might`, `baseAttackPlusPower`->`baseMightPlusPower`, `timeSinceLastHitTaken`->`turnsSinceLastHitLanded`, `*RegenPerSecond`->`*RegenPerTurn` |
| `core/enemy/EnemyStatInput.ts` | reject gated stats for enemies |
| `core/battle/turn/*` | regen field renames; no cadence change |
| `data/progression/PhapTuNodes.ts` (+ path systems) | emit `domain: 'phap_tu'` modifiers |
| `stores/player.ts`, `PlayerStatAssembly` | carry/validate domain on modifier assembly |
| save shape | unchanged — StatType union intact, key renames are dev-phase |
| `data/**` content scrub (F5, enumerated) | universal MP-stat sources to re-scope or re-author: `ThuanHeBuffs.linh_tai` (`manaRegenPerSecond` -> `manaRegenPerTurn` flat + `manaRegenPercent` -> `{stat:'manaRegenPerTurn', percent}`), `ThuanHeBuffs.the_man_water` (same flat rename), 1 buff in `LegacyBuffs`, `RealmPassives` pool entries `maxMp`/`manaRegenPerSecond`, `Techniques.ts` MP tier rows (~8 modifier rows, `maxMpPercent`/`manaRegenPercent` -> `{stat, percent, domain:'phap_tu'}`, D17). Each re-author must keep resolved values equivalent; options per entry: emit through `phap_tu` gate (only benefits Phap Tu players) or re-author to a universal stat |
| D21 scrub | `EnemyStatInput.reactionEffectPercent` zero-fill drops and the stat becomes invalid enemy input. Verified clean: zero reaction references in `data/enemy/**` — no authored enemy, skill, or fixture to migrate; zero enemy thorns content either (D21's "unaffected" clause is precautionary, not a migration). Residual: `BossBuffs.ts` filename misleads (it houses the player Phap Tu an ultimate buff `reaction_empowerment`); a PhapTu-scoped rename is a future cleanup, the whitelist entry is correct as-is |
| `attackRange` scrub (D16) | `StatType`/`StatBlock` keys; `EnemyStatInput.attackRangeRanks` input + mapping + `MAX_ENEMY_ATTACK_RANGE_RANKS` cap; ~24 authored enemy entries in `MortalEnemies`; `PLAYER_BASE_RANGE_RANKS` + `player.ts` restore normalization; Đại Ngũ Hành Chân Quyết `combatModifiers` +2 (re-author as targeting modifier or drop); dormant `ActionTargetingSystem` Battle-typed helpers. Verified absent: no affix rolls it, no component displays it |
| UI | CharacterPanel unchanged (5 attributes still shown); `attack` -> `might` label rename |

## 7. Invariants (for tests/QA)

1. **Gate integrity:** a universal modifier can never move a gated stat;
   violations reject loudly (compile where possible, runtime report
   otherwise). `calculateStats(base, [universal mod -> maxMp])` leaves
   `maxMp` unchanged AND reports the rejection.
2. **Speed scarcity:** `deriveAttributeModifiers` output contains no
   modifier targeting `speed`; `calculateStats` with only attribute
   points invested leaves `speed == base`.
3. **Taken semantics:** hit fully absorbed by ward -> `hpDamage == 0` ->
   no thorns damage, no on-taken procs; `turnsSinceLastHitLanded` still
   resets (landed).
4. **DoT isolation:** DoT never reduces `currentWard`/`currentMp`, never
   fires thorns; mitigation = `dotResistancePercent` only.
5. **MP shield ordering:** post-ward damage redirects to MP at the gated
   ratio before HP; MP 0 -> all remainder to HP.
6. **Derivation single-pass invariant:** unchanged R2 guarantees —
   `calculateStats` is the only full-derivation entry;
   `calculateEffectiveStats` delta pass never re-derives the base.
7. **Attribute completeness:** `createBaseStats` key set == StatType key
   set (existing INV-6 pattern extended to renames).
8. **Enemy gating:** `EnemyStatInput` rejects gated stats arriving via
   modifier-shaped channels (report, not silent clamp); authored enemy
   `baseStats` may carry gated stats directly (Phap Tu boss).
9. **Universal acceptance:** a `domain: 'phap_tu'` modifier targeting
   `might`/`firePower` applies normally — gates protect gated stats, not
   universal ones.
10. **Attunement→MP ordering:** `resolveAttributeTotals` output feeds the
    Phap Tu gate emission; `calculateStats` still derives attributes
    exactly once — no double MP contribution, no derivation inside the
    pre-pass.
11. **Whitelist lint:** an authored `domain: 'phap_tu'` modifier living
    in a non-whitelisted file fails the architecture test (build fails)
    — e.g. an affix granting `maxMp` via `domain: 'phap_tu'` is rejected;
    a whitelisted file authoring a different domain is equally rejected
    (per-modifier check against `WHITELIST[modifier.domain]`).
12. **On-hit proc isolation:** a same-target on-hit damage proc folds
    into the parent hit (one absorb pass); a cross-target proc resolves
    as its own hit and cannot chain further on-hit triggers.
13. **Heal/leech separation (D18):** `leechPercent` alone determines
    leech output (`hpDamage x leechPercent`); `healingEffectivenessPercent`
    amplifies `hpRegenPerTurn` ticks and direct/authored heals, but
    leaves leech output bitwise unchanged and never touches
    `manaRegenPerTurn`, `wardRegenPerTurn`, or shield absorb.
14. **Enemy damage surface (D21):** `EnemyStatInput` rejects authored
    `reactionEffectPercent` and any reaction-tagged skill/buff on enemy
    definitions ("reaction-tagged" = id matches `/reaction/i` or the
    data carries a `reaction` tag — whichever convention exists at
    implementation) — enemies resolve hits + DoT as outgoing damage
    only (reactive thorns unaffected).
15. **Speed pool scarcity (D1):** every `EquipmentStatPolicy` pool
    containing `speed` also contains >=2 stats from the competitive
    set {offense amps, crit stats, defense stats} — validated by the
    data-validation test in §3.3. Scarcity has two enforcement layers:
    derivation (INV-2) and pool composition (this invariant).

## 8. Residual notes

- **Rename `attack` -> `might` (D14):** mechanical rename touching
  `DamageCalculator`, `EnemyStatInput`, authored enemy data, affixes,
  i18n labels, UI. Done in the same change as the derivation re-map —
  one stat-key migration pass.
- **DoT + `finalDamagePercent`:** D13 removes the whole
  `finalDamageMultiplier` from DoT, so attacker-side generic amp no
  longer increases DoT either. If that proves to over-nerf DoT builds,
  the remedy is authored `ailmentPotencyPercent`, not restoring the
  generic amp.
- **MP-cost note:** `resourceType: 'mana'` exists only on the two Phap
  Tu reaction skills, which the Phap Tu rework retires — no skill-cost
  migration needed, and no new content may spend MP (MP = shield only).
- **Derivation coefficients are out of scope:** this spec fixes the
  derivation TOPOLOGY (which attribute feeds which stat, which stat is
  gated, which pipeline layer applies where). Per-point coefficients
  (0.6 might/str, etc.) keep their current values where semantics are
  unchanged and are tuned in a separate balance pass — implementers do
  not invent new ratios.
- **`attackRange` precedent:** reach lives on skills (`ActionTargeting`),
  never on stats — future "range/extent" bonuses are authored as
  targeting modifiers on the skill, not as a StatType.
