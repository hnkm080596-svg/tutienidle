// CombatPresentationCatalogue — what each combat entity's art actually IS.
//
// Spec B §3.3/§4.4
// (docs/superpowers/specs/2026-09-11-combat-animation-metadata-design.md).
//
// Hand-written TypeScript beside the profile, not a generated manifest — it
// follows `PlayerVisualProfiles.ts`, which is already a reviewed catalogue and
// already carries `combatSourceSize` and `NormalizedBodyAnchor`.
//
// The honest trade (§3.3): frame counts can drift from the art, because nothing
// here measures the file. `tests/architecture/atlasFramesExist.test.ts` exists
// specifically to make that drift fail a test rather than a frame, and §7.1
// records what it cannot catch.
//
// THIS ANSWERS FROM WHAT HAS BEEN DRAWN, NEVER FROM `artTierFor`. The tier is an
// expectation checked in a test; letting it influence what a scene resolves at
// runtime would mean a boss without art resolving to something that does not
// exist.
import { PLAYER_VISUAL_PROFILES } from './PlayerVisualProfiles'
import { ENEMY_SOURCE_SIZE, enemyTextureUrl, resolveEnemyTextureKey } from '@/game/support/EnemyArt'
import {
  combatAnimationKey,
  type AtlasClip,
  type CombatAnimationCatalogue,
  type CombatAnimationName,
  type CombatEntityPresentation,
  type IdleMotion,
} from './CombatEntityPresentation'

// ---------------------------------------------------------------------------
// Player atlas and placeholder fallback
// ---------------------------------------------------------------------------
//
// The mortal profile uses the real trimmed atlas below. Profiles without
// dedicated art retain the legacy placeholder until their own sheet is
// authored. `sheetKey` is shared within one atlas while the animation `key`
// stays per-entity; `queueCombatAssets()` dedupes the sheet load.
export const PLACEHOLDER_SHEET_KEY = 'combat-placeholder-32frame-sheet'
export const PLACEHOLDER_SHEET_URL = 'assets/characters/placeholder/combat-anim-32frame.png'
export const PLACEHOLDER_ATLAS_URL = 'assets/characters/placeholder/combat-anim-32frame.json'
export const PLACEHOLDER_FRAME_PREFIX = 'frame_'
export const PLACEHOLDER_FRAME_SUFFIX = '.png'
export const PLACEHOLDER_ZERO_PAD = 3
export const PLACEHOLDER_FRAME_COUNT = 32
export const PLACEHOLDER_FRAME_RATE = 8

/** The untrimmed box each placeholder frame is authored in. */
export const PLACEHOLDER_FRAME_WIDTH = 200
export const PLACEHOLDER_FRAME_HEIGHT = 350

/**
 * The placeholder figure's own box inside the 200x350 authored frame, as
 * fractions, taken from the tallest frame the generator emits.
 *
 * Checked against the atlas JSON by tests/architecture/artExtentDeclared.test.ts,
 * so regenerating the art with different margins fails a test rather than
 * silently resizing every character (Spec C §2.3).
 */
export const PLACEHOLDER_EXTENT_X = 0.28
export const PLACEHOLDER_EXTENT_Y = 0.0943
export const PLACEHOLDER_EXTENT_W = 0.44
export const PLACEHOLDER_EXTENT_H = 0.7943

export const PLAYER_MORTAL_ATLAS_SHEET_KEY = 'player-mortal-combat-atlas-v2'
export const PLAYER_MORTAL_ATLAS_SHEET_URL =
  'assets/characters/player/mortal/player-mortal-combat-atlas-v2.png'
export const PLAYER_MORTAL_ATLAS_URL =
  'assets/characters/player/mortal/player-mortal-combat-atlas-v2.json'
export const PLAYER_MORTAL_FRAME_PREFIX = 'frame_'
export const PLAYER_MORTAL_FRAME_SUFFIX = '.png'
export const PLAYER_MORTAL_ZERO_PAD = 3
export const PLAYER_MORTAL_SOURCE_WIDTH = 128
export const PLAYER_MORTAL_SOURCE_HEIGHT = 128

