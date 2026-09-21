# ENTITY_ART_MODE Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One compile-time constant `ENTITY_ART_MODE: 'static' | 'animated'` that forces EVERY combat entity (player, companions, enemies, bosses) and every entity surface into a single uniform art form — never half-animated/half-static again.

**Architecture:** `CombatPresentationCatalogue` already models each entity's art as a discriminated union (`kind: 'static'` = one PNG + procedural bob, `kind: 'animated'` = clip set). The switch selects which form each registered entity emits; every consumer (`playCombatAnimation`, `beginDeathSequence`, `startIdleMotion`, preload, sizing) already narrows on `kind`, so the mode propagates with zero playback-code branching. Unregistered entities fall back to a single mode-matched placeholder entry (uniformity invariant), tracked by a shrink-only debt test.

**Tech Stack:** TypeScript, Phaser 4, Vue 3 (`<script setup>`), Vitest, `canvas` (Node, already a dep — used by `scripts/pack-mortal-combat-art.mjs` for `opaqueBounds`-style alpha measurement).

**Spec:** This document IS the spec — the locked decisions below were grilled and confirmed with the user on 2026-09-19. No external spec file.

## Locked Decisions (user-confirmed, do not re-litigate)

1. **Switch is compile-time.** `export const ENTITY_ART_MODE` in `src/presentation/art/EntityArtMode.ts`. Changing it = edit + rebuild. No runtime/player-facing toggle.
2. **Beta ships `static`.** `animated` is the guarded future mode, reachable when animated art debt clears.
3. **Uniform animated contract** for EVERY entity (player, companions, ~30 enemies, bosses — all the same): `idle`, `standby`, `death`, `idle_to_standby`, `standby_to_idle` (5 clips). Player-side entities additionally carry `cultivate` (6th, optional).
4. **Attack clips die for everyone.** `cast`/`sweep_hand`/`punch`/`ready` removed from `CombatAnimationName`; `combatAnimationForSkill` + `MORTAL_SKILL_ANIMATIONS` deleted. Attack readability = the existing 350ms lunge tween, uniform for all.
5. **`ready` merges into `standby`.** Turn-start plays `idle_to_standby` (chains to `standby` loop); turn-end plays `standby_to_idle` (chains to `idle`). Entities without transition clips snap directly to the destination loop.
6. **Missing art = placeholder, loudly tracked.** One shared placeholder per mode (a silhouette PNG for `static`, the existing 32-frame sheet for `animated`), registered as `entity-placeholder`. The debt list is a shrink-only ratchet test.
7. **Scope = all surfaces.** CombatScene, TranPhap preview, TribulationScene, MainScene figure, and Vue panels (`PlayerPortrait`) all follow the mode. `PlayerPortrait` is the shared figure component — `CharacterPanel`/`CharacterDetailCard` inherit mode-awareness automatically; `CompanionPanel` has no figure surface (roster/stats only) and needs no change. Artifacts, reward gourd, Thanh Van backdrops are NOT entities — exempt.
8. **Static mode uniform motion:** every entity (including the player) gets the `IdleMotion` bob + lunge attack + pulse turn-signal + rotate/fade death — exactly what enemies already do.

## Global Constraints

- **Worktree required** (P2): implement in `.agent-worktrees/entity-art-mode` via `using-git-worktrees`. Do NOT edit the main checkout.
- **No new dependencies.** `canvas` is already a dependency — reuse it for PNG generation/measurement scripts.
- **No `any`** unless genuinely necessary (P8); flag if unavoidable.
- **Verification (P3):** `cd game && npm run type-check` + `npx vitest run <relevant scope>` per task; `npm run verify` (full) at the end — this touches Phaser scene infra + asset pipeline.
- **P13/P14 runtime check** at the end: this is sprite-rendering work — visually confirm a real combat in the worktree dev server (player + enemies show static PNGs in `static` mode; bob, lunge, death tween all work).
- The battle engine, turn timing, and `acknowledgeActionImpact` are OUT OF SCOPE — attack impact timing already runs on the lunge tween, not on clips.
- Commit style follows existing history (`git log --oneline -5` to match).

## File Structure

**Create:**
- `src/presentation/art/EntityArtMode.ts` — the switch constant + type.
- `public/assets/characters/placeholder/entity-placeholder.png` — static-mode placeholder silhouette (generated).
- `scripts/generate-entity-placeholder.mjs` — canvas script that emits the silhouette PNG.
- `scripts/measure-entity-extents.mjs` — canvas script that prints normalized alpha-bbox extents for static PNGs (constants get hardcoded from its output).
- `src/components/common/EntitySpriteCanvas.vue` — rAF canvas frame-stepper over an atlas (for Vue surfaces in animated mode).
- `tests/architecture/artModeUniformity.test.ts` — the uniformity invariant + placeholder debt ratchet.

**Modify:**
- `src/core/battle/CombatAnimationTypes.ts` — shrink union to 6 names.
- `src/presentation/art/CombatEntityPresentation.ts` — catalogue Record → interface (3 required + 3 optional clips).
- `src/presentation/art/CombatPresentationCatalogue.ts` — mode-driven build, static player entries, mortal-v2 remap, placeholder entity, delete skill-animation mapping.
- `src/game/scenes/combat/combat-animation-playback.ts` — transition chaining + snap fallback + placeholder prefix.
- `src/game/scenes/combat/combat-action-feedback.ts` — remove attack clip call; remap ready→`idle_to_standby`, standby→`standby_to_idle`.
- `src/game/scenes/combat/combat-grid-view.ts` — player `startIdleMotion` call; enemy placeholder-texture branch; idle kick on sprite creation.
- `src/game/scenes/combat/CombatGridViewHost.ts` — add `startEntityIdle(sprite, id)` host method.
- `src/game/scenes/CombatScene.ts` — implement `startEntityIdle`; remove `playerUsesStaticTexture`.
- `src/game/scenes/combat/combat-player-visual.ts` — remove `playerUsesStaticTexture` write.
- `src/game/scenes/TranPhapCombatPreviewScene.ts` — mode-aware fallback texture + play gating + player idle.
- `src/game/scenes/TribulationScene.ts` — static → cultivate PNG; animated → existing multiatlas.
- `src/game/scenes/MainScene.ts` — animated → player atlas idle / cultivate multiatlas when sitting.
- `src/game/support/CombatPreload.ts` — queue placeholder PNG in static mode.
- `src/components/common/PlayerPortrait.vue` — mode branch: `<img>` vs `EntitySpriteCanvas`.

