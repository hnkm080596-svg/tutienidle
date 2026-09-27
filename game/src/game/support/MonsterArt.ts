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

export interface MonsterClipRange {
  /** `<slug>-<clip>-` - matches pack-enemy-art.mjs frameName(). */
  framePrefix: string
  firstFrame: number
  lastFrame: number
  /** Sheet atlas pair inside the variant dir (a clip never spans sheets). */
  sheetKey: string
  sheetUrl: string
  atlasUrl: string
}

export interface MonsterArtVariant {
  slug: string
  /** Authored canvas the frames were drawn in (dump: 960, forest: 624). */
  sourceSize: { w: number; h: number }
  /** Alpha bbox of the tallest frame, normalized - drives display sizing. */
  extent: ArtExtent
  /** Unity m_Pivot of idle-1 (bottom-center anchor for ground contact). */
  pivot: { x: number; y: number }
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
  }
}

function variant(
  slug: string,
  sourceSize: { w: number; h: number },
  extent: ArtExtent,
  ranges: { idle: [number, number]; death: [number, number]; attack?: [number, number] },
  opts: { attackSfx?: string; pivot?: { x: number; y: number }; avatarSize?: { w: number; h: number } } = {},
): MonsterArtVariant {
  return {
    slug,
    sourceSize,
    extent,
    pivot: opts.pivot ?? { x: 0.5, y: 1 },
    avatarKey: `${slug}-avatar`,
    avatarUrl: `${ART_ROOT}/${slug}/avatar.png`,
    avatarSize: opts.avatarSize ?? { w: 150, h: 150 },
    attackSfxUrl: opts.attackSfx ? `${SFX_ROOT}/${slug}/${opts.attackSfx}` : undefined,
    clips: {
      idle: clip(slug, 'idle', ranges.idle[0], ranges.idle[1], 1),
      death: clip(slug, 'death', ranges.death[0], ranges.death[1], 1),
      attack: ranges.attack ? clip(slug, 'attack', ranges.attack[0], ranges.attack[1], 1) : undefined,
    },
  }
}

/**
 * The wired wave-1 set. wugu-demon-king is packed on disk but deliberately
 * NOT in this table - no enemy id binds it yet (spec sec.2.2 RESERVED).
 */
