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
import { enemyTextureUrl, resolveEnemyTextureKey } from './EnemyArt'
import { PLAYER_VISUAL_PROFILES } from './PlayerVisualProfiles'
import { peekThanhVanVariant, thanhVanLoadList } from './ThanhVanArt'

// Combat uses the static mortal artwork. MainScene keeps its existing atlas;
// the scenes intentionally use separate texture keys and presentations.
export const PLAYER_TEXTURE_KEY = 'player-mortal'

export const PLAYER_TEXTURE_URL =
  'assets/characters/player/mortal/player-mortal-ink-sword-concept-v2.png'

// Mortal enemy art batch (mortal-enemy-art-batch-plan.md) — 20 PNG cho
// 10 loài + bản ferocious; id ngoài batch fallback Rectangle.
const ENEMY_TEMPLATE_IDS = [
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

/**
 * Queue mọi texture combat cần — DEDUPE THEO TEXTURE KEY trong chính
 * một lần queue (P2 cleanup, dong-fu plan): `textures.exists()` không
 * nhận biết key vừa được queue trong CÙNG lượt gọi, và các Player
 * profile dùng trùng key (kiem_tu tái dùng Mortal combat art,
 * cultivate chung 'player-mortal-cultivate-v1') nên guard exists một
 * mình là chưa đủ. Một Set cục bộ chặn queue trùng; guard
 * textures.exists() vẫn giữ cho các lần gọi sau khi load hoàn tất.
 * An toàn gọi từ cả MainScene.preload() và CombatScene.preload().
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
}
