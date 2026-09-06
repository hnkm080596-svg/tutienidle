// @vitest-environment jsdom
// Task 14-UI (rework P4) — DecomposeTab: settings UI (grade/age
// select + worker slider) + output preview, mount qua createApp+provide
// (project pattern, KHÔNG @vue/test-utils).
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import DecomposeTab from './DecomposeTab.vue'
import { DecomposeSystem } from '@/core/production/DecomposeSystem'
import { MaterialBag } from '@/core/material/MaterialBag'
import { materials } from '@/data/materials/materials'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'

function makeGameManager() {
  const bag = new MaterialBag()

  for (const material of materials) {
    bag.add(material, 100)
  }

  const decompose = new DecomposeSystem(bag, { autoWorkerCapacity: 6 })

  return {
    decomposeSystem: decompose,
    materialBag: bag,
  }
}

function mountTab(gm: ReturnType<typeof makeGameManager>) {
  const pinia = createPinia()

  setActivePinia(pinia)

  const container = document.createElement('div')

  document.body.appendChild(container)

  const version = ref(0)
  const app = createApp({ render: () => h(DecomposeTab) })

  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gm as unknown as import('@/core/game/GameManager').GameManager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => {
    version.value += 1
  })

  app.mount(container)

  return {
    container,
    select: (index: number) =>
      container.querySelectorAll<HTMLSelectElement>('.decompose-tab select')[index]!,
    slider: () => container.querySelector<HTMLInputElement>('.decompose-tab input[type="range"]')!,
    text: () => container.querySelector('.decompose-tab')?.textContent ?? '',
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DecomposeTab — settings UI (Task 14-UI)', () => {
  it('renders 2 selects (grade + quality) + worker slider', () => {
    const gm = makeGameManager()
    const tab = mountTab(gm)

    expect(tab.container.querySelectorAll('.decompose-tab select')).toHaveLength(2)
    expect(tab.slider()).not.toBeNull()

    tab.unmount()
  })

  it('worker slider input → system.setSetting({workers})', async () => {
    const gm = makeGameManager()
    const tab = mountTab(gm)

    const slider = tab.slider()!

    slider.value = '4'
    slider.dispatchEvent(new Event('input'))
    await nextTick()

    expect(gm.decomposeSystem.getSettings().workers).toBe(4)

    tab.unmount()
  })

  it('grade select → system.setSetting({gradeFilter})', async () => {
    const gm = makeGameManager()
    const tab = mountTab(gm)

    const gradeSelect = tab.select(0)

    gradeSelect.value = 'luc_pham'
    gradeSelect.dispatchEvent(new Event('change'))
    await nextTick()

    expect(gm.decomposeSystem.getSettings().gradeFilter).toBe('luc_pham')

    tab.unmount()
  })

  it('age select → system.setSetting({ageFilter})', async () => {
    const gm = makeGameManager()
    const tab = mountTab(gm)

    const ageSelect = tab.select(1)

    ageSelect.value = 'myriad_year'
    ageSelect.dispatchEvent(new Event('change'))
    await nextTick()

    expect(gm.decomposeSystem.getSettings().ageFilter).toBe('myriad_year')

    tab.unmount()
  })

  it('hiển thị pending output estimate (workers > 0 → dòng text có số)', async () => {
    const gm = makeGameManager()
    const tab = mountTab(gm)

    const slider = tab.slider()!

    slider.value = '2'
    slider.dispatchEvent(new Event('input'))
    await nextTick()

    // Output estimate text: base 1 × Hoang 1 × 2 workers = 2/lượt.
    expect(tab.text()).toContain('2')

    tab.unmount()
  })
})
