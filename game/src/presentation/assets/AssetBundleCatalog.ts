/**
 * AssetBundleCatalog (AstraDoctrine Law A10, AGENTS.md P17).
 * Central catalog of resource descriptors for each presentation bundle.
 *
 * Bundles:
 * - 'core-ui': common required UI assets (ink-wash-ui atlas).
 * - 'home': player standing/cultivate textures and Dong Fu modular DOM layers.
 * - 'combat': backdrop, player combat art, enemy sprites, gourd, animation sheets.
 * - 'tribulation': cultivate multiatlas, ink-wash-ui.
 * - 'ui-chrome': shared panel chrome (huyen-kim slots, symbols, ink-wash
 *   overlays, slot frames, element art) - required by the 'home' transition.
 * - 'ui-scenes': panel/backdrop/icon art reachable mid-session - warmed
 *   lazily on route commit, never inside a transition deadline.
 */

import type { Route } from '../PresentationContracts'
import {
  INK_WASH_UI_ATLAS_DATA_URL,
  INK_WASH_UI_ATLAS_IMAGE_URL,
  INK_WASH_UI_ATLAS_KEY,
} from '@/game/support/InkWashUiPhaser'
import {
  dongFuLayerList,
  type DongFuLayerDescriptor,
} from '@/presentation/background/DongFuArt'
import {
  peekThanhVanVariant,
  thanhVanLoadList,
} from '@/presentation/background/ThanhVanBackdropArt'
import {
  ENEMY_TEMPLATE_IDS,
  PLAYER_TEXTURE_KEY,
  PLAYER_TEXTURE_URL,
} from '@/game/support/CombatPreload'
import {
  GOURD_TEXTURE_KEY,
  GOURD_TEXTURE_URL,
} from '@/game/support/RewardGourd'
import {
  enemyTextureUrl,
  resolveEnemyTextureKey,
} from '@/game/support/EnemyArt'
import { MONSTER_ART, reskinnedTemplateIds } from '@/game/support/MonsterArt'
import { CHARACTER_ART, companionArtVariants, resolveCharacterArtSlugs } from '@/game/support/CharacterArt'
import {
  CULTIVATE_TEXTURE_OVERRIDES,
  PLAYER_VISUAL_PROFILES,
} from '@/presentation/art/PlayerVisualProfiles'
import {
  animatedCombatEntities,
  animatedArtFormFor,
  resolvePlayerEntityKey,
  PLACEHOLDER_STATIC_TEXTURE_KEY,
  PLACEHOLDER_STATIC_TEXTURE_URL,
} from '@/presentation/art/CombatPresentationCatalogue'
import { ENTITY_ART_MODE } from '@/presentation/art/EntityArtMode'
import { atlasClipsOf } from '@/presentation/art/CombatEntityPresentation'
import {
  STABLE_PARALLAX_STACK_IDS,
  STABLE_SYMBOL_IDS,
  stableParallaxStack,
  stableSceneArtUrl,
  stableSymbolUrl,
} from '@/presentation/huyenKim/StableSceneArt'
import { HUYEN_KIM_CHROME } from '@/ui/huyenKimChrome'
import {
  THANH_VAN_SEASONS,
  THANH_VAN_TIMES,
} from '@/presentation/background/BackgroundVariant'
import {
  DONG_FU_BUILDING_ART,
  dongFuBuildingAssetUrls,
  dongFuSeasonOverlayUrl,
} from '@/presentation/background/DongFuBuildingArt'
import { equipment } from '@/data/equipment/equipment'
import { materials } from '@/data/materials/materials'
import { pills } from '@/data/pill/pills'
import { SKILL_ICON_MANIFEST } from '@/data/skill/SkillIconManifest'
import { TECHNIQUES } from '@/data/technique/Techniques'
import { AUDIO_CUES } from '@/core/audio/AudioCueManifest'
import { hoaCauCombatDescriptors, phapTheCombatDescriptors } from '@/game/support/HoaCauVfxAssets'
import { linhBaoCombatDescriptors } from '@/game/support/LinhBaoVfxAssets'
import { vfxSheetCombatDescriptors } from '@/data/vfx/VfxSheetManifest'

