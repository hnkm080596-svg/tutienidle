# P6 — Early Progression Loop Closure

Spec: `docs/specs/2026-09-20-post-canonical-foundation-block-spec.md` §P6.
Depends on: P1–P5 (canonical path authority, build composition, combat
vertical slice, deterministic harness, balance baselines — all landed
and externally approved).

## Goal

Close and PROVE the early-game progression loop end-to-end through the
real systems — not fixtures, not UI mocks:

```
Combat → Reward → Resources/Progress → Character Growth
       → Stronger Build → Harder Combat
```

Scope per spec §P6: Pham Nhan -> transition into Luyen Khi; stat
progression; skill/path progression; Ngo Dao unlock/progression where
applicable; equipment/resource rewards; progression gates; persistence.
Truc Co and beyond is out of scope (foundation content exists but is a
later block).

Exit condition (spec verbatim): "A fresh player can progress through the
intended early-game loop without developer intervention or placeholder
progression state."

## Census findings (pre-plan)

Verified against source before planning:

- **Loop chain exists mechanically.** `createDefaultPlayer` → mortal
  realmLevel 1. Stages carry `requiredRealmId` + `requiredRealmLevel:
  floor` (ChapterStages.ts:99-104) — floor N unlocks at realmLevel N and
  sequential clear (`isStageUnlocked` requires the previous floor in
  `completedStageIds`). Mortal chapter = 10 floors; qi_refining chapter
  = 10 floors; foundation chapter exists.
- **Cultivation advances offline-capably** via `addCultivation` (idle
  tick, capped at `getRequiredCultivation`) → minor `breakthrough()`
  (realmLevel++, +1 attributePoint, overcharge pours). At maxLevel the
  major transition is never auto — mortal->qi_refining goes through the
  Initiation Ritual, all later realms through tribulation.
- **Ritual is real UI-wired content.** `QuanKhiPanel` →
  `realmAdvanceOps.chooseCultivationPath(pathId, wayId)` gated on
  `realmId==='mortal' && realmLevel>=CORE_REALM_LEVEL(12)`, reached via
  the Quan Khi tribulation win or the CharacterPanel entry; offers come
  from `listOfferableWays` (same predicate the ritual enforces).
- **Reward plumbing exists.** Enemy `rewards` → techniqueInsight /
  spiritStone / items; `RewardSystem` settles them; `skillInsight` feeds
  `purchaseNode`/`upgradeNode` (path/way/route/element/revealWhen-gated);
  `cultivationInsightAccumulator` converts online cultivation to insight
  when a talent grants `insight_per_cultivation`; spiritStone sinks into
  equipment refine/wash + alchemy.
- **Fresh-character creation is TWO phases, both progression-relevant.**
  `onCharacterCreated(payload)` (App.vue:620) writes `name`,
  `selectedTalentIds` (exactly 1 talent), and 5 allocated attribute
  points into `baseStats` — then `bootGame(true)` → `onNewCharacter`
  (App.vue:548) learns+equips `tu_linh_quyet`, learns `tram` and loads
  it into loadout slot 0, learns `linh_bao` + `huy_quyen`, creates
  starter buildings, grants the starter material pack
  (`mortal_wood_decade` 15, `mortal_ore_decade` 6), and enables
  production autoRestart. A bare `createDefaultPlayer()` — no talent,
  no creation attributes, no material pack — is NOT a valid
  production-created character and can materially change combat,
  cultivation, reward multipliers, and economy reachability. A fresh
  mortal's basic is `tram` resolved through `createMortalRuntime()`,
  NOT the generic physical basic.
- **Nondeterminism is wider than `Math.random`:** starter buildings use
  `crypto.randomUUID()` + `clock.nowSeconds()`; perfect-clear timing
  uses `Date.now()`; saves write `lastSavedAt = Date.now()`. Loop
  determinism needs a census of ALL nondeterministic sources with
  either owned injectable providers or explicit volatile-field
  normalization — no global monkeypatches.
- **Ngộ Đạo node reality:** `PHAP_TU_AN_NODES` is `[]` — the ngo_dao
  way has NO node branch; it progresses via its fixed kit/reaction
  machinery and is a hidden offer gated at `linh_bao` cast-level 3.
  Node catalogs exist for kiem_tu (`KIEM_TU_NODES`), the_tu
  (`THE_TU_NODES`), plus shared/realm-passive catalogs. "Purchase one
  node" is therefore per-way where-applicable evidence, not a uniform
  gate.
