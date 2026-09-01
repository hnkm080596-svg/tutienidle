# Unified Buff System (Buff + Ailment merge, source tracking) — Design

Status: approved by user, ready for implementation planning.

## Problem

Two parallel, near-duplicate systems represent "something temporary is
happening to this unit": `Buff` (`game/src/core/buff/`, stat modifiers only,
13 definitions) and `Ailment` (`game/src/core/ailment/`, DoT/CC/stat-modifier,
18 definitions, `sourceId`/`targetId` already tracked). They exist because
Ailment was built later to cover DoT/CC — mechanics Buff's flat
`modifiers: StatModifier[]` couldn't express — instead of extending Buff
itself. The result: `BuffManager`/`AilmentManager` (near-identical
stack/refresh/replace logic, duplicated), `BuffSystem`/`AilmentSystem`
(duplicated pool wrappers), `BuffRegistry`/`AilmentRegistry` (duplicated
definition stores), and every combat call site (`BattleSystem`,
`SkillEffectSystem`, `SkillActionRegistry`, `ReactionManager`,
`CombatSystem`) juggling two separate pools per entity
(`playerBuffs`+`playerAilments`, `BattleEnemy.buffs`+`BattleEnemy.ailments`).
The user's own framing: "cả 2 đều là buff, đốt lửa cũng là buff, mà tăng
stat cũng là buff, hành vi phụ thuộc vào cách triển khai của từng cái" —
burning and a stat boost are both just "a buff"; what differs is
implementation, not category.

