// @vitest-environment jsdom
// DecomposeTab rework (owner ruling 2026-10-12): UI kieu Hoa Luyen -
// nhung tui nguyen lieu o pick mode, chon stack khoang, bulk actions
// + submit vang mo ConfirmModal. KHONG con worker slider/settings.
// Mount qua createApp+provide (project pattern, KHONG @vue/test-utils);
// decomposeSystem stub theo contract listDecomposableIds/previewDecompose/
// decompose (impl that o DecomposeSystem - test nay chi khoa UI wiring).
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

// BETA SCOPE LOCK v2 Phase-5 - suite nay exercise implementation ENABLE
// (scope-hidden domains dormant, not deleted) nen scope authority
// bao in-scope cho file nay.
vi.mock('../../../core/betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../core/betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

import { createApp, h, nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import DecomposeTab from './DecomposeTab.vue'
import { MaterialRegistry } from '@/core/material/MaterialRegistry'
import type { Material } from '@/core/material/Material'
import { materials } from '@/data/materials/materials'
import type { DecomposeSystem } from '@/core/production/DecomposeSystem'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'
import { useActionFeedbackStore } from '@/stores/actionFeedback'

// Real generated ores + a real herb from the seed data (child rework
// turned `<realm>_ore_<age>` into authored materials - fake fixtures
// with the same ids would double-register).
const ORE_A: Material = materials.find((m) => m.id === 'material_spirit_ore_decade')!
const ORE_B: Material = materials.find((m) => m.id === 'material_spirit_ore_thuong_co')!

// Stack khong phan giai duoc (thao -> inert cell).
const HERB: Material = materials.find((m) => m.profession?.resourceKind === 'herb')!

function makeGameManager() {
  const registry = new MaterialRegistry()

  for (const material of materials) {
    registry.register(material)
  }

  const stacks = [
    { material: ORE_A, amount: 40 },
    { material: ORE_B, amount: 5 },
    { material: HERB, amount: 12 },
  ]

  const decomposeSystem = {
    listDecomposableIds: () => [ORE_A.id, ORE_B.id],
    previewDecompose: vi.fn((ids: string[]) =>
      ids.length === 0
        ? []
        : [{ materialId: 'luyen_khi_tinh_hoa', minAmount: ids.length * 3, maxAmount: ids.length * 3 }],
    ),
    decompose: vi.fn(() => true),
  }

  return {
    decomposeSystem: decomposeSystem as unknown as DecomposeSystem,
    materialBag: { getAll: () => stacks } as never,
    materialRegistry: registry,
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
  // BagChipSelect/tooltip directives used by the embedded bag section.
  window.ResizeObserver = window.ResizeObserver || (class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never)

  app.mount(container)

  const oreCells = () =>
    Array.from(container.querySelectorAll<HTMLElement>('.bag-section__grid .bag-section__slot'))
      .filter((el) => (el.getAttribute('aria-label') ?? '').includes('Linh Khoáng'))

  return {
    container,
    bump: () => {
      version.value += 1
    },
    oreCells,
    inertCells: () =>
      container.querySelectorAll('.bag-section__slot--inert'),
    pickedCells: () =>
      container.querySelectorAll('.bag-section__slot--picked'),
    submitButton: () =>
      container.querySelector<HTMLButtonElement>('.equipment-forge-actions__submit'),
    bulkButtons: () =>
      Array.from(container.querySelectorAll<HTMLButtonElement>('.decompose-filters__bulk')),
    click: async (el: HTMLElement | null | undefined) => {
      if (!el) throw new Error('element not found')
      el.dispatchEvent(new Event('click', { bubbles: true }))
      await nextTick()
    },
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

describe('DecomposeTab — pick-mode UI (owner ruling 2026-10-12)', () => {
  it('shows the domain failure reason and retains selection on a rejected conversion', async () => {
    const gm = makeGameManager()
    gm.decomposeSystem.decomposeWithResult = vi.fn(() => ({ ok: false, reason: 'output_capacity' } as const))
    const tab = mountTab(gm)
    await tab.click(tab.oreCells()[0])
    await tab.click(tab.submitButton())
    const confirm = Array.from(document.body.querySelectorAll('button'))
      .find((button) => /xác nhận|confirm/i.test(button.textContent ?? ''))
    await tab.click(confirm)
    expect(useActionFeedbackStore().entries.at(-1)?.messageKey).toBe('panels.decompose.hint.output_capacity')
    expect(tab.pickedCells()).toHaveLength(1)
    useActionFeedbackStore().$reset()
    tab.unmount()
  })
  it('render tui nguyen lieu nhung + khong con slider/select nhan cong', () => {
    const gm = makeGameManager()
    const tab = mountTab(gm)

    expect(tab.container.querySelector('.bag-section__grid')).not.toBeNull()
    expect(tab.container.querySelector('input[type="range"]')).toBeNull()
    expect(tab.oreCells().length).toBe(2)
    // Stack thao render mo (inert) - khong pick duoc.
    expect(tab.inertCells().length).toBe(1)

    tab.unmount()
  })

  it('click o khoang toggle selection (badge picked)', async () => {
    const gm = makeGameManager()
    const tab = mountTab(gm)

    await tab.click(tab.oreCells()[0])

    expect(tab.pickedCells().length).toBe(1)

    // Click lai -> bo chon.
    await tab.click(tab.oreCells()[0])

    expect(tab.pickedCells().length).toBe(0)

    tab.unmount()
  })

  it('Chon Tat Ca chon moi stack khoang dang hien; Xoa Chon reset', async () => {
    const gm = makeGameManager()
    const tab = mountTab(gm)

    const [selectAll, clearAll] = tab.bulkButtons()

    await tab.click(selectAll)

    expect(tab.pickedCells().length).toBe(2)
    expect(tab.container.querySelectorAll('.slot-view--selected').length).toBe(2)

    await tab.click(clearAll)

    expect(tab.pickedCells().length).toBe(0)
    expect(tab.container.querySelectorAll('.slot-view--selected').length).toBe(0)

    tab.unmount()
  })

  it('submit vang disabled khi chua chon; click mo ConfirmModal', async () => {
    const gm = makeGameManager()
    const tab = mountTab(gm)

    expect(tab.submitButton()!.disabled).toBe(true)

    await tab.click(tab.oreCells()[0])
    await nextTick()

    expect(tab.submitButton()!.disabled).toBe(false)

    await tab.click(tab.submitButton())

    expect(document.body.textContent).toContain('Phân Giải')

    tab.unmount()
  })

  it('xac nhan modal goi system.decompose voi dung tap id da chon', async () => {
    const gm = makeGameManager()
    const tab = mountTab(gm)

    await tab.click(tab.oreCells()[0])
    await tab.click(tab.submitButton())

    const confirm = Array.from(document.body.querySelectorAll('button'))
      .find((b) => (b.textContent ?? '').trim().length > 0 && /xác nhận|confirm/i.test(b.textContent!))

    if (confirm) {
      await tab.click(confirm)
    } else {
      // ConfirmModal co the expose confirm rieng - fallback: goi truc tiep qua dialog.
      const dialog = document.body.querySelector('[role="dialog"] button:last-child') as HTMLElement | null
      await tab.click(dialog)
    }

    expect(gm.decomposeSystem.decompose).toHaveBeenCalledWith([ORE_A.id])

    tab.unmount()
  })
})