const PLAYER_MORTAL_IDLE_EXTENT = { x: 0.203125, y: 0.0625, w: 0.6328125, h: 0.8671875 }
const PLAYER_MORTAL_READY_EXTENT = { x: 0.203125, y: 0.0625, w: 0.6328125, h: 0.8671875 }
const PLAYER_MORTAL_STANDBY_EXTENT = { x: 0.203125, y: 0.0625, w: 0.6328125, h: 0.8671875 }
const PLAYER_MORTAL_CAST_EXTENT = { x: 0.203125, y: 0.0625, w: 0.6328125, h: 0.8671875 }
const PLAYER_MORTAL_SWEEP_HAND_EXTENT = {
  x: 0.203125,
  y: 0.0625,
  w: 0.6328125,
  h: 0.8671875,
}
const PLAYER_MORTAL_PUNCH_EXTENT = { x: 0.203125, y: 0.0625, w: 0.6328125, h: 0.8671875 }
const PLAYER_MORTAL_DEATH_EXTENT = { x: 0.2109375, y: 0.0625, w: 0.609375, h: 0.8671875 }

/** Frame name for an index, matching what the generator wrote. */
export function placeholderFrameName(index: number): string {
  return `${PLACEHOLDER_FRAME_PREFIX}${String(index).padStart(PLACEHOLDER_ZERO_PAD, '0')}${PLACEHOLDER_FRAME_SUFFIX}`
}

function playerMortalClip(
  entityKey: string,
  name: CombatAnimationName,
  firstFrame: number,
  lastFrame: number,
  frameRate: number,
  extent: AtlasClip['extent'],
  repeat: number,
  impactFrame?: number,
): AtlasClip {
  return {
    key: combatAnimationKey(entityKey, name),
    sheetKey: PLAYER_MORTAL_ATLAS_SHEET_KEY,
    sheetUrl: PLAYER_MORTAL_ATLAS_SHEET_URL,
    atlasUrl: PLAYER_MORTAL_ATLAS_URL,
    framePrefix: PLAYER_MORTAL_FRAME_PREFIX,
    frameSuffix: PLAYER_MORTAL_FRAME_SUFFIX,
    zeroPad: PLAYER_MORTAL_ZERO_PAD,
    firstFrame,
    lastFrame,
    frameRate,
    sourceSize: {
      w: PLAYER_MORTAL_SOURCE_WIDTH,
      h: PLAYER_MORTAL_SOURCE_HEIGHT,
    },
    extent,
    repeat,
    ...(impactFrame === undefined ? {} : { impactFrame }),
  }
}

function playerMortalCatalogue(entityKey: string): CombatAnimationCatalogue {
  return {
    idle: playerMortalClip(entityKey, 'idle', 0, 31, 8, PLAYER_MORTAL_IDLE_EXTENT, -1),
    ready: playerMortalClip(entityKey, 'ready', 32, 42, 10, PLAYER_MORTAL_READY_EXTENT, -1),
    standby: playerMortalClip(entityKey, 'standby', 32, 42, 8, PLAYER_MORTAL_STANDBY_EXTENT, -1),
    cast: playerMortalClip(entityKey, 'cast', 43, 58, 12, PLAYER_MORTAL_CAST_EXTENT, 0, 53),
    sweep_hand: playerMortalClip(
      entityKey,
      'sweep_hand',
      59,
      74,
      12,
      PLAYER_MORTAL_SWEEP_HAND_EXTENT,
      0,
      69,
    ),
    punch: playerMortalClip(entityKey, 'punch', 75, 90, 12, PLAYER_MORTAL_PUNCH_EXTENT, 0, 85),
    death: playerMortalClip(entityKey, 'death', 91, 106, 10, PLAYER_MORTAL_DEATH_EXTENT, 0, 94),
  }
}

/** Presentation-only mapping for the mortal opening skill gestures. */
const MORTAL_SKILL_ANIMATIONS: Readonly<Record<string, CombatAnimationName>> = {
  linh_chuong: 'cast',
  tram: 'sweep_hand',
  dam: 'punch',
  generic_physical: 'punch',
  basic_attack: 'punch',
}

export function combatAnimationForSkill(skillId: string | undefined): CombatAnimationName {
  if (!skillId) {
    return 'cast'
  }

  return MORTAL_SKILL_ANIMATIONS[skillId] ?? 'cast'
}

const LOOPING_NAMES = ['idle', 'ready', 'standby'] as const satisfies readonly CombatAnimationName[]
const ONE_SHOT_NAMES = [
  'cast',
  'sweep_hand',
  'punch',
  'death',
] as const satisfies readonly CombatAnimationName[]

