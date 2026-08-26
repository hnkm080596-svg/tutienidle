// EnemyArt (mortal-enemy-art-batch-plan.md) — map enemy ID runtime →
// texture art trong public/assets/enemies/mortal/. Enemy spawn có id
// dạng `<templateId>_<uuid>` nên lookup dùng LONGEST-PREFIX match trên
// dạng underscore của template id.
//
// 20 asset = 10 loài gốc + 10 bản ferocious (không tint runtime —
// ferocious cần silhouette mạnh hơn hẳn theo plan).

export const ENEMY_SOURCE_SIZE = { w: 1254, h: 1254 }

/** Template id dạng underscore, sắp DÀI TRƯỚC để prefix match đúng. */
const MORTAL_ENEMY_TEXTURE_IDS = [
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
] as const

const TEXTURE_KEY_BY_ID = new Map<string, string>(
  MORTAL_ENEMY_TEXTURE_IDS.map((templateId) => [
    templateId,

    `${templateId.replaceAll('_', '-')}-v1`,
  ]),
)

/**
 * Texture key cho enemy id runtime ('mortal_wild_boar_<uuid>' khớp
 * 'mortal-wild-boar-v1'). undefined khi không thuộc batch Mortal —
 * caller fallback Rectangle màu như cũ.
 */
export function resolveEnemyTextureKey(enemyId: string): string | undefined {
  for (const templateId of MORTAL_ENEMY_TEXTURE_IDS) {
    if (enemyId === templateId || enemyId.startsWith(`${templateId}_`)) {
      return TEXTURE_KEY_BY_ID.get(templateId)!
    }
  }

  return undefined
}

/** URL preload — key trùng tên file trong public/assets/enemies/mortal/. */
export function enemyTextureUrl(textureKey: string): string {
  return `/assets/enemies/mortal/${textureKey}.png`
}