Separately: no buff/ailment instance today records **who** granted it.
`Buff` has no source field at all; `Ailment.sourceId` exists but is
single-instance-per-id (`AilmentManager.get(id)` — a second source applying
the same ailment id collides with/overwrites the first via `stackMode`,
never coexists). This blocks two real needs surfaced while discussing the
Skill Trigger/Action Engine's `onKill`/`onDeath` triggers (Phase 2A, shipped
2026-09-01, see `docs/superpowers/plans/2026-08-31-skill-trigger-action-engine-phase2a.md`):
(1) an `onKill` binding needs to know **which killer's skill** to react on
(already solved for damage — `killIfDead(entity, killerId, skillContext)`
— but a *buff* like "explode for AOE damage when the source you're carrying
kills something" has nowhere to record that source), and (2) two different
attackers landing the same debuff on one target should not silently
overwrite each other's duration/stacks.

## Goals

- One system, one concept, called `Buff` (not "Ailment" — that name is
  retired). Behavior (stat modifier, damage-over-time, crowd-control, future
  kinds) is expressed as pluggable `effects: BuffEffect[]` processed by an
  exhaustive registry (`BUFF_EFFECT_REGISTRY`), mirroring the
  `SKILL_ACTION_REGISTRY` pattern already proven in the Skill Trigger/Action
  Engine — adding a new effect kind is one registration, not a new optional
  field bolted onto a shared struct.
- Every `Buff` instance carries `sourceId: string` (who granted it) — real,
  not the today's "last write tags a static field" version.
- Multiple sources can each hold their own independent instance of the same
  buff id on one target: storage keys on `(id, sourceId)`, not `id` alone.
  Two attackers' DoTs on the same target tick, stack, and expire
  independently.
- Any consumer that needs to act on "only the instance I granted" vs "every
  instance regardless of who granted it" can express that choice explicitly
  per call site (data-driven, not a hardcoded global rule) — see
  "Consume scope" below.
- No permanent dual representation: `Ailment`/`AilmentManager`/
  `AilmentSystem`/`AilmentRegistry`/`AilmentTypes` are deleted, not kept
  alongside as a legacy path. The user has explicitly waived migration-safety
  concerns for this ("đập đi xây lại" — rip out and rebuild, no need to keep
  a compatibility shim) since the whole combat core is still pre-launch.

## Non-goals (this spec)

- **Resource pools** (`currentHoaThe`/`currentMomentum`/`currentSwordIntent`/
  `currentKimThe`/`currentHuyetPha`/`currentBreakGauge`/`currentWard`) and
  **damage events** (`fireHit`/`applyDirectDamage`/`applyDotDamage`) getting
  a consistent `sourceId`/`skillId` tag — this is a real, related need (a
  future damage-meter / "who granted this resource" UI) but does not require
  multi-instance storage the way Buff does; it is a smaller, separate
  follow-up (Phase 2 of the broader source-tracking effort) once this spec's
  primitive has shipped and proven itself. Do not conflate the two.
- Not building a full scripting DSL for buff effects — `BuffEffect` stays a
  closed, exhaustive union like `SkillAction`, not an open-ended expression
  language.
- Not changing any skill/ailment's balance numbers — struct/storage rework
  only. Every existing Ailment definition's numbers port byte-for-byte into
  its new `Buff` definition's `effects[]`.
- Not addressing `onKill`/`onDeath`'s still-missing live production firing
  site (`killIfDead()`'s `skillContext`) — that is unblocked by this spec
  (a buff can now legitimately have a `sourceId` to react from), but wiring
  an actual "explode on kill" buff is follow-up content work, not part of
  this structural spec.

## Data model

### `Buff` (replaces both `Buff` and `Ailment`)

```ts
export type BuffPolarity = 'buff' | 'debuff'

export type BuffStackMode = 'stack' | 'refresh' | 'replace'

export interface Buff {
  id: string                    // definition id (was AilmentId | buff-def-id)
  sourceId: string               // who granted this instance — REAL now, every Buff has one
  targetId: string                // who is holding this instance
  polarity: BuffPolarity
  hidden?: boolean

  duration: number
  remainingTime: number
  stacks: number
  maxStacks?: number
  stackMode: BuffStackMode

  // Lifecycle chain (whole-instance replacement, not a per-effect concern —
  // ported verbatim from Ailment.convertsToId/convertsAfterContinuousSeconds).
  continuousSeconds: number
  convertsToId?: string
  convertsAfterContinuousSeconds?: number

  effects: BuffEffect[]
}
```

`category`/`AilmentCategory` (`'dot'|'cc'|'modifier'`) is retired as a
top-level field — it was doing double duty as "what does this do" and
implicitly "how many things can it do" (exactly one, today). `effects[]`
replaces it: a single `Buff` can carry more than one effect (e.g. a debuff
that both ticks damage AND lowers a stat), which the old model could not
express without contorting `category`.

### `BuffEffect` (new — the pluggable-behavior union)

```ts
export type BuffEffect =
  | StatModifierEffect
  | DotEffect
  | CcEffect
  | OnHitProcEffect

export interface StatModifierEffect {
  type: 'statModifier'
  stat: StatType
  percent?: number
  flat?: number
}

export interface DotEffect {
  type: 'dot'
  // Snapshot at apply time — same contract as Ailment.damagePerSecond today.
  damagePerSecond: number
  element?: ElementType | 'physical'
  // Ported verbatim from Ailment's poisonRoot* fields — Mộc Tu "Độc Căn"-
  // specific DoT scaling, meaningless to any other effect kind, so it lives
  // inside DotEffect rather than on the shared Buff envelope.
  poisonRootPercentPerStack?: number
  poisonRootMaxStacks?: number
  poisonRootThresholdBonusPercent?: number
}

export interface CcEffect {
  type: 'cc'
  ccEffect: 'stun' | 'freeze' | 'root'
}

export interface OnHitProcEffect {
  type: 'onHitProc'
  // Ported from Ailment.onHitChance/onHitAppliesAilmentId (Thổ Tu Thạch
  // Hóa) — renamed appliesBuffId since "ailment" no longer exists as a
  // distinct concept.
  chance: number
  appliesBuffId: string
}
```

Each `BuffEffect.type` gets exactly one executor in an exhaustive
`BUFF_EFFECT_REGISTRY: { [K in BuffEffect['type']]: BuffEffectExecutor<...> }`
(same mapped-type-is-exhaustive guarantee `SKILL_ACTION_REGISTRY` already
uses — a missing executor is a compile error). `statModifier` executor
produces a `StatModifier` for the stat pipeline; `dot` executor is invoked
from `Buff.update()`'s tick loop, calling `combatSystem.applyDotDamage()`
exactly as `AilmentSystem.update()` does today; `cc` executor sets the
stun/freeze/root query surface; `onHitProc` executor is invoked from the
renamed `rollOnHitEffects()`.

### `StatModifier.sourceType`

`ModifierSourceType`'s `'ailment'` member is retired — a `statModifier`
effect's generated `StatModifier.sourceType` becomes `'buff'` or `'debuff'`
per the owning `Buff.polarity`, matching how a pure stat-buff already tags
itself. This removes the last place where "ailment" survives as a distinct
concept in the stat pipeline.

## Storage: `BuffPool` (replaces `BuffManager` + `AilmentManager`)

Flat array (`Buff[]`), unchanged in spirit from today's `BuffManager`/
`AilmentManager` (small counts per entity, serialization is not a concern —
buffs are confirmed ephemeral, never persisted — see "Confirmed facts"
below) — only the keying changes, from `id` alone to the composite
`(id, sourceId)`:

```ts
export class BuffPool {
  private buffs: Buff[] = []

  getAllById(id: string): Buff[]                       // every source's instance of this id
  getFromSource(id: string, sourceId: string): Buff | undefined  // exactly one instance
  getAll(): Buff[]                                      // every instance, every id/source — update()/getActiveModifiers()
  hasAny(id: string): boolean
  add(buff: Buff): void
  removeInstance(id: string, sourceId: string): void
  removeAllById(id: string): void                       // for `scope: 'any'` consumers — see below
  clear(): void
}
```

## `BuffSystem` (replaces `BuffSystem` + `AilmentSystem`)

One class wraps one `BuffPool`, same 1:1 relationship `BuffSystem`/
`AilmentSystem` already have with their managers today (`Battle.playerBuffs`
becomes the only per-player pool; `BattleEnemy.buffs` the only per-enemy
pool — `playerAilments`/`BattleEnemy.ailments` are deleted).

- `apply(buff: Buff)` — looks up `getFromSource(buff.id, buff.sourceId)`
  (NOT `getAllById`) to decide new-instance vs stack/refresh/replace: two
  different sources applying the same id both get their own instance;
  stacking/refreshing only happens when the SAME source re-applies. This is
  the concrete mechanism behind "instances don't collide across sources."
- `update(deltaSeconds, target, combatSystem, registry?, resolveSource?)` —
  ports `AilmentSystem.update()`'s tick loop verbatim (continuousSeconds,
  convertsToId chain, DoT tick via the `dot` effect executor, expiry),
  but now iterates `pool.getAll()` (every source's every instance) instead
  of one pool with implicit single-instance-per-id.
- `getActiveModifiers(): StatModifier[]` — iterates every instance,
  every `statModifier` effect within it, tags `sourceId`/`sourceType` per
  instance (this already works correctly per-instance since `Ailment` does
  it today — multi-instance just means more instances contribute, not a
  logic change).
- `isStunned()`/`isFrozen()`/`isRooted()` — `pool.getAll().some(...)` over
  `cc` effects, unchanged in spirit.
- `rollOnHitEffects(source, target, registry)` — renamed from
  `AilmentSystem`'s method of the same name, now scans `onHitProc` effects.
- `getStacks(id): number` — **ambiguous under multi-instance**, needs a
  decision: sum across all sources, or require a `sourceId` parameter? See
  "Open question" below — flagged for the implementation plan to resolve
  with a concrete call-site audit (Detonate/`consumeForDamage` is the only
  known consumer today).

## Consume scope (data-driven, not a global rule)

`ConsumeForDamageAction` (`game/src/core/skill/SkillAction.ts`) gains a
`scope?: 'own' | 'any'` field, default `'own'`:

- `'own'` (default) — the executing skill's `consumeForDamage` action reads/
  removes only `pool.getFromSource(action.ailmentId, source.id)` — "my
  Detonate only bursts stacks I placed." Matches player-skill intuition.
- `'any'` — reads/removes via `pool.getAllById(action.ailmentId)` summed
  across every source, then `pool.removeAllById(...)`. Reserved for a
  designer who explicitly wants "drain every instance of this debuff
  regardless of who applied it" (the user's own example: more plausible for
  enemy/boss kit than player kit, but the engine should not forbid it).

This mirrors exactly how the Skill Trigger/Action Engine already pushes
per-skill choices into data (`SkillAction` fields) rather than hardcoding
global combat rules — consistent with the codebase's established pattern,
not a new principle.

## Registry & definitions

`BuffRegistry` (keeps its name — it already held only `Buff` objects
directly, no separate template type) absorbs every current `Ailment`
definition. `AilmentRegistry`/`AilmentTemplate` are deleted; the
distinction between "a registered `Buff` doubles as its own definition" vs
"an `AilmentTemplate` is a separate static-definition type from the runtime
`Ailment`" collapses to the `Buff` pattern (simpler — one less type per
definition). `game/src/data/ailment/ailments.ts`'s 18 entries port into
`game/src/data/buff/buffs.ts` (or a sibling file if 13+18=31 entries makes
one file unwieldy — implementation plan's call), each becoming a `Buff`
template with `effects: BuffEffect[]` replacing its old flat fields
byte-for-byte (e.g. `Ailment.damagePerSecond` → `effects: [{type:'dot',
damagePerSecond, ...}]`).

## Call site impact (representative, not exhaustive — 432 references across
64 files touch `Ailment*`/`targetAilments`/`ailmentRegistry` today; the
implementation plan will need to decompose this file-by-file rather than
attempt it as one task)

