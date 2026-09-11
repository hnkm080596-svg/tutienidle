# Combat Animation Metadata — Per-Clip Contract (Spec B)

**Status:** Draft, for review
**Date:** 2026-09-11
**Decided by:** user, in brainstorm, 2026-09-11 (four decisions and one amendment, §3)
**Builds on:** `2026-09-11-frontend-static-dynamic-boundary-design.md` (Spec A)
§2.2, §3.4, §4; `docs/architecture/mission-0-architecture-audit-2026-09-08.md` §14;
`2026-09-08-r5-combat-runtime-presentation-boundary-design.md` §3.3
**Unblocks:** C (anchor/scale geometry), D (animation/impact timing)

---

## 1. Scope

Spec A settled **which layer owns what**. This one settles **what the visual
layer is told about a clip**: how many frames it has, how fast it plays, where
its impact moment is, and which entities get clips at all.

It is deliberately narrow. It does not place sprites on the grid (C), and it does
not drive turn playback off animation events (D). It declares the data those two
need, because both are currently impossible for a measured reason: every entity
and every clip resolves to one shared placeholder, so frame count, frame size and
anchor are the same number for everything.

Out of scope, explicitly: VFX clips (`ActionImpactVfx`, `EnemySpawnVfx`), the
backdrop stack, and UI animation. This is character animation only.

---

## 2. The problem, measured

All figures measured against the tree on 2026-09-11.

### 2.1 The metadata is a constant wearing a parameter's clothes

`CombatAnimationSet.ts:54-58`:

```ts
export function buildPlaceholderAnimationSet(
  entityKey: string,
  _staticTextureUrl: string,
  _frameSize: { width: number; height: number } = { width: 256, height: 256 },
): CombatAnimationSet
```

Both data parameters are `_`-prefixed and unread. All three call sites pass real
per-entity values that are discarded:

| Call site | Passes | Used |
|---|---|---|
| `playerCombatAnimationSet` | `profile.combatTextureUrl`, `combatSourceSize` | no |
| `fallbackPlayerCombatAnimationSet` | `PLAYER_TEXTURE_URL`, size | no |
| `enemyCombatAnimationSet` | `enemyTextureUrl(key)`, `ENEMY_SOURCE_SIZE` | no |

Every clip of every entity resolves to `PLACEHOLDER_SHEET_KEY`: 200×350, 32
frames, 8 fps. `public/assets/characters/placeholder/` holds the one sheet that
backs it.

### 2.2 The type claims eight names; five exist

`CombatAnimationName` (`core/battle/CombatAnimationTypes.ts`) declares **8**:
`idle`, `ready`, `cast`, `standby`, `hit`, `death`, `basic_attack`, `victory`.

The builder produces **5** — `LOOPING_NAMES` (idle, ready, standby) plus
`ONE_SHOT_NAMES` (cast, death) — and ends:

```ts
return Object.fromEntries(entries) as CombatAnimationSet
```

`CombatAnimationSet` is `Record<CombatAnimationName, CombatAnimationClip>`. The
cast asserts all eight keys are present when three are not. **`set.hit`
type-checks and is `undefined` at runtime.** `hit`, `basic_attack` and `victory`
appear nowhere else in the tree — no clip, no call site.

This is the same defect shape Spec A §4.1 found at the registry gate: a declared
type that the values do not honour, with a cast holding the lie in place.

### 2.3 Three of eight names are ever requested

`playCombatAnimation` is called at exactly three sites, for `cast` (`:1960`),
`ready` (`:2453`) and `standby` (`:2487`). `death` has a **separate** path
(`gameSprite.play(deathKey)` at `:2244`, awaiting `ANIMATION_COMPLETE`). `idle`
is built and **never played in combat at all**.

`playCombatAnimation` returns silently when the clip does not exist. That guard
is defensible — Rectangle fallbacks and test fixtures need it — but it means a
missing clip and a deliberate no-op are indistinguishable.