**Test updates (in the task that breaks them):**
- `tests/architecture/animationCatalogue.test.ts`, `atlasFramesExist.test.ts`, `artExtentDeclared.test.ts`, `artTierDebt.test.ts`
- `src/game/scenes/CombatScene.combatAnimations.test.ts`, `src/game/scenes/TranPhapCombatPreviewScene.test.ts`, `src/game/scenes/combat/combat-grid-view.test.ts`
- `src/presentation/assets/AssetBundleCatalog.test.ts`

---

### Task 1: Mode constant + static placeholder asset + measured extents

**Files:**
- Create: `src/presentation/art/EntityArtMode.ts`
- Create: `scripts/generate-entity-placeholder.mjs`
- Create: `scripts/measure-entity-extents.mjs`
- Create: `public/assets/characters/placeholder/entity-placeholder.png` (script output)
- Test: `tests/architecture/artModeUniformity.test.ts` (created here, expanded in Task 6)

**Interfaces:**
- Produces: `ENTITY_ART_MODE: EntityArtMode` (consumed by catalogue, playback, grid-view, scenes, PlayerPortrait); `PLACEHOLDER_ENTITY_TEXTURE_KEY = 'entity-placeholder'`; `PLAYER_STATIC_EXTENTS: Record<string, ArtExtent>` constants used in Task 2.

- [ ] **Step 1: Write the mode constant**

```ts
// src/presentation/art/EntityArtMode.ts
// ENTITY_ART_MODE — the ONE switch deciding what every combat entity's art IS.
//
// Uniformity contract (locked 2026-09-19): 'static' = every entity is one PNG
// plus procedural motion (bob/lunge/pulse/rotate-fade); 'animated' = every
// entity is a clip set (idle/standby/death + optional transitions + cultivate).
// The catalogue emits each entity's `kind` from this constant, so the whole
// tree — combat, panels, previews — moves together. Compile-time by design:
// shipping a runtime toggle would mean producing BOTH art forms forever.
export type EntityArtMode = 'static' | 'animated'

export const ENTITY_ART_MODE: EntityArtMode = 'static'
```

- [ ] **Step 2: Write the placeholder silhouette generator**

```js
// scripts/generate-entity-placeholder.mjs
// Emits entity-placeholder.png — the static-mode placeholder for any entity
// with no authored art (uniformity: unregistered entities render THIS, not a
// colored Rectangle). Neutral ink silhouette, 128x128, transparent bg.
import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SIZE = 128
const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../public/assets/characters/placeholder/entity-placeholder.png',
)

const canvas = createCanvas(SIZE, SIZE)
const ctx = canvas.getContext('2d')

// Head
ctx.fillStyle = '#3a3f4a'
ctx.beginPath()
ctx.arc(64, 34, 16, 0, Math.PI * 2)
ctx.fill()

// Shoulders + body (trapezoid robe shape)
ctx.beginPath()
ctx.moveTo(64, 52)
ctx.lineTo(34, 66)
ctx.quadraticCurveTo(28, 96, 30, 118)
ctx.lineTo(98, 118)
ctx.quadraticCurveTo(100, 96, 94, 66)
ctx.closePath()
ctx.fill()

// Inner robe shadow
ctx.fillStyle = '#2c303a'
ctx.beginPath()
ctx.moveTo(64, 60)
ctx.lineTo(48, 70)
ctx.quadraticCurveTo(46, 96, 47, 118)
ctx.lineTo(64, 118)
ctx.closePath()
ctx.fill()

// Question mark, centered on chest
ctx.fillStyle = '#8b93a5'
ctx.font = 'bold 28px sans-serif'
ctx.textAlign = 'center'
ctx.textBaseline = 'middle'
ctx.fillText('?', 64, 88)

mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, canvas.toBuffer('image/png'))
console.log(`wrote ${OUT}`)
```

- [ ] **Step 3: Write the extent measurement script**

```js
// scripts/measure-entity-extents.mjs
// Prints normalized ArtExtent {x,y,w,h} (0..1 of source) for each static PNG —
// the alpha bounding box of the figure, same measurement as opaqueBounds() in
// pack-mortal-combat-art.mjs. Paste output into PLAYER_STATIC_EXTENTS /
// PLACEHOLDER_STATIC_EXTENT in CombatPresentationCatalogue.ts.
import { createCanvas, loadImage } from 'canvas'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public')

const TARGETS = [
  'assets/characters/player/mortal/player-mortal-ink-sword-concept-v2.png',
  'assets/characters/player/phap-tu/player-phap-tu-v1.png',
  'assets/characters/placeholder/entity-placeholder.png',
]

function opaqueBounds(ctx, w, h) {
  const { data } = ctx.getImageData(0, 0, w, h)
  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] === 0) continue
      minX = Math.min(minX, x); minY = Math.min(minY, y)
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
    }
  }
  if (maxX < 0) throw new Error('fully transparent image')
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

for (const rel of TARGETS) {
  const img = await loadImage(path.join(ROOT, rel))
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const b = opaqueBounds(ctx, img.width, img.height)
  console.log(rel)
  console.log(
    `  { x: ${(b.x / img.width).toFixed(6)}, y: ${(b.y / img.height).toFixed(6)}, ` +
      `w: ${(b.w / img.width).toFixed(6)}, h: ${(b.h / img.height).toFixed(6)} }`,
  )
}
```

- [ ] **Step 4: Run both scripts, produce the asset + constants**

```bash
cd game
node scripts/generate-entity-placeholder.mjs
node scripts/measure-entity-extents.mjs
```

Expected: `entity-placeholder.png` written; script prints 3 extent literals. Record the printed values — Task 2 hardcodes them.

- [ ] **Step 5: Write the failing uniformity test skeleton**

```ts
// tests/architecture/artModeUniformity.test.ts
import { describe, expect, it } from 'vitest'
import { ENTITY_ART_MODE } from '@/presentation/art/EntityArtMode'
import {
  combatPresentationEntityKeys,
  presentationFor,
} from '@/presentation/art/CombatPresentationCatalogue'

describe('ENTITY_ART_MODE uniformity', () => {
  it('every registered presentation kind matches ENTITY_ART_MODE', () => {
    for (const key of combatPresentationEntityKeys()) {
      expect(presentationFor(key)?.kind, `entity '${key}'`).toBe(ENTITY_ART_MODE)
    }
  })
})
```

- [ ] **Step 6: Run test — verify it FAILS**