- **`Battle.ts`**: delete `playerAilments`/`BattleEnemy.ailments` fields;
  `playerBuffs`/`BattleEnemy.buffs` become the only pool per entity.
- **`BattleSystem.ts`**: `getAilmentsFor()` deleted, `getBuffsFor()` is the
  only accessor. `updateAilments()`'s tick loop merges into
  `BuffSystem.update()` (called once per entity per tick instead of twice).
  `isStunned()`/`isFrozen()`/`isRooted()`/`rollOnHitEffects()` call sites
  switch from `AilmentSystem` to `BuffSystem` methods of the same name.
- **`SkillEffectSystem.ts`**: `case 'ailment'` branch and `case 'buff'`/
  `case 'debuff'` branches converge on `ctx.targetBuffs.apply(...)`/
  `ctx.sourceBuffs.apply(...)` — `SkillEffectContext.targetAilments` field
  is deleted, `targetBuffs`/`sourceBuffs` absorb its former responsibility.
  This is the highest-traffic single file for the merge since it's still the
  ONLY path every non-Huy-Kiếm skill across all 6 combat paths goes through.
- **`SkillActionRegistry.ts`**: `applyAilment` executor deleted, folded into
  `applyBuff` (same executor now handles both — the only difference was ever
  which registry/pool it targeted, which no longer exists as a distinction).
  `ApplyAilmentAction`/`ApplyDebuffAction`/`ApplyBuffAction` in
  `SkillAction.ts` likely collapse toward fewer variants — implementation
  plan's call once it audits real usage differences (chance-roll behavior
  today only exists on `ApplyAilmentAction.chance`; if debuffs need the same
  roll-chance semantics, that's a natural unification opportunity, not
  forced by this spec).
