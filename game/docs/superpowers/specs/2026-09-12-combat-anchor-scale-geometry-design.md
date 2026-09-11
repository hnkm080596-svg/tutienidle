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

Five anchors feed real effects: `combat-vfx-spawner.ts:622` spawns skill VFX at
them, and `combat-reward-gourd.ts:278` launches reward motes from `chest`.

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

### 2.5 Enemies have no anchors, deliberately

`combat-reward-gourd.ts` uses `ENEMY_NEUTRAL_BODY_ANCHOR` — a neutral body point
derived from sprite bounds — and a comment records the audit that put it there:
never apply the player's anchors to an enemy. That decision stands and this spec
does not disturb it (§3.1).

---

## 3. The decisions

Both taken by the product owner on 2026-09-11.

### 3.1 One anchor set per entity, authored against the art the clip draws — **decided**

Not per clip, and not per frame.

| | cost | what it buys |
|---|---|---|
| **Per entity (chosen)** | 5 numbers per character | VFX attach to the right region of the body |
| Per clip | 5 x 5 per character, re-tuned whenever art changes | a cast hand that is right during `cast` |
| Per frame | 32 x 5 per character; not hand-writable, needs a tool | a hand that tracks exactly |

The constraint that decides it is the same one that decided §3.2 of Spec B: **art
cost**. No character art is drawn yet, and a contract that demands 160 hand-tuned
numbers per character before the first character exists is a contract that will be
filled in with guesses.

**The accepted consequence, stated plainly:** during a clip with large limb
movement, a VFX anchored to `castHand` will sit near the hand, not on it. For a
palm strike or a sword flourish that is a few pixels at the scales in §2.3. It is
wrong, it is bounded, and it is cheap to upgrade later — per-clip anchors are a
strictly additive change to §4.1's shape, because a clip-level table can override
an entity-level one without any consumer changing.

**Enemies keep no anchor table at all.** They are still images (Spec B §3.2), and
`ENEMY_NEUTRAL_BODY_ANCHOR` derived from bounds is both sufficient and the outcome
of a previous audit (§2.5).

### 3.2 C owns scale, stated as a measurable claim about the world — **decided**

Replace the stack in §2.4 with one sentence that can be checked:

> **An adult person stands `PERSON_HEIGHT_IN_CELLS` times the width of a near-row
> grid cell.**

The near cell's **width** is the ruler, for the reason already recorded in the
tree: the cell's height is perspective-compressed and is not a ruler for anything
upright.

Everything else derives:

```
personHeightPx = nearCellWidth * PERSON_HEIGHT_IN_CELLS * depthScale * classFactor
boxHeightPx    = personHeightPx / fillRatioH          // fillRatioH from the art
boxWidthPx     = boxHeightPx * (sourceSize.w / sourceSize.h)
```

The division by `fillRatioH` is the whole point: **the size that is specified is
the size of the character, and the box is whatever it has to be to make that
true.** Re-exported art with different margins then renders at the same size, and
§5's guard is what proves it.

`classFactor` keeps exactly one job — a boss is twice a person — and the existing
`BOSS_DISPLAY_SCALE_MULTIPLIER = 2 x ENEMY` becomes `classFactor: 2` with its
2026-09-05 reason intact.

**What this deliberately does NOT do:** change how anything is laid out, and it
does not touch `CHARACTER_WIDTH_RATIO`'s use for Rectangle fallbacks and health
bars. Health-bar width is a HUD decision, not a body measurement, and folding it
into this would widen C for no gain. It is named in §2.4 so that nobody later
reads its survival as an oversight.

**Calibration, and a pleasant surprise.** The starting value is the one that
reproduces today's *enemy* size, because the enemy is the entity whose art is real
and whose size nobody has complained about. Measured at 1600x900:

```
near cell width (row 9)        94.49
characterHeight                86.93   = 94.49 * 0.92          ✓ formula confirmed
enemy at row 4… row 5, depthScale 0.70735
  boxHeight                   122.98   = 86.93 * 0.70735 * 2   ✓
  fillRatioH                   1.000   (untrimmed PNG)
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
now:      personHeight  91.13   (box 114.73 x fill 0.794)
under C:  personHeight 114.73   (box 144.45)     +25.9%
```

