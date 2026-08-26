// @vitest-environment jsdom
//
// Regression (review 2026-08-26): App.vue từng bị xóa mất lệnh
// gameManager.registerBuffs(buffs) — buffRegistry rỗng tại runtime trong
// khi SkillEffectSystem resolve effect 'buff'/'debuff' qua
// buffRegistry.get() (THROW khi thiếu) và ReactionManager resolve
// appliesBuffId cùng cách → cast skill/reaction đầu tiên crash giữa
// trận. Test này khóa tính nhất quán dữ liệu: MỌI buffId được tham
// chiếu bởi skill effect hoặc element reaction PHẢI tồn tại trong data
// buff — nếu data thêm tham chiếu mới mà quên đăng ký, test bắt ngay.
import { describe, expect, it } from 'vitest'
import { buffs } from './buffs'
import { SKILLS } from '../skill/Skills'
import { ELEMENT_REACTIONS } from '../../core/element/ElementReaction'
import type { SkillEffect } from '../../core/skill/SkillEffect'

const BUFF_IDS = new Set(buffs.map((buff) => buff.id))

function collectBuffIds(effects: SkillEffect[] | undefined): string[] {
  return (effects ?? [])
    .filter((effect) => effect.type === 'buff' || effect.type === 'debuff')
    .map((effect) => effect.buffId)
    .filter((id): id is string => typeof id === 'string')
}

function collectSkillBuffIds(): string[] {
  const ids: string[] = []

  for (const skill of SKILLS) {
    ids.push(...collectBuffIds(skill.effects))

    // Specialization dùng effectsOverride thay thế toàn bộ effects gốc
    // (xem SkillSystem.getEffectiveSkill()).
    for (const specialization of skill.specializations ?? []) {
      ids.push(...collectBuffIds(specialization.effectsOverride))
    }
  }

  return ids
}

function collectReactionBuffIds(): string[] {
  const ids: string[] = []

  for (const inner of Object.values(ELEMENT_REACTIONS)) {
    for (const reaction of Object.values(inner ?? {})) {
      if (reaction?.appliesBuffId) {
        ids.push(reaction.appliesBuffId)
      }
    }
  }

  return ids
}

describe('data/buff — mọi buffId tham chiếu phải tồn tại trong registry data', () => {
  it('skill effects (kể cả effectsOverride) chỉ tham chiếu buff đã khai báo', () => {
    const referenced = collectSkillBuffIds()

    // Phải có ít nhất các tham chiếu đã biết để test không rỗng vô nghĩa.
    expect(referenced).toContain('sword_wound')
    expect(referenced).toContain('phieu_van_bo_buff')

    const missing = [...new Set(referenced)].filter((id) => !BUFF_IDS.has(id))

    expect(missing).toEqual([])
  })

  it('element reactions (appliesBuffId) chỉ tham chiếu buff đã khai báo', () => {
    const referenced = collectReactionBuffIds()

    expect(referenced).toContain('doc_the')

    const missing = [...new Set(referenced)].filter((id) => !BUFF_IDS.has(id))

    expect(missing).toEqual([])
  })
})
