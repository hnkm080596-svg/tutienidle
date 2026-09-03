// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import StageSelectPanel from './StageSelectPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { STAGES } from '@/data/stage/Stages'
import { zones } from '@/data/stage/Zones'
import { ENEMIES } from '@/data/enemy/Enemies'
import { buildings } from '@/data/building/buildings'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'

// i18n (2.5 task 8) — assert qua i18n.global.t(key) thay vì raw vi string
// (pattern HomeResourceStrip). Tên quái/boss từ dữ liệu core, không locale.
function t(key: string): string {
  return (i18n.global as unknown as { t: (k: string) => string }).t(key)
}

function mountStageSelect() {
  const container = document.createElement('div')
  const pinia = createPinia()
  const manager = new GameManager()
  const version = ref(0)
  manager.registerEnemyTemplates(ENEMIES)
  manager.registerStages(STAGES)
  manager.registerZones(zones)
  manager.registerBuildings(buildings)
  manager.buildingManager.add({
    instanceId: 'teleport-array',
    buildingId: 'teleport_array',
    level: 1,
    lastCollectedAt: 0,
  })

  const app = createApp({ render: () => h(StageSelectPanel) })
  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, unmount: () => app.unmount() }
}

afterEach(() => { document.body.innerHTML = '' })

describe('StageSelectPanel — thông tin Truyền Tống Trận', () => {
  it('hiện tên quái trên tuyến ải và đội hình của stage đang chọn (2026-08-30: bỏ banner ảnh dư thừa + intro text trùng lặp title bar)', () => {
    const mounted = mountStageSelect()

    expect(mounted.container.querySelector('.stage-select__intro')).toBeNull()
    expect(mounted.container.querySelector('.stage-select__scene')).toBeNull()
    expect(mounted.container.querySelectorAll('.stage-select__filter-group--chapters button')).toHaveLength(3)
    expect(mounted.container.querySelectorAll('.stage-map__node')).toHaveLength(10)
    expect(mounted.container.textContent).toContain('Dã Trư')
    expect(mounted.container.textContent).toContain('Sơn Khấu')
    expect(mounted.container.textContent).toContain(`10 ${t('panels.stageSelect.labels.enemiesSuffix')}`)
    expect(mounted.container.textContent).toContain(`${t('panels.stageSelect.labels.bossNamePrefix')} Sơn Khấu`)

    mounted.unmount()
  })
})
