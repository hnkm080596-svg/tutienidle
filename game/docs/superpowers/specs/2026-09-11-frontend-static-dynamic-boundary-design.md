# Frontend Static/Dynamic Boundary — Vue Shell, Phaser Region

**Status:** **Accepted** (product owner, 2026-09-11)
**Date:** 2026-09-11
**Decided by:** user, in brainstorm, 2026-09-11
**Reviewed by:** user, 2026-09-11, over two rounds. Thirteen claims were put up
for verification across the two rounds; all were measured against the tree, two
were imprecise and corrected, and three dispositions reversed as a result — see
§11 and §11.1.
**Builds on:** `docs/architecture/mission-0-architecture-audit-2026-09-08.md`
§11, §13, §14, §16, §17; `2026-09-08-r5-combat-runtime-presentation-boundary-design.md`
**Adopts from:** `docs/superpowers/specs/VUE + Phaser checklist.md` v1.1
(partially — see §9)

---

## 1. Scope, and what this is deliberately not

This spec settles one question: **which layer owns what on the frontend**, and
gives the answer three mechanisms and a set of executable checks.

It is **not** a new constitution. Mission 0 §17 examined exactly that idea and
rejected it:

> Most findings already violate existing A2/A3/A7/A9/A11/A12 or P17; another
> general prohibition would not have prevented them. […] Do not duplicate the
> whole constitution into more files. The findings require better contracts and
> executable checks, not those prohibitions.

That judgment is accepted here. Of the rules in §3, four are restatements of
invariants that already exist and already bind; they appear only so the frontend
boundary can be read in one place. **Exactly one rule is new** (§3.5, pointer
handling and shared geometry), and it is new because it records a decision only
the product owner could make.

Out of scope, with its own spec to come: the per-clip animation metadata
contract, sprite anchor and scale geometry, and animation/impact timing. Those
depend on this one and are described in §8.

---

## 2. The axis: static and dynamic

The checklist divides the frontend by **widget type** — an HP bar belongs to
Vue, a floating damage number belongs to Phaser. That axis does not survive
contact with this repository, because it makes the Formation preview panel
(a Vue panel that constructs its own `Phaser.Game`) look like a violation
requiring justification.

The real axis is **static and dynamic**:

| Layer | Owns | Examples |
|---|---|---|
| Vue | Static UI | Layout, chrome, primitives, panels, every control that takes input |
| Phaser | Dynamic UI | Continuous motion: sprite animation, VFX, parallax backdrops, particle streams |

A **static shell hosting a dynamic region is the standard composition**, not an
exception. Combat Scene is one instance of it (DOM chrome over a canvas);
Formation preview is another (a Vue grid over a preview canvas). More will
follow. Mission 0 §13 already anticipated the consequence:

> Formation preview has a separate `Phaser.Game`, so it needs a separate,
> generation-owned lifecycle and measured projection. Reusing a renderer does
> not make the hosting lifecycle or DOM hit geometry automatically correct.

The design in §5 is the answer to that sentence.

### 2.1 Four layers, not three

The checklist describes three layers meeting at the Core. This repository has
four, and the fourth is where the frontend boundary actually lives:

| Layer | Directory | Role |
|---|---|---|
| Core | `src/core/` | Logic. Runs headless, with no screen. |
| Vue | `src/components/`, `src/composables/`, `src/stores/` | Static UI on the DOM. |
| Phaser | `src/game/` | Dynamic UI on a canvas. |
| **Presentation** | `src/presentation/` | **Where the other three meet.** Coordinator, adapters, asset lifecycle. |

Vue and Phaser do not meet at the Core. They meet at `presentation/`, which is
where `GamePresentationCoordinator` already owns route and readiness authority.

### 2.2 Geometry is a presentation asset, not a Phaser asset

A consequence of §2.1 that is easy to miss: **anything both layers must agree
about lives in `presentation/`, not in the layer that happens to use it first.**

Grid projection is the case at hand. `BattleGridProjection` sits in
`src/game/support/` because the canvas needed it first. But the canvas draws with
it and the DOM must hit-test with it, so under §3.4 (Vue and Phaser do not call
each other directly) it cannot stay there — a DOM overlay importing from
`src/game/` would be the static layer reaching into the dynamic one.

The move is cheap, which is worth stating because it removes the usual excuse for
leaving such things where they are. Measured: `BattleGridProjection.ts` imports
exactly two things — `@/core/battle/BattleGrid` (downward, legal) and
`./BattlefieldRenderMode`, which imports **nothing at all**. Neither file imports
`phaser`. They are pure mathematics. Relocating them is a file move with no
decoupling work (§6/V7).

The same test applies to anything added later: if both layers must agree about
it, it is a presentation asset. Backgrounds shared between Combat and Formation
are the next instance (§5.4).

---

## 3. The rules

### 3.1 The static shell owns the dynamic region's lifecycle — *existing (A3/A5)*

A dynamic region is constructed, sized, and destroyed by the static shell that
hosts it. Phaser does not appear anywhere on its own. Multiple concurrent
regions are legitimate; each has exactly one declared host, and each host owns
one generation (§5.2).

"Owns the lifecycle" means the shell holds a **`DynamicRegion` handle**, not a
scene object and not a `Phaser.Game`. §3.6 defines that handle as the only
surface on which the shell may call a method at all.

### 3.2 `src/game/` imports neither `vue` nor `@/stores/` — *existing (A6)*

Dependencies point downward. The dynamic layer receives what it needs through
the declared gate (§4); it does not reach sideways into the static layer's
state management.

### 3.3 Core knows neither Vue nor Phaser — *existing (A6)*