### 2.4 The impact moment is half a tween

`CombatScene.ts:1968`:

```ts
this.time.delayedCall(ATTACK_LUNGE_DURATION_MS / 2, () => {
  this.gameManagerRef?.acknowledgeActionImpact(token)
})
```

The impact frame — the moment a sword lands and damage should read as having
happened — is **half the duration of a movement tween**. It has no relationship
to the animation being played. No clip declares an impact frame, so there is
nothing better available. This is the single most concrete thing D is blocked on.

### 2.5 Two animation mechanisms already coexist

| Mechanism | Where | Load | Frames |
|---|---|---|---|
| Uniform grid | `CombatScene`, `TranPhapCombatPreviewScene` | `load.spritesheet` | `generateFrameNumbers` |
| Trimmed atlas | `TribulationScene`, `MainScene` | `load.multiatlas` | `generateFrameNames` |

`AssetLoaderScene` already supports four descriptor kinds — `image`,
`spritesheet`, `atlas`, `multiatlas`. **No loader work is needed by this spec.**

### 2.6 Multi-frame atlas assets already exist in the tree, unused by combat

- `public/assets/idle.json` + `idle.png`, `cultivate.json` + `cultivate.png` —
  TexturePacker atlases, trimmed, carrying `sourceSize` and `spriteSourceSize`
  per frame. `TribulationScene` plays the cultivate one with 17 frames.
- `public/assets/characters/player/mortal/idle/player-mortal-idle-v1-frame-00…04`
  — five discrete frames plus a combined sheet. Nothing in combat reads them.

The precise claim is not that the project has *finished* character art — §3.4
records that it does not, and that backgrounds are the only drawn assets. It is
that **a working trimmed-atlas animation already runs in this codebase today**,
so the format in §3.1 is not a bet on unproven tooling. What is missing is any
way for combat to describe art other than the one placeholder.

### 2.7 The asset pipeline carries no metadata

`npm run assets:route` (`scripts/route-assets.mjs`) maps filename to path by
splitting on `__`. It reads no image dimensions and emits no manifest. Dropping a
real sheet places a file that nothing in the codebase can describe.

### 2.8 Animations are registered Game-wide, once

`registerCombatAnimations` guards on `this.anims.exists(clip.key)` because
Phaser's `AnimationManager` is per-Game, not per-Scene. **A clip registered once
is never re-registered**, so changing metadata at runtime has no effect until the
region is torn down. Any design that wants per-battle variation has to key on
that, and this spec does not want it.

---

## 3. The decisions, and who made them

All taken by the product owner on 2026-09-11. §3.4 arrived last and is the one
that reshaped §8 and §9, so it is worth reading before the contract in §4.

### 3.1 TexturePacker atlas is the standard format — **decided**

Character art is authored and shipped as a **trimmed TexturePacker atlas**, loaded
with `load.atlas`, played with `generateFrameNames`. (Corrected 2026-09-11:
this said `load.multiatlas`, which is the loader for a JSON naming its own image
files. A single-image TexturePacker export is `load.atlas`. See §9 criterion 5.)

The grid spritesheet path is **removed entirely**, including for the placeholder
— see §3.4, which was decided afterwards and is the reason. One loading path, so
the format has a consumer from day one rather than waiting for art that has no
schedule.

The reason this is not merely taste: a trimmed atlas's JSON carries `sourceSize`
and `spriteSourceSize` for every frame, which is exactly the data C needs to place
a foot on a grid cell without guessing. A uniform grid discards it — every frame
is padded to the same box, and where the character actually *is* inside that box
is unrecoverable. Choosing the grid would have made C harder, not easier.

The cost is real and is accepted: an anchor expressed against the untrimmed
`sourceSize` must be corrected by `spriteSourceSize` before use. §5.3 makes that
one function rather than a thing each consumer remembers.

### 3.2 The player animates; enemies are static — **decided, and deliberately against the general rule**

