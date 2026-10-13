// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { i18n } from '@/i18n'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'
import QuestRow from './QuestRow.vue'

function row(locked: boolean, claimable = false): BetaQuestSurfaceModel {
  return {
    id: 'quest-1',
    name: 'Quest One',
    description: 'Find materials',
    cadence: 'once',
    progress: claimable ? 3 : 0,
    target: 3,
    targetLabel: null,
    rewards: [],
    claim: { claimed: false, available: claimable, disabledReason: claimable ? null : 'incomplete' },
    ...(locked ? { lockedPreview: { afterQuestName: 'Prologue' } } : {}),
  }
}

function mountRow(model: BetaQuestSurfaceModel) {
  const container = document.createElement('div')
  document.body.append(container)
  let selected = 0
  const app = createApp({ render: () => h(QuestRow, { row: model, selected: false, onSelect: () => { selected++ } }) })
  app.use(i18n)
  app.mount(container)
  return { container, get selected() { return selected }, unmount: () => { app.unmount(); container.remove() } }
}

describe('QuestRow display and interaction', () => {
  it('shows a ready to claim badge and allows selecting an unlocked quest', async () => {
    const view = mountRow(row(false, true))
    await nextTick()
    expect(view.container.querySelector('.quest-row__badge.ready')?.textContent).toBe(
      i18n.global.t('panels.quest.scene.status.ready'),
    )
    view.container.querySelector<HTMLButtonElement>('.quest-row')?.click()
    expect(view.selected).toBe(1)
    view.unmount()
  })

  it('explains and prevents interaction with a locked quest', async () => {
    const view = mountRow(row(true))
    await nextTick()
    const button = view.container.querySelector<HTMLButtonElement>('.quest-row')!
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.getAttribute('tabindex')).toBe('-1')
    expect(button.textContent).toContain(i18n.global.t('panels.quest.lockedAfter', { name: 'Prologue' }))
    expect(view.container.querySelector('.quest-row__badge.pending')).not.toBeNull()
    button.click()
    expect(view.selected).toBe(0)
    view.unmount()
  })
})