Already guarded by `game/tests/architecture/coreImportDirection.test.ts` on the
`r14-architecture-enforcement` branch. (All guard paths in this spec are
repo-root-relative: `game/tests/architecture/`, which is `tests/architecture/`
relative to the `game/` package that runs vitest.)

### 3.4 Phaser reports; it does not decide — *existing (A7 + R5 §2.A3)*

The dynamic layer may tell the domain that a visual step finished. It may never
decide an outcome, select a target, or gate progression. R5 already fixed the
token contract for the three signals that exist today
(`acknowledgeTurnReady`, `acknowledgeActionImpact`, `acknowledgeActionComplete`),
and A7 already forbids presentation-gated progression.

What this spec adds is only that **the list is closed and typed** (§4.3): a new
signal from the dynamic layer to the domain requires a declared addition, not an
ad-hoc method on a structurally-typed reference.

There is one residue worth closing while the gate is built. R5's AR-20 fix is
live at runtime: all three acknowledgments reject a missing token, at
`CombatAnimationRuntime.ts:216-218`, `:249-251` and `:306-308`
(`if (!token || token !== this.playbackToken) return`). But the signatures are
still `acknowledge*(token?: string)`, and the inline type at
`CombatScene.ts:547-553` mirrors that optionality. So a caller that omits the
token **compiles cleanly and silently does nothing** — the turn simply never
advances, with no error anywhere. The runtime is safe; the type is not. R5 §3.3
specified `token: string`, mandatory. Making it mandatory belongs to §4.3's
declared `DomainCommandPort`.

### 3.5 Pointer is handled where it lands; shared geometry goes through the bridge — **NEW**

The rule is not "the static layer receives every pointer event". An earlier draft
said that, and it was wrong in a way worth recording: it made the one canvas-side
interaction in the tree (a tooltip on a world-anchored icon) a violation, when
handling it canvas-side is the *correct* choice — that is where the geometry is.

The rule is:

> **Whichever layer receives a pointer event handles it. What neither layer may
> do is guess the other's geometry.** Any DOM element positioned by world
> coordinates, and any canvas hit-test that must agree with DOM layout, goes
> through the projection bridge (§4.4) — never through a hand-copied constant, a
> parallel grid, or an assumption that two independently-built layouts happen to
> line up.

Default placement still follows §2: controls, forms, panels and lists are static
UI and belong to the DOM. The clause that does the work is the second one, and it
is not hypothetical — §6/V8 documents a live defect that exists precisely because
a DOM grid and a canvas grid were built independently and assumed to match.

Two facts about where the repository stands today:

- Phaser takes pointer input at exactly **one site** in the whole tree:
  `src/game/scenes/combat/combat-vfx-spawner.ts:242-245` — a status icon with
  `setInteractive` plus three handlers (`pointerover` and `pointerout` drive a
  tooltip, `pointerdown` acts on the status). One site, four handlers; it is a
  real interactive affordance, not an incidental call.
- `BattleGridProjection.screenToGridUnclamped()` and `containsScreenPoint()` —
  the machinery for converting a screen point back to a grid cell — have
  **no callers** outside their own module and its tests. They were built for the
  opposite model and then left unused.
- Formation preview already works this way: a Vue grid takes the clicks, the
  Phaser canvas draws below it — and the two do **not** agree geometrically,
  which is the defect at §6/V8.

**Consequence.** The canvas-side tooltip is legal under this rule as written
(§6/V3). The unused projection inverse is not dead code — it is the *ground
truth* a DOM overlay needs in order to hit-test against what the canvas actually
drew (§6/V6). Both dispositions changed once the Formation grid was measured;
the first draft had them backwards.

### 3.6 Shell and region meet on three surfaces, and no others — **NEW**

§3.1 says the static shell owns the dynamic region's lifecycle, so it must hold
*something*. §3.4 says Vue and Phaser do not call each other directly. Those two
read as a contradiction, and today's code sits inside it: `TranPhapPanel.vue`
holds a `TranPhapCombatPreviewScene` and calls `syncAssignments()` on it.

The contradiction dissolves once "holds something" is made precise. There are
exactly three surfaces, each with its own mechanism:

| Surface | Mechanism | Direction |
|---|---|---|
| **Lifecycle** | The shell holds a `DynamicRegion` handle — `generation`, `bootError`, `destroy()`. Never a scene or a `Phaser.Game`. | shell → region |
| **State (push)** | Scoped events on the EventBus. Every payload carries a `regionId`; a region ignores what is not its own. | shell/core → region |
| **Geometry** | Pure functions under `presentation/geometry/`. Both sides import them; neither asks the other. | shared |

**No direct method call between shell and region**, and no `RegionCommandPort`.
When a new interaction is needed, it is a new event or a new geometry function —
never a new method. This is the mirror of §3.4: *Phaser reports, it does not
decide; the shell commands by event, it does not invoke.*

The asymmetry with `DomainCommandPort` (§4.3) is deliberate, not an oversight.
That port has five members because Phaser **asks and needs an answer**. The shell
asks the region nothing; it commands, or it pushes state. Making the two sides
symmetric in form would make them asymmetric in meaning.

#### 3.6.1 Push is by event; pull is by the gate

State reaches a region two ways, and conflating them produces a race:

- **Push** — a change that happens while the region is alive arrives as a scoped
  event. Fire-and-forget.
- **Pull** — the state that already existed when the region mounted is **read by
  the region during `create()`, after it has subscribed**. Not re-emitted by the
  shell.

The pull path is not new and must not be replaced. `CombatScene` already does
exactly this: `gameManager.getCombatPresentationSnapshot(sessionId)` on create,
with a `lastBattlePositionsSnapshot` fallback carrying a two-second freshness
window for standalone tests (`CombatScene.ts:758-771`). A region that mounts late
catches up by reading, not by being told again.

