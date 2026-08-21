import { createBaseStats } from './StatBlock'
import { calculateStats } from './StatCalculator'
import { ModifierSystem } from './ModifierSystem'

const baseStats = createBaseStats()

const modifiers =
  new ModifierSystem()

modifiers.add({
  id: 'iron_sword_attack',

  sourceId: 'iron_sword',
  sourceType: 'equipment',

  stat: 'attack',

  flat: 50,
})

modifiers.add({
  id: 'sword_mastery',

  sourceId: 'sword_mastery',
  sourceType: 'technique',

  stat: 'attack',

  percent: 0.2,
})

modifiers.add({
  id: 'berserk',

  sourceId: 'berserk',
  sourceType: 'buff',

  stat: 'attack',

  percent: 0.1,

  stacks: 3,
})

// attack: base 10 + iron_sword flat 50 = 60, rồi Increased CỘNG DỒN
// (không compound per-source như trước): sword_mastery 20% +
// berserk 10%*3 stacks = 30% -> tổng 50% Increased -> 60 * 1.5 = 90.
// Cộng thêm phần dẫn xuất từ attribute gốc (strength=10 baseline ->
// +6 flat attack, +4 flat defense — xem deriveAttributeModifiers()
// trong StatCalculator.ts) hoà vào CÙNG pool Added trước khi nhân
// Increased, nên attack thật sự in ra sẽ cao hơn 90 một chút.
const finalStats =
  calculateStats(
    baseStats,
    modifiers.getAll(),
  )

console.log(finalStats)