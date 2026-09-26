// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import NativeCoreDetail from './NativeCoreDetail.vue'
import { GameManager } from '@/core/game/GameManager'
import { buffs } from '@/data/buff/buffs'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import type { NativeSkillPathEntry } from './SkillPathEntry'

// M-QI-05 / QI-D3 (D7) - NativeCoreDetail renders owned native cores
// from the SkillPathEntry view-model (no Skill object, no cast lane);
// upgrades funnel through progressionOps.levelUpSkill + bumpState.
function mountDetail(entry: NativeSkillPathEntry | null) {
  const container = document.createElement('div')
  const pinia = createPinia()
  const manager = new GameManager()

  manager.catalogOps.registerBuffs(buffs)

  const levelUpSkill = vi.spyOn(manager.progressionOps, 'levelUpSkill').mockReturnValue(true)
  const version = ref(0)
  const app = createApp({ render: () => h(NativeCoreDetail, { entry }) })

  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, pinia, levelUpSkill, version, manager, unmount: () => app.unmount() }
}

function entryOf(overrides: Partial<NativeSkillPathEntry> = {}): NativeSkillPathEntry {
  return {
    kind: 'native',
    id: 'orb_dam',
    name: 'Orb Đâm',
    description: 'Kiếm quang hóa đâm.',
    level: 1,
    maxLevel: 10,
    realmId: 'qi_refining',
    upgradeCost: 50,
    canUpgrade: true,
    ...overrides,
  }
}

afterEach(() => { document.body.innerHTML = '' })

describe('NativeCoreDetail (D7)', () => {
  it('renders name/description and the canonical Lv x/max from the view-model', () => {
    const mounted = mountDetail(entryOf({ level: 4, maxLevel: 10 }))

    expect(mounted.container.querySelector('.native-core-detail__name')?.textContent).toBe('Orb Đâm')
    expect(mounted.container.querySelector('.native-core-detail__level-label')?.textContent).toContain('Lv. 4/10')
    mounted.unmount()
  })

  it('upgrade click calls levelUpSkill(entry.id) and bumps state', () => {
    const mounted = mountDetail(entryOf())

    const button = mounted.container.querySelector<HTMLButtonElement>('.native-core-detail__upgrade')!
    expect(button.disabled).toBe(false)

    button.click()

    expect(mounted.levelUpSkill).toHaveBeenCalledTimes(1)
    expect(mounted.levelUpSkill.mock.calls[0]?.[0]).toBe('orb_dam')
    expect(mounted.version.value).toBe(1)
    mounted.unmount()
  })

  it('canUpgrade false renders the disabled affordance (cost still shown)', () => {
    const mounted = mountDetail(entryOf({ canUpgrade: false }))

    const button = mounted.container.querySelector<HTMLButtonElement>('.native-core-detail__upgrade')!
    expect(button.disabled).toBe(true)
    mounted.unmount()
  })

  it('maxLevel 1 core renders the maxed state with no upgrade button', () => {
    const mounted = mountDetail(entryOf({ maxLevel: 1, upgradeCost: undefined, canUpgrade: false }))

    expect(mounted.container.querySelector('.native-core-detail__upgrade')).toBeNull()
    expect(mounted.container.querySelector('.native-core-detail__level')!.textContent).toContain('Lv. 1/1')
    mounted.unmount()
  })

  it('null entry renders the empty state', () => {
    const mounted = mountDetail(null)

    expect(mounted.container.querySelector('.native-core-detail__name')).toBeNull()
    expect(mounted.container.querySelector('.empty-state')).not.toBeNull()
    mounted.unmount()
  })
})

describe('NativeCoreDetail - in-battle affordance disable (cleanD INT)', () => {
  it('inBattle disables the upgrade button even when canUpgrade is true', () => {
    const mounted = mountDetail(entryOf({ canUpgrade: true }))

    mounted.manager.getTurnBattle = () => ({ state: 'fighting' }) as ReturnType<GameManager['getTurnBattle']>
    mounted.version.value += 1

    return Promise.resolve().then(() => {
      const button = mounted.container.querySelector<HTMLButtonElement>('.native-core-detail__upgrade')!
      expect(button).not.toBeNull()
      expect(button.disabled).toBe(true)
      mounted.unmount()
    })
  })
})
