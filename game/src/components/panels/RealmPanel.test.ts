// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import RealmPanel from './RealmPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import {
  BUMP_STATE_KEY,
  GAME_MANAGER_KEY,
  STATE_VERSION_KEY,
} from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { i18n } from '@/i18n'

function mountRealmPanel() {
  const container = document.createElement('div')
  const pinia = createPinia()
  const gameManager = new GameManager()
  const stateVersion = ref(0)
  const app = createApp({ render: () => h(RealmPanel) })

  document.body.appendChild(container)
  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })

  useUiStore(pinia).standalonePanel = 'realm'
  app.mount(container)

  return {
    container,
    player: usePlayerStore(pinia),
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('RealmPanel', () => {
  it('chỉ còn nút đại cảnh giới — tiểu cảnh giới tự tăng khi đủ tu vi', async () => {
    const mounted = mountRealmPanel()
    const ritualButton = () => mounted.container.querySelector<HTMLButtonElement>(
      '.realm-panel__actions button',
    )!
    const actionLabels = () => Array.from(
      mounted.container.querySelectorAll<HTMLButtonElement>('.realm-panel__actions button'),
      button => button.textContent?.trim(),
    )

    expect(actionLabels()).toEqual(['Quán Khí'])
    expect(ritualButton().disabled).toBe(true)

    mounted.player.realmLevel = 12
    await nextTick()

    expect(ritualButton().disabled).toBe(false)

    mounted.player.realmId = 'qi_refining'
    mounted.player.realmLevel = 1
    await nextTick()

    expect(actionLabels()).toEqual(['Trúc Cơ'])
    expect(ritualButton().disabled).toBe(true)

    mounted.player.realmLevel = 12
    await nextTick()

    // M-QI-02 - Truc Co admission needs the chapter-final clear too.
    expect(ritualButton().disabled).toBe(true)

    mounted.player.completedStageIds = ['qi_refining_abyssal_pool']
    await nextTick()

    expect(ritualButton().disabled).toBe(false)

    mounted.player.realmId = 'foundation_establishment'
    await nextTick()

    expect(actionLabels()).toEqual(['Kim Đan'])
    expect(ritualButton().disabled).toBe(true)
    mounted.unmount()
  })

  // M-QI-03 - normal Truc Co read-model: exactly the two locked lines,
  // rendered only for qi_refining; hidden foundation inputs never surface.
  it('hiển thị đúng 2 dòng điều kiện Trúc Cơ cho qi_refining, cập nhật trạng thái trực tiếp', async () => {
    const mounted = mountRealmPanel()
    const reqRows = () => Array.from(
      mounted.container.querySelectorAll<HTMLElement>('.realm-requirement'),
    )
    const rowMet = (el: HTMLElement) => el.classList.contains('realm-requirement--met')

    // Mortal keeps its line-less Quan Khi presentation (Truc Co scope only).
    expect(reqRows()).toHaveLength(0)

    mounted.player.realmId = 'qi_refining'
    mounted.player.realmLevel = 12
    await nextTick()

    expect(reqRows()).toHaveLength(2)
    // QI-D6: the block renders EXACTLY the two mandatory normal inputs -
    // row text = marker glyph + semantic label, nothing else appended.
    const rowLabel = (el: HTMLElement) =>
      (el.textContent ?? '').replace(/^[✓✗]/, '').replace(/\s+/g, ' ').trim()
    expect(rowLabel(reqRows()[0]!)).toBe('Luyện Khí tầng 12')
    expect(rowMet(reqRows()[0]!)).toBe(true)
    expect(rowLabel(reqRows()[1]!)).toBe('Chương 10 hoàn thành')
    expect(rowMet(reqRows()[1]!)).toBe(false)

    // Spec v2 §3.2: the block lives INSIDE realm-panel__actions, under
    // the breakthrough button.
    const block = mounted.container.querySelector<HTMLElement>('.realm-requirements')!
    expect(block.parentElement?.classList.contains('realm-panel__actions')).toBe(true)

    mounted.player.completedStageIds = ['qi_refining_abyssal_pool']
    await nextTick()

    expect(rowMet(reqRows()[1]!)).toBe(true)

    mounted.player.realmId = 'foundation_establishment'
    await nextTick()

    expect(reqRows()).toHaveLength(0)
    mounted.unmount()
  })

  it('khối điều kiện KHÔNG hiển thị input ẩn (đan/tầng luyện thể/kinh mạch/hoàn mỹ/talent)', async () => {
    const mounted = mountRealmPanel()
    mounted.player.realmId = 'qi_refining'
    mounted.player.realmLevel = 12
    await nextTick()

    const block = mounted.container.querySelector<HTMLElement>('.realm-requirements')!
    expect(block).not.toBeNull()
    const text = block.textContent ?? ''
    for (const hidden of [
      'Trúc Cơ Đan', 'truc_co_dan', 'Luyện Thể', 'Kinh Mạch',
      'Hoàn Mỹ', 'Pháp Bảo', 'pham_cot',
    ]) {
      expect(text).not.toContain(hidden)
    }

    mounted.unmount()
  })
})