export type AudioBundleId = 'audio-core' | 'audio-combat' | 'audio-tribulation'

export type AssetBundleId =
  | 'core-ui'
  | 'home'
  | 'combat'
  | 'tribulation'
  | 'ui-chrome'
  | 'ui-scenes'
  | AudioBundleId

export type ImageResourceDescriptor = Readonly<{
  kind: 'image'
  key: string
  url: string
}>

export type SpritesheetResourceDescriptor = Readonly<{
  kind: 'spritesheet'
  key: string
  url: string
  frameWidth: number
  frameHeight: number
}>

export type AtlasResourceDescriptor = Readonly<{
  kind: 'atlas'
  key: string
  textureUrl: string
  atlasUrl: string
}>

export type MultiAtlasResourceDescriptor = Readonly<{
  kind: 'multiatlas'
  key: string
  jsonUrl: string
  basePath?: string
}>

export type DomImageResourceDescriptor = Readonly<{
  kind: 'dom-image'
  key: string
  url: string
}>

// Sound System W4: DOM-side audio fetch lane. `key` is the manifest src
// path (AudioManager buffers are keyed by src), `urls` holds that single
// src. `optional` is a type-level marker: a missing file marks the key
// missing and resolves - it never rejects a bundle the way a missing
// texture does.
export type DomAudioResourceDescriptor = Readonly<{
  kind: 'dom-audio'
  key: string
  urls: readonly string[]
  optional: true
}>

export type AssetResourceDescriptor =
  | ImageResourceDescriptor
  | SpritesheetResourceDescriptor
  | AtlasResourceDescriptor
  | MultiAtlasResourceDescriptor
  | DomImageResourceDescriptor
  | DomAudioResourceDescriptor

export function getCoreUiDescriptors(): readonly AssetResourceDescriptor[] {
  return [
    {
      kind: 'atlas',
      key: INK_WASH_UI_ATLAS_KEY,
      textureUrl: INK_WASH_UI_ATLAS_IMAGE_URL,
      atlasUrl: INK_WASH_UI_ATLAS_DATA_URL,
    },
  ]
}

export function getHomeDescriptors(): readonly AssetResourceDescriptor[] {
  const descriptors: AssetResourceDescriptor[] = []
  const seenKeys = new Set<string>()

  // Player textures required by Home (both standing and cultivate poses for all profiles)
  for (const profile of Object.values(PLAYER_VISUAL_PROFILES)) {
    if (!seenKeys.has(profile.combatTextureKey)) {
      seenKeys.add(profile.combatTextureKey)
      descriptors.push({
        kind: 'image',
        key: profile.combatTextureKey,
        url: profile.combatTextureUrl,
      })
    }

    if (profile.cultivateTextureKey && profile.cultivateTextureUrl && !seenKeys.has(profile.cultivateTextureKey)) {
      seenKeys.add(profile.cultivateTextureKey)
      descriptors.push({
        kind: 'image',
        key: profile.cultivateTextureKey,
        url: profile.cultivateTextureUrl,
      })
    }
  }

  // Hidden-way cultivate PNGs (art-seam wave) - same enumerate-everything
  // rule as the profiles: the way read happens at draw time, so the bundle
  // cannot know which override the session will need.
  for (const override of Object.values(CULTIVATE_TEXTURE_OVERRIDES)) {
    if (override && !seenKeys.has(override.key)) {
      seenKeys.add(override.key)
      descriptors.push({
        kind: 'image',
        key: override.key,
        url: override.url,
      })
    }
  }

  if (ENTITY_ART_MODE === 'animated') {
    // Animated mode - MainScene plays the player atlas's idle clip (standing)
    // and the cultivate bridge (sitting). The PNGs above stay loaded too:
    // PlayerPortrait and panel surfaces still read them.
    for (const profile of Object.values(PLAYER_VISUAL_PROFILES)) {
      // Resolve through the same entity-key authority MainScene uses - the
      // raw combatTextureKey misses reskin-mapped character sheets and
      // under-enumerates the bundle (dormant-mode divergence). Enumerate
      // EVERY mapped slug (armed AND unarmed): the armed pick resolves at
      // spawn/profile-change time, so preloading only one leaves the other
      // sheet unloadable mid-scene.
      const entityKeys = new Set([
        ...resolveCharacterArtSlugs(profile.id),
        resolvePlayerEntityKey(profile.id, profile.combatTextureKey),
      ])

      for (const entityKey of entityKeys) {
        const clips = animatedArtFormFor(entityKey)

        if (!clips) {
          continue
        }

        for (const clip of atlasClipsOf(clips)) {
          if (seenKeys.has(clip.sheetKey)) {
            continue
          }

          seenKeys.add(clip.sheetKey)
          descriptors.push({
            kind: 'atlas',
            key: clip.sheetKey,
            textureUrl: clip.sheetUrl,
            atlasUrl: clip.atlasUrl,
          })
        }
      }
    }

    // Legacy cultivate bridge - shared 17-frame multiatlas until the player
    // atlases carry a cultivate clip (uniformity plan, 2026-09-19).
    if (!seenKeys.has('char-cultivate')) {
      seenKeys.add('char-cultivate')
      descriptors.push({
        kind: 'multiatlas',
        key: 'char-cultivate',
        jsonUrl: 'assets/cultivate.json',
        basePath: 'assets',
      })
    }
  }

  // Dong Fu DOM layers (for the current variant)
  const variant = peekThanhVanVariant()
  for (const layer of dongFuLayerList(variant)) {
    descriptors.push({
      kind: 'dom-image',
      key: layer.key,
      url: layer.url,
    })
  }

  return descriptors
}