- **`ReactionManager.ts`**: `checkAndTrigger()`'s `targetAilments:
  AilmentSystem` parameter becomes `targetBuffs: BuffSystem`;
  `getActiveIds()` (renamed or kept) and `getAilment(id)?.element` (renamed
  `getBuff(id)?...` — now ambiguous under multi-instance, needs the same
  "which source" decision as `getStacks()`, see below) update accordingly.
  The static `ELEMENT_REACTIONS` pairing table is untouched — it matches by
  id only, never reads `category`/`sourceId`.
- **`CombatSystem.ts`**: `applyDotDamage()`'s signature is untouched (already
  takes `sourceId`/`source`/`effectId` — no change needed here, this file
  was already ahead of the rest).

## Open questions for the implementation plan (not resolved here — need a
call-site audit this spec's author did not have budget to do exhaustively)

1. **`getStacks(id)`/`getAilment(id)`-equivalent under multi-instance**: does
   any real call site need "total stacks across every source" (sum), or does
   every real consumer actually want "stacks from one specific source"? Only
   known consumer is Detonate (`consumeForDamage`), which the "Consume scope"
   section above already resolves via `scope`. Audit whether any OTHER call
   site (tooltips? UI stack counters?) needs an aggregate view before
   deciding whether `BuffSystem` needs a convenience `getTotalStacks(id):
   number` on top of `getAllById`/`getFromSource`.
2. **`ApplyAilmentAction`/`ApplyDebuffAction`/`ApplyBuffAction` collapse**:
   flagged above — worth a real audit of every skill's current usage before
   deciding whether to merge into one `SkillAction` variant or keep them
   separate (chance-roll is `applyAilment`-only today).
3. **File split for `game/src/data/buff/buffs.ts`** (31 combined
   definitions) — single file vs split, purely a code-organization call.

## Testing

- `BuffPool.test.ts` (new, replaces `AilmentManager`-specific tests where
  they existed) — composite-key add/get/remove, multi-source coexistence.
- `BuffSystem.test.ts` — port every existing `AilmentSystem.test.ts` case
  (DoT tick, CC query, convertsToId chain, poisonRoot scaling, onHitProc)
  plus new multi-source cases: two sources' DoTs on one target tick/expire
  independently; same source re-applying stacks/refreshes/replaces per
  `stackMode` without affecting the other source's instance.
- `BUFF_EFFECT_REGISTRY` gets one parity test per effect type against the
  old `Ailment`-specific math (`statModifier`/`dot`/`cc`/`onHitProc`), same
  spirit as `SkillEffectParity.test.ts` did for the Skill engine.
- `ReactionManager.test.ts` (30 existing cases per the file's current size)
  — re-run against the renamed `BuffSystem` parameter, confirm zero behavior
  change (reaction table logic itself doesn't change).
- Full existing element test suites (Hỏa/Thủy/Mộc/Thổ/Kim Tu — the 5
  Ngũ Hành paths, all of which lean on Ailment today) must stay green
  throughout — these are the real regression surface, not new tests to add.

## Confirmed facts (from investigation, cited for the implementation plan)

- Buff/Ailment instances are 100% ephemeral — `Battle.ts:125`: "Runtime-only,
  KHÔNG persist (giống playerBuffs/playerAilments — Battle không lưu save)."
  `GameSave` interface has no buff/ailment field. No save-version bump, no
  migration code needed for this spec.
- `AilmentCategory` = `'dot'|'cc'|'modifier'`; `AilmentId` had 18 literal
  values (`bong, trung_doc, chay_mau, te_cong, hoai_tu, choang, dong_bang,
  lam_cham, han_khi, cuong_bao, suy_nhuoc, uy_ap, giap_ran, van_kiem_vu,
  thach_hoa, troi_chan, dung_nham, huyet_doc`) — every one needs a ported
  `Buff` definition with equivalent `effects[]`.
- `BuffRegistry`/`AilmentRegistry` both register at `game/src/App.vue` setup
  — the merge point for the unified registry.
