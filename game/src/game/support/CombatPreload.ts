// CombatPreload - canonical enumeration of every texture CombatScene
// needs. No production caller loads through it anymore: the 'combat'
// asset bundle (AssetBundleCatalog -> AssetLoaderScene) is ensured by the
// presentation coordinator before the scene activates. Its live role is
// the parity authority - tests pin the bundle descriptors to the exact
// key set this helper would queue, so a texture added here without a
// catalog entry (or vice versa) fails the suite.
//
// History: it used to be queued from both MainScene.preload() and
// CombatScene.preload() (the latter as a transitional net until the
// 2026-09-16 live pass proved the bundle covers every key - cold combat
// entry queued 0 textures).
import type Phaser from 'phaser'
import { GOURD_TEXTURE_KEY, GOURD_TEXTURE_URL } from './RewardGourd'
import {
  ENEMY_SOURCE_SIZE,
  enemyTextureUrl,
  resolveEnemyTextureKey,
  MORTAL_ENEMY_TEMPLATE_IDS,
} from './EnemyArt'
import { MONSTER_ART, reskinnedTemplateIds } from './MonsterArt'
import { CHARACTER_ART, companionArtVariants } from './CharacterArt'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import { peekThanhVanVariant, thanhVanLoadList } from './ThanhVanArt'
import {
  animatedCombatEntities,
  FALLBACK_PLAYER_ENTITY_KEY,
  PLACEHOLDER_STATIC_TEXTURE_KEY,
  PLACEHOLDER_STATIC_TEXTURE_URL,
} from '@/presentation/art/CombatPresentationCatalogue'
import { ENTITY_ART_MODE } from '@/presentation/art/EntityArtMode'
import {
  atlasClipsOf,
  type CombatAnimationCatalogue,
} from '@/presentation/art/CombatEntityPresentation'
import { CULTIVATE_TEXTURE_OVERRIDES } from '@/presentation/art/PlayerVisualProfiles'

// The mortal entity key - the shared player fallback. MainScene keeps its
// own atlas; the scenes intentionally use separate texture keys. Re-exported
// here so the many existing importers do not all have to move at once.
export const PLAYER_TEXTURE_KEY = FALLBACK_PLAYER_ENTITY_KEY

// Same PNG as the mortal profile's combatTextureUrl, without the leading
// slash - R12/AR-30 keeps the literal spelled once (in PlayerVisualProfiles).
export const PLAYER_TEXTURE_URL = PLAYER_VISUAL_PROFILES.mortal.combatTextureUrl.replace(
  /^\/+/,
  '',
)

// Mortal enemy art batch (mortal-enemy-art-batch-plan.md) - 20 PNG cho
// 10 loai + ban ferocious; id ngoai batch roi ve placeholder entity
// (Rectangle chi khi ca placeholder cung thieu).
// R12/AR-30: the id list is owned by EnemyArt (MORTAL_ENEMY_TEMPLATE_IDS);
// this re-export keeps the preload surface stable for existing importers.
export const ENEMY_TEMPLATE_IDS = MORTAL_ENEMY_TEMPLATE_IDS

// Spec B sec.4.4 (2026-09-11) - ONE resolver answers what an entity's art is.
// This used to be three near-identical wrappers around one placeholder builder
// that discarded both of its data parameters (sec.2.1).
//
// `allCombatAnimationSets` is gone with them: it named every entity, but every
// entity is no longer animated. Enemies are `kind: 'static'` now (sec.3.2), and a
// list that still handed CombatScene a clip set for each of them would quietly
// re-animate them.
export function animatedCombatAnimationSets(): Array<{
  entityKey: string
  clips: CombatAnimationCatalogue
}> {
  return animatedCombatEntities()
}

/**
 * Queue m?i texture combat c?n - DEDUPE THEO TEXTURE KEY trong ch?nh
 * m?t l?n queue (P2 cleanup, dong-fu plan): `textures.exists()` kh?ng
 * nh?n bi?t key v?a ???c queue trong C?NG l??t g?i, v? c?c Player
 * profile d?ng tr?ng key (sword t?i d?ng Mortal combat art,
 * cultivate chung 'player-mortal-cultivate-v1') n?n guard exists m?t
 * m?nh l? ch?a ??. M?t Set c?c b? ch?n queue tr?ng; guard
 * textures.exists() v?n gi? cho c?c l?n g?i sau khi load ho?n t?t.
 * An to?n g?i t? c? MainScene.preload() v? CombatScene.preload().
 *
 * Combat Art Pipeline Task 9 (2026-09-05) - TH?M (kh?ng thay) queue
 * spritesheet placeholder (1 frame = ?nh g?c, xem CombatAnimationSet.ts)
 * cho t?ng entity C?NH c?c ?nh PNG t?nh c?, KH?NG b? ?nh t?nh c?: MainScene
 * (Home Scene, ngo?i ph?m vi task n?y) v? nh?nh fallback c?a
 * combat-grid-view.ts/combat-player-visual.ts v?n d?ng key t?nh nguy?n b?n
 * (PLAYER_TEXTURE_KEY/profile.combatTextureKey/enemy texture key) l?m
 * texture TH?T c?a Sprite; ??i c?c key ?? th?nh spritesheet-only s? l?m v?
 * M?I ch? ?ang add.sprite()/setTexture() b?ng key t?nh ?? (MainScene player
 * ??ng ? Nh?, kh?ng h? animate - t? comment trong MainScene.ts). CombatScene
 * ch? c?n c?c sheetKey RI?NG (h?u t? '-idle-sheet'...) ?? ch?y Animation, n?n
 * load th?m l? ??, kh?ng c?n s?a consumer n?o kh?c ngo?i 2 file brief n?y.
 */