> *"Quái vật không cần animation để tiết kiệm tài nguyên […] quái vật là ảnh
> tĩnh […] Nhân vật thì 'đẹp' hơn với animation. tôi có nhận thấy là đang đi
> ngược với quy tắc. nhưng tôi muốn tạm thời tiết kiệm chi phí vẽ."*

Two presentation classes, not one:

| Class | Who | Presentation |
|---|---|---|
| **Animated** | The player, and bosses (§3.2.1) | Real per-clip atlas animation |
| **Static** | Ordinary and elite enemies | One still image, plus a procedural idle motion |

The product owner named this as a departure from the general rule and as a
temporary economy on **art cost**, not on engineering. This spec therefore has
two obligations it would not otherwise have:

1. Make the split **explicit and typed**, so it is a declared design rather than
   a gap someone later reads as an oversight (§4).
2. Make promoting an enemy to the animated class **cheap** — a data change, not
   a code change — so the economy can be reversed per-entity when art exists
   (§4.3). The trap to avoid is a design in which "enemies are static" becomes
   load-bearing in the playback code.

### 3.2.1 Art tier, so the policy is written once — **amendment, 2026-09-11**

> *"có thể thêm một param art type vào để xử lý hành vi? quái thường thì tĩnh,
> nhưng boss thì động, kiểu kiểu vậy"*

Accepted, and it improves the design: without it, "enemies are static" is a fact
repeated at every enemy entry, and the first boss that deserves animation makes
the rule a lie in a place nobody is looking.

**The domain already has the tier.** `Enemy` carries `isElite` and `isBoss`
(`core/enemy/Enemy.ts:196`, normalised onto the runtime entity at `:373`), set by
`createEliteVariant()` / `createBossVariant()`. Nothing new is classified:

```ts
// presentation/art/CombatArtTier.ts

export type CombatArtTier = 'static' | 'animated'

/**
 * What an entity's art SHOULD be. Policy, in one place.
 *
 * Presentation reading a domain fact is legal under A7 — this reports, it does
 * not decide anything the domain owns.
 */
export function artTierFor(entity: { isBoss?: boolean }): CombatArtTier {
  return entity.isBoss ? 'animated' : 'static'
}
```

**Elite is deliberately static.** Elites are a reward multiplier applied to an
ordinary template, not a distinct creature, so they share the ordinary one's art.
Animating them would multiply the art bill by every elite-able enemy, which is
the opposite of §3.2's purpose. When an elite deserves its own look it becomes a
boss variant or its own template.

**What the tier does NOT do: decide whether art exists.** The union in §4.1 stays
the single source of truth for what has actually been drawn. The tier says what
an entity *deserves*; the entry says what it *has*. Collapsing the two would mean
a boss whose atlas has not been drawn yet either crashes or silently downgrades,
and §3.2 exists precisely because art arrives later than the design for it.

The two are reconciled by a guard, not by a fallback (§7): an entity whose tier
is `animated` and whose entry is `static` is **art debt** — listed, expected, and
allowed, exactly the ratchet Spec A used for cross-layer imports. It may shrink
without ceremony; it may not grow without someone editing the list.

**One consequence, inherited rather than introduced.** `isBoss` is already
overloaded: tribulation (Kiếp) enemies set it directly, *not* through
`createBossVariant()`, and the code says why — *"Chỉ tái dùng cờ isBoss để Combat
HUD hiện thanh máu cố định"* (`Enemy.ts:190-196`). They set it to get a fixed HP
bar, not because they are bosses.

So `artTierFor` will call every Kiếp enemy `animated`, and every one of them will
start life as art debt. That is acceptable — the debt list makes it visible
rather than surprising — but it is a flag doing two jobs, and if the debt list
turns out to be mostly Kiếp enemies, the fix is a separate `hasFixedHealthBar`
flag on the HUD side, not a special case buried in `artTierFor`.

