// CharacterArt (character-art-infra) - the character reskin registry, the
// player-side sibling of MonsterArt.
//
// The ONE place that owns: which NEWSPRITE-derived character atlas replaces
// which player visual profile's combat art. Data is hand-written beside the
// generated `public/assets/characters/animated/manifest.json`; the
// architecture test (tests/architecture/characterArtReskin.test.ts) pins
// every clip/frame against the atlas files on disk so this table cannot
// drift from the art.
//
// Entity key convention mirrors monsters: a reskinned profile's catalogue
// key IS the character slug (`zuofeng`), not the profile's combatTextureKey
// - the static profile PNG stays registered under its own key (other scenes
// still consume it) and is the unmapped fallback.
//
// Mortal/phap_tu/kiem_tu bind the 2026-09-27 hand-drawn sets; `zuofeng`
// placeholder until the six new character sets arrive - swap this table's
// values when the art lands; no other file changes.
import type { ArtExtent } from '@/presentation/art/CombatEntityPresentation'
import type { PlayerVisualProfileId } from '@/core/player/PlayerVisualForm'
import IMPACT_MARKERS from '../../../art/animation-impact-markers.json'

export interface CharacterClipRange {
  /** `<slug>-<clip>-` - matches pack-character-art.mjs frameName(). */
  framePrefix: string
  firstFrame: number
  lastFrame: number
  /** Sheet atlas pair inside the variant dir (a clip never spans sheets). */
  sheetKey: string
  sheetUrl: string
  atlasUrl: string
  /**
   * Authored impact frame, CLIP-LOCAL (0..frameCount-1) - the frame where
   * the strike visually connects, authored by contact-sheet inspection
   * into art/animation-impact-markers.json and propagated onto the packed
   * manifest by pack-character-art.mjs. Absent when unmarked.
   */
  impactFrameIndex?: number
}

/**
 * Marker lookup for one variant + SOURCE clip name ('attack', 'ult',
 * 'cast-linh_bao' - the same names the packer reports and this file's
 * `name` argument produces). The JSON is the single authoring surface;
 * manifest injection and this registry read the same value so the runtime
 * never parses the manifest.
 */
function impactMarker(slug: string, clipName: string): number | undefined {
  const table = IMPACT_MARKERS.characters as Record<string, Record<string, number>>
  return table[slug]?.[clipName]
}

export interface CharacterArtVariant {
  slug: string
  /**
   * The emitted box every frame is positioned in: the union bbox of the
   * idle clip cropped out of the dump canvas (packer feet-anchor crop).
   * (0.5,1) of this box is the feet anchor - origin needs no change.
   */
  sourceSize: { w: number; h: number }
  /** Alpha bbox of the tallest IDLE frame inside `sourceSize` - drives display sizing. */
  extent: ArtExtent
  /** Static fallback texture: the per-variant avatar.png (dump roster-avatar). */
  avatarKey: string
  avatarUrl: string
  /** Measured avatar.png dims - the static form's sourceSize. */
  avatarSize: { w: number; h: number }
  clips: {
    idle: CharacterClipRange
    death: CharacterClipRange
    attack?: CharacterClipRange
    ult?: CharacterClipRange
  }
  /**
   * Per-skill cast clips, keyed by Skill.id; a slot-role clip is keyed
   * `role:<slotRole>` ('role:special') so a skill literally named 'basic'/
   * 'special'/'ultimate' can not collide with the role lookup. startCastPlayback
   * resolves them ahead of the slot-role pick (impact-sync sec.22); clip
   * names in the atlases are `<slug>-cast-<key>-NNN.png` (packer
   * `cast-<key>` dirs; the `role:` prefix is not part of the clip name).
   */
  castClips?: Record<string, CharacterClipRange>
}

const ART_ROOT = 'assets/characters/animated'
const ZERO_PAD = 3
const FRAME_SUFFIX = '.png'

function clip(slug: string, name: string, first: number, last: number, sheet: number): CharacterClipRange {
  return {
    framePrefix: `${slug}-${name}-`,
    firstFrame: first,
    lastFrame: last,
    sheetKey: `${slug}-sheet-${sheet}`,
    sheetUrl: `${ART_ROOT}/${slug}/${slug}-sheet-${sheet}.png`,
    atlasUrl: `${ART_ROOT}/${slug}/${slug}-sheet-${sheet}.atlas.json`,
    impactFrameIndex: impactMarker(slug, name),
  }
}

