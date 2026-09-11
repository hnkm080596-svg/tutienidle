# Spec C — Combat Anchor & Scale Geometry

**Status:** Draft, for review
**Date:** 2026-09-12
**Depends on:** Spec A (static/dynamic boundary), Spec B (animation metadata)
**Followed by:** Spec D (animation & impact timing)

---

## 1. Scope

The division the three specs agreed on:

> **B says what a clip is. C says where it goes and how big. D says when it
> matters.**

C owns three things and nothing else:

1. **How big** a combat entity is drawn, expressed as something measurable about
   the world rather than as a stack of multipliers.
2. **Where on the entity** a VFX attaches — the body anchors.
3. **Which artwork** those anchors and that size are expressed against.

C does **not** own animation timing (D), what art exists (the product owner), or
the cultivation pose's anchors (`PlayerVisualProfile.cultivateBodyAnchors` — a
different scene with a different problem).

### 1.1 What C inherited from B, and gave back

Spec B §5.2 handed C a stated problem and §5.3 handed it a function to solve it:

> *"§3.1's atlas is trimmed, so a frame's pixels sit at `spriteSourceSize.{x,y}`
> inside the untrimmed `sourceSize` box, and the offset **differs per frame**. An
> anchor expressed against the untrimmed box is therefore wrong by a per-frame
> amount unless corrected."*

**That is false, and it was measured false before this spec was written.**
`anchorForFrame` is cancelled — §2.1 has the measurement. B's instinct about trim
was right; it was aimed at the wrong target. Trim matters enormously for **scale**
(§2.3), and not at all for anchors.

This is recorded rather than quietly dropped, because a future reader finding
`anchorForFrame` referenced in B and absent from the tree deserves to know it was
refuted, not forgotten.

---

## 2. The problem, measured

All figures measured on the running game on 2026-09-11/12, at 1600x900, in a real
battle on Thanh Vân · Động 1, by reading the live Phaser scene rather than by
reasoning about the code.

### 2.1 Trim does not move a box-relative anchor — measured

Ten samples of the player sprite across frames whose trim genuinely differs:

| frame | `spriteSourceSize` | `scaleX` / `scaleY` | `getBounds()` |
|---|---|---|---|
| `frame_007` | x56 y33 w88 h278 | 0.3278 / 0.3278 | 344.7, 523.6, 65.6 x 114.7 |
| `frame_008` | x56 y31 w88 h277 | 0.3278 / 0.3278 | 344.7, 523.6, 65.6 x 114.7 |
| `frame_009` | x56 y28 w88 h277 | 0.3278 / 0.3278 | 344.7, 523.6, 65.6 x 114.7 |

The bounds are **identical to the last decimal** while the trim offset moves by
5px of source. 65.6 = 200 x 0.3278 and 114.7 = 350 x 0.3278: the bounds are the
**authored box**, not the trimmed pixels.

Phaser places a trimmed frame at its correct offset inside the authored box. A
point expressed as a fraction of that box therefore resolves to the same screen
point on every frame, with no correction of any kind.

**Consequence:** `anchorForFrame` would have corrected an error of exactly zero,
and would have introduced one had anybody used it.

What DOES move between frames is the character's own features — a hand is in a
different place during a cast because it is animated. That is not a trim artefact
and no arithmetic can recover it; it is the question §3.1 answers with a decision
about authoring cost.

### 2.2 The anchors describe a different picture than the one on screen

`PLAYER_VISUAL_PROFILES.mortal.bodyAnchors` was authored against the profile's
static PNG (1312x1199), in which the figure fills the frame. The sprite now draws
an atlas frame authored at 200x350 in which the figure occupies y 28..305:

| anchor | declared | where that lands in the art now drawn |
|---|---|---|
| `head` | 0.11 | figure's head top is at **0.080** |
| `feet` | 0.97 | figure's feet are at **0.871** |

`feet` sits about 9% of the box height BELOW the character's actual feet — around
10 screen pixels at the current scale, in empty transparent space.