**A correction to the premise, stated rather than absorbed.** The decision
described enemies as static "như hiện tại". They are not static today: enemies
are built `enemyCombatAnimationSet(textureKey)` and play the same 32-frame
placeholder the player does. And the "run nhẹ" does not exist either — walk
sway/bob/tilt were **deleted outright** on 2026-08-26 (`combat-grid-view.ts:212`:
*"Walk sway/bob/tilt ĐÃ XÓA HẲN"*), leaving `rotation 0` and a straight projected
position.

So "static plus a slight shake" is a **target state**, and reaching it means
removing animation from enemies and adding a motion that is not there. Both are
cheap, and neither costs art: the shake is a tween (§4.3). The decision stands
unchanged — it just is not a no-op, and a plan written as though it were would
under-scope.

### 3.3 Metadata is hand-written TypeScript beside the profile — **decided**

Per-clip metadata lives in a reviewed source file under `presentation/`, not in a
generated manifest. It follows `PlayerVisualProfiles.ts`, which is already a
hand-written catalogue and already carries `combatSourceSize` and
`NormalizedBodyAnchor`.

The honest trade: frame counts can drift from the art, because nothing measures
the file. §7's guard exists specifically to make that drift fail a test rather
than a frame, and §7.1 records what that guard cannot catch.

### 3.4 Every asset is still a placeholder, and B ships against that — **decided, 2026-09-11**

> *"tất cả các art trừ backgrounds hiện tại vẫn chưa được vẽ. Tôi vẫn chưa có
> thời gian, đó là lí do tôi cứ đòi bạn đặt placeholder."*

This is the most load-bearing answer in this section, because the first draft of
§8 and §9 assumed real `mortal` art would land inside B. It will not. Backgrounds
are the only drawn art in the project; every character asset is placeholder or
concept, and the schedule for real art is unknown.

**B still ships, and its value is unchanged** — arguably larger. Every defect in
§2 is a defect in how the code *describes* art, not in the art:

- Two unread parameters (§2.1) are unread whatever they point at.
- A type claiming eight names while five exist (§2.2) is a lie about a record,
  not about a drawing.
- An impact moment computed as half a tween (§2.4) is wrong for a placeholder
  exactly as it is wrong for a real sword.
- One global constant for every entity (§2.1) is what makes C and D impossible,
  and replacing it with a real per-entity catalogue does not require the entries
  to point at good art — only at *honestly described* art.

**What changes is the danger.** A contract designed against a format that nothing
uses is a contract nobody has tested. If the placeholder stays a grid spritesheet
while §3.1 declares atlases the standard, then B's chosen format ships with
**zero consumers**, and the first real atlas becomes simultaneously the first
test of the loader path, the metadata shape, the frame naming, and the trim
correction — with no way to tell which half is wrong.

**So the placeholder becomes an atlas.** `scripts/generate-hon-don-tran-placeholder-art.mjs`
already draws 32 frames onto a canvas and knows exactly where it drew each one.
It gains a second output: a TexturePacker-format JSON beside the PNG, with
**real** `sourceSize`/`spriteSourceSize` computed from the drawn bounds — not
full-box values. That makes the atlas path, the frame-name path and §5.3's trim
correction all live from day one, against art that is free to regenerate.

Real packing stays the product owner's job and their tool (§10.2). The generator
imitates TexturePacker's output shape; it does not replace it.

**The residual risk, stated.** A contract validated only against generated
placeholder art can still be wrong about real art — a hand-packed atlas may name
frames differently, or trim more aggressively. `atlasFramesExist` (§7) is the
guard that will catch it, and it will catch it on the day the first real atlas
lands rather than in a frame nobody is watching. That is the best B can do, and
pretending otherwise would be the kind of claim §2 exists to disprove.

---

## 4. The contract

### 4.1 Two entity presentations, declared