**A `REGION_READY` handshake is therefore rejected**, though it was proposed and
is a reasonable design in the abstract. It would be a second mechanism for a
problem this repository has already solved, in production, with a solution that
has no race to reason about: the region subscribes, then reads, both inside
`create()`. Mission 0 §17's finding applies directly — the need is better
contracts, not more mechanisms.

#### 3.6.2 What the geometry clause requires

"Both sides import the pure function" is only safe while both sides derive the
geometry from the **same declared parameters**. A projection is pure, but
`resize()` makes an *instance* stateful, so two independently-constructed
instances agree only as long as their inputs do.

This is why §6/V9 gives the Formation canvas size one owner. For Formation it
holds trivially: the size is fixed and nothing resizes it. For a region whose
viewport is dynamic — Combat, whose projection is resized as the window and the
DOM insets change — a shell-side copy would need the same viewport including
insets, and that is not yet a shared declared value. **Until it is, a
dynamic-viewport region's shell must not construct its own projection instance.**
Formation is unblocked today; Combat is not, and no consumer needs it to be.

---

## 4. Mechanism 1 — the typed presentation gate

### 4.1 The problem, measured

The dynamic layer receives everything through Phaser's `registry`, used as an
untyped service locator. Measured on the tree: **28 registry sites** outside
tests, of which **22 are reads**, across **8 distinct keys**.

| Key | Carries | Type | Required? |
|---|---|---|---|
| `gameManager` | Domain orchestrator reference | `DomainCommandPort` (§4.3, new) | required |
| `sceneAdapter` | Phaser scene adapter | `RendererPort` | required |
| `eventBus` | Core event bus | `EventBus` | required |
| `bundleManager` | Asset bundle manager | `AssetPort` | required |
| `battlefieldGeometry` | Grid geometry published *by* the scene | `BattlefieldGeometry` (new; the shape written at `CombatScene.ts:1090`) | required once published |
| `playerVisualProfileId` | Which player visual profile is current | `PlayerVisualProfileId` | optional (falls back) |
| `lastBattlePositionsSnapshot` | Latest battle positions | `BattlePositionsEvent` | optional |
| `KIEM_BAR_READER_KEY` | Kiếm-bar reader function | `KiemBarReader` | optional |

**11 of the 22 reads carry an `as { … }` cast.** A rename on the domain side
produces no type error anywhere; it fails at runtime, inside a scene, usually as
a silently missing visual.

The required/optional column is not decoration — it drives §4.2's two accessors.
Only `BattlefieldGeometry` and `DomainCommandPort` are new declarations; the
other six types already exist and are merely being named at the boundary.

This is the gate through which every positioning and identity fact for the
visual layer already travels — and through which the animation metadata contract
(§8) will travel next. It is repaired before more is poured through it.

### 4.2 Design

One module declares the gate: the key set, each key's type, and the only
accessors.

```ts
// src/presentation/gate/PresentationGate.ts  (name provisional)

export interface PresentationGateContents {
  gameManager: DomainCommandPort
  sceneAdapter: RendererPort
  eventBus: EventBus
  bundleManager: AssetPort
  playerVisualProfileId: PlayerVisualProfileId
  lastBattlePositionsSnapshot: BattlePositionsEvent | undefined
  battlefieldGeometry: BattlefieldGeometry
  kiemBarReader: KiemBarReader | undefined
}

/**
 * Required keys: absence is a wiring bug, not a runtime condition. Throws, so
 * the failure surfaces where the region was seeded rather than three frames
 * later as a missing sprite.
 */
export function readRequiredGate<K extends RequiredGateKey>(
  registry: Phaser.Data.DataManager,
  key: K,
): PresentationGateContents[K]

/** Optional keys: absence is a legitimate state with a defined fallback. */
export function readOptionalGate<K extends OptionalGateKey>(
  registry: Phaser.Data.DataManager,
  key: K,
): PresentationGateContents[K] | undefined

export function writeGate<K extends keyof PresentationGateContents>(
  registry: Phaser.Data.DataManager,
  key: K,
  value: PresentationGateContents[K],
): void
```

**Why two accessors, not one.** A single `readGate` returning `T | undefined`
forces every caller to handle absence, including for keys whose absence means
the region was never wired — `gameManager`, `sceneAdapter`, `eventBus`,
`bundleManager`. That converts a seed-time wiring bug into a slow, silent
read-time failure, which is the exact class of defect this gate exists to kill.
`RequiredGateKey` and `OptionalGateKey` partition the key union, so the compiler
picks the right accessor and neither can be used for the other's keys.

**Seed-time validation.** §5's host seeds the gate before the first scene is
constructed and asserts that every `RequiredGateKey` is present. A region that
cannot be fully seeded does not boot; it reports through the region's local
error boundary (§5.2) instead of booting half-wired.

Phaser's `registry` remains the transport — this is not a rewrite of how data
travels, only of how it is declared. Every `registry.get('x') as {…}` becomes
`readGate(registry, 'x')`, and the cast disappears because the type is declared
once.

Two directions share the gate and that is correct: `battlefieldGeometry` is
published *by* the scene for the shell to read. The gate is bidirectional by
design; §3.4 governs what may flow, not which way.

### 4.3 The closed signal list

`gameManager` is typed as a `DomainCommandPort` — a declared interface, not the
structural `{ acknowledgeTurnReady: …; … }` shape currently inlined at
`CombatScene.ts:547-553`. Under §3.4 that interface is the complete list of what
the dynamic layer may ask of the domain.

