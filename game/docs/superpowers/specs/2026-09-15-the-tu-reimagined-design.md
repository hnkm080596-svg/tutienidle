# The Tu Reimagined — Design Spec

Date: 2026-09-15
Status: IMPLEMENTED (2026-09-15, plan `2026-09-15-the-tu-reimagined-plan.md` v2.4 — executed in worktree `the-tu-reimagined`, Tasks 1–24).
Context: the third path in the reimagined series, after
`2026-09-14-phap-tu-reimagined-design.md` (APPROVED) and
`2026-09-15-kiem-tu-reimagined-design.md` (draft). Builds on
`2026-09-14-stat-system-reimagined-design.md` (D1–D21) and the ATB turn
engine (R1–R14 complete). Supersedes the user's in-chat draft "THỂ TU
REIMAGINED — DESIGN SPEC" (2026-09-15): the Hiện/Ẩn pair is reinterpreted
as **two separate CultivationPathIds** per the series-wide hidden-path
ruling now recorded in roadmap §0.11 (B6). Sections below replace the
draft wholesale; where the draft's language survives it is re-stated
here, not referenced.

Governing principle (user-authored, unchanged): **stats decide whether a
character is capable of an action; nodes decide what happens when that
action succeeds.** Nodes never grant EVA/Counter/Hộ probability,
independent power sources, or artificial resources that compensate for
weak stats.

---

## 1. Decisions locked with the user (brainstorm 2026-09-15)