```ts
// presentation/art/CombatEntityPresentation.ts

export type CombatEntityPresentation =
  | { kind: 'animated'; clips: CombatAnimationCatalogue }
  | { kind: 'static'; texture: StaticEntityArt; idleMotion: IdleMotion }
```

A discriminated union, so a consumer must decide which it is holding. The
alternative — an animated presentation whose clips happen to be absent — is the
`Partial<Record<…>>` shape Spec A §4.2 has just finished removing from the
registry gate, where it pushed an absence check onto every call site.

### 4.2 The animated clip

```ts
export interface AtlasClip {
  /** Atlas texture key, shared by every clip of one entity. */
  sheetKey: string

  /** Frame names, as TexturePacker emits them: `frame_000.png`. */
  framePrefix: string
  frameSuffix: string
  firstFrame: number
  lastFrame: number
  zeroPad: number

  frameRate: number

  /** -1 loops, 0 plays once. */
  repeat: number

  /**
   * The frame at which this clip's action READS as having happened — a sword
   * connecting, a palm striking. Zero-based, within [firstFrame, lastFrame].
   *
   * Declared here and only here. D consumes it; nothing in B acts on it. It is
   * in B because it is metadata about a clip and belongs with the clip, and
   * because the value replaces `ATTACK_LUNGE_DURATION_MS / 2` (§2.4) — a number
   * with no relationship to the art it is timing.
   *
   * Optional: a looping clip has no impact moment, and a one-shot clip may
   * legitimately not be an action.
   */
  impactFrame?: number
}
```

`frameCount` is deliberately **not** a field: it is `lastFrame - firstFrame + 1`,
and two ways to say the same thing is the V9 defect from Spec A.

### 4.3 The static entity

```ts
export interface StaticEntityArt {
  textureKey: string
  textureUrl: string
  sourceSize: { w: number; h: number }
}

/**
 * Procedural motion for a static entity. Costs no art — this is the whole point
 * of §3.2's economy, and the reason "static" does not have to mean "dead".
 */
export interface IdleMotion {
  /**
   * Peak vertical offset, in SCREEN pixels, and not scaled by projection depth.
   *
   * Decided 2026-09-11: one size for every row. The alternative — scaling
   * amplitude by the row's depth factor, so a far enemy breathes less — is more
   * correct perspective and was explicitly not wanted. A far enemy is already
   * small; scaling its motion too makes it read as frozen.
   */
  amplitudePx: number

  /** One full cycle, in ms. Jittered per entity so a row does not pulse as one. */
  periodMs: number
}
```

**Promotion is a data change.** An enemy gains animation by its entry becoming
`{ kind: 'animated', clips: … }`. No playback code is touched, because §4.4's
resolver already handles both and every consumer already narrows. This is the
mechanism §3.2 asked for.

### 4.4 The catalogue and its resolver

```ts
// presentation/art/CombatAnimationCatalogue.ts

export type CombatAnimationCatalogue = Record<CombatAnimationName, AtlasClip>

export function presentationFor(entityKey: string): CombatEntityPresentation
```

One function, one answer per entity. `CombatPreload`'s three
`buildPlaceholderAnimationSet` call sites collapse into it.

It answers from the catalogue — what has been drawn — and never from
`artTierFor`. The tier is an expectation checked in a test (§7); letting it
influence what a scene resolves at runtime would mean a boss without art
resolving to something that does not exist.

### 4.5 The name list becomes honest

`CombatAnimationName` is reduced to names that have **both** a clip and a call
site:

```
idle, ready, standby, cast, death
```

`hit`, `basic_attack` and `victory` are removed, and the `as CombatAnimationSet`
cast (§2.2) is removed with them, so the compiler checks the record instead of
being told to trust it. Each returns when it has a clip and a site on the same
day — a name in a union with nothing behind it is what let the cast lie for this
long.

`idle` stays despite having no call site today (§2.3), and this spec gives it
one: an idle animation on the player is the most visible thing B buys, and it is
the default state every other clip returns to.