"Closed" is only a claim unless the list is written down, so here it is in full.
This is the entire contract as of 2026-09-11:

```ts
export interface DomainCommandPort {
  /** The visual step that leads a turn has finished playing. */
  acknowledgeTurnReady(token: string): void
  /** The action's impact frame has been reached. */
  acknowledgeActionImpact(token: string): void
  /** The action's playback, including its VFX, has fully finished. */
  acknowledgeActionComplete(token: string): void

  /** The token the domain currently expects; the scene echoes it back. */
  getPendingPlaybackToken(): string | null

  /** Whether a renderer is attached and drawing. Not a decision, a fact. */
  setPresentationActive(active: boolean): void
}
```

Five members, three of which are the R5 acknowledgment triple. Tokens are
**mandatory** here, closing the residue described in §3.4 — the runtime already
rejects a missing token; this makes the compiler reject it too.

**Amendment process.** Adding a member is a three-part edit, deliberately
inconvenient in proportion to what it permits:

1. Edit this interface, in this named file.
2. Record the addition in this spec's §4.3 and state why the existing members
   could not carry it.
3. Confirm the new member reports rather than decides (§3.4/A7). A member that
   selects an outcome, picks a target, or gates progression is refused — the
   correct fix for such a need is a domain command the static layer issues, not
   a new signal from the dynamic layer.

There is no approval ceremony beyond normal review. The constraint is that the
edit is visible and argued, rather than a method appearing on a structural type
that nobody declared.

### 4.4 The projection bridge

§3.5 says shared geometry goes through a bridge. This is that bridge, and it is
deliberately thin — the mathematics already exists and is already correct; what
is missing is a *declared way for the static layer to ask*.

```ts
// src/presentation/geometry/ProjectionBridge.ts  (name provisional)

export interface ProjectionBridge {
  /** Grid cell → screen. Returns the FOOT POINT plus the depth scale. */
  gridToScreen(grid: GridPosition): ScreenPoint & { scale: number }

  /** Screen → grid cell. null when the point is off the playable surface. */
  screenToGridUnclamped(screen: ScreenPoint): GridPosition | null

  /** Is this screen point on the playable surface at all? */
  containsScreenPoint(screen: ScreenPoint): boolean
}

export function createProjectionBridge(
  projection: BattleGridProjection,
): ProjectionBridge
```

**Both directions already exist and are already used.** This is not new maths:

- `gridToScreen` is declared at `BattleGridProjection.ts:153`, implemented in both
  projections (`:279` flat, `:396` perspective), and called ten-plus times in
  production by `combat-grid-view.ts` to draw grid lines, place sprites and apply
  depth scale. The anchor convention — it returns the **foot point** at the cell
  centre — is documented at `:19`.
- `screenToGridUnclamped` and `containsScreenPoint` are implemented and tested,
  with an exact closed-form inverse at `:414-420`. They have no production
  callers. That is the half this spec connects.

**Stateless by construction.** The bridge holds no cached geometry; every call
delegates to the projection, which is pure and already recalculates on `resize()`.
A cached bridge would be a second copy of the geometry that can disagree with the
canvas — the exact failure mode §3.5 exists to prevent.

**Why the inverse is trustworthy.** The transform is not affine, but it is not a
true pinhole perspective either: depth maps through a rational function
`y = bandTop + bandHeight·(v/d)` where `d = q + (1-q)v`, while width scales by
`1/d²` rather than a camera's `1/d`. It is a deliberate pseudo-perspective. What
matters for hit-testing is that it is **separable and free of rotation or shear**,
so the inverse is exact and closed-form rather than iterative.

**Access path.** The bridge reaches the static layer through the gate (§4.2) as
an optional key, so a shell without a live region simply has no bridge rather
than a broken one. Until the gate lands, a consumer may import
`createProjectionBridge` directly from `presentation/geometry/` — legal under
§3.4, since `presentation/` is where both layers meet — carrying a comment saying
it moves behind the gate when §4 ships.

---

## 5. Mechanism 2 — the dynamic-region host

### 5.1 The problem

`PhaserCanvas.vue` and `TranPhapPanel.vue` each hand-roll their own
`new Phaser.Game`: construction, dynamic import, resize observation, teardown,
and error handling, in two different bodies of code. Neither is wrong today.
But under §2 this composition is the standard one, so the third and fourth
region would each be a third and fourth copy — and Mission 0 §13 specifically
warns that reusing a renderer does not make a hosting lifecycle correct.

### 5.2 Design

A single composable owns the mechanics of hosting a dynamic region:

```ts
// src/presentation/host/useDynamicRegion.ts  (name provisional)

/** Phaser's own scene-class shape; no new abstraction is introduced. */
type SceneCtor = new (...args: never[]) => Phaser.Scene

interface DynamicRegionOptions {
  container: Ref<HTMLElement | null>
  scenes: () => Promise<SceneCtor[]>   // dynamic import, code-split preserved
  gate: GateSeed                       // every RequiredGateKey, per §4.2
  config?: Partial<Phaser.Types.Core.GameConfig>
}

interface DynamicRegion {
  generation: Readonly<Ref<number>>
  bootError: Readonly<Ref<string | null>>
  /** Capture at creation; compare before acting. See "Generation ownership". */
  currentGeneration(): number
  destroy(): void
}
```

**This is the whole handle, and that is the point (§3.6).** `useDynamicRegion`
returns no scene, no `Phaser.Game`, and no object originating in `src/game/`.
A shell holding a scene can call every public method on it and nobody reviews
that; a shell holding this can call one. Everything else is an event or a
geometry function.