**How much this actually costs, corrected 2026-09-12.** An earlier draft of this
section claimed "five anchors feed real effects", citing
`combat-vfx-spawner.ts:622`. That was wrong, and wrong in the way this project's
discipline exists to catch: it was read off a grep line number without reading the
function. Line 622 is inside `drawDebugBodyAnchors()`, which is dev-only, gated
behind `localStorage['debug.playerBodyAnchors']='1'`, and whose own comment says
*"Không có UI production nào đụng tới."*

Measured, the production consumers of a named anchor are:

| consumer | anchor | who |
|---|---|---|
| `combat-reward-gourd.ts:278` | `chest` | the player only |
| `combat-reward-gourd.ts:286` | `ENEMY_NEUTRAL_BODY_ANCHOR` | every enemy, derived from bounds |
| `combat-vfx-spawner.ts:599` | all five | **debug overlay, not production** |

So exactly **one** production effect reads the hand-authored table, and no skill,
no core data and no VFX ever picks an anchor by name — the five ids exist, and
four of them are drawn as coloured dots for a developer.

That changes what C is for. The anchors are not an urgent defect; they are an
unused abstraction that is also wrong. §3.1 therefore does not re-author them —
it deletes the authoring step, and then the authored data, altogether.

**This is not a bug that was introduced; it is a contract that was never stated.**
The anchors are normalised against "the source image", and nothing said which
source image — so when Spec B changed what the sprite draws, the anchors kept
pointing at the old one and nothing could notice.

### 2.3 Scale measures the box, and the box is mostly empty

The live scale chain:

```
characterHeight = max(26, nearCell.width * 0.92)      // 86.93 measured
displayHeight   = characterHeight * depthScale * sizeMultiplier
displayWidth    = displayHeight * (sourceSize.w / sourceSize.h)
```

Measured, with `PLAYER_DISPLAY_SCALE_MULTIPLIER === ENEMY_DISPLAY_SCALE_MULTIPLIER === 2`:

| | authored box | fill ratio | **box on screen** | **character on screen** |
|---|---|---|---|---|
| Player (row 4) | 200 x 350 | 44.0% w, 79.1% h | 65.6 x 114.7 | **28.8 x 91.1** |
| Enemy (row 5, boar) | 1254 x 1254 | 100% w, 100% h | 123.0 x 123.0 | **123.0 x 123.0** |

Both carry the same multiplier. **The code believes these two are the same size.**
On screen the boar is 35% taller and more than four times wider — and it is the
one FURTHER AWAY, so perspective should have made it the smaller of the two.

The cause is that `displayHeight` sizes the **box**, and how much of the box the
character fills is a property of the art nobody declared. The enemy PNG is
untrimmed and fills its box exactly; the player's placeholder fills 79% of its
height and 44% of its width.

**The trap this leaves.** Re-export the art with tighter margins and every
character silently changes size, with no code change and no test failure. That is
the same shape of defect as the one Spec B shipped and this branch has just fixed
(`c0826723`): *what a sprite draws* and *what sizes it* were allowed to come from
different places.

### 2.4 Three multipliers, no stated intent

`CHARACTER_WIDTH_RATIO = 0.45`, `PLAYER_DISPLAY_SCALE_MULTIPLIER = 2`,
`ENEMY_DISPLAY_SCALE_MULTIPLIER = 2`, `BOSS_DISPLAY_SCALE_MULTIPLIER = 4`, and
`characterHeight = nearCell.width * 0.92`.

None of them records what it is trying to achieve, so none of them can be checked.
`characterHeight` deriving from the near cell's **width** is the one that does
carry a reason, in a comment: the cell's *height* is perspective-compressed and
"no longer a sensible ruler for the height of a standing person". That comment is
the closest thing in the tree to a statement of intent, and §3.2 turns it into
one.

`CHARACTER_WIDTH_RATIO` is worth naming precisely: it is used only for Rectangle
fallbacks and health-bar widths, never for a Sprite, whose width comes from the
aspect ratio instead. Two notions of "character width" coexist and only one is
ever seen on a real entity.

### 2.5 Enemies have no anchors, so there are two mechanisms

`combat-reward-gourd.ts` uses `ENEMY_NEUTRAL_BODY_ANCHOR` — "~40% of height from
the feet", derived from sprite bounds — and a comment records the audit that put
it there: never apply the *player's* anchors to an enemy.