```bash
cd game && npx vitest run tests/architecture/artModeUniformity.test.ts
```

Expected: FAIL — the catalogue still emits `animated` for player profiles while `ENTITY_ART_MODE === 'static'`.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/art/EntityArtMode.ts scripts/generate-entity-placeholder.mjs scripts/measure-entity-extents.mjs public/assets/characters/placeholder/entity-placeholder.png tests/architecture/artModeUniformity.test.ts
git commit -m "feat(art): ENTITY_ART_MODE constant + static placeholder asset + extent measurement tooling"
```

---

### Task 2: Contract shrink + mode-driven catalogue

**Files:**
- Modify: `src/core/battle/CombatAnimationTypes.ts`
- Modify: `src/presentation/art/CombatEntityPresentation.ts`
- Modify: `src/presentation/art/CombatPresentationCatalogue.ts`
- Modify: `src/game/scenes/combat/combat-action-feedback.ts` (call-site remap — the old names stop compiling here)
- Test: `tests/architecture/animationCatalogue.test.ts`, `tests/architecture/artTierDebt.test.ts` (update to new contract)

**Interfaces:**
- Consumes: `ENTITY_ART_MODE`, measured extents from Task 1.
- Produces: `CombatAnimationCatalogue` interface (`idle`/`standby`/`death` required + `idle_to_standby`/`standby_to_idle`/`cultivate` optional); `PLACEHOLDER_ENTITY_KEY`; `placeholderEntityKeys()` (mode-aware debt list); static player + enemy presentations.

- [ ] **Step 1: Shrink `CombatAnimationName`**

```ts
// src/core/battle/CombatAnimationTypes.ts — replace the union:
export type CombatAnimationName =
  | 'idle'
  | 'standby'
  | 'death'
  | 'idle_to_standby'
  | 'standby_to_idle'
  | 'cultivate'
```

Update the header comment: names that died (`hit`, `basic_attack`, `victory`, and now `ready`, `cast`, `sweep_hand`, `punch`) — record why: uniform contract, attack readability lives on the lunge tween.

- [ ] **Step 2: Catalogue type — Record → interface**

In `src/presentation/art/CombatEntityPresentation.ts`, replace `CombatAnimationCatalogue`:

```ts
/**
 * One entity's clip set. The three combat states are REQUIRED — the compiler
 * checks the record (add a name to CombatAnimationName and this object stops
 * compiling until it has a clip). Transitions and cultivate are optional:
 * entities without them snap to the destination loop (placeholder) or render
 * the static cultivate PNG (non-combat surfaces).
 */
export interface CombatAnimationCatalogue {
  idle: AtlasClip
  standby: AtlasClip
  death: AtlasClip
  idle_to_standby?: AtlasClip
  standby_to_idle?: AtlasClip
  cultivate?: AtlasClip
}
```

- [ ] **Step 3: Rewrite the catalogue build**

In `CombatPresentationCatalogue.ts`:

```ts
import { ENTITY_ART_MODE } from './EntityArtMode'

/** Static-mode placeholder — one shared silhouette for unregistered entities. */
export const PLACEHOLDER_ENTITY_KEY = 'entity-placeholder'
export const PLACEHOLDER_STATIC_TEXTURE_KEY = 'entity-placeholder'
export const PLACEHOLDER_STATIC_TEXTURE_URL =
  'assets/characters/placeholder/entity-placeholder.png'