export function queueCombatAssets(scene: Phaser.Scene): void {
  const queuedKeys = new Set<string>()

  const queueOnce = (key: string, url: string) => {
    if (queuedKeys.has(key) || scene.textures.exists(key)) {
      return
    }

    queuedKeys.add(key)

    scene.load.image(key, url)
  }

  const queueAtlasOnce = (clips: CombatAnimationCatalogue) => {
    for (const clip of atlasClipsOf(clips)) {
      if (queuedKeys.has(clip.sheetKey) || scene.textures.exists(clip.sheetKey)) {
        continue
      }

      queuedKeys.add(clip.sheetKey)

      // Atlas, not spritesheet (Spec B sec.3.1): frames are addressed by name so
      // the JSON's per-frame trim data survives to spec C.
      scene.load.atlas(clip.sheetKey, clip.sheetUrl, clip.atlasUrl)
    }
  }

  queueOnce(PLAYER_TEXTURE_KEY, PLAYER_TEXTURE_URL)

  // Static-mode placeholder - the silhouette unregistered entities draw
  // instead of a Rectangle (uniformity, 2026-09-19). In 'animated' mode the
  // placeholder is the shared 32-frame sheet, queued by the atlas loop below.
  if (ENTITY_ART_MODE === 'static') {
    queueOnce(PLACEHOLDER_STATIC_TEXTURE_KEY, PLACEHOLDER_STATIC_TEXTURE_URL)
  }

  // Thanh V?n modular art - load ??NG variant phi?n hi?n t?i (sky + 6
  // layer m?a).
  for (const entry of thanhVanLoadList(peekThanhVanVariant())) {
    queueOnce(entry.key, entry.url)
  }

  // Reward gourd art - PNG th?t thay placeholder.
  queueOnce(GOURD_TEXTURE_KEY, GOURD_TEXTURE_URL)

  // Reskinned template ids resolve to their variant slug - the old PNG is
  // unreachable for them (the avatar is the fallback), so skip its load.
  const reskinned = reskinnedTemplateIds()

  for (const templateId of ENEMY_TEMPLATE_IDS) {
    if (reskinned.has(templateId)) {
      continue
    }

    const textureKey = resolveEnemyTextureKey(templateId)

    if (textureKey) {
      queueOnce(textureKey, enemyTextureUrl(textureKey))
    }
  }

  // Reskinned enemies (enemy-art-wave1): the avatar PNG is each variant's
  // static fallback form - load it so the dormant half stays real art.
  for (const variant of Object.values(MONSTER_ART)) {
    queueOnce(variant.avatarKey, variant.avatarUrl)
  }

  // Reskinned characters (character-art-infra): same fallback contract.
  for (const variant of Object.values(CHARACTER_ART)) {
    queueOnce(variant.avatarKey, variant.avatarUrl)
  }

  // Mapped companions (impact-sync sec.52): the borrowed character avatar is
  // the companion's static fallback. Today the same avatars are already
  // queued by the CHARACTER_ART loop above; this enumeration is what keeps
  // the contract honest if a companion ever maps to non-character art.
  for (const variant of companionArtVariants()) {
    queueOnce(variant.avatarKey, variant.avatarUrl)
  }

  // Player visual profiles - preload texture cho M?I profile c? th?
  // d?ng trong combat (sword t?i d?ng mortal n?n kh?ng c?n key ri?ng).
  for (const profile of Object.values(PLAYER_VISUAL_PROFILES)) {
    queueOnce(profile.combatTextureKey, profile.combatTextureUrl)

    if (profile.cultivateTextureKey && profile.cultivateTextureUrl) {
      queueOnce(profile.cultivateTextureKey, profile.cultivateTextureUrl)
    }
  }

  // Hidden-way cultivate overrides (art-seam wave): the PNG must be in the
  // parity list so catalogPreloadParity sees bundle+queue enumerate alike.
  for (const override of Object.values(CULTIVATE_TEXTURE_OVERRIDES)) {
    if (override) {
      queueOnce(override.key, override.url)
    }
  }

  // The placeholder atlas, for ANIMATED entities only (Spec B sec.3.2) -
  // CombatScene.create() registers animations from the SAME list, so the two
  // can never name different keys. Static entities queue nothing extra: their
  // still PNG is already queued above, and their motion is a tween.
  for (const { clips } of animatedCombatAnimationSets()) {
    queueAtlasOnce(clips)
  }
}
