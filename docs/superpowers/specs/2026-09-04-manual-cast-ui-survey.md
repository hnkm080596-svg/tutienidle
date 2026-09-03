# Manual Tap-to-Cast UI — Survey (no design, cutover-scope inventory)

Date: 2026-09-04
Status: Survey only — no design decisions locked, no plan follows. Same
treatment as the GameManager External Contract survey (2026-09-04,
phiên 6): manual casting only has meaning once wired into a real
`TurnBattleSystem` with skill loadout support, which doesn't exist yet
(Slice 1 is a headless core loop with no skills at all). This inventory
exists so the eventual UI work has a complete "what already exists /
what's missing" checklist.

## 1. `CombatSkillSlot.vue` — the visual slot, confirmed presentational-only

Its own header comment states this explicitly: *"component nhỏ DÙNG
CHUNG cho mọi renderer theo path (icon/cooldown mask/resource
cost/cast indicator), nhưng KHÔNG có nút bấm/hotkey/manual cast"* — no
click handler, no `@click` in the template, no emit. Props (all
presentational, `game/src/components/game/combat/hud/CombatSkillSlot.vue:21-58`):

```typescript
skill?: Skill
emptyLabel?: string
remaining: number        // cooldown OR cadence countdown, caller decides which
total: number
isMasked?: boolean
castRemaining?: number
castTotal?: number
isCasting?: boolean
resourceCost?: number
isInsufficientResource?: boolean
isOutOfRange?: boolean
isUnreleased?: boolean
isLocked?: boolean
tooltipOverride?: TooltipContent
```

**Reusable as-is once turn-based data is fed into it:** icon rendering
(`SlotView`), the countdown-mask visual, the cast-progress `Bar`, the
resource-cost/locked/unreleased/out-of-range styling states. This is a
dumb presentational component — nothing here assumes real-time
seconds specifically (`remaining`/`total` are just numbers used for a
mask-percentage ratio, unit-agnostic — matches the same "ratio math
doesn't care about units" finding already made for `TurnBuffSystem`'s
buff-duration presentation).

**Missing entirely, needs adding:** a click/tap handler and any
selected/pressed visual state — currently there is none, by design (it
was built for a real-time auto-battler with zero manual input).

## 2. `useCombatSkillPresentation.ts` + `CombatSkillPresentation.ts` — the state-derivation layer, entirely real-time

`buildLoadoutPresentation()` (`game/src/core/combat/CombatSkillPresentation.ts:96-181`)
computes each slot's `CombatSkillPresentationStateKind` — `'ready' |
'cadence' | 'cooldown' | 'casting' | 'blocked_resource' |
'out_of_range' | 'locked' | 'empty' | 'unreleased'` — by reading
real-time fields directly off live `Battle`/`CombatEntity`/`Skill`
state: `skill.remainingCooldownBySlot`, `battle.player.
skillCadenceRemainingBySlot`, `battle.player.castingSkillId`/
`castTimeRemaining`, `getAttackIntervalSeconds(attackSpeed)`. None of
this is turn-based-ready — `deriveState()`'s `'cadence'`/`'cooldown'`
branches specifically model "how many real seconds until this slot can
fire again," a concept the ATB turn system replaces with "has this
entity's gauge filled enough / is this skill's `chargeSteps` still
counting" (per the original design spec §3).

`useCombatSkillPresentation()` itself (`game/src/composables/
useCombatSkillPresentation.ts:28-81`) is thin Vue-reactivity glue: reads
`gameManager.getBattle()`, calls `buildLoadoutPresentation()`, exposes
`{ loadout, skillFor, tuLucState }` to the 3 HUD components
(Mortal/PhapTu/KiemTu). The composable's *shape* (a reactive `loadout`
array + a `skillFor` lookup) is reusable; its *implementation* is 100%
coupled to real-time `Battle` fields and needs a turn-based
equivalent reading from whatever `TurnBattleSystem` exposes once that
exists.

`tuLucState` (Bạt Kiếm channel progress, lines 61-79) is Kiếm Tu-route-specific,
tied to `setChannelTickSeconds`'s slider already flagged as undecided in
the GameManager External Contract survey (§3) — same open question,
not resolved here.

## 3. `RadialSkillSelector.vue` — an existing tap-to-choose UI pattern, but for loadout EDITING, not live casting

Found via blast-radius search: used by `SkillLoadoutStrip.vue`
(`game/src/components/panels/skill-path/SkillLoadoutStrip.vue`) — the
Skill Path Panel's "assign a skill to this loadout slot" flow, opened
by tapping a slot (`openSlot(index)` → shows `RadialSkillSelector` for
that slot, calls `gameManager.setSkillLoadoutSlot(...)` on choice).
This is a genuinely different interaction (pre-battle loadout
configuration, not "cast this skill right now mid-fight") but is the
closest existing precedent in the codebase for "tap something to pick
one option from a radial menu of skills" — worth knowing it exists
before designing the in-combat tap interaction, not because it's
directly reusable for combat.

## 4. What exists vs. what's missing — summary table

| Piece | Exists today | Reusable as-is | Needs turn-based rework |
|---|---|---|---|
| Slot visual (icon, mask, cast bar, resource badge) | `CombatSkillSlot.vue` | Yes — unit-agnostic ratio math | No |
| Click/tap handler on a slot | Nowhere | — | New, from scratch |
| Slot state derivation (ready/cadence/cooldown/...) | `CombatSkillPresentation.ts` | Shape only (`CombatSkillPresentationStateKind` union concept) | Yes — every branch reads real-seconds fields |
| Vue reactivity bridge | `useCombatSkillPresentation.ts` | Shape only (`{loadout, skillFor}`) | Yes — reads `Battle` fields that won't exist post-cutover |
| Tap-to-choose-from-a-set UI pattern | `RadialSkillSelector.vue` (loadout editing, not combat) | Pattern precedent only | Different use case, not directly reusable |
| Slot-6 Ultimate handling | N/A (Ultimate is currently a separate button, not a loadout slot) | No | New — per the already-locked "Ultimate is just a tagged skill in slot 6" decision (roadmap, phiên 4) |

## 5. What this survey deliberately does not do

- No proposed click-handler design, no interaction mockup, no visual
  companion session — per user decision (2026-09-04, phiên 7), this
  session stays at survey-only, matching how the GameManager External
  Contract item was handled just before this.
- No decision on what a turn-based `CombatSkillPresentationStateKind`
  union should look like (e.g., does "cadence" even make sense anymore,
  or does everything collapse into "ready" vs "not this entity's turn"?).
- No decision on the Bạt Kiếm channel-tick slider's turn-based fate
  (already flagged as open in the GameManager External Contract
  survey).
- No plan document. This inventory is the deliverable.