It owns: dynamic import and code-splitting, `Phaser.Game` construction, gate
seeding through `writeGate`, `ResizeObserver` wiring, teardown ordering, the
unmount-during-boot race that `PhaserCanvas.vue` already handles correctly, and
the bootstrap error boundary — kept **local to the region**, per the existing
reasoning at `PhaserCanvas.vue:33-41` that a failed canvas must not take the
whole application down.

**Teardown ordering.** The order is part of the contract, not an implementation
detail — a teardown that destroys the game before cancelling an in-flight boot
leaves a resolved dynamic import writing into a destroyed container, which is
precisely the race `PhaserCanvas.vue` already handles by hand today:

```
destroy():
  1. generation += 1            // every in-flight callback is now stale
  2. resizeObserver.disconnect()
  3. cancel pending boot        // a resolving import() sees a stale generation
  4. game.destroy(true)         // Phaser tears down scenes, tweens, timers
  5. null the game/container/observer refs
```

Step 1 comes first on purpose: everything after it can run while a callback is
mid-flight, and the stale generation is what makes those callbacks harmless.

**Generation ownership** is the part Mission 0 §13 asked for. Each host holds a
counter incremented on every construction *and* every teardown. Anything that
can outlive a teardown — a tween `onComplete`, a `delayedCall`, a resolving
`import()`, an acknowledgment echoed back from a scene — captures the generation
at creation and compares before acting:

```ts
const g = region.currentGeneration()

scene.tweens.add({
  /* … */
  onComplete: () => {
    if (g !== region.currentGeneration()) return   // teardown happened; drop it
    port.acknowledgeActionComplete(token)
  },
})
```

This is the same discipline R5 §3.3 established for playback tokens, applied to
region lifecycle. Note the two guards compose rather than duplicate: the
playback token answers *"is this the turn the domain is waiting for?"*, the
generation answers *"is this even the same region?"*. A cross-battle callback
can carry a valid-looking token; only the generation catches a cross-*region*
one.

### 5.3 What this is not

It is not a scene abstraction, a renderer wrapper, or a second coordinator.
`GamePresentationCoordinator` keeps route and readiness authority untouched. The
composable owns *hosting mechanics only*; what the region draws is entirely the
scene's business.

### 5.4 Shared backgrounds, per-region camera

Once more than one region exists, they start wanting the same art with different
motion. Combat and Formation both show a battlefield; Formation is a 420×480
preview panel, Combat is a full viewport. The same sky and ground should be
reusable without either region inheriting the other's camera.

The rule follows §2.2: **the art is a presentation asset, the motion is a region
parameter.**

- A `BackgroundSpec` names layers and asset references. It lives under
  `presentation/`, is shared, and carries **no parallax values**.
- Each region supplies its own parallax and camera configuration when it
  constructs its scene. Combat keeps exactly what it has today; Formation picks
  its own, appropriate to a small static panel.
- The gate (§4.2) hands a region its `BackgroundSpec`; the scene decides how to
  move it.

The failure this forbids is embedding parallax factors in the shared asset
descriptor. Do that and the second consumer either inherits motion tuned for a
viewport it does not have, or forks the descriptor — and a forked descriptor is
two sources of truth for the same art, which is the defect shape §4.1 and §6/V9
are both about.

---

## 6. Existing violations, and what changes

**No user-visible behaviour changes. Structural moves only** — with two stated
exceptions below, because the blanket claim would be false.

V3 changes behaviour if the interaction moves to the shell: the handler changes
owner, and hit geometry becomes the DOM's rather than the canvas's. V6 changes
behaviour in the narrow sense that deleted code stops existing. V1 moves a
module across a directory boundary, which can shift a code-split chunk even
though nothing it does changes. None of these are visible to a player; all three
are visible to the build graph or a test.

| # | Site | Rule | Action |
|---|---|---|---|
| V1 | `src/game/support/themePhaserSync.ts:1-2` imports `watch` from `vue` and `useThemeStore` from Pinia | §3.2 | Move to `src/presentation/`. It is a bridge, not a visual. |
| V2 | `src/game/support/commandWheelCatalog.ts:8` imports `LeftPanelMode`/`StandalonePanel` types from `@/stores/ui` | §3.2 | Type-only, so no runtime edge — but the direction is still wrong. Move the types down to a core or presentation contract. |
| V3 | `src/game/scenes/combat/combat-vfx-spawner.ts:242-245` — a status icon with `setInteractive`, `pointerover`, `pointerout`, `pointerdown` | §3.5 | **Legal as written.** The icon is world-anchored, so the canvas is where its geometry lives and where the hit-test belongs. It is a bridge consumer, not a violation. Optional follow-up, deferred by the product owner 2026-09-11: move only the tooltip *rendering* to the DOM, with the scene supplying screen coordinates. No action required by this spec. |
| V4 | Two hand-rolled `Phaser.Game` bootstraps — `PhaserCanvas.vue:134` (the main canvas) and `TranPhapPanel.vue:222` (the Formation preview named in Mission 0 §13 and §2 above) | §3.1 | Migrate both onto §5's composable. |
| V5 | 11 `registry.get(…) as {…}` casts, among 22 reads across 8 keys | §4 | Migrate to `readRequiredGate`/`readOptionalGate`/`writeGate`. |
| V6 | `BattleGridProjection.screenToGridUnclamped()`, `containsScreenPoint()` — no production callers | §3.5, §4.4 | **Keep.** Not dead code: this is the ground truth a DOM overlay needs to hit-test against what the canvas actually drew, and the drag interaction in the Formation fix (V8) is its first consumer. The first draft proposed deleting these; that proposal was made before the Formation grid was measured and is withdrawn. |
| V7 | `BattleGridProjection.ts` and `BattlefieldRenderMode.ts` live in `src/game/support/` | §2.2, §3.4 | **Move to `src/presentation/geometry/`.** Both layers must agree about projection, so it is a presentation asset. Verified pure: one core import, one sibling that imports nothing, no `phaser`. A file move plus import updates at `CombatScene.ts:1014`, `TranPhapCombatPreviewScene.ts:119` and the other consumers. **Not blocked on r14** — touches neither `eslint.config.js` nor `tests/architecture/`. |
| V8 | Formation panel: a uniform 176×176 DOM grid overlays a 420×480 perspective canvas, inside a container that clips it | §3.5 | **Own plan, not this spec.** See below — it is a user-visible defect, and this spec claims not to make those. |
| V10 | `TranPhapPanel.vue` holds a `TranPhapCombatPreviewScene` and calls `syncAssignments()` on it (`:195`, `:240`, `:253`); `PhaserCanvas.vue` has the same shape | §3.6 | **Migrate to the `DynamicRegion` handle**, with `syncAssignments` becoming a scoped event. Found while implementing Phase 1 — it was missing from the first violation list, and it is the concrete case that forced §3.6 to exist. Depends on §5's composable. |
| V9 | `420`/`480` declared twice — `TranPhapPanel.vue:35-36` and `TranPhapCombatPreviewScene.ts:41-42` — kept in sync by a comment at `:37` saying "must match" | §2.2 | Give the number one owner under `presentation/geometry/`. Not overridden by theme, DPI or user setting anywhere; it is simply duplicated, and V8 cannot be fixed while two files disagree about the canvas size. |

