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
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
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
    pinia,
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
  // 2026-10-11 ruling - buttons always render so the card layout stays
  // fixed: an unmet gate leaves the slot reserved via .btn-hidden +
  // disabled. The "Dot Pha" button is clickable only while the minor
  // breakthrough could land (cultivation full, floor < realm max); the
  // floor-12+ ritual only once canTriggerBreakthrough passes.
  it('nút Đột Phá chỉ hiện khi tu vi đủ và click lên tầng thẳng', async () => {
    const mounted = mountRealmPanel()
    const upgradeButton = () => mounted.container.querySelector<HTMLButtonElement>(
      '[data-testid="realm-upgrade"]',
    )
    const hidden = () => upgradeButton()?.classList.contains('btn-hidden')

    // Mortal floor 1, cultivation empty - the slot is reserved but the
    // button is hidden and disabled.
    expect(upgradeButton()).not.toBeNull()
    expect(hidden()).toBe(true)
    expect(upgradeButton()?.disabled).toBe(true)

    // Filling cultivation to the cap reveals the button.
    mounted.player.cultivation = mounted.player.cultivationRequired
    await nextTick()
    expect(hidden()).toBe(false)
    expect(upgradeButton()?.textContent?.trim()).toBe('Đột Phá')
    expect(upgradeButton()?.disabled).toBe(false)

    // A plain click lands the minor breakthrough (realmLevel + 1). The
    // cinematic resolves immediately in tests (no GameRoot layer).
    const before = mounted.player.realmLevel
    upgradeButton()!.click()
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mounted.player.realmLevel).toBe(before + 1)
    expect(mounted.player.cultivation).toBe(0)

    // Auto-select: the focus card snapped to the new current floor.
    expect(
      mounted.container.querySelector<HTMLElement>('.realm-floor-line')?.textContent?.trim(),
    ).toBe(`Tầng ${before + 1} / 18`)

    // At the realm cap the floor cannot advance - the button hides again
    // even with a full bar (the major transition is the ritual's job).
    mounted.player.realmLevel = 18
    mounted.player.cultivation = mounted.player.cultivationRequired
    await nextTick()
    expect(hidden()).toBe(true)
    expect(upgradeButton()?.disabled).toBe(true)
    mounted.unmount()
  })

  it('nút nghi lễ đổi tên theo cảnh giới và chỉ tồn tại khi đủ điều kiện', async () => {
    const mounted = mountRealmPanel()
    const requirement = useBreakthroughRequirementStore(mounted.pinia)
    const ritualButton = () => mounted.container.querySelector<HTMLButtonElement>(
      '[data-testid="realm-ritual"]',
    )

    // Mortal floor < 12: the ritual button keeps its slot but stays
    // hidden and disabled until the gate passes.
    expect(ritualButton()).not.toBeNull()
    expect(ritualButton()?.classList.contains('btn-hidden')).toBe(true)
    expect(ritualButton()?.disabled).toBe(true)

    mounted.player.realmLevel = 12
    await nextTick()

    // Level gate met at floor 12 - Quan Khi exists and a plain click
    // opens the breakthrough ceremony requirement store.
    expect(ritualButton()?.classList.contains('btn-hidden')).toBe(false)
    expect(ritualButton()?.textContent?.trim()).toBe('Quán Khí')
    ritualButton()!.click()
    await nextTick()
    expect(requirement.isOpen).toBe(true)
    requirement.close()

    mounted.player.realmId = 'qi_refining'
    mounted.player.realmLevel = 1
    await nextTick()

    expect(ritualButton()?.classList.contains('btn-hidden')).toBe(true)

    mounted.player.realmLevel = 12
    await nextTick()

    // M-QI-02 - Truc Co admission needs the chapter-final clear too.
    expect(ritualButton()?.classList.contains('btn-hidden')).toBe(true)

    mounted.player.completedStageIds = ['qi_refining_abyssal_pool']
    await nextTick()

    expect(ritualButton()?.textContent?.trim()).toBe('Dược')

    mounted.player.realmId = 'foundation_establishment'
    mounted.player.cultivation = 0
    await nextTick()

    // BETA SCOPE LOCK v2 (Phase-6): Truc Co -> Kim Dan is beyond the
    // release ceiling, so both buttons stay hidden.
    expect(ritualButton()?.classList.contains('btn-hidden')).toBe(true)
    expect(ritualButton()?.disabled).toBe(true)
    const upgrade = mounted.container.querySelector<HTMLButtonElement>('[data-testid="realm-upgrade"]')
    expect(upgrade?.classList.contains('btn-hidden')).toBe(true)
    expect(upgrade?.disabled).toBe(true)
    mounted.unmount()
  })

  // 2026-10-11 ruling - the requirements block is gone: buttons appearing
  // is the only eligibility signal, so the card never renders the
  // "Dieu Kien Dot Pha" heading or its rows.
  it('không còn khối điều kiện Đột Phá trong focus card ở mọi cảnh giới', async () => {
    const mounted = mountRealmPanel()
    const card = () => mounted.container.querySelector<HTMLElement>('.realm-active-card')!

    // Mortal.
    expect(card().querySelector('ul')).toBeNull()
    expect(card().textContent ?? '').not.toContain('Điều Kiện')

    mounted.player.realmId = 'qi_refining'
    mounted.player.realmLevel = 12
    await nextTick()

    expect(card().querySelector('ul')).toBeNull()
    expect(card().textContent ?? '').not.toContain('Điều Kiện')

    mounted.player.realmId = 'foundation_establishment'
    await nextTick()

    expect(card().querySelector('ul')).toBeNull()
    mounted.unmount()
  })

  it('khối hành động KHÔNG hiển thị input ẩn (đan/tầng luyện thể/kinh mạch/hoàn mỹ/talent)', async () => {
    const mounted = mountRealmPanel()
    mounted.player.realmId = 'qi_refining'
    mounted.player.realmLevel = 12
    await nextTick()

    const card = mounted.container.querySelector<HTMLElement>('.realm-active-card')!
    expect(card).not.toBeNull()
    const text = card.textContent ?? ''
    for (const hidden of [
      'Trúc Cơ Đan', 'truc_co_dan', 'Luyện Thể', 'Kinh Mạch',
      'Hoàn Mỹ', 'Pháp Bảo', 'pham_cot',
    ]) {
      expect(text).not.toContain(hidden)
    }

    mounted.unmount()
  })

})