// Measured by scripts/measure-entity-extents.mjs — paste its output here.
const PLAYER_STATIC_EXTENT_MORTAL = { x: 0, y: 0, w: 1, h: 1 } // ← real values from Task 1 Step 4
const PLAYER_STATIC_EXTENT_PHAP_TU = { x: 0, y: 0, w: 1, h: 1 } // ← real values
const PLACEHOLDER_STATIC_EXTENT = { x: 0, y: 0, w: 1, h: 1 } // ← real values
```

Add a static-extent lookup keyed by `combatTextureKey` (mortal + phap_tu real; kiem_tu/the_tu share mortal's PNG → same extent):

```ts
const PLAYER_STATIC_EXTENTS: Record<string, ArtExtent> = {
  'player-mortal-ink-sword-concept-v2': PLAYER_STATIC_EXTENT_MORTAL,
  'player-phap-tu-v1': PLAYER_STATIC_EXTENT_PHAP_TU,
}
```

Remap the mortal atlas to the new contract (attack frames become dead art — idle/standby/death ranges are reusable; no transitions → snap):

```ts
function playerMortalCatalogue(entityKey: string): CombatAnimationCatalogue {
  return {
    idle: playerMortalClip(entityKey, 'idle', 0, 31, 8, PLAYER_MORTAL_IDLE_EXTENT, -1),
    standby: playerMortalClip(entityKey, 'standby', 32, 42, 8, PLAYER_MORTAL_STANDBY_EXTENT, -1),
    death: playerMortalClip(entityKey, 'death', 91, 106, 10, PLAYER_MORTAL_DEATH_EXTENT, 0),
  }
}
```

Placeholder animated catalogue — 3 clips over the shared 32f sheet (every clip plays the same frames; transitions absent → snap):

```ts
function placeholderClips(entityKey: string): CombatAnimationCatalogue {
  const clip = (name: CombatAnimationName): AtlasClip => ({
    key: combatAnimationKey(entityKey, name),
    sheetKey: PLACEHOLDER_SHEET_KEY,
    sheetUrl: PLACEHOLDER_SHEET_URL,
    atlasUrl: PLACEHOLDER_ATLAS_URL,
    framePrefix: PLACEHOLDER_FRAME_PREFIX,
    frameSuffix: PLACEHOLDER_FRAME_SUFFIX,
    zeroPad: PLACEHOLDER_ZERO_PAD,
    firstFrame: 0,
    lastFrame: PLACEHOLDER_FRAME_COUNT - 1,
    frameRate: PLACEHOLDER_FRAME_RATE,
    sourceSize: { w: PLACEHOLDER_FRAME_WIDTH, h: PLACEHOLDER_FRAME_HEIGHT },
    extent: { x: PLACEHOLDER_EXTENT_X, y: PLACEHOLDER_EXTENT_Y, w: PLACEHOLDER_EXTENT_W, h: PLACEHOLDER_EXTENT_H },
    repeat: name === 'death' ? 0 : -1,
  })
  return { idle: clip('idle'), standby: clip('standby'), death: clip('death') }
}
```

Mode-aware entry builder:

```ts
function entityPresentation(
  staticArt: { texture: StaticEntityArt; idleMotion: IdleMotion },
  animatedArt: { clips: CombatAnimationCatalogue },
): CombatEntityPresentation {
  return ENTITY_ART_MODE === 'animated'
    ? { kind: 'animated', clips: animatedArt.clips }
    : { kind: 'static', texture: staticArt.texture, idleMotion: staticArt.idleMotion }
}
```

Rewrite `buildCatalogue()`:

```ts
function buildCatalogue(): Map<string, CombatEntityPresentation> {
  const entries = new Map<string, CombatEntityPresentation>()

  for (const profile of Object.values(PLAYER_VISUAL_PROFILES)) {
    const clips =
      profile.combatTextureKey === PLAYER_VISUAL_PROFILES.mortal.combatTextureKey
        ? playerMortalCatalogue(profile.combatTextureKey)
        : placeholderClips(profile.combatTextureKey)

    entries.set(
      profile.combatTextureKey,
      entityPresentation(
        {
          texture: {
            textureKey: profile.combatTextureKey,
            textureUrl: profile.combatTextureUrl.replace(/^\/+/, ''),
            sourceSize: { ...profile.combatSourceSize },
            extent: PLAYER_STATIC_EXTENTS[profile.combatTextureKey] ?? PLAYER_STATIC_EXTENT_MORTAL,
          },
          idleMotion: idleMotionFor(profile.combatTextureKey),
        },
        { clips },
      ),
    )
  }

  entries.set(
    FALLBACK_PLAYER_ENTITY_KEY,
    entityPresentation(
      {
        texture: {
          textureKey: FALLBACK_PLAYER_ENTITY_KEY,
          textureUrl: PLAYER_VISUAL_PROFILES.mortal.combatTextureUrl.replace(/^\/+/, ''),
          sourceSize: { ...PLAYER_VISUAL_PROFILES.mortal.combatSourceSize },
          extent: PLAYER_STATIC_EXTENT_MORTAL,
        },
        idleMotion: idleMotionFor(FALLBACK_PLAYER_ENTITY_KEY),
      },
      { clips: playerMortalCatalogue(FALLBACK_PLAYER_ENTITY_KEY) },
    ),
  )

  for (const templateId of MORTAL_ENEMY_TEMPLATE_IDS) {
    const textureKey = resolveEnemyTextureKey(templateId)
    if (!textureKey) continue
    entries.set(
      textureKey,
      entityPresentation(
        {
          texture: {
            textureKey,
            textureUrl: enemyTextureUrl(textureKey),
            sourceSize: { ...ENEMY_SOURCE_SIZE },
            extent: { x: 0, y: 0, w: 1, h: 1 },
          },
          idleMotion: idleMotionFor(textureKey),
        },
        { clips: placeholderClips(textureKey) },
      ),
    )
  }

  // The wildcard placeholder — unregistered entities resolve to this key at
  // the resolution layer (entityAnimationKeyPrefix / getOrCreateSprite), so
  // every spawnable entity gets a presentation of the active mode's kind.
  entries.set(
    PLACEHOLDER_ENTITY_KEY,
    entityPresentation(
      {
        texture: {
          textureKey: PLACEHOLDER_STATIC_TEXTURE_KEY,
          textureUrl: PLACEHOLDER_STATIC_TEXTURE_URL,
          sourceSize: { w: 128, h: 128 },
          extent: PLACEHOLDER_STATIC_EXTENT,
        },
        idleMotion: idleMotionFor(PLACEHOLDER_ENTITY_KEY),
      },
      { clips: placeholderClips(PLACEHOLDER_ENTITY_KEY) },
    ),
  )

  return entries
}
```

Delete `MORTAL_SKILL_ANIMATIONS` + `combatAnimationForSkill` + `legacyPlaceholderCatalogue` + `LOOPING_NAMES`/`ONE_SHOT_NAMES`/`COMBAT_ANIMATION_NAMES` (keep `COMBAT_ANIMATION_NAMES` only if a test imports it — check; otherwise delete).

Housekeeping while here: `AtlasClip.impactFrame` is now dead metadata for every clip (impact timing lives on the lunge tween's midpoint; nothing consumes the field). Either drop the field + its `atlasFramesExist` assertions, or keep it as documented-unused — pick dropping it unless a consumer turns up in `grep impactFrame`.

Make `placeholderArtEntityKeys()` mode-aware (the debt list):

```ts
export function placeholderEntityKeys(): readonly string[] {
  const keys: string[] = []
  for (const [entityKey, presentation] of CATALOGUE) {
    if (entityKey === PLACEHOLDER_ENTITY_KEY) continue
    if (presentation.kind === 'animated') {
      if (Object.values(presentation.clips).every((c) => c.sheetKey === PLACEHOLDER_SHEET_KEY)) keys.push(entityKey)
    } else if (presentation.texture.textureKey === PLACEHOLDER_STATIC_TEXTURE_KEY) {
      keys.push(entityKey)
    }
  }
  return keys
}
```

(Keep `placeholderArtEntityKeys` name if the existing ratchet test imports it — rename or alias; check `tests/architecture/artTierDebt.test.ts` import and update in Step 5.)

- [ ] **Step 4: Remap the turn-event call sites**

In `src/game/scenes/combat/combat-action-feedback.ts`:

- DELETE the attack clip call + import:

```ts
// DELETE: import { combatAnimationForSkill } from '@/presentation/art/CombatPresentationCatalogue'
// DELETE: scene.playCombatAnimation(attacker, event.sourceId, combatAnimationForSkill(event.skillId))
```

The lunge tween + `acknowledgeActionImpact` stay untouched.

- `ready` → `idle_to_standby`:

```ts
scene.playCombatAnimation(sprite, event.actorId, 'idle_to_standby')
```

- `standby` (turn end) → `standby_to_idle`:

```ts
scene.playCombatAnimation(sprite, event.actorId, 'standby_to_idle')
```

- [ ] **Step 5: Update broken tests**

- `tests/architecture/animationCatalogue.test.ts` — update name list to the 6-name union; assert required 3 clips on every animated catalogue.
- `tests/architecture/artTierDebt.test.ts` — point at `placeholderEntityKeys()`; shrink-only assertion over the debt list.
- Any test importing `combatAnimationForSkill`/`MORTAL_SKILL_ANIMATIONS`/removed names — delete or update.

- [ ] **Step 6: Type-check + run architecture tests**

```bash
cd game
npm run type-check
npx vitest run tests/architecture/ src/presentation/
```

Expected: type-check green; the Task-1 uniformity test PASSES (all entries `static`); catalogue tests green. `CombatScene.combatAnimations.test.ts` may still fail (playback changes come in Task 3) — fix compile breaks now, behavior in Task 3.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(art): mode-driven catalogue, 5+1 clip contract, placeholder entity, kill attack-clip mapping"
```