| # | Decision |
|---|---|
| T1 | `the_tu` (Hiện) and `the_tu_an` (Ẩn) are **separate `CultivationPathId`s**, offered at the Initiation Ritual. Taking Ẩn forfeits the visible branch permanently — no node, no flip, no refund. (Series-wide rule: every hidden path is its own path id; the Kiếm Tu spec's K1–K4 mode-flip model is superseded — roadmap B6.) |
| T2 | `the_tu_an` has its **own reactive 3-slot kit** — it is not a modifier on the visible kit. |
| T3 | Hiện ultimates carry **no resource cost**; gating = cooldown + trigger semantics (see T11). |
| T4 | `counterChance`, `protectChance`, `followUpChance` are **new derived stats** in the `the_tu_an` domain. |
| T5 | Hiện branch roots are **mutually exclusive**: Cuồng Chiến XOR Trấn Thể per character (`excludesNode`). |
| T6 | `the_tu_an` ritual gate = mortal skill **`huy_quyen` (Hủy Quyền) at Lv3**, read live from `skillCastCounts` — same pattern as `tram`→`kiem_tu_an` and `linh_bao`→`phap_tu_an`. `huy_quyen` does not exist yet; authoring it is in scope. |
| T7 | Thế is **proc-fuel**: each reactive check costs Thế to attempt; success refunds + profit; failure drains. Thế never multiplies probability. |
| T8 | Two stat domains: `'the_tu'` (Hiện) and `'the_tu_an'` (Ẩn). |
| T9 | Ẩn branches Hộ/Phản/Trợ are **non-mutex** — three mechanics stacked on one kit. |
| T10 | The draft's Hiện hybrid loop (Taunt → take hits → Berserk → Bất Tử across both kits) **does not exist** — pure identity per kit, no bridge nodes. |
| T11 | Bất Tử is a **passive lethal trigger**: when a killing blow lands and the ultimate is off cooldown, it engages automatically (survive at HP 1 → Bất Tử + Bá Thể state). It is also manually castable; either path starts the same cooldown. Auto-mode may cast it at full HP — that tradeoff is player choice. |
| T12 | `thornsPercent` is **retired** (affix pools and the stat itself — dev phase, no migration). Reflect semantics live only in the_tu Reflection and tho_tu's `wardBreakDamagePercent`. |
| T13 | Idle volatility is **accepted path identity**: Cuồng Chiến peaks near death (anti-auto-farm), Ẩn scales with enemy attack rate (starves vs lone bosses, explodes vs packs). No per-round reactive caps. |
| T14 | Scope = **end-to-end both paths**: path ids, ritual offer, mortal gate skill, kits, trees, derived stats, engine mechanics, tooltips, tests. |

Supporting defaults (proposed in brainstorm, unvetoed — spec-editable):

| # | Default |
|---|---|
| D1 | "3 turns" = the buff **holder's own turns** (`TurnBuffSystem` convention), not rounds. |
| D2 | Bất Tử HP floor = 1 (existing survive-lethal semantics); ward/mana-shield absorb first as usual. |
| D3 | Ally "Armor" = **temporary ward pool** scaled from the tank's maxHp; tank excluded via target scope; recast refreshes, never stacks. |
| D4 | Reflection fires only on the `taken` outcome (`hpDamage > 0`) — dodged or fully-absorbed hits reflect nothing. |
| D5 | Intercept = **target substitution**, no grid movement; multiple protectors → nearest to the attacker rolls first (one substitution per action). |
| D6 | Taunt overrides `selectTarget` for the debuffed enemy; scripted `specialAttacks` and AoE shaping are unaffected; duration measured in the taunted enemy's own turns. |
| D7 | `currentMomentum` / `MAX_MOMENTUM` retire; `breakGauge`/Stagger stays a universal boss mechanic. |
| D8 | Ẩn's Thế reuses `CombatEntity.currentThe` / `MAX_THE` and the existing battle-scoped reset (`resetBattleScopedResources`). |
| D9 | `bat_tu_the` talent (once-per-battle survive + Tử Sinh Ngộ) stays independent — it is a second line of survival, not part of the ultimate. |
| D10 | Bá Thể **unifies** with the existing universal anti-CC mechanic (`consecutiveHardCcTurns`): the ultimate is its proactive form — cleanses hard CC on apply, suppresses the counter while active, grants displacement/interrupt immunity for the duration. |
| D11 | Manual mode for Ẩn = ultimate timing only; all reactive checks are automatic. |

---

## 2. Path model & gating

### 2.1 CultivationPathId

```ts
// CultivationPathKit.ts
export type CultivationPathId = 'phap_tu' | 'kiem_tu' | 'the_tu' | 'the_tu_an'
```

`PlayerData.cultivationPath` is the only persisted path state the new
paths need — **no `PlayerData.theTu` sub-object**: investment lives in
`nodeLevels`, Thế is battle-scoped, there is no stance/preset/route to
persist. (Kiếm Tu's `kiemTu.mode` exists because mode was a flip; under
T1 hidden paths are their own ids and need nothing equivalent.)

### 2.2 Initiation Ritual offer

- `the_tu` is offered unconditionally alongside `phap_tu`/`kiem_tu`.
- `the_tu_an` appears in the offer list only when the mortal has
  `huy_quyen` at Lv3 — **live read of `skillLevels`/`skillCastCounts` at
  offer time** (same pattern as the `tram` Lv3 gate; never stored
  eligibility, never re-offered later).
- Selecting `the_tu_an` grants the Ẩn kit and technique; `the_tu` is not
  granted and cannot be taken later.

### 2.3 Mortal skill `huy_quyen` (Hủy Quyền)

New mortal-tier skill, learned pre-path like `tram`/`linh_bao`:

- `id: 'huy_quyen'`, display "Hủy Quyền", mortal physical basic-tier
  attack (flavor: body-tempering fist art — the martial root of Thể Tu).
- Cast-leveling via the existing `recordCast` → `skillCastCounts` mirror:
  Lv3 at `HUY_QUYEN_L3_CASTS = 10_000` casts (same convention as
  `HUY_KIEM_L3_CASTS`).
- While mortal it may be cast as a basic attack; post-path it locks (K3
  convention: authored per-cast scaling never reaches combat after a path
  is chosen — an inert static fallback at most).

### 2.4 Kits & techniques

`CULTIVATION_PATH_KITS` gains two entries (each requires `techniqueId`):

| Path | Technique | Kit resolution |
|---|---|---|
| `the_tu` | `kim_cang_bat_hoai_the` (Kim Cang Bất Hoại Thể — existing placeholder technique, now backed) | **Owned root decides the kit** (§5). No root owned → generic physical basic only, no special/ultimate. |
| `the_tu_an` | `ung_the_than_quyet` (Ứng Thế Thần Quyết — new technique) | Fixed reactive kit (§6) granted at path choice. |

`realmRewards` entries follow sibling convention (technique at realm
reward tier); artifact grants for Thể Tu are out of scope for this spec
(see §11).

### 2.5 Save

Save version bumps (dev phase, **no migration**). `cultivationPath` may
now carry the two new ids — restores accept them verbatim; battle-scoped
fields (`currentThe`) reset on battle start as today.

---

## 3. Stat model

### 3.1 Domains

```ts
// StatDomain.ts
export type StatDomain = ... | 'the_tu' | 'the_tu_an' | ...

export const STAT_DOMAIN: Partial<Record<StatType, StatDomain>> = {
  ...existing,
  // the_tu (Hien) — executes the D20 earmark; every universal source is
  // re-authored or removed (§3.3).
  blockChance: 'the_tu',
  blockEffectiveness: 'the_tu',
  enduranceThreshold: 'the_tu',
  endurancePercent: 'the_tu',
  // the_tu_an (An) — reactive chances, T4.
  counterChance: 'the_tu_an',
  protectChance: 'the_tu_an',
  followUpChance: 'the_tu_an',
}

export const CULTIVATION_PATH_STAT_DOMAINS = {
  ...existing,
  the_tu: ['the_tu'],
  the_tu_an: ['the_tu_an'],
}
```

`DOMAIN_SOURCE_WHITELIST` gains `the_tu` rows for
`data/progression/TheTu*`, `data/skill/TheTu*`, `data/buff/TheTu*`, plus
scoped rows on `data/technique/Techniques.ts` (the_tu-gated stats) — and
the matching `the_tu_an` rows (`data/progression/TheTuAn*`,
`data/skill/TheTuAn*`, `data/buff/TheTuAn*`; no technique row needed —
Ẩn technique never emits gated chances, INV-13).
`TurnBattleAdapter` declares both for `activeDomains`.

### 3.2 Derived reactive chances (T4)

Three new stats in `StatTypes.ts`, values in **[0,1] probability**,
authored base 0:

| Stat | Derives from | Fantasy |
|---|---|---|
| `counterChance` | `strength` + `dexterity` | striking power + reflex to answer a blow |
| `protectChance` | `vitality` + `dexterity` | mass + speed to interpose |
| `followUpChance` | `dexterity` + `intelligence` | read an ally's rhythm (Thần Thức) |

Emission follows the **D12 two-channel pattern** exactly as
`phap_tu:attunement→maxMp` does:

- **Assembly time**: `getTheTuAnReactiveStatModifiers(player, totals)`
  beside `getPhapTuAttunementStatModifiers` — reads
  `resolveAttributeTotals`, emits `domain:'the_tu_an'` modifiers, only
  when `player.cultivationPath === 'the_tu_an'`; wired into
  `resolvePlayerFinalStats` next to the Pháp Tu emission.
- **Mid-battle**: `registerDomainDeltaDeriver('the_tu_an', ...)` at module
  load — re-emits deltas when attributes move mid-battle; runs only for
  entities whose `activeDomains` contains `the_tu_an`.

Constants (playtest-tunable first passes, same convention as
`ATTRIBUTE_*`):

```ts
const THE_TU_AN_STR_COUNTER_PER_POINT   = 0.004
const THE_TU_AN_DEX_COUNTER_PER_POINT   = 0.004
const THE_TU_AN_VIT_PROTECT_PER_POINT   = 0.004
const THE_TU_AN_DEX_PROTECT_PER_POINT   = 0.003
const THE_TU_AN_DEX_FOLLOWUP_PER_POINT  = 0.004
const THE_TU_AN_INT_FOLLOWUP_PER_POINT  = 0.003
const REACTIVE_CHANCE_CAP               = 0.60  // clamp after pipeline
```

Authoring rule (enforced by an arch test, INV-13): **no node, buff,
technique, or kit may emit modifiers for the three chance stats.** The
attributes→chance derivation is the only source; nodes modulate
*consequences* (payloads, costs, riders), never the roll.

### 3.3 the_tu domain migration (D20 earmark, executed)

`blockChance`/`blockEffectiveness`/`enduranceThreshold`/
`endurancePercent` become `the_tu`-gated. Consequences:

- All current **universal sources are re-authored or removed**: any
  equipment affixes, buffs, or nodes granting these stats are either
  dropped or re-emitted as `the_tu`-domain content. A non-the_tu entity
  can no longer receive block/endurance from gear — that is the intent
  (block is body-path identity, like MP is Pháp Tu's).
- `enduranceThreshold`'s attribute derivation (`vitality × 1`, universal)
  moves to the same assembly/deltaDeriver pattern with
  `domain:'the_tu'` — emitted only for `the_tu` players.
- Corollary: `the_tu_an` can never gain block/endurance via modifiers —
  the Ẩn path dodges and answers, it does not block. `evasionRate`
  stays universal (dexterity → evasion feeds every path).
- `thornsPercent` (T12) is deleted from `StatTypes`, affix pools, and
  any sources. `wardBreakDamagePercent` (tho_tu) is untouched.

Vitality stays the shared Thể Tu axis without duplication: for Hiện it
feeds maxHp/regen/endurance (bigger red bar, more berserk range, tankier
body); for Ẩn it feeds `protectChance`. Strength feeds Hiện offense and
Ẩn `counterChance`; dexterity feeds EVA (universal) plus both Ẩn chances
it shares; intelligence is Ẩn's read-the-rhythm stat.

### 3.4 Missing-HP damage scalar (Cuồng Chiến)

New `TurnSkillDefinition.damage` field:

```ts
damage?: {
  kind: DamageType
  multiplier: number
  // Cuong Chien (the_tu): bonus physical damage proportional to the
  // attacker's missing HP fraction, resolved at impact.
  missingHpBonusPerMissingPercent?: number  // e.g. 0.02 -> +2% dmg per 1% missing
  missingHpBonusCap?: number                // e.g. 2.0 -> total x3 at 100% missing
}
```

Resolved inside the hit pipeline reading live `currentHp/maxHp` — it is
a skill-resolution scalar, not a stat, so it never pollutes the modifier
pipeline and recomputes per hit. `hpDamage` "taken" semantics unchanged.

---

## 4. Thế — proc-fuel economy (T7, D8)

`CombatEntity.currentThe` (0–`MAX_THE` = 100) is the shared field; its
gain/spend rules are **per-path** (Pháp Tu keeps its own cast-gain rules
under its own spec; this spec defines only the Ẩn table). Battle-scoped:
`resetBattleScopedResources` zeroes it on every battle start, including
auto-repeat restarts.

> Known quirk to fix during implementation: the current unconditional
> "+10 special / +20 ultimate landed-hit" gain in `TurnBattleSystem`
> fires for **every** participant. Under this spec it must be scoped to
> `phap_tu` participants (or whatever the Pháp Tu worktree lands); Ẩn
> uses only the table below.

### 4.1 Transactions

| Event | Thế |
|---|---|
| Reactive check attempted (Hộ/Phản/Trợ window opens AND `currentThe >= THE_PROC_COST`) | `−THE_PROC_COST` then roll the derived chance |
| Check succeeds | `+THE_PROC_GAIN` (net `+5`) |
| Check fails | nothing back (net `−15`) |
| `currentThe < THE_PROC_COST` | **no roll** — the mechanic is inert this window |
| EVA success (attack dodged) | `+THE_GAIN_ON_EVADE` (free) |
| Hit taken (`taken` outcome) | `+THE_GAIN_ON_HIT_TAKEN` (free) |
| Own basic lands | `+THE_GAIN_ON_BASIC` (free) |
| Per round elapsed | `+THE_GAIN_PER_ROUND` (anti-starvation bootstrap; tunable to 0) |

```ts
const THE_PROC_COST        = 15
const THE_PROC_GAIN        = 20
const THE_GAIN_ON_EVADE    = 8
const THE_GAIN_ON_HIT_TAKEN = 6
const THE_GAIN_ON_BASIC    = 4
const THE_GAIN_PER_ROUND   = 5
```

### 4.2 Why this bounds the economy

- Income is free but modest; spend is per-attempt. A build whose derived
  chances are low pays 15 and fails often → pool drains → checks stop.
  A build with strong stats succeeds often → net +5 per proc → sustains.
  Thế is a **throughput budget, not a probability** — exactly the
  "stats decide capability" rule (the draft's `StatChance ×
  TheMultiplier` is replaced; there is no multiplier).
- Per-enemy-attack income (`EVADE`/`TAKEN`) keeps the Ẩn fantasy "strong
  vs packs, lean vs lone bosses" (T13 — accepted identity, not a bug).
- `MAX_THE` caps hoarding; node variants may raise it (reuse the
  `resolveMaxThe`-style cap read if it generalizes — implementation
  detail, flag at plan time).

---

## 5. `the_tu` — Hiện kits (root mutex, T5/T10)

Two branch roots, `excludesNode` pair: owning one locks the other.
**Kit resolution reads the owned root at participant build** (alongside
`resolvePlayerSpecialUltimate`): no root → `GENERIC_PHYSICAL_BASIC`
fallback only. Kits never change mid-battle; no respec exists.

### 5.1 Cuồng Chiến (Berserker) — root `cuong_chien`

| Slot | id | Display | Effect |
|---|---|---|---|
| Basic | `cuong_quyen` | Cuồng Quyền | Physical single-target damage; `missingHpBonusPerMissingPercent` scalar (§3.4) — the red bar is the resource. |
| Special | `loan_dau` | Loạn Đấu | Physical damage, bigger multiplier, same missing-HP scalar, cooldown `attack_speed`-flavored; rider slots come from nodes. |
| Ultimate | `bat_tu_ba_the` | Bất Tử Bá Thể | Cooldown (own turns). Applies buff `bat_tu_ba_the` on self for 3 holder-turns. **Also a passive lethal trigger (T11).** |

`bat_tu_ba_the` buff (one buff, two rule sets):

- **Bất Tử**: while active, lethal damage clamps HP to ≥1 — every
  killing blow inside the window leaves the holder at 1 HP. Damage,
  ailments, and wounds still resolve normally; expiry does not heal —
  the next lethal hit kills.
- **Bá Thể** (D10): on apply, cleanse current hard CC; while active,
  `consecutiveHardCcTurns` accumulation is suppressed and the holder is
  immune to displacement and cast-interruption.
- **Passive trigger (T11)**: when lethal damage would kill the holder
  AND the ultimate is off cooldown → consume the cooldown, apply the
  buff, survive at 1. If the ult is on cooldown, death proceeds
  normally (`bat_tu_the` talent may still fire once — D9, independent).
- Manual cast: allowed any time off cooldown; starts the same cooldown.
  `selectAction`'s ult→special→basic priority may fire it at full HP —
  accepted (T11): 3 undying turns are never wasted, but an auto-spent
  cooldown means the lethal insurance is unavailable when needed.

Node examples (non-final, tune at implementation):

- `missingHpBonus` scalar increases below an authored HP threshold
  ("below 30% HP, scalar doubles").
- Bất Tử duration +1 holder-turn; kills during Bất Tử extend by 1.
- Loạn Đấu hits during Bất Tử leech a fraction of `hpDamage`.
- Stat nodes: strength/vitality flats, maxHp% — allowed (stats may come
  from progression; *chances* may not).

### 5.2 Trấn Thể (Tank) — root `tran_the`

| Slot | id | Display | Effect |
|---|---|---|---|
| Basic | `tran_ap` | Trấn Áp | Physical **AoE** damage (all enemies / authored shape); debuff riders come from nodes. |
| Special | `phan_chinh` | Phản Chấn | **Passive emblem** occupying the special slot (K13 emblem precedent): never castable; `selectAction` skips it. Grants permanent self-buff `phan_chinh` at battle start. |
| Ultimate | `son_nhac` | Sơn Nhạc | Cooldown (own turns). Team protection + Taunt + self DR. |

`phan_chinh` (Reflection, Hiện-owned — T12, D4):

- On every enemy hit resolving **`taken`** (`hpDamage > 0`), deal a
  direct damage event to the attacker:
  `reflect = REFLECT_MAXHP_RATIO × tank.maxHp + REFLECT_TAKEN_RATIO × hpDamage`.
- It is a **damage event, not an action**: no accuracy/dodge/crit roll,
  resolved through the vitals authority, and it **opens no reactive
  windows for either side** (INV-8). Reflected kills are real kills.
- Never fires on `miss`/`absorbed` — dodged or fully-warded hits reflect
  nothing (D4).

`son_nhac` (Sơn Nhạc — "body like the great mountains"):

- Allies **excluding self** gain a temporary ward pool =
  `SON_NHAC_WARD_RATIO × tank.maxHp` (D3 — absorb pool via the ward
  authority; may exceed the ally's own `wardMax` since it is externally
  granted — implementation detail flagged). Recast refreshes to full;
  never stacks.
- All enemies receive `khiem_khich` (Khiêu Khích — Taunt) for N of
  **their own** turns (D6). While taunted, `selectTarget` returns the
  taunt source; scripted `specialAttacks` and AoE shaping are
  unaffected. A second taunt on the same enemy replaces the earlier
  source. Bosses are tauntable unless authored immune.
- Self gains `finalDamageReductionPercent` for N self-turns.

Node examples:

- Trấn Áp riders: on-hit slow / attack-down / defense-shred choices.
- Reflection: `REFLECT_TAKEN_RATIO` up; reflect also reduces attacker's
  next-hit damage.
- Taunt: duration +1 enemy-turn; taunted enemies deal reduced damage to
  non-tank targets (softening the AoE gap).
- Sơn Nhạc: ward ratio up; allies under ward gain thorns-*like* rider?
  — no: riders must not recreate generic reflect (T12). Use DR or regen
  riders instead.
- Stat nodes: vitality/maxHp%, defense, block stats (domain-legal for
  the_tu — §3.3).

---

## 6. `the_tu_an` — Ẩn kit & reactive mechanics (non-mutex, T9)

### 6.1 Kit (fixed, granted at path choice — T2)

| Slot | id | Display | Effect |
|---|---|---|---|
| Basic | `tham_the` | Thám Thế | Physical single-target damage; on hit `+THE_GAIN_ON_BASIC` Thế — own-turn income. |
| Special | `tu_the` | Tú Thế | Cooldown. Applies stance buff `tu_the` (N self-turns): reactive check cost −X (authored on the buff) and/or +Thế now. The "bank the rhythm" button. |
| Ultimate | `bach_ung` | Bách Ứng | Cooldown. State buff `bach_ung` (3 self-turns): reactive checks are free (cost 0) and payloads upgrade (authored on buff, e.g. counter hits +break). The burst window. |

### 6.2 Reactive mechanic branches

Three roots — `ho_mon` (Hộ), `phan_mon` (Phản), `tro_mon` (Trợ) —
**non-mutex** (T9). Each root grants the base mechanic (the engine check
itself); sub-nodes modulate consequences only. No root → that mechanic
never checks.

Reactive windows and ordering inside one enemy/player action:

1. **Hộ window** (between enemy *declare* and *impact*): enemy action is
   single-target AND its target is a player-side participant other than
   the protector AND the protector has Hộ AND `currentThe ≥ cost` →
   priority = protector nearest to the attacker (Chebyshev; one roll) →
   roll `protectChance` → success: **the protector becomes the action's
   target** (D5 — substitution, dash is VFX only). The hit then resolves
   fully vs the protector: accuracy/EVA/block — and the protector's own
   Phản may proc on the outcome (Hộ→EVA→Counter chain = the signature).
2. **Phản window** (after the hit resolves on a participant with Phản):
   - `taken` → roll `counterChance` → success queues a counter action.
   - `miss` (dodged) → **new dodge-side trigger** — the existing
     `if (!hitResult.dodged)` gate does not cover this; the engine emits
     a dodge outcome event that the Phản check consumes (R3 contract
     extension — acknowledged new work, not free composition).
   - Success → queue a bypass-turn action resolving payload skill
     `phan_kich` (Phản Kích). The queue entry carries
     `{ actionSource: 'counter', triggerContext: 'post_hit_taken' |
     'post_evasion' | 'post_intercept', targetIds }` so node variants can
     swap payloads (e.g., "counter after EVA becomes a heavy counter").
3. **Trợ window** (after any *other* player-side participant's action
   completes with damage dealt): roll `followUpChance` → success queues
   a bypass-turn action resolving `tro_kich` (Trợ Kích) against the
   triggering action's targets. Never triggers on self-actions or on
   reactive actions (INV-9).

Payload skills `phan_kich`/`tro_kich` are real `TurnSkillDefinition`s —
the counter/follow-up actions are actual combat actions through the
existing follow-up queue (`queuedFollowUpActorIds`, bypass turns that
consume no `actionGauge`, `MAX_FOLLOW_UP_CHAIN_DEPTH = 4`).

### 6.3 Ẩn without allies

Solo Ẩn has no Hộ windows and no Trợ windows — only EVA/hit-taken income
and Phản. That is the designed consequence of "power through the party"
(T13): flag in tooltips. Companions are player-side participants, so a
`the_tu_an` companion can Hộ the player and vice versa once companion
path content lands (out of scope here, mechanics are participant-generic).

---

## 7. Engine mechanics — worklist

All under `game/src/core/` unless noted; every mechanism is
headlessly testable.

1. **Reactive queue entries** (`TurnBattleSystem`): extend the follow-up
   queue item to `{ actorId, actionSource, triggerContext, payloadSkillId,
   targetIds }`. `actionSource` ∈ `'normal' | 'skill' | 'counter' |
   'follow_up' | 'intercept'`; reactive actions never open new windows
   by default — a node may opt in explicitly (draft §37 survives).
   `MAX_FOLLOW_UP_CHAIN_DEPTH` still bounds chains.
2. **Intercept window**: post-declare/pre-impact hook running the Hộ
   check (ordering §6.2.1); substitution mutates `declared.affected`
   before the hit loop.
3. **Dodge-side trigger**: emit a dodge outcome on the defender's pool
   (`onEvade`-class trigger) feeding the Phản check; the landed-path
   reactive triggers keep their `!dodged` gate.
4. **Taunt**: `khiem_khich` debuff → `selectTarget` override to the
   taunt source; scripted `specialAttacks` unaffected; expiry on the
   debuff holder's turns; newest-taunt-wins on conflicts.
5. **Reflection**: `phan_chinh` buff → on `taken`, direct damage event
   to attacker through vitals authority; no windows opened.
6. **Bất Tử lethal trigger**: duration-based survive-lethal variant of
   the existing `SurviveLethalGuard` — engage only when the holder's
   ultimate is off cooldown; engagement starts the cooldown. Distinct
   from `bat_tu_the` talent (once-per-battle) — both may exist on one
   character, resolving independently.
7. **Bá Thể suppression**: while `bat_tu_ba_the` is active, hard-CC
   turns don't increment `consecutiveHardCcTurns` and don't consume the
   holder's action; apply-time cleanse of existing hard CC;
   displacement/interrupt immunity flag.
8. **Thế transactions**: pay-per-attempt + free-income table (§4.1),
   scoped to `the_tu_an` participants; scope the existing generic
   special/ultimate Thế gain to `phap_tu` (see §4 quirk).
9. **missing-HP scalar** (§3.4) in the hit pipeline.
10. **Passive emblem special slot**: `phan_chinh` never selectable —
    `selectAction` treats the slot as absent (K13 precedent).
11. **Ally ward grant** (§5.2): ward authority must accept an external
    grant exceeding the target's own `wardMax`; recast refreshes.
12. **Dead plumbing**: `counterable`/`counterSkillId` on
    `TurnSkillDefinition` stay dead — Phản counters are participant
    mechanics, not "this skill is counterable" semantics. Marked for
    removal review at implementation (do NOT wire them into Phản).
13. **Retire `currentMomentum`/`MAX_MOMENTUM`/`grantsMomentumPerHit`/
    `resourceType:'momentum'`** and the `heavy_impact` content (D7).
14. **Ritual offer gate** (`GameManagerRealmAdvanceOps` / offer UI seam):
    `the_tu_an` enters the offer list iff live `huy_quyen` level ≥ 3 —
    read at offer time, never stored.

---

## 8. Node trees

Files: `data/progression/TheTuNodes.ts`, `TheTuAnNodes.ts`. Costs use the
existing Cảm Ngộ/insight economy; prerequisites use existing kinds
(`realm`, `node`, `nodeCount`, `excludesNode`, `skillCastCount`).

### 8.1 `the_tu` tree

```
[trunk: stat nodes — str/vit/def/maxHp%] 
        |
   (choose one root — excludesNode mutex, T5)
   /                                   \
[cuong_chien]                      [tran_the]
  ├─ missing-HP scalars              ├─ tran_ap debuff riders
  ├─ Bất Tử duration/leech/ext.      ├─ reflection scaling/riders
  ├─ loan_dau riders                 ├─ taunt duration/soften
  └─ str/vit offense stats           └─ son_nhac ward ratio/DR, vit/block stats
```

Realm gating: roots purchasable at `qi_refining`; deeper nodes gate
`foundation_establishment` (beta content bound). Beyond-beta tiers are
structured but parked — same convention as siblings.

### 8.2 `the_tu_an` tree

```
[trunk: stat nodes — vit/dex/str/int, Thế economy (cap/cost/gain)]
        |
   (roots non-mutex — T9; each grants the base mechanic)
   /            |             \
[ho_mon]     [phan_mon]     [tro_mon]
  ├─ intercept→ally ward     ├─ post-evasion heavy counter  ├─ tro_kich heals/buffs ally
  ├─ intercept +Thế          ├─ counter +break/crit rider   ├─ follow-up on ANY ally action
  └─ protect vs stronger hit └─ counter payload variants    └─ Trợ cost/cooldown variants
```

Economy nodes (cap↑/cost↓/gain↑) live on the **trunk**, not under
mechanic roots — they feed all three branches and stay node-shaped
"what happens after", not probability.

---

## 9. Identity boundaries (structural, not soft)

- Reflection exists only on `the_tu` (T12; `thornsPercent` deleted).
- Hộ/Phản/Trợ exist only on `the_tu_an`.
- Hiện protects allies through Taunt/team-ward/damage pressure — never
  interception. Ẩn never gets a missing-HP berserker mode.
- These are enforced by path id + tree structure (T1, T5, T9), not by
  rules text — the Bất Tử+Hộ and Taunt+Counter hybrids cannot exist.

---

## 10. Invariants

| # | Invariant |
|---|---|
| INV-1 | One `cultivationPath` per character. `the_tu_an` eligibility is evaluated once at the ritual via live `skillCastCounts` read; never stored, never re-offered. |
| INV-2 | `cuong_chien`/`tran_the` roots are mutex via `excludesNode` — a character never owns both. |
| INV-3 | Hiện kit resolution reads the owned root only; no root → generic basic fallback; kit is fixed at participant build and never changes mid-battle. |
| INV-4 | Bất Tử: while `bat_tu_ba_the` is active, lethal damage clamps to HP ≥ 1; damage/ailments still resolve; expiry heals nothing. |
| INV-5 | Bá Thể: while active, hard CC never consumes the holder's turn and `consecutiveHardCcTurns` stays suppressed; apply-time cleanse; displacement/interrupt immune. |
| INV-6 | Thế (`currentThe`) is battle-scoped 0..`MAX_THE`, reset on every battle start including auto-repeat. It gates **attempts**, never probability. |
| INV-7 | Proc-fuel: a reactive check rolls iff `currentThe ≥ THE_PROC_COST` (cost paid on attempt); success `+THE_PROC_GAIN`, failure loses the cost; free income only via the §4.1 table. |
| INV-8 | Reflection is a damage event on `taken` only — never an action, opens no windows, cannot chain into counters/reflects; dodged/absorbed hits reflect nothing. |
| INV-9 | Reactive actions carry `actionSource` + `triggerContext`, resolve through the follow-up/bypass queue, consume no `actionGauge`, and by default never open new reactive windows; chain depth bounded by `MAX_FOLLOW_UP_CHAIN_DEPTH`. |
| INV-10 | Hộ substitutes the target **before** impact on single-target enemy actions only; the substituted hit resolves fully vs the protector (accuracy/EVA/block/Phản all apply); no grid movement. |
| INV-11 | Taunt affects only `selectTarget`-driven target selection; scripted `specialAttacks` and AoE shaping are unaffected; duration in the taunted enemy's own turns; newest taunt wins. |
| INV-12 | Sơn Nhạc's ally ward excludes the tank and refreshes rather than stacks on recast. |
| INV-13 | No authored content may emit modifiers for `counterChance`/`protectChance`/`followUpChance` — the attribute derivation is the only source (arch test on `TheTu*` data files). |
| INV-14 | `taken`-only semantics hold everywhere: only `hpDamage > 0` feeds reflection/leech/on-hit-taken procs (existing D11 contract, unchanged). |
| INV-15 | Dead plumbing stays dead until deliberately removed: `counterable`/`counterSkillId` are not wired into Phản. |

---

## 11. Scope, retirements, residuals

### In scope (T14)

- `CultivationPathId` + kits + ritual offer (incl. `huy_quyen` gate).
- `huy_quyen` mortal skill + cast-leveling.
- `StatDomain`/`StatTypes`/`StatCalculator` additions (§3), the_tu
  block/endurance migration, `thornsPercent` deletion.
- Two kits (9 skills), 2 techniques, 2 trees, buffs
  (`bat_tu_ba_the`, `khiem_khich`, `phan_chinh`, `tu_the`, `bach_ung`),
  payload skills (`phan_kich`, `tro_kich`).
- Engine mechanics (§7 worklist) + `currentMomentum` retirement.
- Tooltips/i18n keys (Vietnamese display strings, P16 gateway).
- Unit + integration + arch tests (§12).
- Save version bump (no migration).

### Out of scope / residuals

- Thể Tu artifact grant (`realmRewards.artifactId`) — later content pass.
- Companion path content for `the_tu*` (mechanics are participant-generic;
  roster content is a separate spec).
- AoE-intercept (Hộ vs multi-target actions) — v2.
- Realm tiers beyond `foundation_establishment` (beta bound).
- `kim_cang_bat_hoai_the` technique effects (stats profile authored at
  implementation; spec only requires the id exist for the kit).
- All §4.1/§3.2 constants are playtest-tunable first passes.

---

## 12. Test plan sketch (headless)

- **Stat/domain**: gated chance stats reject universal/wrong-domain
  modifiers (dev throws, prod filters); Ẩn assembly emission only when
  `cultivationPath === 'the_tu_an'`; deltaDeriver doesn't leak to other
  paths; block/endurance gated to `the_tu`; `thornsPercent` gone.
- **Economy**: cost paid on attempt, success/failure nets, zero-pool
  no-roll, cap, battle-start reset incl. auto-repeat.
- **Reactive**: intercept substitution + nearest-protector priority +
  single-target-only; counter on taken AND on dodge-side; follow-up on
  ally action, not on self/reactive actions; chain-depth bound;
  reactive-from-reactive off by default.
- **Hiện**: root mutex (`excludesNode`), kit resolution per root /
  fallback, missing-HP scalar at several HP ratios; Bất Tử lethal
  trigger (off-CD engages, on-CD dies, talent independence), duration
  expiry then death; Bá Thể cleanse + suppression; Reflection fires on
  `taken` only, kills attacker through vitals; Taunt override + expiry +
  specials-immune + newest-wins; Sơn Nhạc ally-only ward + refresh.
- **Path/save**: ritual offer gates on live `huy_quyen` level;
  `the_tu_an` never offered without it; path ids round-trip through
  save/restore at the new version.
- **Regression**: generic Thế gain no longer fires for non-phap_tu
  participants; `currentMomentum` removal compiles clean.

---

## 13. Naming checklist (N2 convention — Vietnamese pinyin, no diacritics)

| id | Display | Kind |
|---|---|---|
| `the_tu` / `the_tu_an` | Thể Tu / Thể Tu Ẩn | path ids |
| `huy_quyen` | Hủy Quyền | mortal skill |
| `cuong_quyen` | Cuồng Quyền | basic |
| `loan_dau` | Loạn Đấu | special |
| `bat_tu_ba_the` | Bất Tử Bá Thể | ultimate + buff |
| `tran_ap` | Trấn Áp | basic (AoE) |
| `phan_chinh` | Phản Chấn | special (passive emblem) + buff |
| `son_nhac` | Sơn Nhạc | ultimate |
| `khiem_khich` | Khiêu Khích | debuff (taunt) |
| `tham_the` | Thám Thế | basic |
| `tu_the` | Tú Thế | special + buff |
| `bach_ung` | Bách Ứng | ultimate + buff |
| `phan_kich` | Phản Kích | counter payload |
| `tro_kich` | Trợ Kích | follow-up payload |
| `cuong_chien` / `tran_the` | Cuồng Chiến / Trấn Thể | Hiện roots |
| `ho_mon` / `phan_mon` / `tro_mon` | Hộ Môn / Phản Môn / Trợ Môn | Ẩn roots |
| `kim_cang_bat_hoai_the` | Kim Cang Bất Hoại Thể | technique (existing) |
| `ung_the_than_quyet` | Ứng Thế Thần Quyết | technique (new) |

Names are proposals — the user renames freely; ids derive from display
names per convention.

---

## 14. Implementation notes (recorded at execution, 2026-09-15)

Resolutions the spec flagged as "implementation detail" — recorded here
so the spec stays the readable contract while the code is the authority.

- **Composite `triggerContext`.** The spec's queue contract sketched a
  flat enum (`'post_hit_taken' | 'post_evasion' | 'post_intercept'`).
  Implementation uses the object superset
  `triggerContext: { origin, intercepted?, outcome? }` (plan v2 review
  fix #11): `origin ∈ 'enemy_hit' | 'ally_action'`, `intercepted`
  marks a Hộ-substituted impact, `outcome ∈ 'taken' | 'evaded'` records
  the defender-side result. One context object serves both the counter
  payload swap (post-evasion heavy counter) and future node riders
  without enum-per-combination sprawl.
- **External ward contract.** `externalWard { sourceId, amount }` on
  `CombatEntity` is a protection-only pool: absorbs before the native
  ward, is exempt from `wardMax`/regen, never feeds `spendWard`, and its
  existence is bound to the granting marker instance — reconcile clears
  it on ANY removal path (expiry/dispel/replace), newest grant replaces
  wholesale. Hit results split `externalWardAbsorbed` /
  `nativeWardAbsorbed` (`wardAbsorbed` stays the total) so ward break
  only false-fires on the native pool; HUD renders it as its own
  "Hộ Thể" layer, not merged into the resource bar.
- **`durationPolicy`.** `BuffDefinition.durationPolicy?:
  'ailment_scaled' | 'fixed_holder_turns'` (default scaled) — holder-
  turn state buffs (Bất Tử, Tú Thế, Bách Ứng, Sơn Nhạc + marker defs)
  are exact turn counts immune to `ailmentResistPercent`/
  `ailmentDurationPercent`; `khiem_khich` stays scaled (enemy resist
  legitimately shortens Taunt).
- **`maxThe`.** `CombatEntity.maxThe` is baked at participant build
  (`MAX_THE + collectTheTuAnMechanicModifiers(player).maxTheBonus`);
  every Thế transaction clamps via `entity.maxThe ?? MAX_THE`. The
  Ẩn economy is node-adjustable through that single collector channel —
  never a `StatModifier`.
- **Basic Thế income.** Exactly one channel: the authored
  `theGainOnLandedCast` field on `THAM_THE` OR the `ung_the` marker's
  `gainOnBasicHit` — decided once at kit build, never both.
- **Reactive bypass.** Queue entries carry `executionKind`; a
  `reactive_bypass` declare skips ONLY the holder-turn lifecycle
  (buff/DoT/cooldown/regen ticks, round tracking) — it still produces a
  `TurnDeclaredAction` resolved by `applyActionImpact`, preserving the
  single declare→impact damage authority.
