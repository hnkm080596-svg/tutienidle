// @vitest-environment jsdom
//
// Meridian figure block — the "Thuoc Tinh" (main attribute) group is
// rendered as five nodes anchored on the martial-figure art instead of a
// plain list. These tests pin the contract: five nodes keyed by
// MainStatKey, values shown, and the existing allocate (+)/MAX behavior
// preserved per node.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, ref } from 'vue'
import { createPinia, type Pinia } from 'pinia'
import CharacterPanel from './CharacterPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import { usePlayerStore } from '@/stores/player'
import { useTooltip as useTooltipState } from '@/composables/useTooltip'

function mountPanel(prepare?: (pinia: Pinia, manager: GameManager) => void) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const pinia = createPinia()
  const manager = new GameManager()
  const version = ref(0)
  prepare?.(pinia, manager)

  const app = createApp({ render: () => h(CharacterPanel) })
  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, manager, unmount: () => { app.unmount(); container.remove() } }
}

afterEach(() => { document.body.innerHTML = '' })

describe('CharacterPanel — meridian figure (5 main stats on the martial art)', () => {
  it('nhóm Thuộc Tính render đúng 5 node, mỗi node gắn data-stat là MainStatKey', () => {
    const { container, unmount } = mountPanel()

    const nodes = container.querySelectorAll('.meridian__node')
    expect(nodes).toHaveLength(5)

    const stats = [...nodes].map(node => node.getAttribute('data-stat')).sort()
    expect(stats).toEqual(['attunement', 'dexterity', 'intelligence', 'strength', 'vitality'])
    unmount()
  })

  it('mỗi node hiển thị label + giá trị stat', () => {
    const { container, unmount } = mountPanel()

    for (const node of container.querySelectorAll('.meridian__node')) {
      expect(node.querySelector('.meridian__node-label')?.textContent?.trim()).not.toBe('')
      expect(node.querySelector('.meridian__node-value')?.textContent?.trim()).not.toBe('')
    }
    unmount()
  })

  it('còn attributePoints → node hiện nút +, click gọi allocateAttributePoint đúng stat', () => {
    const { container, manager, unmount } = mountPanel((pinia) => {
      usePlayerStore(pinia).attributePoints = 3
    })

    const spy = vi.spyOn(manager.progressionOps, 'allocateAttributePoint')
    const button = container.querySelector<HTMLButtonElement>(
      '.meridian__node[data-stat="strength"] .meridian__node-allocate',
    )

    expect(button).not.toBeNull()
    button!.click()
    expect(spy).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('hết attributePoints → không nút + trên node nào', () => {
    const { container, unmount } = mountPanel()

    expect(container.querySelector('.meridian__node-allocate')).toBeNull()
    unmount()
  })

  it('stat chạm trần → hiện MAX thay vì nút + (kể cả khi còn điểm)', () => {
    const { container, unmount } = mountPanel((pinia) => {
      const player = usePlayerStore(pinia)
      player.attributePoints = 3
      player.baseStats.strength = 999_999
    })

    const node = container.querySelector('.meridian__node[data-stat="strength"]')!
    expect(node.querySelector('.meridian__node-allocate')).toBeNull()
    expect(node.querySelector('.meridian__node-max')?.textContent).toBe('MAX')
    unmount()
  })
})

describe('CharacterPanel — Ngũ Hành formation', () => {
  it('render 5 medallion hành (không caption text) + taiji Hỗn Nguyên ở tâm', () => {
    const { container, unmount } = mountPanel()

    const nodes = container.querySelectorAll('.element-node[data-element]')
    expect(nodes).toHaveLength(5)

    const elements = [...nodes].map(node => node.getAttribute('data-element')).sort()
    expect(elements).toEqual(['earth', 'fire', 'metal', 'water', 'wood'])

    // The art medallion identifies the element - no text caption under the disc.
    for (const node of nodes) {
      expect(node.querySelector('.element-node__disc')).not.toBeNull()
      expect(node.querySelector('.element-node__caption')).toBeNull()
    }

    // The taiji at the pentagram center carries Hon Nguyen's Power.
    const primordial = container.querySelector('.element-node--primordial')
    expect(primordial?.querySelector('.element-node__core')?.textContent?.trim()).not.toBe('')
    unmount()
  })

  it('trận đồ có 3 vòng đồng tâm + pentagram nền, tooltip hành dùng kind element (banner)', () => {
    const { container, unmount } = mountPanel()

    expect(container.querySelectorAll('.element-wheel__ring')).toHaveLength(3)
    expect(container.querySelector('.element-wheel__star-line')).not.toBeNull()

    const fire = container.querySelector<HTMLElement>('.element-node--fire')!
    fire.dispatchEvent(new Event('pointerenter', { bubbles: true }))

    const { content } = useTooltipState()
    expect(content.value?.kind).toBe('element')
    if (content.value?.kind === 'element') {
      expect(content.value.element).toBe('fire')
      expect(content.value.title).toBe('Hỏa')
    }
    unmount()
  })

  it('taiji Hỗn Nguyên có tooltip riêng (kind element, element primordial)', () => {
    const { container, unmount } = mountPanel()

    const primordial = container.querySelector<HTMLElement>('.element-node--primordial')!
    primordial.dispatchEvent(new Event('pointerenter', { bubbles: true }))

    const { content } = useTooltipState()
    expect(content.value?.kind).toBe('element')
    if (content.value?.kind === 'element') {
      expect(content.value.element).toBe('primordial')
      expect(content.value.description).toContain('Power')
    }
    unmount()
  })
})