**That ruling was right and its implementation is the problem.** The audit was
about not borrowing one character's proportions for another; the fix was a second
code path. So a reward launched from the player and one launched from a wolf are
computed by different rules, and a third rule would be needed the day a companion
appears.

§3.1 keeps the ruling — no entity borrows another's proportions — and removes the
second path, by making the rule depend on the cell rather than on whose art it is.

---

## 3. The decisions

All taken by the product owner on 2026-09-11/12.

### 3.1 Anchors come from the SLOT, not from the art — **decided 2026-09-12**

> *"Không cần chính xác đâu, chỉ cần Trên đầu, dưới chân, sau lưng (trái) và
> trước mặt (phải) là được."*
> *"à, thêm một vị trí giữa người nữa, gọi là trung tâm."*
> *"Hãy làm một cơ chế cho toàn bộ, thay vì từng art một, lệch không quan trọng,
> đúng vị trí từ slot của trận là được."*

Five directions, one mechanism, for every entity:

| id | Vietnamese | where |
|---|---|---|
| `top` | trên đầu | above the head |
| `bottom` | dưới chân | at the feet |
| `centre` | trung tâm | middle of the body |
| `front` | trước mặt | in front |
| `back` | sau lưng | behind |

**They are computed from the battlefield cell the entity stands on, not from its
artwork.** The projection already returns the foot point at the centre of a cell
(`BattleGridProjection.gridToScreen`, and its "anchor quy ước" comment says so);
a standing person occupies a known height above that point (§3.2); the five
directions are the corners and midpoints of that notional body.

Nothing about the art enters. Not the texture, not the frame, not the trim, not
whether the entity is animated, static, or a coloured Rectangle fallback.

**Why this is better than deriving from the art, and not merely cheaper.** Three
reasons, in increasing order of how much they matter:

1. It is **uniform**. Today an enemy outside the Mortal batch renders as a
   `Phaser.GameObjects.Rectangle` and has no art to measure at all; the reward
   gourd handles it with a separate hardcoded fallback (§2.5). Under a
   slot-derived rule there is no second path, because there is nothing to be
   missing.
2. It is **stable across frames**. An extent-derived anchor moves as the character
   breathes, so an effect attached to `top` jitters with the idle bob. A
   slot-derived one does not, and nobody has to decide which frame is
   authoritative.
3. It **cannot go stale**, which is the property §2.2 lacked. There is no datum
   describing the art, so there is no datum to describe the *wrong* art.

**What is given up, stated plainly.** The anchors do not follow the character.
A tall enemy and a short one get the same `top`, because the slot does not know
how tall its occupant is. An effect at `front` leaves a notional body edge, not
the actual hand, and during a big swing the hand will be somewhere else entirely.
This is precisely what *"lệch không quan trọng"* accepted, and it is worth naming
so that a later reader does not mistake it for an oversight.

**The upgrade path stays open and cheap.** §4.2's function takes a body box; §3.2
already computes a per-entity one from its `classFactor`. Making `top` follow a
boss's real height is a change to what is passed in, not to any consumer.

**`centre` retires a hardcoded estimate.** `ENEMY_NEUTRAL_BODY_ANCHOR` — "~40% of
height from the feet", derived from sprite bounds — exists only because enemies
had no anchors. `centre` is that point for every entity by the same rule, so the
special case goes away rather than gaining a sibling.

### 3.2 C owns scale, stated as a measurable claim about the world — **decided**

Replace the stack in §2.4 with one sentence that can be checked:

> **An adult person stands `PERSON_HEIGHT_IN_CELLS` times the width of a near-row
> grid cell, and `PERSON_WIDTH_IN_CELLS` times that width across.**

The near cell's **width** is the ruler, for the reason already recorded in the
tree: the cell's height is perspective-compressed and is not a ruler for anything
upright.

Everything else derives:

```
personHeightPx = nearCellWidth * PERSON_HEIGHT_IN_CELLS * depthScale * classFactor
personWidthPx  = nearCellWidth * PERSON_WIDTH_IN_CELLS  * depthScale * classFactor
boxHeightPx    = personHeightPx / extent.h            // extent measured from the art
boxWidthPx     = boxHeightPx * (sourceSize.w / sourceSize.h)
```

