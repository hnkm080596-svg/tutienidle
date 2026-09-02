// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { createApp, h } from 'vue'
import { i18n } from '@/i18n'
import RewardList from './RewardList.vue'
import type { BattleRewardSummary } from '@/core/reward/BattleRewardSummary'

// i18n (2.5 task 8) — assert qua i18n.global.t(key) thay vì raw vi string
// (pattern HomeResourceStrip). Tên item thưởng từ dữ liệu summary, không locale.
function t(key: string): string {
  return (i18n.global as unknown as { t: (k: string) => string }).t(key)
}

interface MountedRewardList {
  container: HTMLDivElement
  items: NodeListOf<HTMLElement>
  unmount: () => void
}

function mountRewardList(summary: BattleRewardSummary): MountedRewardList {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({
    render: () => h(RewardList, { summary }),
  })
  app.use(i18n)
  app.mount(container)

  return {
    container,
    items: container.querySelectorAll<HTMLElement>('li'),
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

describe('RewardList', () => {
  it('renders 5 li elements when all 5 reward fields are populated', () => {
    const summary: BattleRewardSummary = {
      techniqueInsight: 1234,
      skillInsight: 567,
      artifactInsight: 89,
      spiritStone: 42,
      items: [{ itemId: 'pill-1', kind: 'pill', name: 'Luyện Khí Đan', amount: 3 }],
    }
    const { items, unmount } = mountRewardList(summary)
    expect(items).toHaveLength(5)
    unmount()
  })

  it('renders 0 li elements when summary is empty', () => {
    const summary: BattleRewardSummary = {
      techniqueInsight: 0,
      skillInsight: 0,
      artifactInsight: 0,
      spiritStone: 0,
      items: [],
    }
    const { items, unmount } = mountRewardList(summary)
    expect(items).toHaveLength(0)
    unmount()
  })

  it('renders 1 li when only spiritStone > 0', () => {
    const summary: BattleRewardSummary = {
      techniqueInsight: 0,
      skillInsight: 0,
      artifactInsight: 0,
      spiritStone: 99,
      items: [],
    }
    const { items, unmount } = mountRewardList(summary)
    expect(items).toHaveLength(1)
    expect(items[0]?.textContent).toContain(t('combat.rewards.spiritStone'))
    expect(items[0]?.textContent).toContain('+99')
    unmount()
  })

  it('skips reward lines with value 0', () => {
    const summary: BattleRewardSummary = {
      techniqueInsight: 0,
      skillInsight: 500,
      artifactInsight: 0,
      spiritStone: 0,
      items: [],
    }
    const { items, unmount } = mountRewardList(summary)
    expect(items).toHaveLength(1)
    expect(items[0]?.textContent).toContain(t('combat.rewards.skillInsight'))
    expect(items[0]?.textContent).toContain('+500')
    unmount()
  })

  it('renders multiple items correctly', () => {
    const summary: BattleRewardSummary = {
      techniqueInsight: 0,
      skillInsight: 0,
      artifactInsight: 0,
      spiritStone: 0,
      items: [
        { itemId: 'mat-1', kind: 'material', name: 'Linh Thạch', amount: 10 },
        { itemId: 'mat-2', kind: 'material', name: 'Minh Văn Thạch', amount: 5 },
      ],
    }
    const { items, unmount } = mountRewardList(summary)
    expect(items).toHaveLength(2)
    expect(items[0]?.textContent).toContain('Linh Thạch')
    expect(items[0]?.textContent).toContain('+10')
    expect(items[1]?.textContent).toContain('Minh Văn Thạch')
    expect(items[1]?.textContent).toContain('+5')
    unmount()
  })
})
