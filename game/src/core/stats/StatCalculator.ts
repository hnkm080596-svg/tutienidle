import type { StatType } from './StatTypes'
import type { Stats } from './StatBlock'

export type ModifierSourceType =
  | 'realm'
  | 'technique'
  | 'skill'
  | 'buff'
  | 'debuff'
  | 'equipment'
  | 'talent'
  | 'reincarnation'
  | 'pill'
  | 'formation'
  | 'talisman'
  // 'attribute': modifier tự sinh ra bởi deriveAttributeModifiers() bên
  // dưới (dẫn xuất từ 5 attribute gốc) — không phải nguồn nào tạo tay.
  | 'attribute'

export interface StatModifier {
  id: string

  sourceId: string

  sourceType: ModifierSourceType

  stat: StatType

  // Phân nhóm tầng Increased (LE tách "Increased Fire Damage" khỏi
  // "Increased Damage" chung — mỗi nhóm tự cộng dồn rồi nhân RIÊNG,
  // xem runPipeline()). KHÔNG khai = rơi vào pool chung (untagged),
  // hành vi giữ nguyên như trước khi có field này.
  tag?: string

  flat?: number

  percent?: number

  multiplier?: number

  stacks?: number

  maxStacks?: number

  perLevelFlat?: number

  perLevelPercent?: number
}

// Tầng Attribute gốc (Căn Cốt/Thân Pháp/Thần Thức/Linh Căn/Thể Chất) —
// dẫn xuất ra stat phái sinh, KHÔNG có UI phân bổ điểm riêng: attribute
// chỉ là StatType như mọi stat khác, nhận modifier qua đúng pipeline
// hiện có (equipment/technique/buff/pill), calculateStats() tự động
// quy đổi ra bonus mỗi lần tính lại. Số liệu dưới đây là khởi điểm
// hợp lý, cần tinh chỉnh qua playtest, không phải số chốt cứng.
const ATTRIBUTE_ATTACK_PER_POINT = 0.6
const ATTRIBUTE_DEFENSE_PER_POINT = 0.4
const ATTRIBUTE_ATTACK_SPEED_PERCENT_PER_POINT = 0.0015
const ATTRIBUTE_ACCURACY_PER_POINT = 1.5
const ATTRIBUTE_EVASION_PER_POINT = 1.0
const ATTRIBUTE_CRIT_RATE_PERCENT_PER_POINT = 0.0005
const ATTRIBUTE_COOLDOWN_REDUCTION_PER_POINT = 0.001
const ATTRIBUTE_AILMENT_RESIST_PER_POINT = 0.002
const ATTRIBUTE_CRIT_DAMAGE_PERCENT_PER_POINT = 0.003
const ATTRIBUTE_ELEMENT_POWER_PER_POINT = 0.5
const ATTRIBUTE_MAX_HP_PER_POINT = 8
const ATTRIBUTE_HP_REGEN_PER_POINT = 0.1
const ATTRIBUTE_ENDURANCE_THRESHOLD_PER_POINT = 1

// Linh Căn (Attunement) hấp thụ nguyên vai trò "độ thiên hành" cũ của
// ElementAffinity (đã xoá — luôn = 0 với player, chỉ có ý nghĩa thật
// với enemy) — 1 điểm Linh Căn tăng đều sát thương CẢ 6 hành (kể cả
// Hỗn Nguyên), đúng nghĩa "linh căn tốt thì dùng thuật pháp hành nào
// cũng mạnh hơn", không thiên vị 1 hành cụ thể. Spec
// 2026-08-30-phap-tu-dao-sac §5 — Phong/Lôi đã bỏ toàn hệ nên không
// còn trong danh sách này.
const ATTUNEMENT_POWER_STATS: { stat: StatType; tag: string }[] = [
  { stat: 'woodPower', tag: 'wood' },
  { stat: 'firePower', tag: 'fire' },
  { stat: 'earthPower', tag: 'earth' },
  { stat: 'metalPower', tag: 'metal' },
  { stat: 'waterPower', tag: 'water' },
  { stat: 'primordialPower', tag: 'primordial' },
]