The division by `extent.h` is the whole point: **the size that is specified is the
size of the character, and the box is whatever it has to be to make that true.**
Re-exported art with different margins then renders at the same size, and §5's
guard is what proves it.

`personWidthPx` is used only by §4.2's `front`/`back`. It is a declared constant
rather than a measurement of the art for the same reason as §3.1: one mechanism,
no per-art data. The alternative — putting `front`/`back` at the cell's own edges
— needs no constant at all but places effects visibly outside the body, half a
cell (≈47px at the near row) from its centre.

`classFactor` keeps exactly one job — a boss is twice a person — and the existing
`BOSS_DISPLAY_SCALE_MULTIPLIER = 2 x ENEMY` becomes `classFactor: 2` with its
2026-09-05 reason intact.

**What this deliberately does NOT do:** change how anything is laid out, and it
does not touch `CHARACTER_WIDTH_RATIO`'s use for Rectangle fallbacks and health
bars. Health-bar width is a HUD decision, not a body measurement, and folding it
into this would widen C for no gain. It is named in §2.4 so that nobody later
reads its survival as an oversight.

**Calibration, and a pleasant surprise.** The starting value for
`PERSON_HEIGHT_IN_CELLS` is the one that reproduces today's *enemy* size, because
the enemy is the entity whose art is real and whose size nobody has complained
about. Measured at 1600x900:

```
near cell width (row 9)        94.49
characterHeight                86.93   = 94.49 * 0.92          ✓ formula confirmed
enemy at row 5, depthScale 0.70735
  boxHeight                   122.98   = 86.93 * 0.70735 * 2   ✓
  extent.h                      1.000  (untrimmed PNG)
  personHeight                122.98

PERSON_HEIGHT_IN_CELLS = 122.98 / (94.49 * 0.70735) = 1.840
```

**1.840 is exactly 0.92 x 2** — the existing `* 0.92` and
`ENEMY_DISPLAY_SCALE_MULTIPLIER = 2` multiplied together. So the new constant is
not a new guess at all: it is the product of the two the tree already had, with
the meaning they never wrote down. Enemies are a **bit-exact** no-op, not an
approximate one.

The player moves, which is the point:

```
now:      personHeight  91.13   (box 114.73 x extent.h 0.794)
under C:  personHeight 114.73   (box 144.45)     +25.9%
```

`PERSON_WIDTH_IN_CELLS` has no such anchor in the existing code and is a
judgement: **0.42** puts a person's shoulders at about 40px at the near row,
roughly the proportion of the enemy art, and §5.1 records that no test can say
whether it looks right.

---

## 4. The contract

### 4.1 One measured datum, for scale only

```ts
// presentation/art/CombatEntityPresentation.ts

/**
 * Where the character's own pixels sit inside the clip's authored box, as
 * fractions of that box — the atlas's `spriteSourceSize` normalised by
 * `sourceSize`. Measured from the art, never hand-written.
 *
 * Used by SCALE alone (§3.2). Anchors do not read it: they come from the slot.
 */
export interface ArtExtent {
  x: number
  y: number
  w: number
  h: number
}
```

One field on `AtlasClip`, and one on `StaticEntityArt`, where it is `{0,0,1,1}`
for an untrimmed PNG and every formula collapses to today's behaviour.

It replaces the separate `fillRatioH` an earlier draft proposed: **`extent.h` IS
the fill ratio**, and two ways to say one number is the defect Spec A logged as V9.

Only `extent.h` is read today. The other three are carried because they come free
from the same JSON field, and because they are what §3.1's upgrade path would need.

### 4.2 Five anchors, computed from the slot

```ts
// presentation/geometry/combatBodyAnchors.ts

export type BodyAnchorId = 'top' | 'bottom' | 'centre' | 'front' | 'back'

/** Which way the entity faces. The player faces right; enemies face left. */
export type Facing = 'right' | 'left'

export interface BodyBox {
  /** The projected foot point at the centre of the entity's cell. */
  footX: number
  footY: number
  personHeight: number
  personWidth: number
  facing: Facing
}

export function bodyAnchor(id: BodyAnchorId, body: BodyBox): { x: number; y: number }
```

A pure function, in `presentation/geometry/` beside the rest of the shared
geometry (Spec A §3.6) — unit-testable without a canvas, like
`BattleGridProjection`:

