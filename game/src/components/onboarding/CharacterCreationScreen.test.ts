// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import CharacterCreationScreen from './CharacterCreationScreen.vue'
import { CHARACTER_CREATION_ATTRIBUTE_POINTS } from '@/services/character/CharacterCreationService'
import { i18n } from '@/i18n'

function mountScreen() {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({ render: () => h(CharacterCreationScreen) })
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

async function reachAttributeStep(container: HTMLElement) {
  const next = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
  // onMounted fires reroll() against the mock service — flush it, then
  // walk name → talent → attributes through the real controls.
  await next()
  await nextTick()

  const nameInput = container.querySelector<HTMLInputElement>('.name-step input, input[type="text"]')!
  nameInput.value = 'Lạc Vân'
  nameInput.dispatchEvent(new Event('input'))
  await nextTick()

  container.querySelector<HTMLButtonElement>('[data-testid="creation-continue-name"]')!.click()
  await nextTick()

  container.querySelector<HTMLButtonElement>('.talent-card')!.click()
  await nextTick()

  container.querySelector<HTMLButtonElement>('[data-testid="creation-confirm-talent"]')!.click()
  await nextTick()
}

describe('CharacterCreationScreen — attribute budget', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('remaining points derive from the shared CHARACTER_CREATION_ATTRIBUTE_POINTS', async () => {
    const mounted = mountScreen()

    await reachAttributeStep(mounted.container)

    const points = mounted.container.querySelector<HTMLElement>('.points')!
    expect(points.textContent).toContain(String(CHARACTER_CREATION_ATTRIBUTE_POINTS))

    mounted.container.querySelector<HTMLButtonElement>('[data-testid="creation-attribute-plus-strength"]')!.click()
    await nextTick()

    expect(points.textContent).toContain(String(CHARACTER_CREATION_ATTRIBUTE_POINTS - 1))

    mounted.unmount()
  })
})