export function getCombatDescriptors(): readonly AssetResourceDescriptor[] {
  const descriptors: AssetResourceDescriptor[] = []
  const seenKeys = new Set<string>()

  const addImage = (key: string, url: string) => {
    if (seenKeys.has(key)) return
    seenKeys.add(key)
    descriptors.push({ kind: 'image', key, url })
  }

  // Mortal fallback player art
  addImage(PLAYER_TEXTURE_KEY, PLAYER_TEXTURE_URL)

  // Static-mode placeholder silhouette - what every unregistered entity
  // draws instead of a Rectangle (uniformity, 2026-09-19). In 'animated'
  // mode the placeholder is the shared atlas, covered by the clip loop below.
  if (ENTITY_ART_MODE === 'static') {
    addImage(PLACEHOLDER_STATIC_TEXTURE_KEY, PLACEHOLDER_STATIC_TEXTURE_URL)
  }

  // Thanh Van modular backdrop layers
  for (const entry of thanhVanLoadList(peekThanhVanVariant())) {
    addImage(entry.key, entry.url)
  }

  // Reward Gourd art
  addImage(GOURD_TEXTURE_KEY, GOURD_TEXTURE_URL)

  // Mortal enemy batch textures - minus reskinned ids, whose old PNG is
  // unreachable (the variant slug wins resolution; the avatar is fallback).
  const reskinned = reskinnedTemplateIds()

  for (const templateId of ENEMY_TEMPLATE_IDS) {
    if (reskinned.has(templateId)) {
      continue
    }

    const textureKey = resolveEnemyTextureKey(templateId)
    if (textureKey) {
      addImage(textureKey, enemyTextureUrl(textureKey))
    }
  }

  // Reskinned enemies (enemy-art-wave1): avatar PNG is the static fallback.
  for (const variant of Object.values(MONSTER_ART)) {
    addImage(variant.avatarKey, variant.avatarUrl)
  }

  // Reskinned characters (character-art-infra): same fallback contract.
  for (const variant of Object.values(CHARACTER_ART)) {
    addImage(variant.avatarKey, variant.avatarUrl)
  }

  // Mapped companions (impact-sync sec.52): borrowed character avatar as
  // static fallback - no-op while COMPANION_RESKIN_MAP is empty.
  for (const variant of companionArtVariants()) {
    addImage(variant.avatarKey, variant.avatarUrl)
  }

  // Player profiles combat & cultivate textures
  for (const profile of Object.values(PLAYER_VISUAL_PROFILES)) {
    addImage(profile.combatTextureKey, profile.combatTextureUrl)
    if (profile.cultivateTextureKey && profile.cultivateTextureUrl) {
      addImage(profile.cultivateTextureKey, profile.cultivateTextureUrl)
    }
  }

  // Hidden-way cultivate overrides (art-seam wave): the cultivate pose in
  // the combat-side paths reads these when the way is hidden.
  for (const override of Object.values(CULTIVATE_TEXTURE_OVERRIDES)) {
    if (override) {
      addImage(override.key, override.url)
    }
  }

  // Character animation atlases (Spec B sec.3.1) - one entry per distinct sheet,
  // however many entities and clips share it.
  for (const { clips } of animatedCombatEntities()) {
    for (const clip of atlasClipsOf(clips)) {
      if (seenKeys.has(clip.sheetKey)) continue
      seenKeys.add(clip.sheetKey)
      descriptors.push({
        kind: 'atlas',
        key: clip.sheetKey,
        textureUrl: clip.sheetUrl,
        atlasUrl: clip.atlasUrl,
      })
    }
  }

  for (const descriptor of [...hoaCauCombatDescriptors(), ...linhBaoCombatDescriptors(), ...phapTheCombatDescriptors()]) {
    if (seenKeys.has(descriptor.key)) continue
    seenKeys.add(descriptor.key)
    descriptors.push(descriptor)
  }

  // Monster attack VFX sweep (2026-10-04) - preset-bound attack sheets
  // (VfxSheetManifest); 'sheet' impact cues read these texture keys.
  for (const descriptor of vfxSheetCombatDescriptors()) {
    if (seenKeys.has(descriptor.key)) continue
    seenKeys.add(descriptor.key)
    descriptors.push(descriptor)
  }

  return descriptors
}