function flatAttributeModifier(sourceId: string, stat: StatType, amount: number): StatModifier {
  return {
    id: `attribute:${sourceId}:${stat}`,
    sourceId,
    sourceType: 'attribute',
    stat,
    flat: amount,
  }
}

function percentAttributeModifier(
  sourceId: string,
  stat: StatType,
  amount: number,
  tag?: string,
): StatModifier {
  return {
    id: `attribute:${sourceId}:${stat}${tag ? `:${tag}` : ''}`,
    sourceId,
    sourceType: 'attribute',
    stat,
    percent: amount,
    tag,
  }
}

// Linh Căn CAO thì hành đang tu luyện càng "thuần" — % nhỏ Increased
// riêng theo TỪNG hành (tag = tên hành), tách biệt khỏi pool Increased
// chung của stat đó (vd equipment/technique "+X% Increased Fire
// Damage" sau này cũng gắn tag 'fire' để cộng dồn ĐÚNG vào chung pool
// này, không lẫn vào pool tổng quát) — minh hoạ tag-hierarchy Increased.
const ATTRIBUTE_ELEMENT_TAG_PERCENT_PER_POINT = 0.001

function deriveAttributeModifiers(finalized: Stats): StatModifier[] {
  const modifiers: StatModifier[] = [
    flatAttributeModifier('strength', 'attack', finalized.strength * ATTRIBUTE_ATTACK_PER_POINT),
    flatAttributeModifier('strength', 'defense', finalized.strength * ATTRIBUTE_DEFENSE_PER_POINT),

    percentAttributeModifier(
      'dexterity',
      'attackSpeed',
      finalized.dexterity * ATTRIBUTE_ATTACK_SPEED_PERCENT_PER_POINT,
    ),
    flatAttributeModifier(
      'dexterity',
      'accuracyRating',
      finalized.dexterity * ATTRIBUTE_ACCURACY_PER_POINT,
    ),
    flatAttributeModifier(
      'dexterity',
      'evasionRate',
      finalized.dexterity * ATTRIBUTE_EVASION_PER_POINT,
    ),
    percentAttributeModifier(
      'dexterity',
      'criticalRate',
      finalized.dexterity * ATTRIBUTE_CRIT_RATE_PERCENT_PER_POINT,
    ),

    flatAttributeModifier(
      'intelligence',
      'cooldownReduction',
      finalized.intelligence * ATTRIBUTE_COOLDOWN_REDUCTION_PER_POINT,
    ),
    percentAttributeModifier(
      'intelligence',
      'criticalDamage',
      finalized.intelligence * ATTRIBUTE_CRIT_DAMAGE_PERCENT_PER_POINT,
    ),
    flatAttributeModifier(
      'intelligence',
      'ailmentResistPercent',
      finalized.intelligence * ATTRIBUTE_AILMENT_RESIST_PER_POINT,
    ),

    flatAttributeModifier('vitality', 'maxHp', finalized.vitality * ATTRIBUTE_MAX_HP_PER_POINT),
    flatAttributeModifier(
      'vitality',
      'hpRegenPerSecond',
      finalized.vitality * ATTRIBUTE_HP_REGEN_PER_POINT,
    ),
    flatAttributeModifier(
      'vitality',
      'enduranceThreshold',
      finalized.vitality * ATTRIBUTE_ENDURANCE_THRESHOLD_PER_POINT,
    ),
  ]

  for (const { stat, tag } of ATTUNEMENT_POWER_STATS) {
    modifiers.push(
      flatAttributeModifier(
        'attunement',
        stat,
        finalized.attunement * ATTRIBUTE_ELEMENT_POWER_PER_POINT,
      ),
    )
    modifiers.push(
      percentAttributeModifier(
        'attunement',
        stat,
        finalized.attunement * ATTRIBUTE_ELEMENT_TAG_PERCENT_PER_POINT,
        tag,
      ),
    )
  }

  return modifiers
}

// Key untagged (pool "Increased X" chung) trong bảng `increased` bên
// dưới — tách biệt khỏi các tag pool cụ thể (vd 'fire').
const UNTAGGED = ''

