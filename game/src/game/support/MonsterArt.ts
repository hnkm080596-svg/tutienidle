// MonsterArt (enemy-art-wave1.spec.md D4) - the reskin registry.
//
// The ONE place that owns: which NEWSPRITE-derived atlas art replaces which
// existing enemy id. Data is hand-written beside the generated
// `public/assets/enemies/animated/manifest.json`; the architecture test
// (tests/architecture/enemyArtReskin.test.ts) pins every clip/frame against
// the atlas files on disk so this table cannot drift from the art.
//
// Entity key convention: a reskinned enemy's catalogue key IS the variant
// slug (`graymane-wolf`), not the old `mortal-*-v1` texture key - the old
// static PNG stays registered under its own key as the unmapped fallback.
//
// Variants suffixed `-ferocious` / `-mudboss` / `-floodserpent` are offline
// recolors produced by scripts/pack-enemy-art.mjs (hue-shift with accent
// guard) - no runtime tinting, per the ferocious-silhouette rule.
import type { ArtExtent } from '@/presentation/art/CombatEntityPresentation'
import IMPACT_MARKERS from '../../../art/animation-impact-markers.json'

export interface MonsterClipRange {
  /** `<slug>-<clip>-` - matches pack-enemy-art.mjs frameName(). */
  framePrefix: string
  firstFrame: number
  lastFrame: number
  /** Sheet atlas pair inside the variant dir (a clip never spans sheets). */
  sheetKey: string
  sheetUrl: string
  atlasUrl: string
  /** Authored impact frame, CLIP-LOCAL - see CharacterClipRange. */
  impactFrameIndex?: number
}

/** Marker lookup for one variant + source clip name (see CharacterArt). */
function impactMarker(slug: string, clipName: string): number | undefined {
  const table = IMPACT_MARKERS.enemies as Record<string, Record<string, number>>
  return table[slug]?.[clipName]
}

export interface MonsterArtVariant {
  slug: string
  /**
   * The emitted box every frame is positioned in: the union bbox of the
   * idle clip cropped out of the dump canvas (packer feet-anchor crop).
   * (0.5,1) of this box is the feet anchor - origin needs no change.
   */
  sourceSize: { w: number; h: number }
  /** Alpha bbox of the tallest IDLE frame inside `sourceSize` - drives display sizing. */
  extent: ArtExtent
  /** Static fallback texture: the per-variant avatar.png. */
  avatarKey: string
  avatarUrl: string
  /** Measured avatar.png dims - the static form's sourceSize. */
  avatarSize: { w: number; h: number }
  /** `assets/audio/enemies/<slug>/<file>` - absent means silent (wave-1 rule). */
  attackSfxUrl?: string
  clips: {
    idle: MonsterClipRange
    death: MonsterClipRange
    attack?: MonsterClipRange
  }
}

const ART_ROOT = 'assets/enemies/animated'
const SFX_ROOT = 'assets/audio/enemies'
const ZERO_PAD = 3
const FRAME_SUFFIX = '.png'

function clip(slug: string, name: string, first: number, last: number, sheet: number): MonsterClipRange {
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
  ranges: { idle: [number, number, number]; death: [number, number, number]; attack?: [number, number, number] },
  opts: { attackSfx?: string; avatarSize?: { w: number; h: number } } = {},
): MonsterArtVariant {
  return {
    slug,
    sourceSize,
    extent,
    avatarKey: `${slug}-avatar`,
    avatarUrl: `${ART_ROOT}/${slug}/avatar.png`,
    avatarSize: opts.avatarSize ?? { w: 150, h: 150 },
    attackSfxUrl: opts.attackSfx ? `${SFX_ROOT}/${slug}/${opts.attackSfx}` : undefined,
    clips: {
      idle: clip(slug, 'idle', ranges.idle[0], ranges.idle[1], ranges.idle[2]),
      death: clip(slug, 'death', ranges.death[0], ranges.death[1], ranges.death[2]),
      attack: ranges.attack ? clip(slug, 'attack', ranges.attack[0], ranges.attack[1], ranges.attack[2]) : undefined,
    },
  }
}

