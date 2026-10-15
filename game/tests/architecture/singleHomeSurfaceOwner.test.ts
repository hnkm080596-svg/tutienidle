import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '@/stores/ui'

const SRC_DIR = join(process.cwd(), 'src')

describe('single home surface owner architecture (Slice 3.2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('stores/ui.ts owns a single activeHomeSurface state ref with derived projections', () => {
    const ui = useUiStore()

    // In Pinia setup stores, only ref() state fields live in $state; computed
    // projections (`leftPanelMode`, `standalonePanel`, `characterOverlayOpen`,
    // `characterSceneTab`, `hasHomeOverlayOpen`) are getters, not parallel state.
    const stateKeys = Object.keys(ui.$state)
    expect(stateKeys).toContain('activeHomeSurface')
    expect(stateKeys).not.toContain('leftPanelMode')
    expect(stateKeys).not.toContain('standalonePanel')
    expect(stateKeys).not.toContain('characterOverlayOpen')
    expect(stateKeys).not.toContain('characterSceneTab')
  })

  it('DongFuStage.vue does not maintain a separate feedbackOpen ref or surfaceOpen watcher', () => {
    const dongFuStageSource = readFileSync(
      join(SRC_DIR, 'components/scenes/dong-fu/DongFuStage.vue'),
      'utf8',
    )
    expect(dongFuStageSource).not.toMatch(/\bconst\s+feedbackOpen\s*=\s*ref\s*\(/)
    expect(dongFuStageSource).not.toMatch(/\bwatch\s*\(\s*surfaceOpen\b/)
    expect(dongFuStageSource).toContain("ui.activeHomeSurface === 'feedback'")
  })

  it('LeftPanel.vue has been folded into FunctionOverlayPanel.vue', () => {
    expect(existsSync(join(SRC_DIR, 'components/layout/LeftPanel.vue'))).toBe(false)
    const functionOverlaySource = readFileSync(
      join(SRC_DIR, 'components/layout/FunctionOverlayPanel.vue'),
      'utf8',
    )
    expect(functionOverlaySource).toContain("ui.activeHomeSurface === 'character'")
    expect(functionOverlaySource).toContain("ui.activeHomeSurface === 'inventory'")
  })
})