```
bottom  ( footX ,                     footY                    )
top     ( footX ,                     footY - personHeight     )
centre  ( footX ,                     footY - personHeight / 2 )
front   ( footX ± personWidth / 2 ,   footY - personHeight / 2 )
back    ( footX ∓ personWidth / 2 ,   footY - personHeight / 2 )
```

`±` resolves by `facing`: `right` puts `front` at `+x`.

**Facing is the only state in an otherwise pure derivation**, and it is a
parameter rather than a flag read off the sprite so that nothing downstream has to
remember which way a wolf looks. A literal "front is +x" would put every enemy's
effects behind it — §5's fourth guard exists for exactly that.

### 4.3 One resolver for size

```ts
// presentation/geometry/combatEntityScale.ts

export interface EntityScaleInput {
  nearCellWidth: number
  depthScale: number
  classFactor: number
  extent: ArtExtent
  sourceSize: { w: number; h: number }
}

export function resolveEntityDisplaySize(
  input: EntityScaleInput,
): { boxWidth: number; boxHeight: number; personWidth: number; personHeight: number }
```

`applySpriteSize` and `applyEntityDepthScale` in `combat-grid-view.ts` both call
it. Today they each carry their own copy of the formula, which is how they came to
disagree with each other about `sourceSize` in the first place.

It returns `personWidth`/`personHeight` as well as the box, because §4.2 needs
exactly those and computing them twice is how the two halves would drift apart.

### 4.4 `SpriteBodyAnchor` loses its last combat caller

`resolveSpriteBodyAnchor` (`game/support/SpriteBodyAnchor.ts`) resolves an anchor
against a **sprite transform** — origin, display size, flip, rotation. §3.1 moved
anchors off the sprite entirely, so combat stops calling it: the debug overlay and
the reward gourd both take §4.2's slot-derived points instead.

Measured: those two are its only callers in the tree. It therefore becomes dead
code, and so does `PlayerVisualProfile.bodyAnchors` as far as combat is concerned.

**Neither is deleted by this spec.** `bodyAnchors` still describes the profile's
static PNG, which `MainScene` and the cultivation pose draw, and a future VFX there
is exactly what it is for. Deleting a capability is a product decision, not a
tidying decision — the same ruling this branch already applied to
`themePhaserSync`. What C does is stop combat reading a table about a picture it
does not show, and say out loud that `SpriteBodyAnchor.ts` now has no caller, so
the next person to touch it knows it is a choice and not an accident.

---

## 5. Enforcement

Every guard is observed red against a probe before acceptance (Spec A §7).

| Guard | Asserts | Probe that must fail it |
|---|---|---|
| `combatEntityScale.test.ts` | A player and an ordinary enemy on the same row resolve to the **same person height**; a boss to twice it | Give the player a different `classFactor` |
| `combatEntityScale.test.ts` | Changing `extent.h` changes `boxHeight` and leaves `personHeight` **unchanged** | Make the resolver size the box directly |
| `combatBodyAnchors.test.ts` | `top`/`bottom` bracket the body exactly; `centre` is their midpoint; `front`/`back` are level with `centre` | Hang `top` off the box instead of the person height |
| `combatBodyAnchors.test.ts` | `front` and `back` **swap** when facing does, and `top`/`bottom`/`centre` do not move | Ignore the facing parameter |
| `combatBodyAnchors.test.ts` | Two entities on the same cell with different ART get **identical** anchors | Read anything about the texture |
| `atlasFramesExist.test.ts` | The declared `extent` matches the tallest frame's `spriteSourceSize` normalised by `sourceSize` | Declare `{0,0,1,1}` for trimmed art |
| e2e capture | The player's **character height** on screen, not its box, sits within tolerance of the enemy's | Revert §4.3 and measure the box |

**The second and the sixth earn their keep together.** They are the assertion
whose absence let `c0826723` ship: that the thing being sized is the character,
and that what the metadata says about the art matches the art.

**The fifth is what makes §3.1 a mechanism rather than a claim.** "One mechanism
for everything" is only true if the anchors genuinely cannot see the art, and this
is the assertion that notices if somebody later reaches for the sprite to make one
case slightly nicer.

### 5.1 What these cannot catch