---

### Task 3: Playback — transitions, snap fallback, placeholder prefix, uniform bob

**Files:**
- Modify: `src/game/scenes/combat/combat-animation-playback.ts`
- Modify: `src/game/scenes/combat/combat-action-feedback.ts` (verify remap lands correctly)
- Modify: `src/game/scenes/combat/combat-grid-view.ts`
- Modify: `src/game/scenes/combat/CombatGridViewHost.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `src/game/scenes/combat/combat-player-visual.ts`
- Test: `src/game/scenes/CombatScene.combatAnimations.test.ts`, `src/game/scenes/combat/combat-grid-view.test.ts`

**Interfaces:**
- Consumes: `CombatAnimationCatalogue` optional transition fields; `PLACEHOLDER_ENTITY_KEY`; `PLACEHOLDER_STATIC_TEXTURE_KEY`.
- Produces: `CombatGridViewHost.startEntityIdle(sprite: EntitySprite, id: string): void` — implemented by CombatScene (`playCombatAnimation(sprite, id, 'idle')`) and TranPhap (mode-gated `PREVIEW_IDLE_ANIMATION_KEY`).

- [ ] **Step 1: Write failing playback tests**

In `CombatScene.combatAnimations.test.ts` — add cases:

```ts
it('idle_to_standby plays then chains to standby loop on complete', () => {
  // sprite with a catalogue containing the transition clip;
  // fire ANIMATION_COMPLETE for the transition key and assert
  // the standby key got played next.
})

it('entity WITHOUT transition clip snaps straight to standby', () => {
  // catalogue with idle/standby/death only: playCombatAnimation
  // 'idle_to_standby' must play the standby key directly.
})
```

(Adapt to the existing fake-scene harness — `createScene()`, `makeSprite()`, stubbed `scene.anims`.)

- [ ] **Step 2: Transition chaining + snap fallback**

In `combat-animation-playback.ts`:

```ts
/** Transitions that never got authored as clips snap to their destination loop. */
const TRANSITION_DESTINATION: Partial<Record<CombatAnimationName, CombatAnimationName>> = {
  idle_to_standby: 'standby',
  standby_to_idle: 'idle',
}
```

In `playCombatAnimation`, after `const key = combatAnimationKey(prefix, name)`:

```ts
if (!this.scene.anims.exists(key)) {
  const destination = TRANSITION_DESTINATION[name]
  if (destination !== undefined) {
    this.playCombatAnimation(sprite, actorId, destination)
  }
  return
}
```

Replace the one-shot→idle `once` handler's destination:

```ts
const destination = TRANSITION_DESTINATION[name] ?? 'idle'
const destinationKey = combatAnimationKey(prefix, destination)
// ...once ANIMATION_COMPLETE → gameSprite.play(destinationKey)
```

Keep the `name === 'idle' || name === 'death'` early return (death still owns its finalize path).

Update `entityAnimationKeyPrefix` — unregistered enemies resolve to the placeholder entity:

```ts
entityAnimationKeyPrefix(actorId: string): string | undefined {
  if (actorId === PLAYER_ID) {
    return this.scene.playerProfile.combatTextureKey
  }
  return resolveEnemyTextureKey(actorId) ?? PLACEHOLDER_ENTITY_KEY
}
```

(This replaces `undefined` for unregistered enemies — `isAnimatedEntity` still gates whether anything plays: in `static` mode the placeholder entry is `kind: 'static'` so all plays no-op.)

- [ ] **Step 3: Uniform bob — player branch + enemy placeholder texture**

In `combat-grid-view.ts`:

- `getOrCreateSprite` player branch, after `this.host.sprites.set(id, sprite)` (before `return sprite`):

```ts
this.startIdleMotion(sprite, id, textureKey)
this.host.startEntityIdle(sprite, id)
```

- `startIdleMotion` currently gates on `presentation?.kind !== 'static'` — in `static` mode the player entry IS static → bob starts automatically. No change needed to the gate.

- Enemy branch — placeholder texture for unregistered ids:

```ts
const enemyTextureKey = resolveEnemyTextureKey(id) ?? placeholderTextureForMode()
```

```ts
function placeholderTextureForMode(): string {
  return ENTITY_ART_MODE === 'animated' ? PLACEHOLDER_SHEET_KEY : PLACEHOLDER_STATIC_TEXTURE_KEY
}
```

When `enemyTextureKey` came from the placeholder path, the sprite's `sourceSize`/`extent` must come from `presentationFor(PLACEHOLDER_ENTITY_KEY)` (static: 128×128 + measured extent; animated: sheet frame size + placeholder extent). `add.sprite` for an atlas texture needs the frame argument:

```ts
const presentation = presentationFor(enemyTextureKey)
const gameSprite =
  presentation?.kind === 'animated'
    ? this.host.add.sprite(0, 0, enemyTextureKey === PLACEHOLDER_SHEET_KEY ? PLACEHOLDER_SHEET_KEY : presentation.clips.idle.sheetKey, 'frame_000.png')
    : this.host.add.sprite(0, 0, enemyTextureKey)
```

Simplify: resolve `textureKey` + `sourceSize` + `extent` from the presentation in both branches (registered enemies keep their existing values — presentation.texture for static, clips.idle for animated).

- Kick idle on every created sprite: `this.host.startEntityIdle(sprite, id)` at the end of enemy + player branches (Rectangle fallback excluded — `kind: 'rect'` has no anims; `startEntityIdle` impl guards anyway).

- [ ] **Step 4: Host method + implementations**

`CombatGridViewHost.ts` — add to the interface:

```ts
/** Kick the entity's idle state right after sprite creation — a no-op for
    entities whose presentation is static (playCombatAnimation guards). */
