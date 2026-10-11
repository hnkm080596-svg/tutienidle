// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { createApp, h } from 'vue'
import { createI18n } from 'vue-i18n'
import AlchemyPaperRecipes from './AlchemyPaperRecipes.vue'

it('emits the clicked recipe identity and keeps source selection read-only', () => {
  const recipes = Object.freeze([{ id: 'first', name: 'First', icon: '/first.png', grade: 'I' }, { id: 'second', name: 'Second', icon: '/second.png', grade: 'II' }])
  const requests: string[] = []
  const container = document.createElement('div')
  const app = createApp({ render: () => h(AlchemyPaperRecipes, { recipes, selected: 'first', onSelect: (id: string) => requests.push(id) }) })
  app.use(createI18n({ legacy: false, locale: 'vi', messages: { vi: { alchemy: { recipe: 'Recipes', emptyRecipes: 'None' } } } })).mount(container)
  try {
    const buttons = container.querySelectorAll('button')
    buttons[1]!.click()
    expect(requests).toEqual(['second'])
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('true')
    expect(buttons[1]!.getAttribute('aria-pressed')).toBe('false')
  } finally { app.unmount() }
})