### 4.6 How the metadata travels

A §8 says B's metadata "must travel through §4's gate". Measured against what
the gate actually carries, it already does, and **no new key is needed** — which
is worth stating precisely, because "no new key" and "travels through the gate"
sound contradictory and are not.

The catalogue is a presentation asset under `presentation/art/`. Both layers may
import it directly (A §3.4), so it does not travel anywhere: it is a module, the
same way `FormationCanvasSpec` is.

What travels is the **identity** needed to index it, and that already goes
through the gate as `playerVisualProfileId`. The catalogue is keyed by
`combatTextureKey`, which is the same key `combatAnimationKey()` already builds
animation keys from and which the profile already carries. A scene therefore
reads one existing gate key and resolves the rest locally.

Adding a key to hand over data the dynamic layer can already reach would widen
the gate for nothing, and A §4.1's key table is meant to stay short enough to
read.

---

## 5. Anchors, trim, and the line to C

### 5.1 What B declares and does not use

B declares `impactFrame` (§4.2) and does not act on it. B does **not** declare
anchors: `NormalizedBodyAnchor` already exists on `PlayerVisualProfile`, and
moving or redefining it is C's job.

The division: **B says what a clip is. C says where it goes. D says when it
matters.**

### 5.2 The trim problem, named now because B chooses the format that creates it

§3.1's atlas is trimmed, so a frame's pixels sit at `spriteSourceSize.{x,y}`
inside the untrimmed `sourceSize` box, and the offset **differs per frame**. An
anchor expressed against the untrimmed box is therefore wrong by a per-frame
amount unless corrected.

This is not a new defect — it is a consequence of §3.1, and it is recorded here
so C inherits a stated problem rather than discovering one.

### 5.3 One correction function, in presentation/geometry/

The correction is arithmetic over data the atlas JSON already carries, so it is a
pure function next to the rest of the shared geometry (A §3.6):

```ts
// presentation/geometry/atlasAnchor.ts
export function anchorForFrame(
  anchor: NormalizedBodyAnchor,
  frame: { sourceSize: Size; spriteSourceSize: Rect },
): { x: number; y: number }
```

B ships this function and its tests. B does not call it — C does. It is here
because it is the format's cost and §3.1 is where the format was chosen; leaving
it for C would hand C a bill without the receipt.

---

## 6. What changes

| # | Site | Change |
|---|---|---|
| B1 | `CombatAnimationSet.ts:54-58` — two unread parameters | Replaced by §4.4's resolver. The placeholder builder is deleted, not deprecated. |
| B2 | `CombatAnimationTypes.ts` — 8 names, 3 of them empty | Reduced to 5 (§4.5). |
| B3 | `CombatAnimationSet.ts` — `as CombatAnimationSet` | Removed; the record is checked (§4.5). |
| B4 | `CombatPreload.ts:61,72,79` — three placeholder call sites | One call to `presentationFor`. |
| B5 | Enemies play the 32-frame placeholder (§2.6, §3.2) | Become `kind: 'static'` with `IdleMotion`. |
| B6 | No idle motion exists at all (sway deleted 2026-08-26) | A tween per §4.3, phase-jittered per entity. |
| B7 | `idle` built, never played (§2.3) | Played as the player's default state (§4.5). |
| B8 | `impactFrame` does not exist; `ATTACK_LUNGE_DURATION_MS / 2` stands (§2.4) | Field declared (§4.2). **The call site is NOT changed — that is D.** |
| B9 | The placeholder is a grid spritesheet, so §3.1's atlas format would ship unused | The generator emits a TexturePacker-format JSON with real trim bounds; every animated entity loads through `load.atlas` (§3.4). |
| B12 | Nothing exercises §5.3's trim correction | The generated atlas is genuinely trimmed per frame, so `anchorForFrame` has real input before real art exists. |
| B10 | "Enemies are static" would be restated at every enemy entry | `artTierFor` states it once, from `isBoss` (§3.2.1). |
| B11 | Nothing reconciles deserved art with drawn art | The art-debt list plus its guard (§7). Expected to be non-empty on day one, and to be mostly Kiếp enemies. |