- **RNG authority gap:** `resolveDrops` accepts `rng?: () => number`
  but `BattleLootSystem` calls it WITHOUT rng → drop rolls fall back to
  `Math.random`. `rollVanDaoWaive` also calls `Math.random` inside
  `purchaseNode`. The loop cannot be deterministically committed while
  these ride the global RNG.
- **Save restore is app-boundary:** `restoreGameSession(player:
  GameSessionPlayerOwner, ...)` needs the Pinia-owner shape and applies
  production restore ordering — `core/simulation/**` must not import
  upward into `stores/`; restoring plain PlayerData by hand would not
  prove the real round-trip.
- **`runBattle` cannot be the progression primitive:** it
  `structuredClone`s the player into a disposable session — rewards,
  `completedStageIds`, bags, and insight land on the clone, never on a
  persistent player. The loop needs a persistent session whose real
  stage entry mutates the real state.
- **Known placeholder:** `canTriggerBreakthrough` returns false for
  foundation+ (explicit "product scope up to Truc Co" note) — inside
  early scope this is correct behavior, NOT a gap; the plan treats only
  the mortal->qi_refining loop as the gate surface.

## What "closed" must prove (decision)

The loop is closed only when a scripted fresh-player session — starting
from the REAL bootstrap (`onNewCharacter` semantics: `tu_linh_quyet`
equipped, `tram` in loadout slot 0, `linh_bao`/`huy_quyen` learned,
starter buildings) — driving REAL GameManager/public-writer seams
end-to-end, can:

1. Fight `mortal_dong_1` immediately (realmLevel 1, `tram` basic) and
   receive real rewards (insight/stone/items actually settled on the
   persistent player).
2. Cultivate -> breakthrough minor tiers -> each floor's realmLevel gate
   is reachable and the next floor unlocks on clear.
3. Earn real skillInsight inside the loop's income and perform at
   least one POSITIVE-COST insight spend producing a measurable build
   delta — per primary way, where node branches exist. The element
   root inside `selectPhapTuElement` is `insightCost: 0` and therefore
   cannot count: ngu_hanh's evidence is a cost-positive child such as
   `minor_fire_intensity` after the fire root; kiem_hien and the_tu_hien
   likewise spend on a cost-positive way node (e.g. the `minor_cuong_*`
   children under `cuong_chien`). For ngo_dao — no node branch exists —
   the evidence is offer-eligibility + fixed-kit + reaction
   progression, never a fabricated node requirement.
4. Reach realmLevel 12, win the Quan Khi tribulation via the real
   outcome seam, perform the ritual, and emerge qi_refining with a
   functional kit (mustCast evidence on a real qi_refining floor — the
   P5 kit surface, not a stub).
