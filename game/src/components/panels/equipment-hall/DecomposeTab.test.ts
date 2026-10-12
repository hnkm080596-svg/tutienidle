// @vitest-environment jsdom
// DecomposeTab submits explicit ore and quantity through the domain owner.
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import DecomposeTab from './DecomposeTab.vue'
import { DecomposeSystem } from '@/core/production/DecomposeSystem'
import { MaterialBag } from '@/core/material/MaterialBag'
import { MaterialRegistry } from '@/core/material/MaterialRegistry'
import { materials } from '@/data/materials/materials'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'
import { LUYEN_KHI_TINH_HOA_ID } from '@/core/equipment/TinhHoaMaterial'

function makeGameManager() {
  const bag = new MaterialBag()
  for (const material of materials) bag.add(material, 100)
  const callbacks = { notifyMaterialGained: vi.fn() }
  const decompose = new DecomposeSystem(bag, {
    onEssenceProduced: callbacks.notifyMaterialGained,
  })
  const materialRegistry = new MaterialRegistry()
  for (const material of materials) materialRegistry.register(material)
  return { decomposeSystem: decompose, materialBag: bag, materialRegistry, callbacks }
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
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)
  return {
    container,
    ore: () => container.querySelector<HTMLSelectElement>('.decompose-tab select')!,
    amount: () => container.querySelector<HTMLInputElement>('.decompose-tab input[type="number"]')!,
    button: () => container.querySelector<HTMLButtonElement>('.decompose-tab button')!,
    text: () => container.querySelector('.decompose-tab')?.textContent ?? '',
    unmount: () => { app.unmount(); container.remove() },
  }
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => { document.body.innerHTML = '' })

describe('DecomposeTab — explicit instant command', () => {
  it('lists only ore stacks and previews the selected amount', async () => {
    const gm = makeGameManager()
    const tab = mountTab(gm)
    await nextTick()
    expect([...tab.ore().options].some((option) => option.value === 'mortal_ore_decade')).toBe(true)
    expect([...tab.ore().options].some((option) => option.value === LUYEN_KHI_TINH_HOA_ID)).toBe(false)
    tab.amount().value = '4'
    tab.amount().dispatchEvent(new Event('input'))
    await nextTick()
    expect(tab.text()).toContain('2')
    tab.unmount()
  })

  it('button commits selected ore atomically and refreshes the visible stock', async () => {
    const gm = makeGameManager()
    const tab = mountTab(gm)
    await nextTick()
    tab.ore().value = 'mortal_ore_decade'
    tab.ore().dispatchEvent(new Event('change'))
    tab.amount().value = '4'
    tab.amount().dispatchEvent(new Event('input'))
    await nextTick()
    tab.button().click()
    await nextTick()
    expect(gm.materialBag.getAmount('mortal_ore_decade')).toBe(96)
    expect(gm.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(102)
    expect(gm.callbacks.notifyMaterialGained).toHaveBeenCalledWith(LUYEN_KHI_TINH_HOA_ID, 2)
    expect(tab.text()).toContain('96')
    tab.unmount()
  })

  it('keeps the action clickable and reports invalid input without mutating either balance', async () => {
    const gm = makeGameManager()
    const tab = mountTab(gm)
    await nextTick()
    tab.amount().value = '0'
    tab.amount().dispatchEvent(new Event('input'))
    await nextTick()
    tab.button().click()
    await nextTick()
    expect(gm.materialBag.getAmount('mortal_ore_decade')).toBe(100)
    expect(gm.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(100)
    expect(tab.text()).not.toContain('disabled')
    tab.unmount()
  })
})
