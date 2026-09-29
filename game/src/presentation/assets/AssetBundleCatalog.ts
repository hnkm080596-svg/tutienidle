/**
 * AssetBundleCatalog (AstraDoctrine Law A10, AGENTS.md P17).
 * Central catalog of resource descriptors for each presentation bundle.
 *
 * Bundles:
 * - 'core-ui': common required UI assets (ink-wash-ui atlas).
 * - 'home': player standing/cultivate textures and Dong Fu modular DOM layers.
 * - 'combat': backdrop, player combat art, enemy sprites, gourd, animation sheets.
 * - 'tribulation': cultivate multiatlas, ink-wash-ui.
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
import { CHARACTER_ART, resolveCharacterArtSlugs } from '@/game/support/CharacterArt'
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

export type AssetBundleId = 'core-ui' | 'home' | 'combat' | 'tribulation'

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

export type AssetResourceDescriptor =
  | ImageResourceDescriptor
  | SpritesheetResourceDescriptor
  | AtlasResourceDescriptor
  | MultiAtlasResourceDescriptor
  | DomImageResourceDescriptor

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

  return descriptors
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
 */
export function getBundlesForRoute(target: Route): readonly AssetBundleId[] {
  switch (target) {
    case 'home':
      return ['core-ui', 'home']
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