That is the distribution of risk C wants: real art unchanged, the entity that was
measurably wrong corrected.

---

## 4. The contract

### 4.1 Anchors move to the presentation catalogue

```ts
// presentation/art/CombatEntityPresentation.ts

export type BodyAnchorId = 'head' | 'chest' | 'castHand' | 'offHand' | 'feet'

/** A fraction of the clip's AUTHORED box (§2.1 — not of the trimmed pixels). */
export interface NormalizedBodyAnchor {
  x: number
  y: number
}

export type BodyAnchorTable = Record<BodyAnchorId, NormalizedBodyAnchor>
```

The animated branch of `CombatEntityPresentation` gains `anchors: BodyAnchorTable`.
The static branch does not: §3.1 keeps enemies on the neutral point.

`PlayerVisualProfile.bodyAnchors` stays where it is and keeps its current job —
describing the profile's **static PNG**, which `MainScene` and the cultivation
pose still draw. Nothing is deleted; what changes is that combat stops reading a
table describing a picture it no longer shows.

**Why the catalogue and not the profile.** The catalogue entry is the thing that
says which art is drawn (Spec B §4.4). An anchor is a fact about that art. Putting
them in one place is what makes §2.2 impossible to repeat: change the art and the
anchors are right there, in the same object, failing the guard in §5 if they are
not updated.

### 4.2 Fill ratio is declared, not discovered

```ts
export interface AtlasClip {
  // … B's existing fields, including sourceSize …

  /**
   * How much of the authored box the character's pixels actually occupy.
   * Vertical only: it is the one that sizes a standing person.
   */
  fillRatioH: number
}
```

It could be read from the live Phaser frame instead. It is declared because:

- a value that only exists at runtime cannot be guarded against the art on disk,
  and §5's second guard is the one that catches the §2.3 trap;
- it varies per frame (the placeholder breathes), and a size that changes every
  frame is a defect, not a feature. One number per clip, checked against the
  **tallest** frame, keeps the character's feet planted and its head from jittering.

### 4.3 One resolver for size

```ts
// presentation/geometry/combatEntityScale.ts

export interface EntityScaleInput {
  nearCellWidth: number
  depthScale: number
  classFactor: number
  fillRatioH: number
  sourceSize: { w: number; h: number }
}

export function resolveEntityDisplaySize(
  input: EntityScaleInput,
): { boxWidth: number; boxHeight: number; personHeight: number }
```

A pure function in `presentation/geometry/`, beside the rest of the shared
geometry (Spec A §3.6), so it is unit-testable without a canvas — the same reason
`BattleGridProjection` lives there.

`applySpriteSize` and `applyEntityDepthScale` in `combat-grid-view.ts` both call
it. Today they each carry their own copy of the formula, which is how they came to
disagree with each other about `sourceSize` in the first place.

### 4.4 The anchor resolver keeps its shape

`resolveSpriteBodyAnchor` (`game/support/SpriteBodyAnchor.ts`) is **unchanged**.
§2.1 is why: it already resolves against `displayWidth`/`displayHeight`, which
Phaser reports as the authored box, which is exactly the space §4.1's anchors are
expressed in. The function was right; only its inputs were wrong.

What changes is one line at each call site: where the anchor table comes from.

---

## 5. Enforcement

Every guard is observed red against a probe before acceptance (Spec A §7).