/**
 * Declared but not iterated when building a catalogue: the record below is
 * written key by key so the COMPILER checks it. This pair exists to say which
 * names loop, and `satisfies` keeps both halves from drifting out of
 * `CombatAnimationName`.
 */
export const COMBAT_ANIMATION_NAMES: readonly CombatAnimationName[] = [
  ...LOOPING_NAMES,
  ...ONE_SHOT_NAMES,
]

/**
 * Legacy placeholder clips span the shared 32-frame sheet. Real art declares
 * its own per-phase `firstFrame`/`lastFrame` ranges through the same shape.
 */
function legacyPlaceholderCatalogue(entityKey: string): CombatAnimationCatalogue {
  const clip = (name: CombatAnimationName): AtlasClip => {
    const looping = (LOOPING_NAMES as readonly CombatAnimationName[]).includes(name)

    return {
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
      extent: {
        x: PLACEHOLDER_EXTENT_X,
        y: PLACEHOLDER_EXTENT_Y,
        w: PLACEHOLDER_EXTENT_W,
        h: PLACEHOLDER_EXTENT_H,
      },
      repeat: looping ? -1 : 0,

      // Midpoint, and honest about being arbitrary: the placeholder has no
      // moment where anything connects. Spec D re-tunes every one of these
      // against real art, and §7.1 records that no test can flag a wrong value.
      ...(looping ? {} : { impactFrame: Math.floor(PLACEHOLDER_FRAME_COUNT / 2) }),
    }
  }

  // Written out key by key ON PURPOSE, with no cast.
  //
  // The version this replaces ended `Object.fromEntries(entries) as
  // CombatAnimationSet`, which asserted that all of `CombatAnimationName` was
  // present while three names were not — so `set.hit` type-checked and was
  // `undefined` at runtime (§2.2). Here the compiler checks the record: add a
  // name to `CombatAnimationName` and this object stops compiling until it has
  // a clip.
  return {
    idle: clip('idle'),
    ready: clip('ready'),
    standby: clip('standby'),
    cast: clip('cast'),
    sweep_hand: clip('sweep_hand'),
    punch: clip('punch'),
    death: clip('death'),
  }
}

// ---------------------------------------------------------------------------
// Static entities
// ---------------------------------------------------------------------------

/**
 * Peak bob, in SCREEN pixels. Small on purpose: this reads as breathing, not as
 * hovering. Not scaled by projection depth — see `IdleMotion.amplitudePx`.
 */
export const ENEMY_IDLE_AMPLITUDE_PX = 6

/** Base cycle. The jitter below spreads entities around it. */
const ENEMY_IDLE_BASE_PERIOD_MS = 2200

/** How far an entity's period may stray from the base, in ms, either way. */
const ENEMY_IDLE_PERIOD_JITTER_MS = 600

/**
 * Deterministic per-key jitter.
 *
 * Random would do the job on screen and be untestable; this is data, derived
 * from the key, so a test can assert that two different enemies do NOT share a
 * period. Without it a row of five wolves breathes as one organism, which reads
 * worse than not breathing at all.
 */
function idleMotionFor(entityKey: string): IdleMotion {
  let hash = 0

  for (let index = 0; index < entityKey.length; index++) {
    hash = (hash * 31 + entityKey.charCodeAt(index)) % 100000
  }

  const spread = (hash / 100000) * 2 - 1

  return {
    amplitudePx: ENEMY_IDLE_AMPLITUDE_PX,
    periodMs: Math.round(ENEMY_IDLE_BASE_PERIOD_MS + spread * ENEMY_IDLE_PERIOD_JITTER_MS),
  }
}

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

/**
 * Fallback player entity key — same PNG as the mortal profile, different key.
 * Used when `combat-grid-view.ts` does not find the current profile's texture
 * loaded yet.
 *
 * Declared HERE rather than imported from `CombatPreload`: that module imports
 * this one, and the reverse edge would be a cycle.
 */
export const FALLBACK_PLAYER_ENTITY_KEY = 'player-mortal'

/**
 * Enemy template ids whose art is drawn. Resolved through
 * `resolveEnemyTextureKey` so the texture keys come from `EnemyArt`'s own table
 * rather than being spelled a second time here.
 */
