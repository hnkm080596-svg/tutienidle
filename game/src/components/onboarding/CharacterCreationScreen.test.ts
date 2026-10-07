// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createApp, h, nextTick } from 'vue'
import CharacterCreationScreen, { type CharacterCreationPayload } from './CharacterCreationScreen.vue'
import { i18n } from '@/i18n'

beforeEach(() => setActivePinia(createPinia()))

function mountScreen(onComplete?: (payload: CharacterCreationPayload) => void) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({ render: () => h(CharacterCreationScreen, onComplete ? { onComplete } : {}) })
  app.use(i18n)
  app.mount(container)

  return {
    container,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

async function flushRoll() {
  // onMounted fires reroll() against the mock service - flush the promise,
  // then let the DOM update.
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

function fillName(container: HTMLElement) {
  const nameInput = container.querySelector<HTMLInputElement>('[data-testid="creation-name-input"]')!
  nameInput.value = 'Lạc Vân'
  nameInput.dispatchEvent(new Event('input'))
}

describe('CharacterCreationScreen — beta name + talent flow', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders name + dao-lo + talent on ONE screen; dao-lo previews 5 cells with only linh_bao selectable', async () => {
    const mounted = mountScreen()
    await flushRoll()

    const container = mounted.container
    expect(container.querySelector('[data-testid="creation-name-input"]')).toBeTruthy()
    expect(container.querySelector('[data-testid^="creation-talent-"]')).toBeTruthy()

    // BETA SCOPE LOCK v2 (phase-2): no allocation, no stepper. Dao lo
    // cells: Tu Phap (linh_bao) is the only OPEN pick in beta - a normal
    // selectable cell, not pre-selected (Minh ruling 2026-10-06).
    // tram/huy_quyen render locked, the two trailing cells are hidden
    // placeholders. The pick stays local UI state and never enters the
    // payload (pinned below).
    const daoLo = container.querySelector('[data-hk-region="dao-lo"]')
    expect(daoLo).toBeTruthy()
    expect(daoLo!.querySelectorAll('.trial-path-cell')).toHaveLength(5)
    const locked = daoLo!.querySelectorAll('.trial-path-cell.locked')
    expect(locked).toHaveLength(4)
    const starterPick = daoLo!.querySelector<HTMLButtonElement>('[data-testid="creation-starter-linh_bao"]')
    expect(starterPick!.tagName).toBe('BUTTON')
    expect(starterPick!.getAttribute('role')).toBe('radio')
    expect(starterPick!.getAttribute('aria-checked')).toBe('false')
    expect(starterPick!.disabled).toBe(false)
    expect(daoLo!.querySelectorAll('button:not([disabled])')).toHaveLength(1)
    expect(container.querySelector('[data-testid^="creation-attribute-"]')).toBeNull()
    expect(container.querySelector('.stepper')).toBeNull()

    mounted.unmount()
  })

  it('renders the 3-offer talent row inside a 9-tile grid (6 locked slots)', async () => {
    const mounted = mountScreen()
    await flushRoll()

    const grid = mounted.container.querySelector('[data-hk-region="talent-grid"]')!
    expect(grid.querySelectorAll('button[data-testid^="creation-talent-"]')).toHaveLength(3)
    expect(grid.querySelectorAll('[data-testid^="creation-locked-talent-"]')).toHaveLength(6)
    expect(mounted.container.querySelector('[data-testid="creation-random-all"]')).toBeTruthy()

    mounted.unmount()
  })

  it('master die randomizes all three sections - name, dao-lo, talent (reroll first)', async () => {
    const mounted = mountScreen()
    await flushRoll()

    const container = mounted.container
    const nameInput = container.querySelector<HTMLInputElement>('[data-testid="creation-name-input"]')!
    expect(nameInput.value).toBe('')
    expect(container.querySelector('[data-testid^="creation-talent-"][aria-checked="true"]')).toBeNull()
    expect(container.querySelector('[data-testid="creation-starter-linh_bao"]')!.getAttribute('aria-checked')).toBe('false')

    container.querySelector<HTMLButtonElement>('[data-testid="creation-random-all"]')!.click()
    await flushRoll()

    expect(nameInput.value.length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('[data-testid="creation-starter-linh_bao"]')!.getAttribute('aria-checked')).toBe('true')
    expect(container.querySelectorAll('[data-testid^="creation-talent-"][aria-checked="true"]')).toHaveLength(1)

    mounted.unmount()
  })

  it('master die never overrides a section the player filled', async () => {
    const mounted = mountScreen()
    await flushRoll()
    const container = mounted.container

    fillName(container)
    await nextTick()
    container.querySelector<HTMLButtonElement>('[data-testid="creation-random-all"]')!.click()
    await flushRoll()

    const nameInput = container.querySelector<HTMLInputElement>('[data-testid="creation-name-input"]')!
    expect(nameInput.value).toBe('Lạc Vân')
    expect(container.querySelectorAll('[data-testid^="creation-talent-"][aria-checked="true"]')).toHaveLength(1)

    mounted.unmount()
  })

  it('master die re-randomizes sections the player cleared', async () => {
    const mounted = mountScreen()
    await flushRoll()
    const container = mounted.container
    const nameInput = container.querySelector<HTMLInputElement>('[data-testid="creation-name-input"]')!
    const die = () => container.querySelector<HTMLButtonElement>('[data-testid="creation-random-all"]')!
    const checkedTalent = () => container.querySelectorAll('[data-testid^="creation-talent-"][aria-checked="true"]')

    fillName(container)
    await nextTick()
    container.querySelector<HTMLButtonElement>('[data-testid^="creation-talent-"]')!.click()
    await nextTick()
    expect(checkedTalent()).toHaveLength(1)

    nameInput.value = ''
    nameInput.dispatchEvent(new Event('input'))
    container.querySelector<HTMLButtonElement>('[data-testid^="creation-talent-"][aria-checked="true"]')!.click()
    await nextTick()
    expect(checkedTalent()).toHaveLength(0)

    die().click()
    await flushRoll()

    expect(nameInput.value.length).toBeGreaterThanOrEqual(2)
    expect(checkedTalent()).toHaveLength(1)

    mounted.unmount()
  })

  it('keeps finish disabled until name + talent are both chosen', async () => {
    const mounted = mountScreen()
    await flushRoll()
    const container = mounted.container
    const finish = () => container.querySelector<HTMLButtonElement>('[data-testid="creation-finish"]')!

    expect(finish().getAttribute('aria-disabled')).toBe('true')

    fillName(container)
    await nextTick()
    expect(finish().getAttribute('aria-disabled')).toBe('true')

    container.querySelector<HTMLButtonElement>('[data-testid^="creation-talent-"]')!.click()
    await nextTick()
    expect(finish().getAttribute('aria-disabled')).toBe('false')

    mounted.unmount()
  })

  it('emits name + talentIds only - the starter pick never leaves the screen', async () => {
    const payloads: CharacterCreationPayload[] = []
    const mounted = mountScreen((payload) => payloads.push(payload))
    await flushRoll()

    fillName(mounted.container)
    await nextTick()

    mounted.container.querySelector<HTMLButtonElement>('[data-testid^="creation-talent-"]')!.click()
    await nextTick()

    mounted.container.querySelector<HTMLButtonElement>('[data-testid="creation-finish"]')!.click()
    await flushRoll()

    expect(payloads).toHaveLength(1)
    expect(payloads[0]).toEqual({
      name: 'Lạc Vân',
      talentIds: [expect.any(String)],
    })
    expect('mortalBasicSkillId' in payloads[0]!).toBe(false)
    expect('attributes' in payloads[0]!).toBe(false)

    mounted.unmount()
  })
})
