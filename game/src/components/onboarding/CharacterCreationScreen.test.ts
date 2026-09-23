// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import CharacterCreationScreen, { type CharacterCreationPayload } from './CharacterCreationScreen.vue'
import { i18n } from '@/i18n'

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

async function completeCreation(container: HTMLElement, skillId: string) {
  fillName(container)
  await nextTick()

  container.querySelector<HTMLButtonElement>('.talent-card')!.click()
  await nextTick()

  container.querySelector<HTMLButtonElement>(`[data-testid="creation-skill-${skillId}"]`)!.click()
  await nextTick()
}

describe('CharacterCreationScreen — unified name + talent + skill flow', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders name, talent and starting-skill sections on ONE screen with no stepper or attribute step', async () => {
    const mounted = mountScreen()
    await flushRoll()

    const container = mounted.container
    expect(container.querySelector('[data-testid="creation-name-input"]')).toBeTruthy()
    expect(container.querySelector('[data-testid^="creation-talent-"]')).toBeTruthy()

    const skillCards = container.querySelectorAll('[data-testid^="creation-skill-"]')
    expect([...skillCards].map(el => el.getAttribute('data-testid')).sort()).toEqual([
      'creation-skill-huy_quyen',
      'creation-skill-linh_bao',
      'creation-skill-tram',
    ])

    // The ruling removed allocation entirely: no counters, no stepper.
    expect(container.querySelector('[data-testid^="creation-attribute-"]')).toBeNull()
    expect(container.querySelector('.stepper')).toBeNull()

    mounted.unmount()
  })

  it('keeps finish disabled until name + talent + skill are all chosen', async () => {
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
    expect(finish().disabled).toBe(true)

    container.querySelector<HTMLButtonElement>('[data-testid="creation-skill-huy_quyen"]')!.click()
    await nextTick()
    expect(finish().disabled).toBe(false)

    mounted.unmount()
  })

  it('emits name + talentIds + mortalBasicSkillId and no attributes field', async () => {
    const payloads: CharacterCreationPayload[] = []
    const mounted = mountScreen((payload) => payloads.push(payload))
    await flushRoll()

    await completeCreation(mounted.container, 'huy_quyen')
    mounted.container.querySelector<HTMLButtonElement>('[data-testid="creation-finish"]')!.click()
    await flushRoll()

    expect(payloads).toHaveLength(1)
    expect(payloads[0]).toEqual({
      name: 'Lạc Vân',
      talentIds: [expect.any(String)],
      mortalBasicSkillId: 'huy_quyen',
    })
    expect('attributes' in payloads[0]!).toBe(false)

    mounted.unmount()
  })
})
