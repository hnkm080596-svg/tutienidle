// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
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

  manager.catalogOps.registerSkillTemplates(SKILLS)
  manager.catalogOps.registerBuffs(buffs)

  const version = ref(0)
  const app = createApp({ render: () => h(SkillDetailView, { skill }) })

  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, pinia, unmount: () => app.unmount() }
}

afterEach(() => { document.body.innerHTML = '' })

describe('SkillDetailView — dòng cơ chế Thuần hệ (Task 12)', () => {
  it('skill thường (không mechanic field) → không render block mechanics', () => {
    const skill = SKILLS.find(s => s.id === 'hoa_cau_thuat')!
    const mounted = mountDetail(skill)

    expect(mounted.container.querySelector('.skill-detail__mechanics')).toBeNull()
    mounted.unmount()
  })


})

// Task 16 — cast-leveled skills (tram/linh_bao/huy_quyen) show cast
// progress to the next threshold instead of the Insight upgrade button
// (INV-9 — upgradeSkill rejects them anyway).
describe('SkillDetailView — cast-level progress (Task 16)', () => {
  it('tram Lv1 với 400 casts → hiện "400 / 1000" thay nút Nâng Cấp', async () => {
    const { usePlayerStore } = await import('@/stores/player')
    const skill = SKILLS.find(s => s.id === 'tram')!
    const mounted = mountDetail(skill)

    usePlayerStore(mounted.pinia).skillCastCounts = { tram: 400 }
    await nextTick()

    const levelRow = mounted.container.querySelector('.skill-detail__level')!

    expect(levelRow.textContent).toContain('400')
    expect(levelRow.textContent).toContain('1000')
    expect(mounted.container.querySelector('.skill-detail__upgrade')).toBeNull()
    mounted.unmount()
  })

  it('skill thường vẫn hiện nút Nâng Cấp (không cast progress)', () => {
    const skill = SKILLS.find(s => s.id === 'hoa_cau_thuat')!
    const mounted = mountDetail(skill)

    expect(mounted.container.querySelector('.skill-detail__cast-progress')).toBeNull()
    mounted.unmount()
  })
})