export function getTribulationDescriptors(): readonly AssetResourceDescriptor[] {
  const descriptors: AssetResourceDescriptor[] = []

  if (ENTITY_ART_MODE === 'animated') {
    // Legacy bridge until player atlases carry a cultivate clip: the shared
    // 17-frame cultivate multiatlas IS the cultivate presentation.
    descriptors.push({
      kind: 'multiatlas',
      key: 'char-cultivate',
      jsonUrl: 'assets/cultivate.json',
      basePath: 'assets',
    })
  } else {
    // Static mode - the cultivate PNG, same source HomeScene's sitting pose
    // reads. Profiles share the mortal cultivate art, so dedupe by key.
    const seenKeys = new Set<string>()

    for (const profile of Object.values(PLAYER_VISUAL_PROFILES)) {
      if (
        profile.cultivateTextureKey &&
        profile.cultivateTextureUrl &&
        !seenKeys.has(profile.cultivateTextureKey)
      ) {
        seenKeys.add(profile.cultivateTextureKey)
        descriptors.push({
          kind: 'image',
          key: profile.cultivateTextureKey,
          url: profile.cultivateTextureUrl,
        })
      }
    }

    // Hidden-way cultivate overrides (art-seam wave) - TribulationScene
    // resolves the way before picking its texture.
    for (const override of Object.values(CULTIVATE_TEXTURE_OVERRIDES)) {
      if (override && !seenKeys.has(override.key)) {
        seenKeys.add(override.key)
        descriptors.push({
          kind: 'image',
          key: override.key,
          url: override.url,
        })
      }
    }
  }

  descriptors.push({
    kind: 'atlas',
    key: INK_WASH_UI_ATLAS_KEY,
    textureUrl: INK_WASH_UI_ATLAS_IMAGE_URL,
    atlasUrl: INK_WASH_UI_ATLAS_DATA_URL,
  })

  // Huyen Kim tribulation-environment-kit (stable art): storm-far/storm-
  // near/dais/sky-vignette Phaser textures around the runtime character,
  // lightning and meter presentation. @1x suffices - these render
  // cover-fit at runtime canvas size, never at 2x.
  for (const assetId of TRIBULATION_SCENE_ASSET_IDS) {
    descriptors.push({
      kind: 'image',
      key: `hk-${assetId}`,
      url: stableSceneArtUrl(assetId, '@1x'),
    })
  }

  return descriptors
}

