import type { Skill } from '@/core/skill/Skill'
import { formatNumber } from '@/core/format/NumberFormatter'
import { BUFF_REGISTRY } from '@/data/buff/BuffRegistry'

function formatMultiplier(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Number.parseFloat(value.toFixed(2)).toString()
}

export function projectSkillStatRows(skill: Skill | undefined, t: (key: string) => string): { id: string; label: string; value: string }[] {
  if (skill === undefined) return []
  const rows: { id: string; label: string; value: string }[] = []
  const push = (label: string, value: string) => rows.push({ id: `stat-${rows.length}`, label, value })
  const damageSuffix = (damageType: 'physical' | 'primordial' | undefined) =>
    damageType === 'physical'
      ? ` ${t('skill.damageTypePhysical')}`
      : damageType === 'primordial'
        ? ` ${t('skill.damageTypePrimordial')}`
        : ''
  const ailmentLine = (buffId: string, chance: number | undefined) => {
    const name = BUFF_REGISTRY.tryGet(buffId)?.name ?? buffId
    const pct = chance === undefined ? '100%' : `${Math.round(chance * 100)}%`
    push(t('skill.statAilmentChance'), `${pct} ${name}`)
  }
  for (const binding of skill.triggers ?? []) {
    for (const action of binding.actions) {
      if (action.type === 'dealDamage') {
        push(t('skill.statDamage'), `x${formatMultiplier(action.value ?? 0)}${damageSuffix(action.damageType)}`)
      } else if (action.type === 'applyBuff' || action.type === 'applyDebuff') {
        ailmentLine(action.buffId, action.chance)
      } else if (action.type === 'heal') {
        push(t('skill.statHeal'), `x${formatMultiplier(action.value ?? 0)}`)
      }
    }
  }
  for (const effect of skill.effects) {
    if (effect.type === 'damage') {
      push(t('skill.statDamage'), `x${formatMultiplier(effect.value ?? 0)}${damageSuffix(effect.damageType)}`)
      if (effect.ailmentChance !== undefined && effect.buffId !== undefined) {
        ailmentLine(effect.buffId, effect.ailmentChance)
      }
    } else if (effect.type === 'debuff' && effect.buffId !== undefined) {
      ailmentLine(effect.buffId, effect.ailmentChance)
    } else if (effect.type === 'heal') {
      push(t('skill.statHeal'), `x${formatMultiplier(effect.value ?? 0)}`)
    }
  }
  if (skill.execution?.kind === 'cooldown') {
    push(t('skill.statCooldown'), `${formatNumber(skill.cooldown)} ${t('skill.turnUnit')}`)
  }
  if (skill.cost !== undefined && skill.resourceType !== undefined && skill.resourceType !== 'none') {
    push(t('skill.statCost'), `${formatNumber(skill.cost)} ${skill.resourceType}`)
  }
  return rows
}