5. Spend spiritStone/equipment rewards on a real sink that changes
   combat stats (equipment equip/refine or alchemy — whichever exists
   for a fresh player's inventory).
6. Save, restore through the real app-boundary path
   (`buildGameSave` → JSON → validate → `restoreGameSession`), and
   continue the loop without loss (persistence is part of the spec,
   not a nicety).
7. Clear `qi_refining_forest` (floor 1 of chapter 2) — the loop's
   "harder combat" endpoint — with a build reachable by steps 1-6.

The loop runs per primary way (the P5 primary-row precedent): hien,
ngu_hanh, the_tu_hien. Alternate ways (ngo_dao, ung_the, ngu) are
reported diagnostics where reachable, never gate rows — their offer
gates (tram/linh_bao/huy_quyen Lv3) sit far outside the early loop.

Every transition either passes or is recorded as a named gap with owner
and fix — the phase is not green on a shrug.

## Harness design (decision)

Two layers, keeping the boundary rules intact:

**Layer 1 — framework-free core** under `src/core/simulation/earlygame/`
(same leaf rule as `benchmark/`): zero gameplay-path imports, tests-only
consumers.

- `EarlyGameSession` — owns ONE `PlayerData` + ONE `GameManager` for the
  whole run. `runBattle()` is NOT the battle primitive: it clones the
  player into a disposable session, so rewards/`completedStageIds`/
  insight would never persist. Instead the deterministic battle driver
  (seeded clock/RNG/terminal stepping) is extracted from the P4 harness
  into a reusable unit that operates on a battle the session itself
  started through its real stage-entry seam — rewards settle on the
  persistent player.
- `LoopStep[]` — scripted steps are data (fight stage X, cultivate
  until breakthroughable, purchase node Y, ...), each step's
  pre/poststate assertable and the whole trace inspectable.
- Determinism: cultivation advances via `cultivateTick(player,
  deltaSeconds, deps)` — the production tick seam (see the Cultivation
  seam decision), never raw `addCultivation` from harness code. M0
  censuses ALL
  nondeterministic sources on the loop path — `Math.random` consumers
  (drop rolls, Van Dao waive, spawn/crit/AI picks) AND clock/id sources
  (`crypto.randomUUID`, `clock.nowSeconds`, `Date.now` for
  perfect-clear/`lastSavedAt`). Where a consumer lacks an injectable
  seam, M2 plumbs a session-owned seeded RNG / fixed clock / fixed id
  provider through the PRODUCTION owner — the harness injects them at
  session construction. Fields that are legitimately volatile
  (`lastSavedAt`) are normalized out of regression comparisons by
  declaration, not patched. No global monkeypatching anywhere.
- `LoopReport` per step: gate checks (unlock state, affordability,
  rewards settled), before/after evidence, named gaps. Report-only
  diagnostics vs gate failures follow the P5 precedent.

**Layer 2 — save/app boundary adapter** at the integration-test level
(`tests/` or the services/save boundary, NOT inside `core/simulation/`):
`buildGameSave` → JSON round-trip → `saveShapeValidation` → fresh
Pinia + fresh `GameManager` → `restoreGameSession` → hand the restored
session back to the same `LoopStep[]` continuation. This is the only
way the persistence criterion is honest — manual PlayerData copying
would prove a different system than production restores.

**Bootstrap seam (decision):** the complete production creation
transaction is two phases — creation payload (name, 1 talent, 5
allocated attribute points via `onCharacterCreated` semantics) then
starter bootstrap (`onNewCharacter` semantics). Both phases' combat/
progression-relevant parts are extracted into a canonical framework-
neutral op living in PRODUCTION-owned space (e.g.
`core/player/NewCharacterBootstrap.ts` or `core/game/` — never under
`core/simulation/`; production App.vue must not depend on tooling).
`App.vue` and `EarlyGameSession` both consume it.

Validation boundary: the op accepts an ALREADY-VALID creation profile —
creation validation (`validateDraft`) stays at the service/app
boundary where it lives; `core/simulation/**` never imports
`services/**`. The P6 setup validates the pinned profile with the
canonical pure validation semantics at the integration layer before
handing it to `EarlyGameSession`.

**Pinned creation profile (fixed in this plan, not chosen at
implementation time):**
`{ name: 'P6 Loop Probe', talentIds: ['hap_linh'],
attributes: { strength: 2, dexterity: 0, intelligence: 0,
attunement: 0, vitality: 3 } }`. Rationale: `hap_linh` (Hấp Linh) is a
creation-pool talent (weight 55) whose only effect is in-battle
lifesteal below 50% HP — it subsidizes NONE of the gate surfaces
(cultivation speed, insight income, node costs, drop tables, sink
affordability, tribulation difficulty). Deliberately NOT `van_dao`
(×2 battle insight + free-cost node rolls), `ngo_dao` (cultivation→
insight), `pham_cot`/`ho_tich_bat_phat`/`hai_na` (cultivation speed/
ramp/overflow), `loi_kiep` (tribulation), or crafting talents (sink
affordability). The positive-cost node proof must additionally show an
ACTUAL `skillInsight` decrease — purchasing a node whose catalog cost
is >0 but rolled free via Van Dao would not prove the sink.

**Cultivation seam (decision):** loop cultivation drives the PRODUCTION
progression path, not raw `addCultivation`. The Pinia action
`stores/player.ts::cultivate(deltaSeconds)` applies cultivation-speed
talents, the per-realm-level ramp, timed Tu Linh Tran modifiers,
`totalCultivationGained`, and `accrueCultivationInsight` — raw
`addCultivation` is the low-level clamped writer only. M1 extracts a
framework-neutral cultivation-tick op (e.g.
`cultivateTick(player, deltaSeconds, deps)` in `core/cultivation/`)
that owns this chain; `stores/player.ts::cultivate` and
`EarlyGameSession` both call it with explicit delta/time. Timed-
modifier reads (`Date.now()` inside `getActiveCultivationSpeedPercent`)
resolve through the session's injected clock.

## What P6 is NOT

- No new combat content, stages, enemies, or skills (spec ordering
  constraint — content passes come after the foundation block).
- No UI work beyond verifying existing wiring seams; the ritual panel
  and stage select already exist.
- No re-architecture — gaps are fixed at the smallest coherent
  responsibility; a broken loop link is a defect report first, a fix
  second.
- No foundation+ content gates.

## Milestones

### M0 — Loop trace + gap census (this plan's first output)

A scripted probe through the real systems (temporary harness test)
answering: does each step above actually work TODAY, and where exactly
does it break? The census MUST also inventory: (a) the complete
creation transaction — `onCharacterCreated` payload semantics AND
`onNewCharacter` bootstrap — split into combat/progression-relevant vs
visual init; (b) EVERY nondeterministic source on the loop path — RNG
consumers (drop rolls, Van Dao waive, spawn/crit/AI picks), identity
sources (`crypto.randomUUID`), and wall-clock sources
(`clock.nowSeconds`, `Date.now` for perfect-clear timing/`lastSavedAt`)
— with an owner/seam/normalization decision recorded per source;
(c) the real stage-entry seam a persistent session calls
(`startStage`/battle entry) and whether the deterministic drive can
attach to it. Deliverable:
`docs/architecture/2026-09-23-early-progression-loop-inventory.md` —
the step-by-step trace, every gate encountered, every placeholder or
dead-end found, owner + proposed fix per gap. No production changes.

### M1 — Persistent session + step primitives

`src/core/simulation/earlygame/` module: `EarlyGameSession` (one player
+ one GameManager), the extracted deterministic battle driver operating
on session-started battles, `LoopStep` driver, `LoopReport`. The shared
bootstrap op lands in production space (`core/player`/`core/game`) per
the seam decision above — `earlygame/` only consumes it. Unit tests
per step primitive.

### M2 — Gap fixes + RNG seam + economy sanity

Fix the M0 gap list (bounded: smallest coherent responsibility, owner-
respected). Add the session-owned seeded RNG through production seams
where the census found uninjectable consumers. Economy check via the
balance-check approach: insight income vs node costs reachable inside
the loop's real reward stream; spiritStone sink affordability; stage
difficulty vs a P5-style baseline build on the REAL floors (not
synthetic fixtures). Any tuning touches owned data only, with the
tuning-bounds rule from P5.

### M3 — Closure report + gates

`docs/progression/` closure report (loop trace, evidence per step, gap
resolutions, remaining limitations) + the Layer-2 save/app round-trip
integration test, regression tests committed (the loop run becomes a
suite, not a one-off), docs sync, `npm run verify`, P18 OCR, P4
adversarial QA, P5 sequential passes, external review loop.

## Verification

- Quick: `npm run type-check` + `npx vitest run src/core/simulation`
  (+ touched scopes).
- Full: `npm run verify` (milestone-class work).
- The loop suite itself is the new evidence: deterministic, seeded,
  committed expectations where stable (fingerprint precedent from P5).

## Risks / open questions for review

1. Tribulation seam: Quan Khi goes through `TribulationOutcomeService` /
   director — the harness must drive the real outcome path (win ->
   realm advance offer), not shortcut the ritual. If the real seam is
   UI-bound, the plan extracts a minimal headless seam at the service
   boundary rather than bypassing it.
2. Save round-trip fidelity: the loop must prove the canonical path
   state (P1), node levels, completedStageIds, currencies, and the
   in-progress cultivation all survive — the Layer-2 adapter asserts
   each field family explicitly across the real
   `buildGameSave`/`restoreGameSession` path.
3. "No developer intervention" is operationalized as: every step uses
   the same public seams the UI calls — a step that requires a debug
   hook IS a gap.
4. Deterministic-drive extraction: the P4 drive loop currently lives
   inside `runBattle`'s disposable-session shape. M1 extracts it so the
   SAME code drives both the disposable benchmark battles and the
   persistent-session battles — one driver, two session hosts; no
   second copy of the stepping loop.