/**
 * The wired set. Clip ranges carry their sheet index as the third tuple
 * element - wugu-demon-king spans four sheets, so nothing here assumes
 * sheet-1 (impact-sync). Wugu's packed `enrage`/`stomp` clips stay
 * deliberately UNBOUND: no skill/runtime path reaches them, so the
 * registry declares only the playable idle/attack/death (spec sec.2.2).
 */
export const MONSTER_ART: Record<string, MonsterArtVariant> = {
  // --- 9 approved species ---
  'graymane-wolf': variant(
    'graymane-wolf',
    { w: 504, h: 283 },
    { x: 0, y: 0, w: 0.984127, h: 1 },
    { idle: [1, 9, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { attackSfx: 'graymane-wolf-attack.ogg', avatarSize: { w: 147, h: 150 } },
  ),
  'tusked-mountain-boar': variant(
    'tusked-mountain-boar',
    { w: 258, h: 154 },
    { x: 0.007752, y: 0, w: 0.965116, h: 1 },
    { idle: [1, 15, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { avatarSize: { w: 102, h: 102 } },
  ),
  'bloodarm-ox-demon': variant(
    'bloodarm-ox-demon',
    { w: 429, h: 355 },
    { x: 0, y: 0, w: 0.988345, h: 0.997183 },
    { idle: [1, 8, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { attackSfx: 'bloodarm-ox-demon-attack.ogg', avatarSize: { w: 148, h: 150 } },
  ),
  'mudbelly-green-toad': variant(
    'mudbelly-green-toad',
    { w: 475, h: 345 },
    { x: 0, y: 0, w: 1, h: 1 },
    { idle: [1, 13, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { attackSfx: 'mudbelly-green-toad-attack.ogg', avatarSize: { w: 512, h: 512 } },
  ),
  'whiteshell-venom-beetle': variant(
    'whiteshell-venom-beetle',
    { w: 596, h: 221 },
    { x: 0.010067, y: 0, w: 0.984899, h: 0.99095 },
    { idle: [1, 9, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { attackSfx: 'whiteshell-venom-beetle-attack.ogg', avatarSize: { w: 512, h: 512 } },
  ),
  'witherfir-vineman': variant(
    'witherfir-vineman',
    { w: 349, h: 572 },
    { x: 0.040115, y: 0, w: 0.939828, h: 1 },
    { idle: [1, 10, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { attackSfx: 'witherfir-vineman-attack.ogg', avatarSize: { w: 132, h: 150 } },
  ),
  'drybranch-treant': variant(
    'drybranch-treant',
    { w: 624, h: 624 },
    { x: 0, y: 0, w: 0.99359, h: 1 },
    { idle: [1, 13, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { avatarSize: { w: 102, h: 102 } },
  ),
  'spore-flower-spirit': variant(
    'spore-flower-spirit',
    { w: 249, h: 243 },
    { x: 0.136546, y: 0, w: 0.859438, h: 0.880658 },
    { idle: [1, 15, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { avatarSize: { w: 102, h: 102 } },
  ),
  'streamgrudge-nymph': variant(
    'streamgrudge-nymph',
    { w: 468, h: 546 },
    { x: 0.012821, y: 0, w: 0.987179, h: 0.994505 },
    { idle: [1, 10, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { attackSfx: 'streamgrudge-nymph-attack.ogg', avatarSize: { w: 138, h: 150 } },
  ),
  // --- boss: real boss art ---
  'blood-locust-elder': variant(
    'blood-locust-elder',
    { w: 626, h: 857 },
    { x: 0.017572, y: 0, w: 0.972843, h: 1 },
    { idle: [1, 12, 1], attack: [1, 1, 1], death: [1, 1, 1] },
    { attackSfx: 'blood-locust-elder-attack.ogg', avatarSize: { w: 150, h: 150 } },
  ),
  // --- boss recolors ---
  'bloodflower-tree-fiend-mudboss': variant(
    'bloodflower-tree-fiend-mudboss',
    { w: 616, h: 543 },
    { x: 0.025974, y: 0, w: 0.964286, h: 1 },
    { idle: [1, 25, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { avatarSize: { w: 81, h: 78 } },
  ),
  'streamscale-forkman-floodserpent': variant(
    'streamscale-forkman-floodserpent',
    { w: 514, h: 463 },
    { x: 0.015564, y: 0, w: 0.980545, h: 0.993521 },
    { idle: [1, 9, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { attackSfx: 'streamscale-forkman-attack.ogg', avatarSize: { w: 142, h: 150 } },
  ),
  // --- ferocious recolors of mapped species ---
  'graymane-wolf-ferocious': variant(
    'graymane-wolf-ferocious',
    { w: 504, h: 283 },
    { x: 0, y: 0, w: 0.984127, h: 1 },
    { idle: [1, 9, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { attackSfx: 'graymane-wolf-attack.ogg', avatarSize: { w: 147, h: 150 } },
  ),
  'tusked-mountain-boar-ferocious': variant(
    'tusked-mountain-boar-ferocious',
    { w: 258, h: 154 },
    { x: 0.007752, y: 0, w: 0.965116, h: 1 },
    { idle: [1, 15, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { avatarSize: { w: 102, h: 102 } },
  ),
  'bloodarm-ox-demon-ferocious': variant(
    'bloodarm-ox-demon-ferocious',
    { w: 429, h: 355 },
    { x: 0, y: 0, w: 0.988345, h: 0.997183 },
    { idle: [1, 8, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { attackSfx: 'bloodarm-ox-demon-attack.ogg', avatarSize: { w: 148, h: 150 } },
  ),
  'mudbelly-green-toad-ferocious': variant(
    'mudbelly-green-toad-ferocious',
    { w: 475, h: 345 },
    { x: 0, y: 0, w: 1, h: 1 },
    { idle: [1, 13, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { attackSfx: 'mudbelly-green-toad-attack.ogg', avatarSize: { w: 512, h: 512 } },
  ),
  'whiteshell-venom-beetle-ferocious': variant(
    'whiteshell-venom-beetle-ferocious',
    { w: 596, h: 221 },
    { x: 0.010067, y: 0, w: 0.984899, h: 0.99095 },
    { idle: [1, 9, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { attackSfx: 'whiteshell-venom-beetle-attack.ogg', avatarSize: { w: 512, h: 512 } },
  ),
  'drybranch-treant-ferocious': variant(
    'drybranch-treant-ferocious',
    { w: 624, h: 624 },
    { x: 0, y: 0, w: 0.99359, h: 1 },
    { idle: [1, 13, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { avatarSize: { w: 102, h: 102 } },
  ),
  'spore-flower-spirit-ferocious': variant(
    'spore-flower-spirit-ferocious',
    { w: 249, h: 243 },
    { x: 0.136546, y: 0, w: 0.859438, h: 0.880658 },
    { idle: [1, 15, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { avatarSize: { w: 102, h: 102 } },
  ),
  'bloodflower-tree-fiend-mudboss-ferocious': variant(
    'bloodflower-tree-fiend-mudboss-ferocious',
    { w: 616, h: 543 },
    { x: 0.025974, y: 0, w: 0.964286, h: 1 },
    { idle: [1, 25, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { avatarSize: { w: 81, h: 78 } },
  ),
  'streamscale-forkman-floodserpent-ferocious': variant(
    'streamscale-forkman-floodserpent-ferocious',
    { w: 514, h: 463 },
    { x: 0.015564, y: 0, w: 0.980545, h: 0.993521 },
    { idle: [1, 9, 1], attack: [1, 2, 1], death: [1, 1, 1] },
    { attackSfx: 'streamscale-forkman-attack.ogg', avatarSize: { w: 142, h: 150 } },
  ),
  // The Co Thu / Wugu Demon King (impact-sync): packed on disk since
  // wave-1 but RESERVED until now - the first variant whose clips span
  // multiple sheets. enrage (sheet-3) and stomp (sheet-4) are packed but
  // have no runtime path yet, so they are not registered here.
  'wugu-demon-king': variant(
    'wugu-demon-king',
    { w: 463, h: 376 },
    { x: 0.008639, y: 0, w: 0.984881, h: 1 },
    { idle: [1, 13, 1], attack: [1, 23, 2], death: [1, 1, 2] },
    { avatarSize: { w: 150, h: 150 } },
  ),
}

/**
 * Enemy id -> variant slug (spec sec.2). Keys are TEMPLATE ids; runtime ids
 * (`<templateId>_<uuid>`) match by longest prefix - same convention as
 * EnemyArt.resolveEnemyTextureKey. Sorted longest-first.
 */
export const ENEMY_RESKIN_MAP: Record<string, string> = {
  // qi_refining boss-eligible pair - recolored streamscale-forkman art
  flood_serpent: 'streamscale-forkman-floodserpent',
  ferocious_flood_serpent: 'streamscale-forkman-floodserpent-ferocious',
  pool_toad: 'mudbelly-green-toad',
  ferocious_pool_toad: 'mudbelly-green-toad-ferocious',
  metal_beetle: 'whiteshell-venom-beetle',
  ferocious_metal_beetle: 'whiteshell-venom-beetle-ferocious',
  forest_fiend: 'witherfir-vineman',
  // mortal tier
  mortal_feral_dog: 'graymane-wolf',
  mortal_ferocious_feral_dog: 'graymane-wolf-ferocious',
  mortal_wild_boar: 'tusked-mountain-boar',
  mortal_ferocious_wild_boar: 'tusked-mountain-boar-ferocious',
  mortal_mud_ox: 'bloodarm-ox-demon',
  mortal_ferocious_mud_ox: 'bloodarm-ox-demon-ferocious',
  // mortal boss-eligible - recolored bloodflower-tree-fiend
  mortal_giant_crocodile: 'bloodflower-tree-fiend-mudboss',
  mortal_ferocious_giant_crocodile: 'bloodflower-tree-fiend-mudboss-ferocious',
  // foundation tier
  foundation_wood_ape: 'drybranch-treant',
  foundation_ferocious_wood_ape: 'drybranch-treant-ferocious',
  foundation_stone_fungus: 'spore-flower-spirit',
  foundation_ferocious_stone_fungus: 'spore-flower-spirit-ferocious',
  foundation_flood_dragon_whelp: 'streamgrudge-nymph',
  // The chapter boss: `foundation_ferocious_flood_dragon_whelp` is the
  // bossEligible species promoted on floor 10 (bossTrigger ->
  // 'foundation_dragon_enrage' BUFF - the *_phase* ids are buffs, not
  // enemies). It wears the real boss art, not a ferocious nymph recolor.
  foundation_ferocious_flood_dragon_whelp: 'blood-locust-elder',
  // Co Thu (hidden-beast boss) binds the wugu-demon-king atlas
  // (impact-sync). huyet_mong deliberately stays unbound - it is not the
  // same entity.
  co_thu: 'wugu-demon-king',
}

const RESKIN_KEYS = Object.keys(ENEMY_RESKIN_MAP).sort((a, b) => b.length - a.length)

/** Runtime/template enemy id -> variant slug, or undefined when unmapped. */
/**
 * The template ids ENEMY_RESKIN_MAP intercepts - the enumeration loaders use
 * to skip an old PNG that can no longer be reached (the variant slug wins
 * resolution; the avatar is the fallback, never the superseded texture).
 */
export function reskinnedTemplateIds(): ReadonlySet<string> {
  return new Set(Object.keys(ENEMY_RESKIN_MAP))
}

export function resolveMonsterArtSlug(enemyId: string): string | undefined {
  for (const templateId of RESKIN_KEYS) {
    if (enemyId === templateId || enemyId.startsWith(`${templateId}_`)) {
      return ENEMY_RESKIN_MAP[templateId]
    }
  }
  return undefined
}

/**
 * Entity keys that emit `kind: 'animated'` even while ENTITY_ART_MODE is
 * 'static' - the sanctioned per-entity exception to the uniformity contract
 * (spec D2, contract amendment 2026-09-28). Everything else keeps the mode.
 */
export const ANIMATED_ENEMY_KEYS: ReadonlySet<string> = new Set(
  Object.values(ENEMY_RESKIN_MAP),
)

export const MONSTER_ZERO_PAD = ZERO_PAD
export const MONSTER_FRAME_SUFFIX = FRAME_SUFFIX
