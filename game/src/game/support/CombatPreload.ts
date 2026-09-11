// CombatPreload — danh sách texture CombatScene cần, queue MỘT LẦN dùng
// chung cho CẢ MainScene.preload() và CombatScene.preload().
//
// Fix "lần đầu vào combat không thấy spawn animation" (2026-08-26):
// trước đây chỉ CombatScene.preload() queue các ảnh này — lần ĐẦU tiên
// scene start (ngay sau 'battle_start'), loader phải tải ~7-25MB qua
// dev server trong khi phase spawn telegraph (~1s) đã chạy xong phía
// core → scene kịp subscribe khi mọi quái đã materialize. Eager-load từ
// MainScene (chạy lúc boot game, TRƯỚC mọi trận) khiến lần start đầu
// của CombatScene có loader queue RỖNG → create() gần như tức thời,
// listener gắn đúng phase spawn.
import type Phaser from 'phaser'
import { GOURD_TEXTURE_KEY, GOURD_TEXTURE_URL } from './RewardGourd'
import { ENEMY_SOURCE_SIZE, enemyTextureUrl, resolveEnemyTextureKey } from './EnemyArt'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import { peekThanhVanVariant, thanhVanLoadList } from './ThanhVanArt'
import {
  animatedCombatEntities,
  FALLBACK_PLAYER_ENTITY_KEY,
} from '@/presentation/art/CombatPresentationCatalogue'
import type { CombatAnimationCatalogue } from '@/presentation/art/CombatEntityPresentation'

// Combat uses the static mortal artwork. MainScene keeps its existing atlas;
// the scenes intentionally use separate texture keys and presentations.
// The catalogue declares this key (it is a presentation fact: an entity whose
// art is the mortal PNG under a second key). Re-exported here so the many
// existing importers do not all have to move at once.
export const PLAYER_TEXTURE_KEY = FALLBACK_PLAYER_ENTITY_KEY

export const PLAYER_TEXTURE_URL =
  'assets/characters/player/mortal/player-mortal-ink-sword-concept-v2.png'

// Mortal enemy art batch (mortal-enemy-art-batch-plan.md) — 20 PNG cho
// 10 loài + bản ferocious; id ngoài batch fallback Rectangle.
// Export (Task 9, 2026-09-05) — CombatScene.create() lặp lại ĐÚNG danh
// sách này để đăng ký Animation cho từng template (registerCombatAnimations),
// tránh một danh sách thứ hai lệch khỏi danh sách preload thật.
export const ENEMY_TEMPLATE_IDS = [
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
]

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
 * profile dùng trùng key (kiem_tu tái dùng Mortal combat art,
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
  // dùng trong combat (kiem_tu tái dùng mortal nên không cần key riêng).
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