export const TRIBULATION_SCENE_ASSET_IDS = [
  'tribulation-storm-far',
  'tribulation-storm-near',
  'tribulation-dais',
  'tribulation-sky-vignette',
] as const

/**
 * Cue-id prefixes each lazy audio bundle covers. `audio-core` carries every
 * non-scene cue domain plus menu/home music; combat and tribulation add
 * their own cues (tribulation keeps combat.* because ward/vitals events
 * fire there too). While every manifest `src` is '' this yields [].
 */
export const AUDIO_BUNDLE_PREFIXES: Record<AudioBundleId, readonly string[]> = {
  'audio-core': ['ui.', 'stinger.', 'progress.', 'craft.', 'farm.', 'ambient.', 'music.menu', 'music.home'],
  'audio-combat': ['combat.', 'music.combat'],
  'audio-tribulation': ['tribulation.', 'combat.', 'music.tribulation'],
}

/** Boundary-aware prefix match shared by the two bundle lookups below:
 *  `id === p` covers the exact row (`music.combat` itself),
 *  `id.startsWith(p + '.')` covers sub-ids; a bare startsWith(p) would
 *  also match a flat sibling like `music.menubar`. Prefix entries may
 *  already carry the trailing dot (`combat.`), which IS the prefix.
 */
function prefixCoversCue(p: string, cueId: string): boolean {
  return p.endsWith('.')
    ? cueId.startsWith(p)
    : cueId === p || cueId.startsWith(`${p}.`)
}

/** Bundle ids whose prefix table covers the cue - empty means the cue
 *  can never be fetched (a new manifest domain forgot a bundle row). */
export function audioBundleIdsForCue(cueId: string): AudioBundleId[] {
  return (Object.keys(AUDIO_BUNDLE_PREFIXES) as AudioBundleId[]).filter((bundleId) =>
    AUDIO_BUNDLE_PREFIXES[bundleId].some((p) => prefixCoversCue(p, cueId)),
  )
}

/** Manifest-derived audio descriptors: one row per cue with a non-empty src. */
export function audioDescriptorsFor(
  bundleId: AudioBundleId,
): readonly DomAudioResourceDescriptor[] {
  const prefixes = AUDIO_BUNDLE_PREFIXES[bundleId]
  const out: DomAudioResourceDescriptor[] = []
  const seen = new Set<string>()
  for (const [id, def] of Object.entries(AUDIO_CUES)) {
    if (!prefixes.some((p) => prefixCoversCue(p, id))) continue
    const urls = typeof def.src === 'string' ? (def.src ? [def.src] : []) : [...def.src]
    for (const src of urls) {
      if (seen.has(src)) continue
      seen.add(src)
      out.push({ kind: 'dom-audio', key: src, urls: [src], optional: true })
    }
  }
  return out
}

// ---- Panel chrome + scene art lanes ----
//
// Everything below feeds the 'ui-chrome'/'ui-scenes' bundles. Before they
// existed, every chrome/symbol/scene/icon image below was fetched lazily
// by the first component that painted it - the reason every panel switch
// re-requested art. Registry-owned art (chrome manifest, stable layers,
// symbols, buildings, backdrop variants, item-icon catalogs) is read
// straight from its owner module; literals live here only where the
// owning component keeps a raw-path constant.

/**
 * Density the browser picks for a "1x, 2x" srcset/image-set pair: the @2x
 * candidate wins whenever devicePixelRatio exceeds 1, so warming the other
 * file leaves the rendered request cold. Outside a DOM (tests) @1x is the
 * deterministic pick.
 */
function preferredDomDensity(): '@1x' | '@2x' {
  return typeof window !== 'undefined' && window.devicePixelRatio > 1 ? '@2x' : '@1x'
}

/**
 * Shared chrome literals - overlays, slot frames, element art, the divider
 * strip and the two nine-slice papers several fidelity scenes share.
 * These raw paths are referenced inside components and theme.css, so this
 * table is their manifest.
 */