V3 and V6 are explicitly left as decisions, not foregone conclusions. Assuming
either one would be the kind of silent narrowing this repository's review
history has repeatedly caught.

**V3 and V6 are settled** — decided by the product owner on 2026-09-11, after
three measurements that the first draft had not made. Both reversed:

- V3 was "decide whether this violates §3.5". It does not; §3.5 was the thing
  that needed fixing, not the code. The tooltip is deferred as an optional
  polish item, not carried as a violation.
- V6 was "probably delete". It is kept, because the Formation grid turned out to
  be the consumer nobody had written yet.

**V8 gets its own plan, and this is the one item this spec hands off rather than
absorbs.** The reason is the claim at the top of this section: A makes no
user-visible change, and V8 is very visible. Measured, the Formation panel today:

| | DOM grid (takes the clicks) | Canvas (draws) |
|---|---|---|
| Geometry | uniform 56×56 px cells, `gap: 4px` | perspective trapezoids, compressing toward the horizon |
| Size | **176 × 176 px** | **420 × 480 px** |

`.grid-stack` has `position: relative` and no declared size; `.preview-canvas` is
`position: absolute; inset: 0` and therefore out of flow, so the container is
sized entirely by the overlay — 176 px. The canvas element inside is a fixed
420×480 under `overflow: hidden`. **Roughly 85% of what Phaser draws is clipped
and never seen**, and the visible remainder is the top-left corner, which in this
projection is the most compressed region near the horizon. There is no
`ResizeObserver` and no `Phaser.Scale` mode; nothing recomputes anything.

This is not an accident, and the repository already knew. The CSS carries the
note at `TranPhapPanel.vue:361-363` — *"canvas/overlay alignment là known
limitation (spec Part 2 Non-Goals, needs its own future plan)"* — and that spec
is `docs/archive/specs/2026-09-06-battlefield-perspective-panel-design.md`, whose
Non-Goals say plainly: *"Không đổi layout CSS xung quanh panel (formation cards,
roster queue) — chỉ đổi kích thước chính canvas Phaser."* The canvas was enlarged
to 420×480 and the surrounding CSS was deliberately left alone. The misalignment
is the acknowledged, deferred consequence of that scope decision — **not** a
decision never to fix it.

Two constraints the V8 plan inherits from that older Non-Goal: it may change the
grid-stack's own layout, and it should still leave the formation cards and roster
queue alone. V8 depends on V7 and V9, and on neither r14 nor the rest of this
spec.

---

## 7. Enforcement — executable, falsifiable

Guards live in `game/tests/architecture/`, following the pattern established by
`r14-architecture-enforcement` and reusing its `helpers/scanTs.ts`. That branch
carries four guard files holding ten tests — verified: `coreImportDirection` 2,
`eslintCoreSeverity` 2, `statProvenanceAndQueryPurity` 3, `vitalsWriteAuthority`
3 — described there as *probe-verified falsifiable*.

| Guard | Asserts | Probe that must fail it |
|---|---|---|
| `frontendImportDirection.test.ts` | No file under `src/game/` imports `vue` or `@/stores/` | Add such an import to a scratch fixture; the guard must go red |
| `pointerOwnership.test.ts` | No `setInteractive` / pointer handler under `src/game/`, except a declared allowlist | Add a `setInteractive` call outside the allowlist |
| `presentationGate.test.ts` | No `registry.get(` / `registry.set(` outside the gate module | Add a raw registry read in a scene |
| `dynamicRegionHost.test.ts` | No `new Phaser.Game` outside the host composable | Construct a game in a component |
| `projectionLocation.test.ts` | `BattleGridProjection` / `BattlefieldRenderMode` are defined only under `src/presentation/geometry/`, and nothing under `src/game/` defines a second projection | Re-add a projection class under `src/game/support/` |

**Each guard must be proven to fail before it is accepted.** This is not
ceremony: a source-grep guard that passes on a rename has shipped on this
repository before — Task 4 of the combat turn branch shipped exactly that and it
had to be fixed in review. A guard whose red state has never been observed is
not evidence of anything.

