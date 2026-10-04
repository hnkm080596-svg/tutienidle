// @vitest-environment jsdom
//
// Regression (review 2026-08-26): App.vue tung bi xoa mat lenh
// gameManager.catalogOps.registerBuffs(buffs) - buffRegistry rong tai runtime trong
// khi turn engine resolve effect 'buff'/'debuff' qua
// buffRegistry.get() (THROW khi thieu) -> cast skill dau tien crash giua
// tran. Test nay khoa tinh nhat quan du lieu: MOI buffId duoc tham
// chieu boi skill effect PHAI ton tai trong data
// buff - neu data them tham chieu moi ma quen dang ky, test bat ngay.
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

    // Specialization dung effectsOverride thay the toan bo effects goc
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

    // Kiem The / Kiem Y (spec 2026-08-29): skill buff-carrying (Thai Hu
    // Nhat Kiem/Phieu Van Bo) da chuyen thanh passive node - hien KHONG
    // con skill nao tham chieu buff. Invariant van giu: neu sau nay
    // them tham chieu moi ma quen khai bao, test bat ngay.
    const missing = [...new Set(referenced)].filter((id) => !BUFF_IDS.has(id))

    expect(missing).toEqual([])
  })
})