const UI_SHARED_CHROME_URLS = [
  // InkWashBackdrop overlay layers.
  '/assets/ui/ink-wash/overlays/wash-corner-mountain-left.png',
  '/assets/ui/ink-wash/overlays/wash-corner-mountain-right.png',
  '/assets/ui/ink-wash/overlays/wash-bottom-mist.png',
  '/assets/ui/ink-wash/overlays/wash-bamboo-right.png',
  '/assets/ui/ink-wash/overlays/seal-cinnabar-small.png',
  '/assets/ui/ink-wash/overlays/seal-cinnabar-large.png',
  // SlotView frame/hover/seal art.
  '/assets/ui/Slot/inv-slot-backdrop.png',
  '/assets/ui/Slot/bag-slot-hover.png',
  '/assets/ui/Slot/slot-frame-hover.png',
  '/assets/ui/Slot/slot-backdrop.png',
  '/assets/ui/Slot/seal-frame.png',
  // Element discs + Tooltip banners + CharacterFigureWheel formation art.
  '/assets/ui/elements/el-wood.png',
  '/assets/ui/elements/el-fire.png',
  '/assets/ui/elements/el-earth.png',
  '/assets/ui/elements/el-metal.png',
  '/assets/ui/elements/el-water.png',
  '/assets/ui/elements/el-primordial.png',
  '/assets/ui/elements/el-formation-orbs.png',
  '/assets/ui/elements/el-formation-ring.png',
  '/assets/ui/elements/el-formation-star.png',
  '/assets/ui/elements/banner-wood.png',
  '/assets/ui/elements/banner-fire.png',
  '/assets/ui/elements/banner-earth.png',
  '/assets/ui/elements/banner-metal.png',
  '/assets/ui/elements/banner-water.png',
  '/assets/ui/elements/banner-primordial.png',
  // theme.css divider strip + shared nine-slice papers.
  '/assets/ui/divider-glow.png',
  '/assets/ui/huyen-kim/scene/dong-fu-v2/panel-nine-slice.png',
  '/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png',
] as const

/**
 * Per-scene hero art referenced by raw path inside the fidelity scenes and
 * by the module-level art constants (characterUi figure, dongFuUi statics,
 * loginArt). Registry entries with no live consumer (body/technique/map
 * layers) stay unwarmed on purpose. The last two entries are stray
 * component literals pinned by the domArtLiteralCoverage architecture
 * guard - a quoted art path with no registry owner.
 */
const UI_SCENE_SINGLE_URLS = [
  '/assets/ui/huyen-kim/scene/body-v2/mortal-horse-stance-v1.png',
  '/assets/ui/huyen-kim/scene/body-v2/qi-taichi-v1.png',
  '/assets/ui/huyen-kim/scene/body-v2/zhou-meditation-v1.png',
  '/assets/ui/huyen-kim/scene/skill-v2/node-ring-v1.png',
  '/assets/ui/huyen-kim/scene/combat-v2/ornament-ring-v1.png',
  '/assets/ui/huyen-kim/scene/forge-v2/furnace-v1.png',
  '/assets/ui/huyen-kim/scene/victory-v2/victory-title-v1.png',
  '/assets/ui/huyen-kim/scene/defeat-v2/defeat-title-v1.png',
  '/assets/ui/huyen-kim/scene/realm-v2/ascension-path-six-landings-v2.png',
  '/assets/ui/huyen-kim/scene/exploration-v2/terrain-three-realms-v1.png',
  '/assets/ui/huyen-kim/scene/technique-v2/temporary-manual-v1.png',
  '/assets/ui/huyen-kim/alchemy/alchemy-cauldron-prop@2x.png',
  '/assets/ui/huyen-kim/ornaments/divider-ornament@2x.png',
  '/assets/ui/huyen-kim/scene/character-v2/figure.png',
  '/assets/ui/huyen-kim/scene/dong-fu-v2/rear.png',
  '/assets/ui/huyen-kim/scene/dong-fu-v2/foreground.png',
  '/assets/ui/huyen-kim/scene/dong-fu-v2/cultivator.png',
  '/assets/ui/huyen-kim/scene/login-v2/scroll-panel.png',
  '/assets/ui/huyen-kim/scene/login-v2/wordmark.png',
  '/assets/ui/huyen-kim/scene/login-v2/cultivator.png',
  '/assets/ui/huyen-kim/scene/login-v2/jade-button.png',
  // PlayerPortrait sheetUrl - the shared cultivate sheet quoted as a
  // literal (profile cultivate textures already arrive via 'home').
  '/assets/cultivate.png',
  // CombatPreview portrait - enemy battle-status avatar fetched as a
  // DOM image by the ui-preview page.
  '/assets/characters/animated/zuofeng/avatar/zuofeng-battle-status-avatar.png',
  // CharacterFidelityFigure hand-flame - Fire 9 sheetUrl quoted as a
  // literal by the Nhan Vat tab figure (component art path, no registry
  // owner) - pinned by the domArtLiteralCoverage guard.
  '/assets/vfx/spritesheets/火 (9).png',
] as const