Scope note: these guards are file-and-import shaped, which is what makes them
falsifiable. They cannot prove that a *semantic* violation is absent — a lookup
table keyed by layer name would slip past `frontendImportDirection`. That limit
is stated rather than papered over.

---

## 8. What comes after this, and why it waits

Agreed order: this spec (A), then the animation metadata contract (B), then
anchor/scale geometry (C), then animation/impact timing (D).

**When B starts.** B's spec is written as soon as this one is accepted; it does
**not** wait for A to be implemented. A's implementation is itself blocked on
`r14-architecture-enforcement` merging, and leaving B idle behind that would
stall C and D behind a queue neither depends on. The only true ordering
constraint is that B's metadata must travel through §4's gate, which is a design
dependency on this document, not on its code. So: A spec → B spec (immediately
after) → A implementation (when r14 lands) → B implementation → C → D.

B is the actual unlock, and it waits on this spec because its data travels
through §4's gate. The reason B must come before C and D is measurable:

`CombatAnimationSet.buildPlaceholderAnimationSet()` takes an entity's texture URL
and frame size and **uses neither** — both parameters are `_`-prefixed and unread
(`src/game/support/CombatAnimationSet.ts:54-58`). Every entity and every clip
resolves to one shared `PLACEHOLDER_SHEET_KEY`: 200×350, 32 frames, 8 fps. A
boar, a sword cultivator, and a crocodile's death all play the same sheet, and
`public/assets/characters/` contains exactly one animation sheet — that
placeholder.

C and D cannot be designed against a constant. You cannot plant a boar's feet on
a grid cell or land a VFX on the impact frame when frame count, frame size, and
anchor are the same number for everything. Mission 0 §14 reached the same
conclusion independently:

> Real character ingestion must declare per-clip frame geometry/anchor and
> playback semantics.

---

## 9. Relationship to `VUE + Phaser checklist.md` v1.1

The checklist is kept as the source of the *intent*. It is not implementable as
written against this repository: it assumes Phaser 3, plain JS, `src/vue/` and
`src/phaser/` trees, no Pinia, no turn system, and a single canvas.

| Checklist rule | Disposition |
|---|---|
| Core owns logic; Vue and Phaser are separate | **Adopted** (§2.1) |
| Vue never touches Phaser API | **Overruled.** A static shell hosting a dynamic region is the standard composition (§2). Hosting is declared, not forbidden. |
| Phaser never touches Vue | **Adopted** (§3.2) |
| Vue and Phaser meet only at the Core | **Overruled.** They meet at `presentation/` (§2.1). |
| Phaser never emits logic events (§11.4) | **Overruled by the user, 2026-09-11.** The turn mechanism spec makes Phaser's "skill VFX done" signal the thing that ends a turn. Legal, but the list is closed and typed (§3.4, §4.3). |
| World-space → Phaser, screen-space → Vue | **Adopted** (§2) |
| Anything needing pointer-events → Vue | **Overruled, after measurement.** The first draft adopted it; §3.5 now says pointer is handled where it lands, and the real constraint is that neither layer may guess the other's geometry. The checklist's version would have made the one correct canvas-side interaction in the tree a violation. |
| Damage numbers, floating HP/cast bars → Phaser | **Adopted**; matches what is built |
| Single canvas | **Overruled.** Multiple declared regions (§3.1, §5). |

---

## 10. Acceptance criteria

1. No file under `src/game/` imports `vue` or `@/stores/`, and a guard proves it
   by failing on a probe.
2. Every Phaser `registry` access goes through the typed gate; zero `as` casts
   remain at those sites.
3. `gameManager` reaches the dynamic layer as a declared `DomainCommandPort`,
   not a structural inline type.
4. Both existing regions are constructed by the shared host composable, each
   holding its own generation.
5. V1, V2, V4, V5, V7, V9 and V10 are closed. V3 and V6 are settled as recorded
   in §6 and need no code change here. V8 is handed to its own plan and is
   **not** an acceptance criterion of this spec.

5a. No Vue file imports from `src/game/`, and none holds a scene or
   `Phaser.Game` object. The import guard largely subsumes the second clause:
   a typed scene reference requires importing its type, so what escapes it is
   only a reference held structurally or as `any` — and P8 already requires any
   introduced `any` to be flagged.
6. Five guards exist, and each has been observed red against a probe before
   being accepted.
7. Full gate green: type-check, build, vitest, Playwright. **No test expectation
   changes, except for import paths that V7 necessarily moves** — and such a
   change touches the path only, never an asserted value. A test whose expected
   *value* needs updating is a signal to stop: this work moves code, it does not
   change what the code does. (V3 and V6 need no code change; V8 is out of
   scope, and its own plan carries its own criteria.)

8. After V7, `BattleGridProjection` is imported by both `src/game/` and the
   static layer, and by neither through the other.

---

## 11. Verification log

Every measured claim in this spec was re-verified against the tree on
2026-09-11, at the reviewer's request, before the spec was accepted. Two were
found imprecise and corrected; the rest held.

