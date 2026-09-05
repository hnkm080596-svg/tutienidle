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
import { PLAYER_VISUAL_PROFILES, type PlayerVisualProfile } from './PlayerVisualProfiles'
import { peekThanhVanVariant, thanhVanLoadList } from './ThanhVanArt'
import { buildPlaceholderAnimationSet, type CombatAnimationSet } from './CombatAnimationSet'

// Combat uses the static mortal artwork. MainScene keeps its existing atlas;
// the scenes intentionally use separate texture keys and presentations.
export const PLAYER_TEXTURE_KEY = 'player-mortal'

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

// Combat Art Pipeline Task 9 (2026-09-05) — animation set PLACEHOLDER cho
// từng entity combat (player theo profile, enemy theo texture key). Export
// để CombatScene.create() đăng ký ĐÚNG animation set này qua
// registerCombatAnimations() (Phaser Animation registry là nguồn dùng
// chung toàn Game, không phải riêng scene) — tránh một bảng tính key thứ
// hai lệch khỏi bảng preload thật.
export function playerCombatAnimationSet(profile: PlayerVisualProfile): CombatAnimationSet {
  return buildPlaceholderAnimationSet(profile.combatTextureKey, profile.combatTextureUrl, {
    width: profile.combatSourceSize.w,
    height: profile.combatSourceSize.h,
  })
}

// PLAYER_TEXTURE_KEY — key fallback riêng (PNG giống hệt profile mortal
// nhưng key khác, dùng khi combat-grid-view.ts không thấy texture profile
// hiện hành đã tải xong); dùng chung kích thước nguồn với mortal (CÙNG file
// vật lý).
export function fallbackPlayerCombatAnimationSet(): CombatAnimationSet {
  return buildPlaceholderAnimationSet(PLAYER_TEXTURE_KEY, PLAYER_TEXTURE_URL, {
    width: PLAYER_VISUAL_PROFILES.mortal.combatSourceSize.w,
    height: PLAYER_VISUAL_PROFILES.mortal.combatSourceSize.h,
  })
}

export function enemyCombatAnimationSet(textureKey: string): CombatAnimationSet {
  return buildPlaceholderAnimationSet(textureKey, enemyTextureUrl(textureKey), {
    width: ENEMY_SOURCE_SIZE.w,
    height: ENEMY_SOURCE_SIZE.h,
  })
}

/**
 * Toàn bộ animation set combat cần đăng ký — player (mọi profile + key
 * fallback) + enemy (mọi template id trong batch Mortal). MỘT nguồn dùng
 * chung cho queueCombatAssets() (load spritesheet) VÀ CombatScene.create()
 * (this.anims.create()) để hai bên KHÔNG BAO GIỜ lệch key nhau.
 */
export function allCombatAnimationSets(): Array<{
  entityKey: string
  animationSet: CombatAnimationSet
}> {
  const sets: Array<{ entityKey: string; animationSet: CombatAnimationSet }> = []

  for (const profile of Object.values(PLAYER_VISUAL_PROFILES)) {
    sets.push({ entityKey: profile.combatTextureKey, animationSet: playerCombatAnimationSet(profile) })
  }

  sets.push({ entityKey: PLAYER_TEXTURE_KEY, animationSet: fallbackPlayerCombatAnimationSet() })

  for (const templateId of ENEMY_TEMPLATE_IDS) {
    const textureKey = resolveEnemyTextureKey(templateId)

    if (textureKey) {
      sets.push({ entityKey: textureKey, animationSet: enemyCombatAnimationSet(textureKey) })
    }
  }

  return sets
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

  const queueAnimationSetOnce = (animationSet: CombatAnimationSet) => {
    for (const clip of Object.values(animationSet)) {
      if (queuedKeys.has(clip.sheetKey) || scene.textures.exists(clip.sheetKey)) {
        continue
      }

      queuedKeys.add(clip.sheetKey)

      scene.load.spritesheet(clip.sheetKey, clip.sheetUrl, {
        frameWidth: clip.frameWidth,
        frameHeight: clip.frameHeight,
      })
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

  // Sprite-sheet placeholder cho toàn bộ entity combat (Task 9) — xem
  // allCombatAnimationSets(); CombatScene.create() đăng ký Animation từ
  // ĐÚNG cùng danh sách này.
  for (const { animationSet } of allCombatAnimationSets()) {
    queueAnimationSetOnce(animationSet)
  }
}
