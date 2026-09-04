# Stat System — Turn-Based Conversion — Design Spec

Date: 2026-09-04
Status: Approved (design), plan not yet written

## 1. Motivation

This is the hard blocker flagged in
[Slice 6's design](2026-09-04-turn-battle-system-slice6-gamemanager-cutover-design.md)
§2 — `GameManager` cutover needs a real `speed` stat driving
`TurnBattleSystem`'s ATB gauge, and the user declined a temporary
`attackSpeed`-as-bridge shortcut. This spec is the deep-think session
the roadmap flagged as needed: review all 5 main stats (strength/
dexterity/intelligence/attunement/vitality) and every derived
secondary stat against turn-based semantics, not just speed in
isolation.

## 2. Survey: Current Formulas (`StatCalculator.ts`'s `deriveAttributeModifiers()`)

| Main stat | Derives | Rate/point |
|---|---|---|
| Strength | `attack` | +0.6 |
| Strength | `defense` | +0.4 |
| Dexterity | `attackSpeed` (%) | +0.0015 |
| Dexterity | `accuracyRating` | +1.5 |
| Dexterity | `evasionRate` | +1.0 |
| Dexterity | `criticalRate` (%) | +0.0005 |
| Intelligence | `cooldownReduction` (%) | +0.001 |
| Intelligence | `criticalDamage` (%) | +0.003 |
| Intelligence | `ailmentResistPercent` (%) | +0.002 |
| Vitality | `maxHp` | +8 |
| Vitality | `hpRegenPerSecond` | +0.1 |
| Vitality | `enduranceThreshold` | +1 |
| Attunement | 6× elemental `Power` (flat) | +0.5 each |
| Attunement | 6× elemental tagged Increased% | +0.001 each |

## 3. Per-Stat Turn-Based Fit Analysis

**Fits unchanged** (all resolve per-hit/instantly via
`CombatSystem.resolveActionHit()`/`calculateSkillBaseDamage()`, a
mechanism turn-based combat reuses as-is per Slice 1's design):
`attack`, `defense`, `accuracyRating`, `evasionRate`, `criticalRate`,
`criticalDamage`, `ailmentResistPercent` (already consumed directly by
`TurnBuffSystem`'s `AILMENT_RESIST_CAP` formula, Slice 3), `maxHp`,
`enduranceThreshold` (a per-hit damage threshold, not time-based),
every elemental `Power`/Increased% stat.

**Needs conversion:**
- `attackSpeed` → `speed` (§4) — real-time cadence stat becomes the
  ATB gauge-fill-rate stat `ActionGauge.advanceGauge()` already
  consumes (`actor.actionGauge += actor.speed * stepRate`).
- `hpRegenPerSecond` → `hpRegenPerTurn` — same numeric value (X/giây
  → X/lượt, matching the "no rebalance, unit-swap only" policy applied
  to every other seconds→turns conversion in this rework), ticking at
  the holder's own turn (same convention Slice 3/4 established for
  buff/resource ticks). **Not yet wired into `TurnBattleSystem`** —
  flagged as follow-up engine work, not scoped by this spec (§6).

**Retired, no replacement:**
- `cooldownReduction` — dropped entirely (locked decision, §5). Skill
  cooldowns are fixed integer turn counts; no stat reduces them.
  Faster `speed` already means more turns per unit of real time, which
  is the only "cooldown feels shorter" effect that survives — adding a
  second, separate cooldown-reduction formula on top would be
  redundant double-dipping on the same underlying lever.
- `castSpeedPercent` — already had zero real content granting it
  before this rework; retiring it drops nothing that existed.
- `movementSpeed` — already dead for the player (`StatBlock.ts`'s own
  comment: "tower cố định, không dùng movementSpeed cho bản thân
  nữa"); its only real dependents were enemy real-time grid movement,
  which doesn't exist in `TurnBattleSystem`.

## 4. `speed` Formula (locked, 2026-09-04)

`speed = 100 + dexterity × 0.15`. Source attribute stays Dexterity
(unchanged — Dexterity keeps its existing identity as the
"speed/accuracy/evasion/crit" stat). The formula itself is a pure unit
conversion from the old `attackSpeed = 1 + dexterity × 0.0015`, not a
rebalance: both the base (1 → 100) and the rate (0.0015 → 0.15) are
scaled by the same ×100 anchor, preserving the exact relative growth
curve. The ×100 anchor value itself is chosen to put `speed` on a
magnitude comparable to Honkai: Star Rail's SPD stat (~100-115
baseline) — a genre precedent for ATB gauge-fill-rate stats, not a new
balance decision (`ActionGauge.ts`'s `GAUGE_MAX = 1000` doesn't care
about `speed`'s absolute magnitude, only the ratio between actors'
speeds, so any consistent anchor works equally correctly; 100 is
chosen for readability/precedent, nothing more).

## 5. Intelligence's 2-Stat Gap (locked, 2026-09-04)

Losing `cooldownReduction` leaves Intelligence deriving only 2
secondary stats (`criticalDamage%`, `ailmentResistPercent`) instead of
3. **Decision: no replacement stat added.** Per YAGNI — inventing a new
mechanic solely to keep a per-attribute stat count symmetric is
speculative design with no concrete need behind it. Other main stats
already have uneven counts (Strength derives only 2). If this proves
to feel underweight during playtest, the fix is tuning
`criticalDamage`/`ailmentResistPercent`'s existing rates, not adding a
new stat — not decided now, tracked as a possible future tuning pass
only if it turns out to matter.

## 6. Scope

**In scope:**
- `StatTypes.ts`: remove `movementSpeed`, `castSpeedPercent`,
  `cooldownReduction` from `StatType`; rename `attackSpeed` → `speed`;
  rename `hpRegenPerSecond` → `hpRegenPerTurn`.
- `StatBlock.ts`'s `createBaseStats()`: remove the 3 retired stats'
  baseline entries; `speed: 100` replaces `attackSpeed: 1`;
  `hpRegenPerTurn: 0` replaces `hpRegenPerSecond: 0` (same value, 0).
- `StatCalculator.ts`'s `deriveAttributeModifiers()`: replace the
  `attackSpeed` percent-modifier line with a flat `speed` modifier
  (`dexterity * 0.15`); remove the `cooldownReduction` flat-modifier
  line entirely; rename the `hpRegenPerSecond` line's target stat to
  `hpRegenPerTurn` (same rate, +0.1/point).
- `StatMetadata.ts`: remove `cooldownReduction`/`castSpeedPercent`
  entries (no longer valid `StatType` keys once removed from
  `StatTypes.ts`, so their metadata entries become dead/invalid and
  must go too).
- Every other file referencing `attackSpeed`/`movementSpeed`/
  `castSpeedPercent`/`cooldownReduction`/`hpRegenPerSecond` by name
  (content grants: equipment affix `suffix_attack_speed`, 2 talent/
  node passives, several buffs pairing `movementSpeed`+`attackSpeed`,
  `ArtifactSystem.ts:439`, `CharacterPanel.vue`'s `combatPower`
  display formula, i18n label keys) — renamed to match, content values
  unchanged (same numbers, same grant mechanism, only the `StatType`
  key string changes). Full call-site inventory happens at plan-writing
  time via a real grep pass, not enumerated exhaustively here.

**Explicitly out of scope (deferred, tracked in roadmap):**
- Wiring `hpRegenPerTurn` into `TurnBattleSystem` (no regen-tick call
  site exists there yet — Slice 4's `ResourceTurnHook` wiring was
  generic/fixture-only, not HP-specific). Separate follow-up engine
  work, likely small, not scoped here.
- The 3 buffs pairing `movementSpeed`+`attackSpeed` (haste/slow
  effects) — need editing to drop the `movementSpeed` component and
  keep only the renamed `speed` component. Real content editing, not
  scoped here (already flagged in the original Slice 2 survey as
  "Equipment/Affix content ngoài 3 buff" — same 3 buffs).
- Enemy `speed` values — every `Enemy` in `Enemies.ts` needs a real
  `speed` stat value for turn order to make sense; currently enemies
  have no `attackSpeed`-equivalent content grant at all (only the
  player has affix/passive sources). Real content work, already listed
  in the roadmap's out-of-scope table.
- Any tuning pass on `criticalDamage`/`ailmentResistPercent` rates to
  compensate Intelligence's lost 3rd stat (§5) — not needed unless
  playtest says otherwise.

## 7. What This Spec Unblocks

Once implemented, `TurnBattleSystem` can read a real `speed` value from
`CombatEntity.stats` instead of requiring it passed by hand (as Slice
1-5 do via test fixtures) — the actual hard blocker on
[Slice 6](2026-09-04-turn-battle-system-slice6-gamemanager-cutover-design.md)'s
implementation plan.