function variant(
  slug: string,
  sourceSize: { w: number; h: number },
  extent: ArtExtent,
  ranges: {
    idle: [number, number, number]
    death: [number, number, number]
    attack?: [number, number, number]
    ult?: [number, number, number]
  },
  opts: { avatarSize?: { w: number; h: number }; cast?: Record<string, { src?: string; range: [number, number, number] }> } = {},
): CharacterArtVariant {
  const castClips: Record<string, CharacterClipRange> = {}
  for (const [key, entry] of Object.entries(opts.cast ?? {})) {
    // `src` is the SOURCE clip name in the atlas (what markers and the
    // manifest call it); it defaults to `cast-<key>` with the `role:`
    // selector prefix stripped so `role:special` -> clip 'cast-special'.
    const src = entry.src ?? `cast-${key.replace(/^role:/, '')}`
    castClips[key] = clip(slug, src, entry.range[0], entry.range[1], entry.range[2])
  }
  return {
    slug,
    sourceSize,
    extent,
    avatarKey: `${slug}-avatar`,
    avatarUrl: `${ART_ROOT}/${slug}/avatar.png`,
    avatarSize: opts.avatarSize ?? { w: 150, h: 150 },
    clips: {
      idle: clip(slug, 'idle', ranges.idle[0], ranges.idle[1], ranges.idle[2]),
      death: clip(slug, 'death', ranges.death[0], ranges.death[1], ranges.death[2]),
      attack: ranges.attack ? clip(slug, 'attack', ranges.attack[0], ranges.attack[1], ranges.attack[2]) : undefined,
      ult: ranges.ult ? clip(slug, 'ult', ranges.ult[0], ranges.ult[1], ranges.ult[2]) : undefined,
    },
    castClips: Object.keys(castClips).length > 0 ? castClips : undefined,
  }
}

/**
 * The WIRED set. The other nine characters are packed on disk (manifest.json
 * lists them with all clips + avatar/portrait/closeup/radar files staged)
 * but have no binding yet - add a variant + a CHARACTER_RESKIN_MAP row when
 * the user assigns art. Clip ranges carry their sheet index (zuofeng's clips
 * span three sheets) so nothing here assumes sheet-1.
 */
export const CHARACTER_ART: Record<string, CharacterArtVariant> = {
  zuofeng: variant(
    'zuofeng',
    { w: 439, h: 647 },
    { x: 0, y: 0, w: 0.997722, h: 1 },
    { idle: [1, 8, 1], attack: [1, 18, 2], ult: [1, 14, 3], death: [1, 1, 3] },
    { avatarSize: { w: 512, h: 512 } },
  ),
  // Armed mortal (sword): attack IS the tram slash - a tram-picked player's
  // basic cast resolves to it via the slot-role fallback.
  pham_nhan: variant(
    'pham_nhan',
    { w: 495, h: 512 },
    { x: 0.008081, y: 0, w: 0.991919, h: 1 },
    { idle: [1, 33, 1], attack: [1, 17, 2], death: [1, 17, 2] },
    { avatarSize: { w: 512, h: 512 } },
  ),
  // Unarmed mortal (fist/treasure): attack IS the huy_quyen punch; the
  // linh_bao cast is a per-skill clip since the slot-role fallback would
  // otherwise play the punch for it too.
  pham_nhan_unarmed: variant(
    'pham_nhan_unarmed',
    { w: 348, h: 514 },
    { x: 0.008621, y: 0, w: 0.971264, h: 1 },
    { idle: [1, 33, 1], attack: [1, 17, 1], death: [1, 17, 2] },
    { avatarSize: { w: 512, h: 512 }, cast: { linh_bao: { range: [1, 17, 2] } } },
  ),
  ngu_kiem: variant(
    'ngu_kiem',
    { w: 350, h: 475 },
    { x: 0.02, y: 0, w: 0.908571, h: 1 },
    { idle: [1, 33, 1], attack: [1, 17, 1], death: [1, 17, 1] },
    { avatarSize: { w: 512, h: 512 } },
  ),
  // ngu_hanh's special cast covers every element's special slot (the path
  // emits slotRole 'special', never 'ultimate') - keyed by role, not skillId.
  ngu_hanh: variant(
    'ngu_hanh',
    { w: 444, h: 518 },
    { x: 0.009009, y: 0, w: 0.975225, h: 1 },
    { idle: [1, 33, 1], attack: [1, 17, 2], death: [1, 17, 2] },
    { avatarSize: { w: 512, h: 512 }, cast: { 'role:special': { range: [1, 17, 3] } } },
  ),
}