startEntityIdle(sprite: EntitySprite, id: string): void
```

`CombatScene.ts`:

```ts
startEntityIdle(sprite: EntitySprite, id: string): void {
  this.playCombatAnimation(sprite, id, 'idle')
}
```

`TranPhapCombatPreviewScene.ts` — implement (mode-gated; the panel keeps its own preview key for non-player combatants):

```ts
startEntityIdle(sprite: EntitySprite, id: string): void {
  if (ENTITY_ART_MODE !== 'animated' || sprite.kind !== 'sprite') return
  const key =
    id === PLAYER_ID
      ? combatAnimationKey(this.playerProfile.combatTextureKey, 'idle')
      : PREVIEW_IDLE_ANIMATION_KEY
  if (this.anims.exists(key) && !(sprite.rect as Phaser.GameObjects.Sprite).anims.isPlaying) {
    ;(sprite.rect as Phaser.GameObjects.Sprite).play(key)
  }
}
```

- [ ] **Step 5: Delete `playerUsesStaticTexture`**

- `CombatScene.ts`: remove field + its doc comment.
- `combat-player-visual.ts`: remove `this.scene.playerUsesStaticTexture = true`.
- `TranPhapCombatPreviewScene.ts`: update the comment referencing it.

- [ ] **Step 6: Type-check + scene tests**

```bash
cd game
npm run type-check
npx vitest run src/game/scenes/
```

Expected: all green incl. the two new transition tests.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(art): transition chaining + snap fallback, placeholder entity resolution, uniform static bob"
```

---

### Task 4: Non-combat scenes — TranPhap, Tribulation, MainScene

**Files:**
- Modify: `src/game/scenes/TranPhapCombatPreviewScene.ts`
- Modify: `src/game/scenes/TribulationScene.ts`
- Modify: `src/game/scenes/MainScene.ts`
- Modify: `src/game/support/CombatPreload.ts` (placeholder PNG queue)
- Test: `src/game/scenes/TranPhapCombatPreviewScene.test.ts`

**Interfaces:**
- Consumes: `ENTITY_ART_MODE`, `PLACEHOLDER_STATIC_TEXTURE_KEY`, `animatedCombatEntities()` (for atlas queuing outside the combat bundle).

- [ ] **Step 1: Shared atlas-queue helper**

