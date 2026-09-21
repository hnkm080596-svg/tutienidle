// CombatPreload — canonical enumeration of every texture CombatScene
// needs. No production caller loads through it anymore: the 'combat'
// asset bundle (AssetBundleCatalog → AssetLoaderScene) is ensured by the
// presentation coordinator before the scene activates. Its live role is
// the parity authority — tests pin the bundle descriptors to the exact
// key set this helper would queue, so a texture added here without a
// catalog entry (or vice versa) fails the suite.
//
// History: it used to be queued from both MainScene.preload() and
// CombatScene.preload() (the latter as a transitional net until the
// 2026-09-16 live pass proved the bundle covers every key — cold combat
// entry queued 0 textures).
import type Phaser from 'phaser'
import { GOURD_TEXTURE_KEY, GOURD_TEXTURE_URL } from './RewardGourd'
import {
  ENEMY_SOURCE_SIZE,
  enemyTextureUrl,
  resolveEnemyTextureKey,
  MORTAL_ENEMY_TEMPLATE_IDS,
} from './EnemyArt'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import { peekThanhVanVariant, thanhVanLoadList } from './ThanhVanArt'
import {
  animatedCombatEntities,
  FALLBACK_PLAYER_ENTITY_KEY,
  PLACEHOLDER_STATIC_TEXTURE_KEY,
  PLACEHOLDER_STATIC_TEXTURE_URL,
} from '@/presentation/art/CombatPresentationCatalogue'
import { ENTITY_ART_MODE } from '@/presentation/art/EntityArtMode'
import type { CombatAnimationCatalogue } from '@/presentation/art/CombatEntityPresentation'

// The mortal entity key - the shared player fallback. MainScene keeps its
// own atlas; the scenes intentionally use separate texture keys. Re-exported
// here so the many existing importers do not all have to move at once.
export const PLAYER_TEXTURE_KEY = FALLBACK_PLAYER_ENTITY_KEY

// Same PNG as the mortal profile's combatTextureUrl, without the leading
// slash — R12/AR-30 keeps the literal spelled once (in PlayerVisualProfiles).
export const PLAYER_TEXTURE_URL = PLAYER_VISUAL_PROFILES.mortal.combatTextureUrl.replace(
  /^\/+/,
  '',
)

// Mortal enemy art batch (mortal-enemy-art-batch-plan.md) — 20 PNG cho
// 10 loai + ban ferocious; id ngoai batch roi ve placeholder entity
// (Rectangle chi khi ca placeholder cung thieu).
// R12/AR-30: the id list is owned by EnemyArt (MORTAL_ENEMY_TEMPLATE_IDS);
// this re-export keeps the preload surface stable for existing importers.
export const ENEMY_TEMPLATE_IDS = MORTAL_ENEMY_TEMPLATE_IDS

// Spec B §4.4 (2026-09-11) — ONE resolver answers what an entity's art is.
// This used to be three near-identical wrappers around one placeholder builder
// that discarded both of its data parameters (§2.1).
//
// `allCombatAnimationSets` is gone with them: it named every entity, but every
// entity is no longer animated. Enemies are `kind: 'static'` now (§3.2), and a
// list that still handed CombatScene a clip set for each of them would quietly
// re-animate them.
export function animatedCombatAnimationSets(): Array<{
  entityKey: string
  clips: CombatAnimationCatalogue
}> {
  return animatedCombatEntities()
}

/**
 * Queue mọi texture combat cần — DEDUPE THEO TEXTURE KEY trong chính
 * một lần queue (P2 cleanup, dong-fu plan): `textures.exists()` không
 * nhận biết key vừa được queue trong CÙNG lượt gọi, và các Player
 * profile dùng trùng key (sword tái dùng Mortal combat art,
 * cultivate chung 'player-mortal-cultivate-v1') nên guard exists một
 * mình là chưa đủ. Một Set cục bộ chặn queue trùng; guard
 * textures.exists() vẫn giữ cho các lần gọi sau khi load hoàn tất.
 * An toàn gọi từ cả MainScene.preload() và CombatScene.preload().
 *
 * Combat Art Pipeline Task 9 (2026-09-05) — THÊM (không thay) queue
 * spritesheet placeholder (1 frame = ảnh gốc, xem CombatAnimationSet.ts)
 * cho từng entity CẠNH các ảnh PNG tĩnh cũ, KHÔNG bỏ ảnh tĩnh cũ: MainScene
 * (Home Scene, ngoài phạm vi task này) và nhánh fallback của
 * combat-grid-view.ts/combat-player-visual.ts vẫn dùng key tĩnh nguyên bản
 * (PLAYER_TEXTURE_KEY/profile.combatTextureKey/enemy texture key) làm
 * texture THẬT của Sprite; đổi các key đó thành spritesheet-only sẽ làm vỡ
 * MỌI chỗ đang add.sprite()/setTexture() bằng key tĩnh đó (MainScene player
 * đứng ở Nhà, không hề animate — tự comment trong MainScene.ts). CombatScene
 * chỉ cần các sheetKey RIÊNG (hậu tố '-idle-sheet'…) để chạy Animation, nên
 * load thêm là đủ, không cần sửa consumer nào khác ngoài 2 file brief này.
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
    for (const clip of Object.values(clips)) {
      if (queuedKeys.has(clip.sheetKey) || scene.textures.exists(clip.sheetKey)) {
        continue
      }

      queuedKeys.add(clip.sheetKey)

      // Atlas, not spritesheet (Spec B §3.1): frames are addressed by name so
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

  // Thanh Vân modular art — load ĐÚNG variant phiên hiện tại (sky + 6
  // layer mùa).
  for (const entry of thanhVanLoadList(peekThanhVanVariant())) {
    queueOnce(entry.key, entry.url)
  }

  // Reward gourd art — PNG thật thay placeholder.
  queueOnce(GOURD_TEXTURE_KEY, GOURD_TEXTURE_URL)

  for (const templateId of ENEMY_TEMPLATE_IDS) {
    const textureKey = resolveEnemyTextureKey(templateId)

    if (textureKey) {
      queueOnce(textureKey, enemyTextureUrl(textureKey))
    }
  }

  // Player visual profiles — preload texture cho MỌI profile có thể
  // dùng trong combat (sword tái dùng mortal nên không cần key riêng).
  for (const profile of Object.values(PLAYER_VISUAL_PROFILES)) {
    queueOnce(profile.combatTextureKey, profile.combatTextureUrl)

    if (profile.cultivateTextureKey && profile.cultivateTextureUrl) {
      queueOnce(profile.cultivateTextureKey, profile.cultivateTextureUrl)
    }
  }

  // The placeholder atlas, for ANIMATED entities only (Spec B §3.2) —
  // CombatScene.create() registers animations from the SAME list, so the two
  // can never name different keys. Static entities queue nothing extra: their
  // still PNG is already queued above, and their motion is a tween.
  for (const { clips } of animatedCombatAnimationSets()) {
    queueAtlasOnce(clips)
  }
}