| # | Claim | Result |
|---|---|---|
| C1 | Phaser takes pointer input at one site | **Corrected.** One site, but **four handlers** at `combat-vfx-spawner.ts:242-245`, not a lone `setInteractive` at `:242`. §3.5 and §6/V3 now say so. |
| C2 | `screenToGridUnclamped` / `containsScreenPoint` have no callers | **Held.** Only `BattleGridProjection.test.ts` references them. Zero production callers. |
| C3 | 8 keys, casts on reads | **Held and sharpened.** 28 registry sites outside tests, 22 of them reads, 11 carrying an `as` cast, across 8 keys. The first draft said "11 read sites" without the denominator. |
| C4 | Exactly two hand-rolled `Phaser.Game` | **Held.** `PhaserCanvas.vue:134`, `TranPhapPanel.vue:222`. Three other matches are comments. |
| C5 | `themePhaserSync.ts:1-2` imports `vue` + Pinia | **Held**, verbatim. |
| C6 | `commandWheelCatalog.ts:8` type-imports from `@/stores/ui` | **Held**, verbatim. |
| C7 | `buildPlaceholderAnimationSet` ignores two parameters | **Held.** `_staticTextureUrl` and `_frameSize` at `CombatAnimationSet.ts:56-57`, both unread. |
| C8 | One animation sheet under `public/assets/characters/` | **Held.** 19 PNGs there; exactly one is an animation sheet (`placeholder/combat-anim-32frame.png`). The other 18 are static art. |
| C9 | `coreImportDirection.test.ts` exists on r14 | **Held.** Path is `game/tests/architecture/coreImportDirection.test.ts`. §3.3's path was inconsistent with §7's and is now unified. |
| N2 | R5 token guard line numbers | **Corrected.** `CombatAnimationRuntime.ts:216-218`, not `:215-217` — 215 is the comment. Two sibling guards at `:249-251` and `:306-308` were also missing from the first draft. |
| N5 | r14 carries four guard files, ten tests | **Held**, exactly: 2 + 2 + 3 + 3. |

Nothing in C1–C9 turned out false, so no rule or enforcement item in this spec
rests on a claim that did not survive checking. The two corrections were
precision, not substance.

### 11.1 Second measurement pass (B1–B4)

The reviewer asked four further questions before the V3/V6/V7 dispositions were
settled. Three changed a decision.

| # | Question | Answer |
|---|---|---|
| B1 | Which spec is the CSS comment's "Part 2 Non-Goals"? | `docs/archive/specs/2026-09-06-battlefield-perspective-panel-design.md`. Its Non-Goals (`:51-52`) say the canvas size alone was to change and the surrounding CSS was to be left alone. So the misalignment is a **deferred consequence of a scope decision, not a decision never to fix it** — fixing it now honours the original intent. Two constraints inherited: formation cards and roster queue stay untouched. |
| B2 | Does any other DOM position itself by world coordinates? | **No.** One site reads `battlefieldGeometry` on the DOM side — `PhaserCanvas.vue:151` — and it exists for the e2e/visual gate, not for positioning UI. Production sites: zero. Combat's overlays use the *reverse* relationship (`combatInsets`: the DOM tells the canvas where not to draw), which already works. Formation is the first and only consumer, so V8 is fixed in place and no `useProjectionOverlay` composable is written until a second consumer actually exists. |
| B3 | Is 420×480 overridden anywhere? | **Not overridden — duplicated.** Declared in `TranPhapPanel.vue:35-36` and `TranPhapCombatPreviewScene.ts:41-42`, kept in sync by a comment at `:37` reading "must match". No theme, DPI or user setting touches it. Recorded as V9: the number needs one owner before V8 can be fixed. |
| B4 | Does `BattleGridProjection` depend on `src/game/`? | **No.** Two imports: `@/core/battle/BattleGrid` and `./BattlefieldRenderMode`, and that second file imports nothing at all. Neither imports `phaser`. Pure mathematics, so V7 is a file move with zero decoupling. |

The three dispositions these produced — V6 kept rather than deleted, V3 legal
rather than violating, V7 added — all reversed or added to the first draft. None
of them could have been reached without measuring the Formation grid, which the
first draft did not do.

### 11.2 Third measurement pass — the three questions §3.6 left open

Asked when §3.6 was proposed, and marked non-blocking. Two were answerable from
the tree, and both changed something.

**1. Does a region need to read state from outside, rather than receive it?**
**Yes, and it already does — which is why §3.6.1 separates push from pull.**
`CombatScene.create()` reads `gameManager.getCombatPresentationSnapshot(sessionId)`
and falls back to `registry.get('lastBattlePositionsSnapshot')` with a
two-second freshness window (`CombatScene.ts:758-771`). Scenes also pull
`playerVisualProfileId`, `sceneAdapter`, `eventBus` and `bundleManager`. A
"state arrives only by event" rule would have contradicted working production
code. The consequence is larger than the clause: it retires the proposed
`REGION_READY` handshake, because the late-join race it was designed to close is
already closed by subscribing and then reading, both inside `create()`.

**2. Does the shell ever need a synchronous return from a region?**
**No — the suspicion was right.** The only shell-side read of region internals
is `__tutienPhaserGame` at `PhaserCanvas.vue:151`, whose own comment says it
exists for the e2e/visual gate and that no gameplay code uses it. Geometry
suffices, and §3.6's three surfaces need no fourth.

A consequence, recorded because it reverses something already built: the
`projectionBridge` getter added to `TranPhapCombatPreviewScene` during Phase 1.1
is the wrong shape under §3.6 — it is precisely a synchronous read of region
internals by the shell. It is removed. The shell constructs its own bridge from
`presentation/geometry/`, which §3.6.2 permits for Formation because its canvas
size is fixed and now singly-owned.

**3. What shape does the §3.6 guard take?**
Two clauses, one cheap and one partial. *"No Vue file imports from `src/game/`"*
is an import guard of the same shape as the others in §7, falsifiable by adding
such an import. *"No Vue file holds a scene object"* would need AST work in
general — but the import guard subsumes most of it, since a typed scene
reference requires importing the type. What escapes both is a reference held
structurally or as `any`, and P8 already requires an introduced `any` to be
flagged. That residue is stated rather than hidden; it is not worth AST
machinery today.