export const MONSTER_ART: Record<string, MonsterArtVariant> = {
  // --- 9 approved species ---
  'graymane-wolf': variant(
    'graymane-wolf',
    { w: 960, h: 960 },
    { x: 0.280208, y: 0.467708, w: 0.516667, h: 0.294792 },
    { idle: [1, 9], attack: [1, 2], death: [1, 1] },
    { attackSfx: 'graymane-wolf-attack.ogg', avatarSize: { w: 147, h: 150 } },
  ),
  'tusked-mountain-boar': variant(
    'tusked-mountain-boar',
    { w: 624, h: 624 },
    { x: 0.296474, y: 0.641026, w: 0.399038, h: 0.246795 },
    { idle: [1, 15], attack: [1, 2], death: [1, 1] },
    { avatarSize: { w: 102, h: 102 } },
  ),
  'bloodarm-ox-demon': variant(
    'bloodarm-ox-demon',
    { w: 960, h: 960 },
    { x: 0.296875, y: 0.386458, w: 0.441667, h: 0.36875 },
    { idle: [1, 8], attack: [1, 2], death: [1, 1] },
    { attackSfx: 'bloodarm-ox-demon-attack.ogg', avatarSize: { w: 148, h: 150 } },
  ),
  'mudbelly-green-toad': variant(
    'mudbelly-green-toad',
    { w: 960, h: 960 },
    { x: 0.252083, y: 0.416667, w: 0.494792, h: 0.359375 },
    { idle: [1, 13], attack: [1, 2], death: [1, 1] },
    { attackSfx: 'mudbelly-green-toad-attack.ogg', avatarSize: { w: 512, h: 512 } },
  ),
  'whiteshell-venom-beetle': variant(
    'whiteshell-venom-beetle',
    { w: 960, h: 960 },
    { x: 0.215625, y: 0.544792, w: 0.611458, h: 0.228125 },
    { idle: [1, 9], attack: [1, 2], death: [1, 1] },
    { attackSfx: 'whiteshell-venom-beetle-attack.ogg', avatarSize: { w: 512, h: 512 } },
  ),
  'witherfir-vineman': variant(
    'witherfir-vineman',
    { w: 960, h: 960 },
    { x: 0.335417, y: 0.192708, w: 0.341667, h: 0.595833 },
    { idle: [1, 10], attack: [1, 2], death: [1, 1] },
    { attackSfx: 'witherfir-vineman-attack.ogg', avatarSize: { w: 132, h: 150 } },
  ),
  'drybranch-treant': variant(
    'drybranch-treant',
    { w: 624, h: 624 },
    { x: 0, y: 0, w: 0.99359, h: 1 },
    { idle: [1, 13], attack: [1, 2], death: [1, 1] },
    { avatarSize: { w: 102, h: 102 } },
  ),
  'spore-flower-spirit': variant(
    'spore-flower-spirit',
    { w: 624, h: 624 },
    { x: 0.333333, y: 0.439103, w: 0.342949, h: 0.342949 },
    { idle: [1, 15], attack: [1, 2], death: [1, 1] },
    { avatarSize: { w: 102, h: 102 } },
  ),
  'streamgrudge-nymph': variant(
    'streamgrudge-nymph',
    { w: 960, h: 960 },
    { x: 0.251042, y: 0.148958, w: 0.48125, h: 0.565625 },
    { idle: [1, 10], attack: [1, 2], death: [1, 1] },
    { attackSfx: 'streamgrudge-nymph-attack.ogg', avatarSize: { w: 138, h: 150 } },
  ),
  // --- boss: real boss art ---
  'blood-locust-elder': variant(
    'blood-locust-elder',
    { w: 960, h: 960 },
    { x: 0.185417, y: 0.051042, w: 0.634375, h: 0.892708 },
    { idle: [1, 12], attack: [1, 1], death: [1, 1] },
    { attackSfx: 'blood-locust-elder-attack.ogg', avatarSize: { w: 150, h: 150 } },
  ),
  // --- boss recolors ---
  'bloodflower-tree-fiend-mudboss': variant(
    'bloodflower-tree-fiend-mudboss',
    { w: 624, h: 624 },
    { x: 0.038462, y: 0.033654, w: 0.951923, h: 0.870192 },
    { idle: [1, 25], attack: [1, 2], death: [1, 1] },
    { avatarSize: { w: 81, h: 78 } },
  ),
  'streamscale-forkman-floodserpent': variant(
    'streamscale-forkman-floodserpent',
    { w: 960, h: 960 },
    { x: 0.182292, y: 0.292708, w: 0.525, h: 0.479167 },
    { idle: [1, 9], attack: [1, 2], death: [1, 1] },
    { attackSfx: 'streamscale-forkman-attack.ogg', avatarSize: { w: 142, h: 150 } },
  ),
  // --- ferocious recolors of mapped species ---
  'graymane-wolf-ferocious': variant(
    'graymane-wolf-ferocious',
    { w: 960, h: 960 },
    { x: 0.280208, y: 0.467708, w: 0.516667, h: 0.294792 },
    { idle: [1, 9], attack: [1, 2], death: [1, 1] },
    { attackSfx: 'graymane-wolf-attack.ogg', avatarSize: { w: 147, h: 150 } },
  ),
  'tusked-mountain-boar-ferocious': variant(
    'tusked-mountain-boar-ferocious',
    { w: 624, h: 624 },
    { x: 0.296474, y: 0.641026, w: 0.399038, h: 0.246795 },
    { idle: [1, 15], attack: [1, 2], death: [1, 1] },
    { avatarSize: { w: 102, h: 102 } },
  ),
  'bloodarm-ox-demon-ferocious': variant(
    'bloodarm-ox-demon-ferocious',
    { w: 960, h: 960 },
    { x: 0.296875, y: 0.386458, w: 0.441667, h: 0.36875 },
    { idle: [1, 8], attack: [1, 2], death: [1, 1] },
    { attackSfx: 'bloodarm-ox-demon-attack.ogg', avatarSize: { w: 148, h: 150 } },
  ),
  'mudbelly-green-toad-ferocious': variant(
    'mudbelly-green-toad-ferocious',
    { w: 960, h: 960 },
    { x: 0.252083, y: 0.416667, w: 0.494792, h: 0.359375 },
    { idle: [1, 13], attack: [1, 2], death: [1, 1] },
    { attackSfx: 'mudbelly-green-toad-attack.ogg', avatarSize: { w: 512, h: 512 } },
  ),
  'whiteshell-venom-beetle-ferocious': variant(
    'whiteshell-venom-beetle-ferocious',
    { w: 960, h: 960 },
    { x: 0.215625, y: 0.544792, w: 0.611458, h: 0.228125 },
    { idle: [1, 9], attack: [1, 2], death: [1, 1] },
    { attackSfx: 'whiteshell-venom-beetle-attack.ogg', avatarSize: { w: 512, h: 512 } },
  ),
  'drybranch-treant-ferocious': variant(
    'drybranch-treant-ferocious',
    { w: 624, h: 624 },
    { x: 0, y: 0, w: 0.99359, h: 1 },
    { idle: [1, 13], attack: [1, 2], death: [1, 1] },
    { avatarSize: { w: 102, h: 102 } },
  ),
  'spore-flower-spirit-ferocious': variant(
    'spore-flower-spirit-ferocious',
    { w: 624, h: 624 },
    { x: 0.333333, y: 0.439103, w: 0.342949, h: 0.342949 },
    { idle: [1, 15], attack: [1, 2], death: [1, 1] },
    { avatarSize: { w: 102, h: 102 } },
  ),
  'bloodflower-tree-fiend-mudboss-ferocious': variant(
    'bloodflower-tree-fiend-mudboss-ferocious',
    { w: 624, h: 624 },
    { x: 0.038462, y: 0.033654, w: 0.951923, h: 0.870192 },
    { idle: [1, 25], attack: [1, 2], death: [1, 1] },
    { avatarSize: { w: 81, h: 78 } },
  ),
  'streamscale-forkman-floodserpent-ferocious': variant(
    'streamscale-forkman-floodserpent-ferocious',
    { w: 960, h: 960 },
    { x: 0.182292, y: 0.292708, w: 0.525, h: 0.479167 },
    { idle: [1, 9], attack: [1, 2], death: [1, 1] },
    { attackSfx: 'streamscale-forkman-attack.ogg', avatarSize: { w: 142, h: 150 } },
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
}

const RESKIN_KEYS = Object.keys(ENEMY_RESKIN_MAP).sort((a, b) => b.length - a.length)

/** Runtime/template enemy id -> variant slug, or undefined when unmapped. */
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
