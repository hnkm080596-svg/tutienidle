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
  allCombatAnimationSets,
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
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'

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

  // Thanh Van modular backdrop layers
  for (const entry of thanhVanLoadList(peekThanhVanVariant())) {
    addImage(entry.key, entry.url)
  }

  // Reward Gourd art
  addImage(GOURD_TEXTURE_KEY, GOURD_TEXTURE_URL)

  // Mortal enemy batch textures
  for (const templateId of ENEMY_TEMPLATE_IDS) {
    const textureKey = resolveEnemyTextureKey(templateId)
    if (textureKey) {
      addImage(textureKey, enemyTextureUrl(textureKey))
    }
  }

  // Player profiles combat & cultivate textures
  for (const profile of Object.values(PLAYER_VISUAL_PROFILES)) {
    addImage(profile.combatTextureKey, profile.combatTextureUrl)
    if (profile.cultivateTextureKey && profile.cultivateTextureUrl) {
      addImage(profile.cultivateTextureKey, profile.cultivateTextureUrl)
    }
  }

  // Character animation atlases (Spec B §3.1) — one entry per distinct sheet,
  // however many entities and clips share it.
  for (const { animationSet } of allCombatAnimationSets()) {
    for (const clip of Object.values(animationSet)) {
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
  return [
    {
      kind: 'multiatlas',
      key: 'char-cultivate',
      jsonUrl: 'assets/cultivate.json',
      basePath: 'assets',
    },
    {
      kind: 'atlas',
      key: INK_WASH_UI_ATLAS_KEY,
      textureUrl: INK_WASH_UI_ATLAS_IMAGE_URL,
      atlasUrl: INK_WASH_UI_ATLAS_DATA_URL,
    },
  ]
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
