# Frontend Static/Dynamic Boundary — Vue Shell, Phaser Region

**Status:** Draft, awaiting review
**Date:** 2026-09-11
**Decided by:** user, in brainstorm, 2026-09-11
**Reviewed by:** user, 2026-09-11. Every measured claim re-verified against the
tree before acceptance — see §11.
**Builds on:** `docs/architecture/mission-0-architecture-audit-2026-09-08.md`
§11, §13, §14, §16, §17; `2026-09-08-r5-combat-runtime-presentation-boundary-design.md`
**Adopts from:** `docs/superpowers/specs/VUE + Phaser checklist.md` v1.1
(partially — see §9)

---

## 1. Scope, and what this is deliberately not

This spec settles one question: **which layer owns what on the frontend**, and
gives the answer two mechanisms and a set of executable checks.

It is **not** a new constitution. Mission 0 §17 examined exactly that idea and
rejected it:

> Most findings already violate existing A2/A3/A7/A9/A11/A12 or P17; another
> general prohibition would not have prevented them. […] Do not duplicate the
> whole constitution into more files. The findings require better contracts and
> executable checks, not those prohibitions.

That judgment is accepted here. Of the rules in §3, four are restatements of
invariants that already exist and already bind; they appear only so the frontend
boundary can be read in one place. **Exactly one rule is new** (§3.5, pointer
ownership), and it is new because it records a decision only the product owner
could make.

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

---

## 3. The rules

### 3.1 The static shell owns the dynamic region's lifecycle — *existing (A3/A5)*

A dynamic region is constructed, sized, and destroyed by the static shell that
hosts it. Phaser does not appear anywhere on its own. Multiple concurrent
regions are legitimate; each has exactly one declared host, and each host owns
one generation (§5.2).

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

### 3.5 Pointer input belongs to the static layer — **NEW**

Buttons, grid cells, target selection, drag: the static layer receives them all.
The dynamic layer draws beneath and does not need to know where the pointer is.

This is new as a written rule, but it is not a new practice — the repository had
already chosen it and simply never wrote it down. Evidence:

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
  Phaser canvas draws below it.

**Consequence for the two findings above:** `combat-vfx-spawner.ts:242` becomes
a declared exception or moves to the shell (§6). The unused projection inverse
is dead code under this rule; §6 records the decision rather than assuming it.

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
| V3 | `src/game/scenes/combat/combat-vfx-spawner.ts:242-245` — a status icon with `setInteractive`, `pointerover`, `pointerout`, `pointerdown` | §3.5 | **Decide, do not assume**: move the interaction to the shell, or record it as a declared exception with its reason. Note it is a tooltip on a world-anchored icon, so moving it means the shell must track a world position — the trade is real, not cosmetic. |
| V4 | Two hand-rolled `Phaser.Game` bootstraps — `PhaserCanvas.vue:134` (the main canvas) and `TranPhapPanel.vue:222` (the Formation preview named in Mission 0 §13 and §2 above) | §3.1 | Migrate both onto §5's composable. |
| V5 | 11 `registry.get(…) as {…}` casts, among 22 reads across 8 keys | §4 | Migrate to `readRequiredGate`/`readOptionalGate`/`writeGate`. |
| V6 | `BattleGridProjection.screenToGridUnclamped()`, `containsScreenPoint()` — no callers | §3.5 | Dead under §3.5. **Decide, do not assume**: delete, or keep with a recorded reason if Formation work will need them. |

V3 and V6 are explicitly left as decisions, not foregone conclusions. Assuming
either one would be the kind of silent narrowing this repository's review
history has repeatedly caught.

**Who decides V3 and V6:** the product owner, before the implementation plan is
written — not the implementing agent mid-task, and not a reviewer after the
fact. Each needs one piece of information the tree cannot supply: whether a
world-anchored tooltip is worth moving to the DOM (V3), and whether Formation
work will need screen→grid inversion (V6). Both answers belong in §6 of this
spec once given, so the plan can cite them rather than re-litigate them.

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
| Anything needing pointer-events → Vue | **Adopted and sharpened** into §3.5 |
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
5. V1, V2, V4, V5 are closed. V3 and V6 are closed **or** recorded as declared
   exceptions with stated reasons — decided by the product owner before the plan
   is written (§6), and written back into §6.
6. Four guards exist, and each has been observed red against a probe before
   being accepted.
7. Full gate green: type-check, build, vitest, Playwright. **No test expectation
   changes, except where a V3 or V6 decision explicitly authorizes it** — and
   such a change cites that decision. Outside those two, a test that needs its
   expectation updated is a signal to stop, not to update the expectation: this
   work moves code, it does not change what the code does.

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