/**
 * 1 lượt Added -> Increased -> More cho TOÀN BỘ stat, dùng chung bởi
 * cả 2 pass của calculateStats() bên dưới.
 *
 * SỬA lỗi so với bản trước: "Increased" (percent) giờ CỘNG DỒN theo
 * CÙNG STAT trước rồi mới nhân 1 LẦN — trước đây mỗi nguồn percent tự
 * nhân riêng (compound), khiến nhiều modifier percent nhỏ cộng dồn
 * MẠNH hơn đáng kể so với ý nghĩa ban đầu của field này (2 nguồn
 * +20% từng cho ra ×1.44 thay vì ×1.40 đúng ra phải có). "More"
 * (multiplier) giữ nguyên hành vi nhân tuần tự — đúng ý nghĩa gốc.
 *
 * Tag-hierarchy Increased (LE thật): modifier có `tag` (vd 'fire') rơi
 * vào 1 pool RIÊNG cho (stat, tag) đó, tự cộng dồn nội bộ rồi nhân như
 * 1 TẦNG multiplier ĐỘC LẬP với pool chung (untagged) — "+20% Increased
 * Fire Damage" và "+20% Increased Damage" ra ×1.2 × ×1.2 = ×1.44,
 * không gộp chung 1 pool ×1.4 như 2 nguồn cùng tag. Modifier không
 * khai `tag` luôn rơi vào pool chung — 100% content hiện có (chưa
 * dùng field mới) hành vi giữ nguyên không đổi.
 */
function runPipeline(base: Stats, modifiers: StatModifier[]): Stats {
  const result = { ...base }

  const added: Partial<Record<StatType, number>> = {}
  const increased: Map<StatType, Map<string, number>> = new Map()
  const more: Partial<Record<StatType, number[]>> = {}

  for (const modifier of modifiers) {
    const stacks = modifier.stacks ?? 1

    if (modifier.flat !== undefined) {
      added[modifier.stat] = (added[modifier.stat] ?? 0) + modifier.flat * stacks
    }

    if (modifier.percent !== undefined) {
      const tagKey = modifier.tag ?? UNTAGGED

      const pools = increased.get(modifier.stat) ?? new Map<string, number>()

      pools.set(tagKey, (pools.get(tagKey) ?? 0) + modifier.percent * stacks)

      increased.set(modifier.stat, pools)
    }

    if (modifier.multiplier !== undefined) {
      const list = more[modifier.stat] ?? (more[modifier.stat] = [])

      for (let i = 0; i < stacks; i++) {
        list.push(modifier.multiplier)
      }
    }
  }

  for (const stat of Object.keys(result) as StatType[]) {
    let value = base[stat] + (added[stat] ?? 0)

    for (const poolPercent of (increased.get(stat) ?? new Map()).values()) {
      value *= 1 + poolPercent
    }

    for (const mult of more[stat] ?? []) {
      value *= mult
    }

    result[stat] = value
  }

  return result
}

/**
 * 2 lượt: lượt 1 tính đủ mọi modifier THẬT (equipment/technique/buff/
 * ...) để CHỐT giá trị 5 attribute; lượt 2 dẫn xuất bonus từ attribute
 * đã chốt rồi hoà CHUNG vào đúng pool Added/Increased của stat đích
 * (vd attribute-derived +attack hoà chung pool với +attack từ trang
 * bị, % tăng tốc đánh từ Dexterity hoà chung pool % từ buff...) —
 * chữ ký hàm KHÔNG đổi nên mọi call site hiện có (BattleSystem, store
 * player.ts) tự động nhận cả 2 sửa đổi (Increased + Attribute) mà
 * không cần sửa gì thêm.
 */
export function calculateStats(baseStats: Stats, modifiers: StatModifier[]): Stats {
  const pass1 = runPipeline(baseStats, modifiers)

  const attributeModifiers = deriveAttributeModifiers(pass1)

  return runPipeline(baseStats, [...modifiers, ...attributeModifiers])
}

export function addStack(modifier: StatModifier, amount = 1) {
  const current = modifier.stacks ?? 0

  let newStacks = current + amount

  if (modifier.maxStacks !== undefined) {
    newStacks = Math.min(newStacks, modifier.maxStacks)
  }

  modifier.stacks = newStacks
}