/**
 * PlayerVisualProfileId -> character slug binding. A bare string is the one
 * slug; an {armed,unarmed} pair picks by the entity's armed state (mortal:
 * tram = sword => armed; linh_bao/huy_quyen => unarmed - user ruling
 * 2026-09-29). Profiles sharing one slug collapse onto the same atlas.
 */
export interface CharacterReskinBinding {
  armed: string
  unarmed: string
}
export const CHARACTER_RESKIN_MAP: Record<PlayerVisualProfileId, string | CharacterReskinBinding> = {
  mortal: { armed: 'pham_nhan', unarmed: 'pham_nhan_unarmed' },
  phap_tu: 'ngu_hanh',
  kiem_tu: 'ngu_kiem',
  // the_tu art not drawn yet - keeps the placeholder set.
  the_tu: 'zuofeng',
}

/**
 * Player visual profile id -> character slug, or undefined when unmapped.
 * `opts.armed` selects between an {armed,unarmed} pair; undefined or a bare
 * string binding resolves the single slug (armed is the canonical default).
 */
export function resolveCharacterArtSlug(profileId: string, opts?: { armed?: boolean }): string | undefined {
  const binding = (CHARACTER_RESKIN_MAP as Record<string, string | CharacterReskinBinding>)[profileId]
  if (binding === undefined || typeof binding === 'string') return binding
  return opts?.armed === false ? binding.unarmed : binding.armed
}

/**
 * Every slug a profile's binding covers: bare bindings answer [slug],
 * {armed,unarmed} pairs answer BOTH. Preload enumerates this (not the armed
 * pick) because the armed state resolves at spawn - the unarmed sheets must
 * be queued before mortalBasicSkillId is ever read.
 */
export function resolveCharacterArtSlugs(profileId: string): string[] {
  const binding = (CHARACTER_RESKIN_MAP as Record<string, string | CharacterReskinBinding>)[profileId]
  if (binding === undefined) return []
  return typeof binding === 'string' ? [binding] : [binding.armed, binding.unarmed]
}

/**
 * Entity keys that emit `kind: 'animated'` even while ENTITY_ART_MODE is
 * 'static' - same sanctioned exception as ANIMATED_ENEMY_KEYS.
 */
export const ANIMATED_CHARACTER_KEYS: ReadonlySet<string> = new Set(
  Object.values(CHARACTER_RESKIN_MAP).flatMap((b) => (typeof b === 'string' ? [b] : [b.armed, b.unarmed])),
)

/**
 * Companion readiness seam (impact-sync sec.46): companion.id -> a packed
 * CHARACTER_ART slug. Empty until real companion art mappings land - do
 * NOT invent mappings here; unmapped companions keep their placeholder
 * registration. Resolution stays LAZY (functions, not a derived record) so
 * the catalogue build and preload enumeration read the live map - a fixture
 * that injects a mapping flows through the same code path real content will.
 */
export const COMPANION_RESKIN_MAP: Record<string, string> = {}

/** The character variant a companion id binds, or undefined when unmapped. */
export function companionArtVariant(companionId: string): CharacterArtVariant | undefined {
  // Object.hasOwn: a companion id colliding with an Object.prototype member
  // ('constructor', 'hasOwnProperty', ...) must not resolve a builtin truthy.
  const slug = Object.hasOwn(COMPANION_RESKIN_MAP, companionId)
    ? COMPANION_RESKIN_MAP[companionId]
    : undefined
  if (slug === undefined) {
    return undefined
  }
  const variant = CHARACTER_ART[slug]
  if (!variant) {
    throw new Error(
      `COMPANION_RESKIN_MAP maps '${companionId}' to unknown character art '${slug}'`,
    )
  }
  return variant
}

/** Every mapped companion's art variant - the preload parity enumeration. */
export function companionArtVariants(): CharacterArtVariant[] {
  return Object.keys(COMPANION_RESKIN_MAP)
    .map((companionId) => companionArtVariant(companionId))
    .filter((variant): variant is CharacterArtVariant => variant !== undefined)
}

/**
 * Forced-animation set for companions uses the MAP KEYS (companion ids),
 * never the art slugs - catalogue identity is the companion id (sec.48).
 * Derived snapshot for the uniformity test; runtime membership checks read
 * COMPANION_RESKIN_MAP live through isForcedAnimatedEntity.
 */
export const ANIMATED_COMPANION_KEYS: ReadonlySet<string> = new Set(
  Object.keys(COMPANION_RESKIN_MAP),
)

export const CHARACTER_ZERO_PAD = ZERO_PAD
export const CHARACTER_FRAME_SUFFIX = FRAME_SUFFIX