In `CombatPreload.ts` (or the catalogue module — pick the home that doesn't create an import cycle; `CombatPreload` already imports the catalogue):

```ts
/** Queue every animated entity's atlas — non-combat surfaces call this in
    'animated' mode so figure sprites can play idle/cultivate clips. */
export function queueEntityAtlases(scene: Phaser.Scene): void {
  for (const { clips } of animatedCombatAnimationSets()) {
    for (const clip of Object.values(clips)) {
      if (!scene.textures.exists(clip.sheetKey)) {
        scene.load.atlas(clip.sheetKey, clip.sheetUrl, clip.atlasUrl)
      }
    }
  }
}
```

In `queueCombatAssets`, add the static placeholder PNG (static mode needs it for unregistered entities):

```ts
if (ENTITY_ART_MODE === 'static') {
  queueOnce(PLACEHOLDER_STATIC_TEXTURE_KEY, PLACEHOLDER_STATIC_TEXTURE_URL)
}
```

- [ ] **Step 2: TranPhap — mode-aware fallback + preload + play gating**

```ts
fallbackSpriteTextureKey(_id: string): string | undefined {
  return ENTITY_ART_MODE === 'animated' ? PLACEHOLDER_SHEET_KEY : PLACEHOLDER_STATIC_TEXTURE_KEY
}

preload(): void {
  if (ENTITY_ART_MODE === 'animated') {
    this.load.atlas(PLACEHOLDER_SHEET_KEY, PLACEHOLDER_SHEET_URL, PLACEHOLDER_ATLAS_URL)
    queueEntityAtlases(this) // player idle clip needs the profile's atlas too
  } else {
    this.load.image(PLACEHOLDER_STATIC_TEXTURE_KEY, PLACEHOLDER_STATIC_TEXTURE_URL)
  }
  // profile PNGs stay — the player branch uses them as the sprite base texture
  // in BOTH modes (animated swaps to atlas frames when idle plays).
  for (const profile of Object.values(PLAYER_VISUAL_PROFILES)) { /* unchanged */ }
}
```

`create()`: gate the `PREVIEW_IDLE_ANIMATION_KEY` registration behind `ENTITY_ART_MODE === 'animated'`, and in the same branch register the player profile's idle clip so `startEntityIdle` can play `${profile.combatTextureKey}-idle` (iterate `presentationFor(profile.combatTextureKey)` clips → `this.anims.create` per clip, guarded by `anims.exists` — the AnimationManager is shared across scenes).

`syncAssignments`: the non-player `.play(PREVIEW_IDLE_ANIMATION_KEY)` call is now redundant with `startEntityIdle` (Task 3) — remove it; `startEntityIdle` handles both modes (animated → PREVIEW_IDLE; static → no-op).

Update `TranPhapCombatPreviewScene.test.ts` — placeholder sheet key expectations become mode-aware.

- [ ] **Step 3: TribulationScene — static PNG vs multiatlas**

```ts
preload() {
  if (ENTITY_ART_MODE === 'animated') {
    if (!this.textures.exists(CULTIVATE_KEY)) {
      this.load.multiatlas(CULTIVATE_KEY, 'assets/cultivate.json', 'assets')
    }
  } else {
    const { key, sourceSize } = getCultivateTexture(PLAYER_VISUAL_PROFILES[this.resolveProfile()])
    void sourceSize
    if (!this.textures.exists(key)) {
      this.load.image(key, PLAYER_VISUAL_PROFILES[this.resolveProfile()].cultivateTextureUrl!.replace(/^\/+/, ''))
    }
  }
  queueInkWashUiAtlas(this)
}
```

(Resolve the active profile the same way MainScene does — via the registry/player store gate; check how TribulationScene currently learns the profile — it doesn't today, it hardcodes `char-cultivate`. Use the profile-gate read already used elsewhere, e.g. `readOptionalGate(this.registry, 'playerVisualProfileId')` — verify the actual gate name in `PlayerVisualForm.ts` / MainScene and reuse it.)

`create()`:

```ts
if (ENTITY_ART_MODE === 'animated') {
  // existing anims.create + .play(CULTIVATE_KEY) — unchanged
} else {
  const { key } = getCultivateTexture(profile)
  this.player = this.add.image(width / 2, height * 0.62, key)
  // display size: derive from sourceSize aspect like the animated path's 128x132
}
```

- [ ] **Step 4: MainScene — animated figure**

```ts
preload(): void {
  if (ENTITY_ART_MODE === 'animated') {
    queueEntityAtlases(this)
    if (!this.textures.exists('char-cultivate')) {
      this.load.multiatlas('char-cultivate', 'assets/cultivate.json', 'assets')
    }
  }
  // ...existing loads unchanged
}
```

In the player-sprite setup + `refreshPlayerTexture`:

```ts
if (ENTITY_ART_MODE === 'animated') {
  // register entity anims once (guard anims.exists per clip — shared
  // AnimationManager across scenes)
  // play `${profile.combatTextureKey}-idle` when standing;
  // play char-cultivate anim when sitting (multiatlas, registered like
  // TribulationScene's block — extract the registration into a small shared
  // helper or duplicate the ~10 lines).
} else {
  // existing setTexture logic — unchanged
}
```

Extract the cultivate anim registration (TribulationScene's `anims.create` block, lines ~100-107) into a shared helper — e.g. `ensureCultivateAnimation(scene)` in a small support module both scenes import.

- [ ] **Step 5: Type-check + tests**

```bash
cd game
npm run type-check
npx vitest run src/game/scenes/ src/game/support/
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(art): mode-aware non-combat scenes (TranPhap, Tribulation, MainScene) + atlas queue helper"
```

---

### Task 5: Vue surfaces — EntitySpriteCanvas + PlayerPortrait

**Files:**
- Create: `src/components/common/EntitySpriteCanvas.vue`
- Modify: `src/components/common/PlayerPortrait.vue`
- Test: `src/components/common/PlayerPortrait.test.ts` (create if absent — check first)

**Interfaces:**
- Consumes: `ENTITY_ART_MODE`; mortal idle atlas URLs (`PLAYER_MORTAL_ATLAS_SHEET_URL`, `PLAYER_MORTAL_ATLAS_URL` from the catalogue); char-cultivate multiatlas (`assets/cultivate.json`).
- Produces: `EntitySpriteCanvas` props `{ sheetUrl, atlasUrl, framePrefix, frameSuffix, zeroPad, firstFrame, lastFrame, fps, height }`.

- [ ] **Step 1: EntitySpriteCanvas.vue**

A DOM-side frame stepper that consumes the SAME atlas files Phaser uses (no second export format):

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// EntitySpriteCanvas — Vue-side sprite animation over a TexturePacker atlas.
// Exists because Vue panels can't play Phaser animations: this component
// fetches the atlas JSON + PNG once and steps frames on a rAF interval. Only
// rendered when ENTITY_ART_MODE === 'animated' (callers gate on the constant).
export interface EntitySpriteCanvasProps {
  sheetUrl: string
  atlasUrl: string
  framePrefix: string
  frameSuffix: string
  zeroPad: number
  firstFrame: number
  lastFrame: number
  fps: number
  height?: number | string
}

const props = withDefaults(defineProps<EntitySpriteCanvasProps>(), { height: 239 })

const canvasEl = ref<HTMLCanvasElement | null>(null)
let rafId = 0
let lastStep = 0
let frameIndex = props.firstFrame

interface AtlasFrame { frame: { x: number; y: number; w: number; h: number } }

function frameName(i: number): string {
  return `${props.framePrefix}${String(i).padStart(props.zeroPad, '0')}${props.frameSuffix}`
}

onMounted(async () => {
  const canvas = canvasEl.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const [atlas, image] = await Promise.all([
    fetch(props.atlasUrl).then((r) => r.json()),
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = props.sheetUrl
    }),
  ])

  const frames: AtlasFrame[] = []
  for (let i = props.firstFrame; i <= props.lastFrame; i++) {
    const f = atlas.frames?.[frameName(i)]?.frame
    if (f) frames.push({ frame: f })
  }
  if (frames.length === 0) return

  canvas.width = frames[0]!.frame.w
  canvas.height = frames[0]!.frame.h
  const stepMs = 1000 / props.fps

  const tick = (t: number) => {
    if (t - lastStep >= stepMs) {
      lastStep = t
      const f = frames[frameIndex - props.firstFrame]!.frame
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(image, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h)
      frameIndex = frameIndex >= props.lastFrame ? props.firstFrame : frameIndex + 1
    }
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
})

onBeforeUnmount(() => cancelAnimationFrame(rafId))
</script>

<template>
  <canvas ref="canvasEl" class="entity-sprite-canvas" :style="{ height: typeof height === 'number' ? `${height}px` : height }" />
</template>

<style scoped>
.entity-sprite-canvas {
  display: block;
  width: auto;
  image-rendering: pixelated;
}
</style>
```

- [ ] **Step 2: PlayerPortrait mode branch**

```vue
<script setup lang="ts">
import { ENTITY_ART_MODE } from '@/presentation/art/EntityArtMode'
import EntitySpriteCanvas from './EntitySpriteCanvas.vue'
// ...existing imports

const ANIMATED_URLS = {
  // portrait → mortal idle clip (v2 atlas frames 0-31 @8fps)
  portrait: {
    sheetUrl: '/assets/characters/player/mortal/player-mortal-combat-atlas-v2.png',
    atlasUrl: '/assets/characters/player/mortal/player-mortal-combat-atlas-v2.json',
    framePrefix: 'frame_', frameSuffix: '.png', zeroPad: 3,
    firstFrame: 0, lastFrame: 31, fps: 8,
  },
  // cultivate → char-cultivate multiatlas (17 frames @ ~8fps)
  cultivate: {
    sheetUrl: 'assets/cultivate.png', // verify actual multiatlas png path from cultivate.json
    atlasUrl: 'assets/cultivate.json',
    framePrefix: 'frame_', frameSuffix: '.png', zeroPad: 3,
    firstFrame: 0, lastFrame: 16, fps: 8,
  },
} as const

const useCanvas = ENTITY_ART_MODE === 'animated'
</script>

<template>
  <div :class="[...]">
    <!-- aura/qi-ring/taiji spans unchanged -->
    <EntitySpriteCanvas
      v-if="useCanvas"
      v-bind="ANIMATED_URLS[variant]"
      :height="height"
      class="player-portrait__image"
    />
    <img v-else class="player-portrait__image" :src="imageUrl" alt="" draggable="false" decoding="async" />
  </div>
</template>
```

**Note for the implementer:** multiatlas JSON (`assets/cultivate.json`) has a different frame structure than a single atlas — verify its `frames` shape at implementation time (it's an array-of-textures format); if the canvas stepper can't read it uniformly, keep `cultivate` on the static PNG path for this pass and note it as deferred (animated-mode cultivate surfaces keep TribulationScene's Phaser path). The `portrait` variant over the v2 atlas works with the standard JSON-Hash format.

- [ ] **Step 3: Component test**

```ts
// src/components/common/PlayerPortrait.test.ts (or extend existing)
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PlayerPortrait from './PlayerPortrait.vue'
import { ENTITY_ART_MODE } from '@/presentation/art/EntityArtMode'

describe('PlayerPortrait art mode', () => {
  it('renders <img> in static mode', () => {
    if (ENTITY_ART_MODE !== 'static') return
    const wrapper = mount(PlayerPortrait, { props: { variant: 'portrait' } })
    expect(wrapper.find('img.player-portrait__image').exists()).toBe(true)
    expect(wrapper.find('canvas').exists()).toBe(false)
  })

  it('renders EntitySpriteCanvas in animated mode', () => {
    if (ENTITY_ART_MODE !== 'animated') return
    const wrapper = mount(PlayerPortrait, { props: { variant: 'portrait' } })
    expect(wrapper.find('canvas').exists()).toBe(true)
  })
})
```

(The test self-skips the non-active branch — both branches are asserted in whichever mode is current. If the suite runs both modes, gate via the same constant.)

- [ ] **Step 4: Type-check + component tests**

```bash
cd game
npm run type-check
npx vitest run src/components/
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(art): EntitySpriteCanvas + mode-aware PlayerPortrait for Vue surfaces"
```

---

### Task 6: Uniformity enforcement + full verification

**Files:**
- Modify: `tests/architecture/artModeUniformity.test.ts` (expand)
- Modify: `tests/architecture/atlasFramesExist.test.ts`, `tests/architecture/artExtentDeclared.test.ts` (verify they still assert correctly — they read declared clip metadata vs on-disk atlas JSON; in `static` mode no animated entries exist, so these become trivially true — decide per implementation whether they should only run their assertions when `ENTITY_ART_MODE === 'animated'` or keep validating the declared-but-inactive clip data)
- Test: `src/presentation/assets/AssetBundleCatalog.test.ts`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Expand the uniformity test**

```ts
describe('ENTITY_ART_MODE uniformity', () => {
  it('every registered presentation kind matches ENTITY_ART_MODE', () => {
    for (const key of combatPresentationEntityKeys()) {
      expect(presentationFor(key)?.kind, `entity '${key}'`).toBe(ENTITY_ART_MODE)
    }
  })

  it('the wildcard placeholder entry is registered', () => {
    expect(presentationFor(PLACEHOLDER_ENTITY_KEY)?.kind).toBe(ENTITY_ART_MODE)
  })

  it('every spawnable enemy template resolves to a registered or placeholder presentation', () => {
    for (const templateId of MORTAL_ENEMY_TEMPLATE_IDS) {
      const key = resolveEnemyTextureKey(templateId)
      const presentation = key ? presentationFor(key) : presentationFor(PLACEHOLDER_ENTITY_KEY)
      expect(presentation?.kind, templateId).toBe(ENTITY_ART_MODE)
    }
  })

  it('placeholder debt list is shrink-only', () => {
    // Ratchet: the CURRENT list. Remove entries as real art lands; never add.
    expect(placeholderEntityKeys()).toEqual([
      // populate with the actual output of placeholderEntityKeys() at
      // implementation time — the test then fails if the list GROWS.
    ])
  })
})
```

- [ ] **Step 2: Review remaining atlas/extent tests under the new contract**

- `atlasFramesExist.test.ts`: it validates declared frame ranges against on-disk atlas JSON. The mortal v2 atlas still exists and the declared ranges (idle/standby/death) still point at real frames — the test should still pass in either mode since it validates DATA, not mode. Verify and keep.
- `artExtentDeclared.test.ts`: same — validates declared extents against atlas JSON; keep for animated clip data.
- `AssetBundleCatalog.test.ts`: verify the 'combat' bundle's atlas descriptors still derive correctly (in `static` mode `animatedCombatEntities()` is empty → zero atlas descriptors; assert that).

- [ ] **Step 3: Full verification**

```bash
cd game
npm run type-check
npm run build
npx vitest run
```

(= `npm run verify`. Full mode required: Phaser scene infra + asset pipeline touched.)

- [ ] **Step 4: Runtime verification (P13/P14 — mandatory for sprite work)**

```bash
cd game && npm run dev
```

- Note the printed port; open Playwright (`npx playwright cli`).
- Drive into a real combat: confirm **player AND enemies render as PNG sprites** (not rectangles), the idle bob runs, attack lunge + impact timing works, death = rotate/fade tween.
- Open CharacterPanel: figure PNG renders.
- Check console for texture-key errors (missing `entity-placeholder` etc.).
- Screenshot evidence; clean up `.playwright-cli/` artifacts.

- [ ] **Step 5: Adversarial QA + sequential review (P4/P5)**

Run `tutienidle-adversarial-qa` (quick) on the diff, then the P5 sequential review passes (≥3). Particular risks to probe:

- Animated-mode regressions hiding in `static` mode (flip the constant, type-check, spot-run combat — do the placeholder clips actually play?).
- `entityAnimationKeyPrefix` returning `PLACEHOLDER_ENTITY_KEY` for genuinely-missing art hides art bugs — is that acceptable vs the ratchet? (The ratchet test is the guard; confirm it lists real debt.)
- Extent constants drift when PNGs change — the measurement script must be re-run; the artExtentDeclared test only covers animated clips, so static PNG extents have no drift guard. Decide if a `vitest` + `canvas` check is worth adding (canvas IS available in the test env — `loadImage` works in vitest; an `artExtentDeclared`-style test CAN measure static PNGs directly).
- Save/migration: none (presentation-only).
- The dead `playerUsesStaticTexture` flag is gone — confirm no other references.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "test(art): art-mode uniformity invariant + placeholder debt ratchet"
```

---

## Post-Implementation Notes

**Animated-mode activation checklist** (when the constant flips — NOT part of this plan's tasks):
- Every entity needs its real 5-clip set + cultivate for player-side. `placeholderEntityKeys()` is the debt list; the ratchet test blocks enabling `animated` until the list only holds acceptable placeholder entities.
- `atlasFramesExist`/`artExtentDeclared` already validate declared clip data — new atlases just extend the constants.
- Vue `EntitySpriteCanvas` needs the real atlas URLs per entity (currently hardcoded to mortal v2 + char-cultivate).
- The mortal v2 atlas's attack frames (43-90) become dead art in the new contract — a future atlas repack can drop them.