const STATIC_ENEMY_TEMPLATE_IDS = [
  'mortal_ferocious_wild_boar',
  'mortal_ferocious_water_wolf',
  'mortal_ferocious_savage_tiger',
  'mortal_ferocious_mountain_bandit',
  'mortal_ferocious_giant_crocodile',
  'mortal_ferocious_stone_lynx',
  'mortal_ferocious_silver_fox',
  'mortal_ferocious_iron_boar',
  'mortal_ferocious_mud_ox',
  'mortal_ferocious_feral_dog',
  'mortal_wild_boar',
  'mortal_water_wolf',
  'mortal_savage_tiger',
  'mortal_mountain_bandit',
  'mortal_giant_crocodile',
  'mortal_stone_lynx',
  'mortal_silver_fox',
  'mortal_iron_boar',
  'mortal_mud_ox',
  'mortal_feral_dog',
] as const

function buildCatalogue(): Map<string, CombatEntityPresentation> {
  const entries = new Map<string, CombatEntityPresentation>()

  // The player animates (§3.2). Every profile, plus the fallback key.
  for (const profile of Object.values(PLAYER_VISUAL_PROFILES)) {
    const clips =
      profile.combatTextureKey === PLAYER_VISUAL_PROFILES.mortal.combatTextureKey
        ? playerMortalCatalogue(profile.combatTextureKey)
        : legacyPlaceholderCatalogue(profile.combatTextureKey)

    entries.set(profile.combatTextureKey, {
      kind: 'animated',
      clips,
    })
  }

  entries.set(FALLBACK_PLAYER_ENTITY_KEY, {
    kind: 'animated',
    clips: playerMortalCatalogue(FALLBACK_PLAYER_ENTITY_KEY),
  })

  // Enemies are still images plus a bob. Promoting one is a data change;
  // playback code does not move.
  for (const templateId of STATIC_ENEMY_TEMPLATE_IDS) {
    const textureKey = resolveEnemyTextureKey(templateId)

    if (!textureKey) {
      continue
    }

    entries.set(textureKey, {
      kind: 'static',
      texture: {
        textureKey,
        textureUrl: enemyTextureUrl(textureKey),
        sourceSize: { ...ENEMY_SOURCE_SIZE },
        // The Mortal PNGs are untrimmed: the animal fills its own file.
        extent: { x: 0, y: 0, w: 1, h: 1 },
      },
      idleMotion: idleMotionFor(textureKey),
    })
  }

  return entries
}

const CATALOGUE = buildCatalogue()

/** Every entity key the catalogue knows. For the guards, and for preload. */
export function combatPresentationEntityKeys(): readonly string[] {
  return [...CATALOGUE.keys()]
}

/**
 * One function, one answer per entity.
 *
 * `undefined` for an entity with no drawn art at all — a realm whose enemies are
 * not in the Mortal batch, or a test fixture. Callers keep their existing
 * Rectangle fallback; this does NOT invent a presentation to avoid returning
 * nothing, because a silent downgrade is exactly what §3.2.1 refuses.
 */
export function presentationFor(entityKey: string): CombatEntityPresentation | undefined {
  return CATALOGUE.get(entityKey)
}

/**
 * Animated entity keys whose clips still point at the shared placeholder
 * sheet — derived, not declared, so the answer cannot drift from the
 * catalogue. This is the placeholder-art debt list; the ratchet guard is
 * `tests/architecture/artTierDebt.test.ts` (shrink freely, never grow).
 */
export function placeholderArtEntityKeys(): readonly string[] {
  const keys: string[] = []

  for (const [entityKey, presentation] of CATALOGUE) {
    if (presentation.kind !== 'animated') {
      continue
    }

    const clips = Object.values(presentation.clips)

    if (clips.every((clip) => clip.sheetKey === PLACEHOLDER_SHEET_KEY)) {
      keys.push(entityKey)
    }
  }

  return keys
}

/** Every animated entity's clips, for preload and animation registration. */
export function animatedCombatEntities(): Array<{
  entityKey: string
  clips: CombatAnimationCatalogue
}> {
  const animated: Array<{ entityKey: string; clips: CombatAnimationCatalogue }> = []

  for (const [entityKey, presentation] of CATALOGUE) {
    if (presentation.kind === 'animated') {
      animated.push({ entityKey, clips: presentation.clips })
    }
  }

  return animated
}