/**
 * Item-icon paths across the data catalogs (bag, equipment, alchemy,
 * technique and skill surfaces). Data-driven so a new catalog entry joins
 * the warm automatically.
 */
function collectItemIconUrls(): string[] {
  const urls = new Set<string>()
  const add = (icon: string | undefined) => {
    if (typeof icon === 'string' && icon.startsWith('/assets/')) urls.add(icon)
  }
  for (const pill of pills) add(pill.icon)
  for (const material of materials) add(material.icon)
  for (const item of equipment) {
    add(item.icon)
    for (const icon of item.iconPool ?? []) add(icon)
  }
  for (const technique of TECHNIQUES) add(technique.icon)
  for (const url of Object.values(SKILL_ICON_MANIFEST)) add(url)
  return [...urls]
}

/** Keyed by URL: a file shared by two surfaces dedupes itself. */
function domImageDescriptors(urls: Iterable<string>): AssetResourceDescriptor[] {
  const out: AssetResourceDescriptor[] = []
  const seen = new Set<string>()
  for (const url of urls) {
    if (seen.has(url)) continue
    seen.add(url)
    out.push({ kind: 'dom-image', key: url, url })
  }
  return out
}

/**
 * 'ui-chrome' - the shared panel chrome every surface paints. Required by
 * the 'home' transition (getBundlesForRoute): small enough to stay under
 * the asset deadline, and 'home' is the first route every session commits
 * on the way in, so the first panel open already paints warm.
 */
export function getUiChromeDescriptors(): readonly AssetResourceDescriptor[] {
  const urls: string[] = []

  // huyen-kim-chrome.json: every 'ready' slot at BOTH densities - the
  // nine-slice image-set picks per DPR while hkChromeUrl('2x') consumers
  // take the @2x file directly, so both files are live requests.
  for (const slot of Object.values(HUYEN_KIM_CHROME)) {
    if (slot.status !== 'ready') continue
    urls.push(slot.url1x, slot.url2x)
  }

  // Tintable SVG symbols (nav rail, seals, wheel orbit buttons).
  for (const id of STABLE_SYMBOL_IDS) urls.push(stableSymbolUrl(id))

  urls.push(...UI_SHARED_CHROME_URLS)
  return domImageDescriptors(urls)
}

/**
 * 'ui-scenes' - every panel/backdrop/icon reachable mid-session that is
 * not in a Phaser bundle: parallax stacks, per-scene hero art, ALL Dong Fu
 * backdrop variants (the variant rotates after each battle, so warming
 * only the boot preset reopens the gap), building sprites and the full
 * item-icon catalogs. Too large for a transition deadline -
 * artWarmWiring prefetches it on committed game routes.
 */
