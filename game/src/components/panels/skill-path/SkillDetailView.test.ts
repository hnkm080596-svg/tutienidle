// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import SkillDetailView from './SkillDetailView.vue'
import { GameManager } from '@/core/game/GameManager'
import { SKILLS } from '@/data/skill/Skills'
import { buffs } from '@/data/buff/buffs'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import type { Skill } from '@/core/skill/Skill'

// Task 12 (plan 2026-09-03-thuan-he) — SkillDetailView render dòng cơ
// chế engine (hitCount/spread/zone/add_stack/remove_buff/
// stacksPerAffectedTarget) từ describeSkillMechanics; skill thường
// không có field → không có block mechanics.
function mountDetail(skill: Skill | null) {
  const container = document.createElement('div')
  const pinia = createPinia()
  const manager = new GameManager()

  manager.registerSkillTemplates(SKILLS)
  manager.registerBuffs(buffs)

  const version = ref(0)
  const app = createApp({ render: () => h(SkillDetailView, { skill }) })

  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, unmount: () => app.unmount() }
}

afterEach(() => { document.body.innerHTML = '' })

describe('SkillDetailView — dòng cơ chế Thuần hệ (Task 12)', () => {
  it('skill thường (không mechanic field) → không render block mechanics', () => {
    const skill = SKILLS.find(s => s.id === 'hoa_cau_thuat')!
    const mounted = mountDetail(skill)

    expect(mounted.container.querySelector('.skill-detail__mechanics')).toBeNull()
    mounted.unmount()
  })

  it('skill có hitCount (Bát Thủ Càn Quét — water ult) → hiện dòng "8 lần"', () => {
    const skill = SKILLS.find(s => s.id === 'bat_thu_can_quet')!

    expect(skill.effects.some(e => e.hitCount !== undefined)).toBe(true)

    const mounted = mountDetail(skill)
    const mechanics = mounted.container.querySelector('.skill-detail__mechanics')

    expect(mechanics).not.toBeNull()
    expect(mechanics!.textContent).toContain('lần liên tiếp')
    mounted.unmount()
  })

  it('skill có spreadsAilmentId (Vân Mộc Lan Độc) → hiện dòng lan Độc', () => {
    const skill = SKILLS.find(s => s.id === 'van_moc_lan_doc')!

    expect(skill.effects.some(e => e.spreadsAilmentId !== undefined)).toBe(true)

    const mounted = mountDetail(skill)

    expect(mounted.container.querySelector('.skill-detail__mechanics')!.textContent).toContain('Lan')
    mounted.unmount()
  })

  it('skill có stacksPerAffectedTarget (Hậu Thổ Thành Lũy) → hiện dòng tầng theo target', () => {
    const skill = SKILLS.find(s => s.id === 'hau_tho_thanh_luy')!

    expect(skill.effects.some(e => e.stacksPerAffectedTarget === true)).toBe(true)

    const mounted = mountDetail(skill)

    expect(mounted.container.querySelector('.skill-detail__mechanics')!.textContent).toContain('Thành Lũy')
    mounted.unmount()
  })
})
