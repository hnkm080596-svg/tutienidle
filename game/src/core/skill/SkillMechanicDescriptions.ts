import type { Skill } from './Skill'
import type { SkillEffect } from './SkillEffect'
import type { BuffRegistry } from '../buff/BuffRegistry'
import { ELEMENT_LABELS } from '../element/ElementLabels'

// Pháp Tu Thuần Hệ (Task 12, plan 2026-09-03) — dòng mô tả CƠ CHẾ effect
// trong tooltip/chi tiết skill: engine field (hitCount, spreadsAilmentId,
// grantsZone, add_stack/remove_buff, stacksPerAffectedTarget) KHÔNG có
// trong skill.description tự do, người chơi không thể biết cơ chế từ
// text. Helper THUẦN (core-no-i18n — trả string qua buffRegistry labels
// + ELEMENT_LABELS đã là nguồn nhãn sẵn có; caller Vue render thẳng).
// Trả [] cho skill không có field nào trong nhóm này → UI không hiện gì
// thêm (backward-compatible với mọi skill cũ).

export interface SkillMechanicLine {
  /** Stable key cho v-for. */
  key: string

  text: string
}

function buffName(registry: BuffRegistry | undefined, buffId: string | undefined): string | undefined {
  if (!buffId) {
    return undefined
  }

  if (registry?.has(buffId)) {
    return registry.get(buffId).name
  }

  return buffId
}

function describeEffect(
  effect: SkillEffect,
  index: number,
  registry: BuffRegistry | undefined,
): SkillMechanicLine[] {
  const lines: SkillMechanicLine[] = []

  if (effect.hitCount !== undefined) {
    lines.push({
      key: `hit-${index}`,
      text: `Đánh trúng ${effect.hitCount} lần liên tiếp, mỗi lần tự quyết chí mạng/tránh đỡ.`,
    })
  }

  if (effect.spreadsAilmentId) {
    const name = buffName(registry, effect.spreadsAilmentId)
    const percent = effect.spreadStackPercent ?? 1
    const percentText = percent >= 1 ? 'toàn bộ' : `${Math.round(percent * 100)}%`

    lines.push({
      key: `spread-${index}`,
      text: `Lan ${percentText} tầng ${name} từ mục tiêu chính sang mọi mục tiêu trúng đòn.`,
    })
  }

  if (effect.grantsZone || effect.grantsSwordZone) {
    const element = effect.zoneElement ?? 'metal'

    lines.push({
      key: `zone-${index}`,
      text: `Để lại vùng ${ELEMENT_LABELS[element]} sát thương diện rộng tại mục tiêu.`,
    })
  }

  if (effect.type === 'add_stack' && effect.buffId) {
    const name = buffName(registry, effect.buffId)
    const stacks = effect.stacks ?? 1

    lines.push({
      key: `addstack-${index}`,
      text: `Cộng ${stacks} tầng ${name} đang chạy trên mục tiêu.`,
    })
  }

  if (effect.type === 'remove_buff') {
    const scopeText = effect.scope === 'source' ? 'trên bản thân' : 'trên mục tiêu'
    const filter = effect.buffId
      ? buffName(registry, effect.buffId)
      : effect.polarity === 'buff'
        ? 'buff'
        : effect.polarity === 'debuff'
          ? 'debuff'
          : 'hiệu ứng'
    const count = effect.count

    lines.push({
      key: `removebuff-${index}`,
      text: count !== undefined
        ? `Gỡ tối đa ${count} ${filter} ${scopeText}.`
        : `Gỡ ${filter} ${scopeText}.`,
    })
  }

  if (effect.stacksPerAffectedTarget && effect.buffId) {
    const name = buffName(registry, effect.buffId)

    lines.push({
      key: `stacksper-${index}`,
      text: `Nhận ${name}: mỗi mục tiêu trúng đòn cộng 1 tầng.`,
    })
  }

  return lines
}

export function describeSkillMechanics(
  skill: Skill,
  registry?: BuffRegistry,
): SkillMechanicLine[] {
  const lines: SkillMechanicLine[] = []

  skill.effects.forEach((effect, index) => {
    lines.push(...describeEffect(effect, index, registry))
  })

  return lines
}