export function getUiSceneDescriptors(): readonly AssetResourceDescriptor[] {
  const urls: string[] = []
  const density = preferredDomDensity()

  // HuyenKimParallaxStack srcset picks one density per DPR - warm the
  // file the browser will actually request.
  for (const stackId of STABLE_PARALLAX_STACK_IDS) {
    for (const layer of stableParallaxStack(stackId)) {
      urls.push(density === '@2x' ? layer.src2x : layer.src1x)
    }
  }

  // Single stable layer with a live consumer (EquipmentPaperdoll pins
  // '@2x'); non-stack layers without consumers stay unwarmed.
  urls.push(stableSceneArtUrl('equipment-paperdoll-base', '@2x'))

  urls.push(...UI_SCENE_SINGLE_URLS)

  // Dong Fu modular backdrop: every season/time file is reachable once
  // the variant rotates (selectNextThanhVanVariant after each battle),
  // so enumerate the full matrix, not just the current variant.
  for (const season of THANH_VAN_SEASONS) {
    for (const time of THANH_VAN_TIMES) {
      for (const layer of dongFuLayerList({ season, time })) urls.push(layer.url)
    }
  }

  // Thanh Van modular backdrop (combat/victory/defeat): the variant also
  // rotates after each battle, so the full season/time matrix is reachable
  // - warming only the boot preset reopens the lazy-fetch gap mid-session.
  for (const season of THANH_VAN_SEASONS) {
    for (const time of THANH_VAN_TIMES) {
      for (const layer of thanhVanLoadList({ season, time })) urls.push(layer.url)
    }
  }

  // Dong Fu building sprites + shared season overlay sheets.
  for (const entry of DONG_FU_BUILDING_ART) {
    const building = dongFuBuildingAssetUrls(entry)
    urls.push(building.base, building.silhouetteMask, building.groundShadow, building.lockedOverlay)
  }
  for (const season of THANH_VAN_SEASONS) urls.push(dongFuSeasonOverlayUrl(season))

  urls.push(...collectItemIconUrls())
  return domImageDescriptors(urls)
}

export function getBundleDescriptors(bundleId: AssetBundleId): readonly AssetResourceDescriptor[] {
  switch (bundleId) {
    case 'core-ui':
      return getCoreUiDescriptors()
    case 'home':
      return getHomeDescriptors()
    case 'combat':
      return getCombatDescriptors()
    case 'tribulation':
      return getTribulationDescriptors()
    case 'ui-chrome':
      return getUiChromeDescriptors()
    case 'ui-scenes':
      return getUiSceneDescriptors()
    case 'audio-core':
    case 'audio-combat':
    case 'audio-tribulation':
      return audioDescriptorsFor(bundleId)
  }
}

/**
 * Bundles a route must have loaded before it can be revealed.
 *
 * Only routes that activate a Phaser primary scene require Phaser-loaded
 * bundles. boot/auth/character/error render as plain Vue before any Phaser
 * host exists, so requiring 'core-ui' (a Phaser atlas) there would block on a
 * loader that cannot exist yet - the transition would sit until its deadline
 * and fail, leaving the coordinator stuck off-route for the rest of the
 * session. A route's asset requirement must be satisfiable by the renderer
 * that route actually uses.
 *
 * 'ui-chrome' rides the 'home' transition: the shared panel chrome every
 * surface paints - small enough to stay inside the asset deadline, and
 * 'home' is the earliest Phaser-backed route on the way in, so the first
 * panel open already paints warm. 'ui-scenes' deliberately stays out of
 * this map: ~120MB of mid-session art cannot sit inside a transition's
 * asset deadline - artWarmWiring.prefetch warms it on committed routes.
 */
export function getBundlesForRoute(target: Route): readonly AssetBundleId[] {
  switch (target) {
    case 'home':
      return ['core-ui', 'home', 'ui-chrome']
    case 'combat':
      return ['core-ui', 'combat']
    case 'tribulation':
      return ['core-ui', 'tribulation']
    case 'boot':
    case 'auth':
    case 'character':
    case 'error':
      return []
  }
}

export function enumerateResources(
  bundleIds: readonly AssetBundleId[],
): readonly AssetResourceDescriptor[] {
  const result: AssetResourceDescriptor[] = []
  const seenKeys = new Set<string>()

  for (const bundleId of bundleIds) {
    for (const descriptor of getBundleDescriptors(bundleId)) {
      if (seenKeys.has(descriptor.key)) continue
      seenKeys.add(descriptor.key)
      result.push(descriptor)
    }
  }

  return result
}