**B8 is the one to watch in review.** It would be easy, having declared
`impactFrame`, to also use it — the call site is four lines away. That is D, and
changing playback timing while changing metadata makes a regression in either
impossible to attribute.

---

## 7. Enforcement

| Guard | Asserts | Probe that must fail it |
|---|---|---|
| `animationCatalogue.test.ts` | Every `AtlasClip`'s `impactFrame`, where present, lies within `[firstFrame, lastFrame]`; `lastFrame >= firstFrame`; `frameRate > 0` | Set an `impactFrame` past `lastFrame` |
| `animationCatalogue.test.ts` | Every clip's `sheetKey` resolves to an atlas declared in the asset catalogue | Rename a sheet key in the catalogue only |
| `animationCatalogue.test.ts` | Every animated entity declares **every** `CombatAnimationName` — no partial records | Delete a clip from one entity |
| `atlasFramesExist.test.ts` | For every clip, the atlas JSON on disk actually contains `framePrefix + pad(n) + frameSuffix` for every n in range | Extend `lastFrame` by one past the real art |
| `staticEntityMotion.test.ts` | Every `kind: 'static'` entry has `amplitudePx > 0` and `periodMs > 0` | Set amplitude to 0 — a "static" entity that does not move at all is B5 done halfway |
| `artTierDebt.test.ts` | Every entity whose `artTierFor` is `animated` but whose entry is `static` appears in the recorded debt list, and every listed entity is still a real one | Add a boss template without adding it to the list; and leave a listed entity in place after its atlas lands |

**`atlasFramesExist` is the one that earns its keep.** §3.3 accepted that
hand-written metadata can drift from the art; this guard reads the JSON and makes
the drift fail a test instead of a frame. Every guard is observed red against a
probe before acceptance, per Spec A §7.

### 7.1 What these cannot catch

They check that a clip is *describable*, never that it *looks right*. A clip
whose `impactFrame` is inside the range but on the wrong frame — the sword still
rising — passes every assertion here. That is a judgement made by watching, and
it belongs to D's verification, not to a unit test. Stated so nobody reads green
as "the timing is correct".

---

## 8. Sequencing

1. **B9/B12 — the placeholder becomes a trimmed atlas.** First, deliberately:
   it is the only step that can be verified entirely on its own (the same 32
   frames must still animate, now loaded through `load.atlas`), and every later
   step is designed against the format it establishes. A regression here is
   obvious; a regression here discovered in step 4 would not be.
2. §4's types and the catalogue, resolving to that atlas. No visible change; the
   shape lands behind identical pixels.
3. B2/B3 — the name list and the cast. Type-level only.
4. B5 + B6 — enemies to `kind: 'static'`, and `IdleMotion`. **These ship
   together**: step B5 alone removes animation from enemies and gives them
   nothing back, which is visibly worse and must not be demonstrated or merged
   on its own.
5. B7 — the player's idle, played from the catalogue.
6. §5.3's `anchorForFrame` and its tests, unused, handed to C.

**C is no longer gated on real art.** It was, in the first draft, because real
art was expected inside B. With §3.4 it is gated on *real per-entity metadata*,
which step 2 delivers — the placeholder's frame geometry is honest even though
its pixels are not.

D still needs `impactFrame` values somebody has watched. Against a numbered
placeholder that is possible but shallow: you can confirm the acknowledgment
fires on the declared frame, not that the frame is the right one. D should expect
to re-tune every `impactFrame` when real art lands, and §7.1 says why no test
will tell it to.

---

## 9. Acceptance criteria

1. `buildPlaceholderAnimationSet` is deleted; no function takes an unread data
   parameter in its place.
