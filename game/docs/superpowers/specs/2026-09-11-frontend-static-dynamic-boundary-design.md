# Frontend Static/Dynamic Boundary — Vue Shell, Phaser Region

**Status:** Draft, awaiting review
**Date:** 2026-09-11
**Decided by:** user, in brainstorm, 2026-09-11
**Builds on:** `docs/architecture/mission-0-architecture-audit-2026-09-08.md`
§11, §13, §14, §16, §17; `2026-09-08-r5-combat-runtime-presentation-boundary-design.md`
**Adopts from:** `VUE + Phaser checklist.md` v1.1 (partially — see §9)

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

Already guarded by `tests/architecture/coreImportDirection.test.ts` on the
`r14-architecture-enforcement` branch.

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
live at runtime — `CombatAnimationRuntime.ts:215-217` rejects a missing token
(`if (!token || token !== this.playbackToken) return`). But the signature is
still `acknowledgeTurnReady(token?: string)`, and the inline type at
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

- Phaser takes pointer input in exactly **one** place in the whole tree:
  `src/game/scenes/combat/combat-vfx-spawner.ts:242` (`setInteractive` on an icon).
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
untyped service locator. Today that is **8 distinct keys**:

| Key | Carries |
|---|---|
| `gameManager` | Domain orchestrator reference |
| `sceneAdapter` | `PhaserSceneAdapter` (renderer port) |
| `eventBus` | Core event bus |
| `bundleManager` | `AssetBundleManager` |
| `playerVisualProfileId` | Which player visual profile is current |
| `lastBattlePositionsSnapshot` | Latest battle positions |
| `battlefieldGeometry` | Grid geometry published *by* the scene |
| `KIEM_BAR_READER_KEY` | Kiếm-bar reader function |

**11 read sites carry an `as { … }` cast.** A rename on the domain side produces
no type error anywhere; it fails at runtime, inside a scene, usually as a
silently missing visual.

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

export function readGate<K extends keyof PresentationGateContents>(
  registry: Phaser.Data.DataManager,
  key: K,
): PresentationGateContents[K] | undefined

export function writeGate<K extends keyof PresentationGateContents>(
  registry: Phaser.Data.DataManager,
  key: K,
  value: PresentationGateContents[K],
): void
```

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
the dynamic layer may ask of the domain. Adding to it is a deliberate edit to a
named contract, which is the point.

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

interface DynamicRegionOptions {
  container: Ref<HTMLElement | null>
  scenes: () => Promise<SceneCtor[]>   // dynamic import, code-split preserved
  gate: Partial<PresentationGateContents>
  config?: Partial<Phaser.Types.Core.GameConfig>
}

interface DynamicRegion {
  generation: Readonly<Ref<number>>
  bootError: Readonly<Ref<string | null>>
  destroy(): void
}
```

It owns: dynamic import and code-splitting, `Phaser.Game` construction, gate
seeding through `writeGate`, `ResizeObserver` wiring, teardown ordering, the
unmount-during-boot race that `PhaserCanvas.vue` already handles correctly, and
the bootstrap error boundary — kept **local to the region**, per the existing
reasoning at `PhaserCanvas.vue:33-41` that a failed canvas must not take the
whole application down.

**Generation ownership** is the part Mission 0 §13 asked for: each host holds a
generation counter, incremented on every construction. A callback or tween that
survives a teardown compares generations and is discarded — the same discipline
R5 §3.3 established for playback tokens, applied to region lifecycle.

### 5.3 What this is not

It is not a scene abstraction, a renderer wrapper, or a second coordinator.
`GamePresentationCoordinator` keeps route and readiness authority untouched. The
composable owns *hosting mechanics only*; what the region draws is entirely the
scene's business.

---

## 6. Existing violations, and what changes

No behaviour changes. Nothing visible to a player moves. This is structural.

| # | Site | Rule | Action |
|---|---|---|---|
| V1 | `src/game/support/themePhaserSync.ts:1-2` imports `watch` from `vue` and `useThemeStore` from Pinia | §3.2 | Move to `src/presentation/`. It is a bridge, not a visual. |
| V2 | `src/game/support/commandWheelCatalog.ts:8` imports `LeftPanelMode`/`StandalonePanel` types from `@/stores/ui` | §3.2 | Type-only, so no runtime edge — but the direction is still wrong. Move the types down to a core or presentation contract. |
| V3 | `src/game/scenes/combat/combat-vfx-spawner.ts:242-245` calls `setInteractive` + `pointerdown` | §3.5 | **Decide, do not assume**: either move the interaction to the shell, or record it as a declared exception with its reason. |
| V4 | Two hand-rolled `Phaser.Game` bootstraps | §3.1 | Migrate both onto §5's composable. |
| V5 | 11 `registry.get(…) as {…}` casts across 8 keys | §4 | Migrate to `readGate`/`writeGate`. |
| V6 | `BattleGridProjection.screenToGridUnclamped()`, `containsScreenPoint()` — no callers | §3.5 | Dead under §3.5. **Decide, do not assume**: delete, or keep with a recorded reason if Formation work will need them. |

V3 and V6 are explicitly left as decisions, not foregone conclusions. Assuming
either one would be the kind of silent narrowing this repository's review
history has repeatedly caught.

---

## 7. Enforcement — executable, falsifiable

Guards live in `game/tests/architecture/`, following the pattern established by
`r14-architecture-enforcement` (four guard files, ten tests, described there as
*probe-verified falsifiable*).

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
   exceptions with stated reasons.
6. Four guards exist, and each has been observed red against a probe before
   being accepted.
7. Full gate green: type-check, build, vitest, Playwright. No behavioural change
   is expected in any of them — a test that changes expectations is a signal to
   stop, not to update the expectation.
