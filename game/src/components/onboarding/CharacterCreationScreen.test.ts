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

  it('renders name and talent sections on ONE screen with no skill, stepper or attribute step', async () => {
    const mounted = mountScreen()
    await flushRoll()

    const container = mounted.container
    expect(container.querySelector('[data-testid="creation-name-input"]')).toBeTruthy()
    expect(container.querySelector('[data-testid^="creation-talent-"]')).toBeTruthy()

    // BETA SCOPE LOCK v2 (phase-2): the mortal starter pick is gone
    // entirely - no skill cards, no allocation, no stepper.
    expect(container.querySelector('[data-testid^="creation-skill-"]')).toBeNull()
    expect(container.querySelector('[data-testid^="creation-attribute-"]')).toBeNull()
    expect(container.querySelector('.stepper')).toBeNull()

    mounted.unmount()
  })

  it('keeps finish disabled until name + talent are both chosen', async () => {
    const mounted = mountScreen()
    await flushRoll()
    const container = mounted.container
    const finish = () => container.querySelector<HTMLButtonElement>('[data-testid="creation-finish"]')!

    expect(finish().disabled).toBe(true)

    fillName(container)
    await nextTick()
    expect(finish().disabled).toBe(true)

    container.querySelector<HTMLButtonElement>('.talent-card')!.click()
    await nextTick()
    expect(finish().disabled).toBe(false)

    mounted.unmount()
  })

  it('emits name + talentIds only - the starter pick never leaves the screen', async () => {
    const payloads: CharacterCreationPayload[] = []
    const mounted = mountScreen((payload) => payloads.push(payload))
    await flushRoll()

    fillName(mounted.container)
    await nextTick()

    mounted.container.querySelector<HTMLButtonElement>('.talent-card')!.click()
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
