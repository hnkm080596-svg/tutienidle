// @vitest-environment jsdom
//
// Regression (review 2026-08-26): App.vue từng bị xóa mất lệnh
// gameManager.catalogOps.registerBuffs(buffs) — buffRegistry rỗng tại runtime trong
// khi turn engine resolve effect 'buff'/'debuff' qua
// buffRegistry.get() (THROW khi thiếu) → cast skill đầu tiên crash giữa
// trận. Test này khóa tính nhất quán dữ liệu: MỌI buffId được tham
// chiếu bởi skill effect PHẢI tồn tại trong data
// buff — nếu data thêm tham chiếu mới mà quên đăng ký, test bắt ngay.
import { describe, expect, it } from 'vitest'
import { buffs } from './buffs'
import { SKILLS } from '../skill/Skills'
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

describe('data/buff — mọi buffId tham chiếu phải tồn tại trong registry data', () => {
  it('skill effects (kể cả effectsOverride) chỉ tham chiếu buff đã khai báo', () => {
    const referenced = collectSkillBuffIds()

    // Kiếm Thế / Kiếm Ý (spec 2026-08-29): skill buff-carrying (Thái Hư
    // Nhất Kiếm/Phiêu Vân Bộ) đã chuyển thành passive node — hiện KHÔNG
    // còn skill nào tham chiếu buff. Invariant vẫn giữ: nếu sau này
    // thêm tham chiếu mới mà quên khai báo, test bắt ngay.
    const missing = [...new Set(referenced)].filter((id) => !BUFF_IDS.has(id))

    expect(missing).toEqual([])
  })
})