They check arithmetic and measurement. They cannot check that either constant
LOOKS right — `PERSON_HEIGHT_IN_CELLS` is calibrated against enemy art and
`PERSON_WIDTH_IN_CELLS` is a judgement with no anchor in the existing code
(§3.2). A value uniformly wrong passes everything here and makes everybody a
giant. That judgement is the e2e capture plus somebody looking at it.

Nor can they catch the thing §3.1 knowingly gave up: an anchor that is in the
right place for the slot and the wrong place for the character standing in it.
There is no test for "the effect should have left the hand", because the design
does not promise it.

---

## 6. Sequencing

1. **§4.1's `extent`**, measured by the placeholder generator and guarded against
   the atlas JSON. Data only; nothing reads it yet.
2. **§4.3's scale resolver and its tests, called by nothing.** Pure arithmetic,
   no pixels move.
3. **`combat-grid-view.ts` calls it.** Pixels move here, and only here — one step
   whose entire visible effect is a size change, so a regression is attributable.
   Enemies must be a bit-exact no-op by §3.2's calibration; that is the step's own
   check.
4. **§4.2's `bodyAnchor()` and its tests**, called by nothing.
5. **The two call sites** switch to it — the debug overlay and the reward gourd —
   and `ENEMY_NEUTRAL_BODY_ANCHOR` is deleted in this step, not before.
6. **The e2e capture**, extended to measure character height rather than box
   height.

Steps 3 and 5 are deliberately separate: one changes how big things are, the other
where effects attach. Together they would make a misplaced effect impossible to
attribute to either.

---

## 7. Acceptance criteria

1. `anchorForFrame` does not exist, and Spec B §5.2/§5.3 carry a correction
   pointing at §2.1's measurement.
2. One function computes display size; `applySpriteSize` and
   `applyEntityDepthScale` share it rather than each carrying the formula.
3. A player and an ordinary enemy on the same row render at the same **character**
   height, measured on screen, not the same box height.
4. Regenerating the placeholder art with different margins changes no character's
   size on screen. Demonstrated by regenerating it, not asserted.
5. Anchors are computed from the cell and the person box alone. No anchor code
   reads a texture, a frame, an extent, or a sprite transform.
6. `ENEMY_NEUTRAL_BODY_ANCHOR` is gone, and the reward gourd uses the same
   `centre` for the player and for every enemy.
7. Seven guards exist and each has been observed red against a probe.
8. Full gate green: type-check, build, vitest, Playwright.
9. Verified on screen: the player and an enemy stand at comparable height, and
   reward motes leave the body rather than the air beside it.

**Criterion 4 protects §3.2** — if regenerating the art moves anybody, size is
still being taken from the box. **Criterion 5 protects §3.1** — if any anchor code
reads the art, the "one mechanism" has already grown a second one.

---

## 8. What this spec is honest about

**The anchors do not follow the character, by design.** They describe a notional
body standing in a cell. A boss's `top` is above a boss-sized body only because
`classFactor` scales the box, not because anything looked at the boss. When real
art arrives and an effect wants the actual hand, the answer is not to patch this —
it is per-clip anchor data, which §4.2's signature already admits by taking a body
box rather than reading one.

**`PERSON_WIDTH_IN_CELLS` is the weakest number in this spec.** Height was
calibrated to reproduce existing enemy size exactly; width has no such reference,
because nothing in the tree ever expressed a person's width for a Sprite
(`CHARACTER_WIDTH_RATIO` is a health-bar measurement, §2.4). 0.42 is a judgement
from looking at the enemy art, and it will likely be re-tuned once character art
exists.

**Two anchor systems now exist** — C's, for combat, and
`PlayerVisualProfile.bodyAnchors` with `resolveSpriteBodyAnchor`, for the PNG the
home and cultivation scenes draw. The second has **no caller at all** after step 5
(§4.4). That is dead code kept deliberately, not an oversight; if it is still
callerless when the cultivation scene is next touched, it should be deleted then.

**C does not fix the empty-box problem for enemies**, because they have none —
their PNGs are untrimmed, so `extent` is `{0,0,1,1}`. The first trimmed enemy
export will exercise the static branch for real. This spec routes it through the
same resolver, but nothing can test that today: a known gap, not a surprise.