2. `CombatAnimationName` has no member without both a clip and a call site.
3. No cast asserts the shape of an animation record.
4. Every enemy is `kind: 'static'` with a non-zero `IdleMotion`, and moves on
   screen.
5. Every entity resolves through the catalogue, and every **animated** entity
   resolves to the **trimmed placeholder atlas**. No entity resolves through
   `load.spritesheet`, and the grid path is gone.

   *Corrected 2026-09-11, during implementation.* This said "loaded with
   `multiatlas`". That was wrong, and the code is right: `multiatlas` is for a
   JSON that names its own image files (what `MainScene` and `TribulationScene`
   use); a single-image atlas is `load.atlas`, which takes the PNG and the JSON
   explicitly. §2.5's table named the loader correctly and this criterion copied
   the wrong half of it. Also narrowed from "player profiles and enemies alike":
   §3.2, decided in the same session, makes enemies static, so requiring them to
   resolve to an atlas contradicted it.
6. `impactFrame` is declared and populated; `ATTACK_LUNGE_DURATION_MS / 2` is
   **still** the live call site (D's to change).
7. Promoting one enemy to `kind: 'animated'` requires editing one data entry and
   no playback code. Demonstrated, not asserted.
7a. `artTierFor` is the only place that says which tier deserves animation, and
   no runtime path reads it to decide what to draw (§4.4).
8. Five guards exist and each has been observed red against a probe.
9. Full gate green: type-check, build, vitest, Playwright.
10. Verified on screen: the player's idle animation plays, and enemies visibly
    breathe. A screenshot proves layout and nothing else — motion needs a capture
    across frames, or watching it. The numbered placeholder frames make this
    unusually easy to check: if the number on the player changes and the enemies
    bob without their number changing, both halves are correct.
11. `anchorForFrame` is exercised by the generated atlas's real trim values, not
    only by hand-written fixtures (§3.4, B12).

**Criterion 7 is the one that protects §3.2's reversibility.** If it cannot be
demonstrated, the economy has become load-bearing and the design is wrong.

---

## 10. Open questions — answered 2026-09-11

All three closed by the product owner in the same session. Kept rather than
deleted, because the answers constrain the work more than the questions did.

1. **Which `mortal` art becomes the first real atlas?** — **None.** No character
   art is drawn, and none is scheduled; backgrounds are the only drawn assets in
   the project. B ships entirely against the placeholder. §3.4 is the ruling and
   the reason it does not weaken B; criterion 5 was rewritten from "plays a real
   atlas" to "resolves through the catalogue to the trimmed placeholder atlas".

2. **Who packs the atlas?** — **The product owner, with TexturePacker**, when
   real art exists. The repo gets no packing script. The placeholder generator
   imitates TexturePacker's output format (§3.4) so the path is exercised; it is
   a stand-in for the tool, not a replacement, and it should never grow into one.

3. **Does `IdleMotion` amplitude scale with depth?** — **No. One size.**
   Previously wanted, now explicitly not: a far enemy is already small, and
   scaling its motion as well makes it read as frozen. §4.3 records the reasoning
   so the question is not reopened by someone noticing the perspective is
   "wrong".

---

## 11. What this spec is honest about

Three things a reviewer should push on, listed so they are not discovered as
surprises:

1. **The contract is validated only against generated art.** §3.4 states the
   residual risk and names `atlasFramesExist` as the guard that will catch a
   real atlas that disagrees. No test can catch a real atlas that agrees
   structurally and looks wrong.
2. **`impactFrame` will be wrong.** It is declared here, populated with values
   chosen against a numbered placeholder, and consumed by D. Every value should
   be expected to change when real art lands. §7.1 says why no test will flag it.
3. **§3.2's economy is a decision, not an oversight**, and criterion 7 is the
   thing that keeps it reversible. If promoting an enemy to animated ever
   requires touching playback code, the economy has leaked into the engine and
   this design has failed at the thing it was most careful about.