| Guard | Asserts | Probe that must fail it |
|---|---|---|
| `combatEntityScale.test.ts` | A player and an ordinary enemy on the same row resolve to the **same person height**; a boss to twice it | Give the player a different `classFactor` |
| `combatEntityScale.test.ts` | Changing `fillRatioH` changes `boxHeight` and leaves `personHeight` **unchanged** | Make the resolver size the box directly |
| `bodyAnchorTable.test.ts` | Every animated entity declares all five anchors, each within [0,1] | Delete one anchor; set one to 1.4 |
| `bodyAnchorTable.test.ts` | `feet` and `head` lie inside the art's real vertical extent, read from the atlas JSON on disk | Restore `feet: 0.97` against art whose feet are at 0.871 |
| `atlasFramesExist.test.ts` | The declared `fillRatioH` matches the tallest frame's `spriteSourceSize.h / sourceSize.h` | Declare 1.0 for trimmed art |
| e2e capture | The player's **character height** on screen, not its box, sits within tolerance of the enemy's | Revert §4.3 and measure the box |

**The second and the fifth are the ones that earn their keep.** Together they are
the assertion whose absence let `c0826723` ship: that the thing being sized is the
character, and that what the metadata says about the art matches the art.

### 5.1 What these cannot catch

They check that a character is the size it was declared to be. They cannot check
that the declared size **looks right** — `PERSON_HEIGHT_IN_CELLS` is calibrated by
eye (§3.2), and a value that is uniformly wrong passes every assertion here while
making everybody a giant. That judgement is the e2e capture plus somebody looking
at it, and it is stated here so nobody reads green as "the scale is good".

Nor can they catch an anchor that is inside the character but on the wrong part of
it — `chest` at the knee passes every check. Only §5's extent guard bounds this,
and it bounds it loosely on purpose: a tight bound would need per-frame data,
which §3.1 declined to pay for.

---

## 6. Sequencing

1. **§4.3's resolver and its tests, called by nothing.** Pure arithmetic, verified
   in isolation, no pixels move.
2. **`combat-grid-view.ts` calls it.** Pixels move here, and only here — one step
   whose entire visible effect is a size change, so a regression is attributable.
   Enemies must be a no-op by §3.2's calibration; that is the step's own check.
3. **§4.1's anchors into the catalogue**, with `PlayerVisualProfile.bodyAnchors`
   left in place for the scenes that still draw the PNG.
4. **The two call sites** (`combat-player-visual.ts`, `combat-reward-gourd.ts`)
   read the catalogue.
5. **Guards and the e2e capture**, each probed red.

Steps 2 and 3 are deliberately separate: one changes how big things are and the
other changes where effects attach. Shipping them together would make a
misplaced VFX impossible to attribute to either.

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
5. Combat reads anchors from the catalogue; `PlayerVisualProfile.bodyAnchors` is
   still read by the scenes that draw the PNG, and is unchanged.
6. No anchor lies in transparent space: every declared anchor is inside the art's
   measured extent.
7. Six guards exist and each has been observed red against a probe.
8. Full gate green: type-check, build, vitest, Playwright.
9. Verified on screen: the player and an enemy stand at comparable height, and
   skill VFX leave the player's body rather than the air beside it.

**Criterion 4 is the one that protects §3.2.** If regenerating the art moves
anybody, then the size is still being taken from the box and the design has not
landed.

---

## 8. What this spec is honest about

**The anchors will still be approximate.** §3.1 bought cheapness with accuracy,
knowingly. A VFX on `castHand` during a big swing will be near the hand. If that
reads badly once real art exists, the fix is per-clip anchors, which §4.1's shape
already admits without a consumer changing.

**`PERSON_HEIGHT_IN_CELLS` is calibrated against art that is a placeholder.** The
enemy PNGs are real art, which is why they are the calibration point — but they
are enemies. The first real *character* art may well want a different number, and
§5.1 says no test will tell anybody that.

**Two anchor tables now exist** — the catalogue's, for combat, and the profile's,
for the PNG the home and cultivation scenes draw. That is duplication, and it is
chosen: they describe two different pictures, and collapsing them is what caused
§2.2. If the two pictures ever become one asset, the tables should merge, and
whoever does that should delete this paragraph.

**C does not fix the empty-box problem for enemies**, because they have none —
their PNGs are untrimmed. The first trimmed enemy export will exercise
`fillRatioH` on the static branch, which this spec routes through the same
resolver but cannot test today. Stated so that it is a known gap and not a
surprise.
