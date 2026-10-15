// @vitest-environment jsdom
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import GamePanel from '../../src/components/common/GamePanel.vue'
import { AudioManager } from '../../src/core/audio/AudioManager'
import { i18n } from '../../src/i18n'
import { playUiButtonClick } from '../../src/presentation/audio/buttonClickAudio'

const SRC_ROOT = resolve(__dirname, '../../src')

function collectVueFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      results.push(...collectVueFiles(full))
    } else if (entry.endsWith('.vue')) {
      results.push(full)
    }
  }
  return results
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Phase 3 Slice 3.6: UI Primitive Consolidation & Header Authority', () => {
  it('playUiButtonClick plays click audio by default and suppresses when sound=false or silent=true', () => {
    const audio = AudioManager.getInstance()
    const unlockSpy = vi.spyOn(audio, 'unlock').mockImplementation(() => {})
    const spy = vi.spyOn(audio, 'playCue').mockImplementation(() => {})
    try {
      playUiButtonClick()
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenLastCalledWith('ui.click')

      playUiButtonClick({ sound: true, silent: false })
      expect(spy).toHaveBeenCalledTimes(2)

      playUiButtonClick({ sound: false })
      expect(spy).toHaveBeenCalledTimes(2)

      playUiButtonClick({ silent: true })
      expect(spy).toHaveBeenCalledTimes(2)
    } finally {
      unlockSpy.mockRestore()
      spy.mockRestore()
    }
  })

  it('all canonical UI button primitives support sound/silent props and route through playUiButtonClick', () => {
    const directButtonFiles = [
      'components/common/GameButton.vue',
      'components/common/art/OrnateButton.vue',
      'components/common/art/EquipmentArtButton.vue',
      'components/common/GameTabButton.vue',
      'components/common/PcPaperButton.vue',
      'components/scenes/combat/CombatControlButton.vue',
    ]

    for (const relPath of directButtonFiles) {
      const content = readFileSync(join(SRC_ROOT, relPath), 'utf8')
      expect(content, `${relPath} must import playUiButtonClick`).toContain('playUiButtonClick')
      expect(content, `${relPath} must declare sound prop`).toMatch(/sound\??:\s*boolean/)
      expect(content, `${relPath} must declare silent prop`).toMatch(/silent\??:\s*boolean/)
    }

    const actionBtnContent = readFileSync(
      join(SRC_ROOT, 'components/common/GameActionButton.vue'),
      'utf8',
    )
    expect(actionBtnContent).toMatch(/sound\??:\s*boolean/)
    expect(actionBtnContent).toMatch(/silent\??:\s*boolean/)
    expect(actionBtnContent).toContain(':sound="sound"')
    expect(actionBtnContent).toContain(':silent="silent"')
  })

  it('removes redundant card and panel wrapper components (D8)', () => {
    const removedFiles = [
      'components/common/art/EquipmentArtCard.vue',
      'components/common/RailPanelDialog.vue',
      'components/common/RailPanelChrome.vue',
      'components/common/system/SysPanel.vue',
    ]

    for (const relPath of removedFiles) {
      expect(
        existsSync(join(SRC_ROOT, relPath)),
        `${relPath} should be consolidated and removed`,
      ).toBe(false)
    }
  })

  it('GamePanel supports dialog mode and renders rail-panel-dialog chrome when dialog=true', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const onClose = vi.fn()
    const app = createApp({
      render: () =>
        h(
          GamePanel,
          {
            dialog: true,
            open: true,
            layer: 3100,
            title: 'Test Dialog',
            closable: true,
            onClose,
          },
          {
            default: () => h('div', { class: 'dialog-body' }, 'Dialog Content'),
          },
        ),
    })
    app.use(i18n)
    app.mount(host)
    await nextTick()

    const dialogOverlay = document.body.querySelector<HTMLElement>('.rail-panel-dialog')
    expect(dialogOverlay).not.toBeNull()
    const viewport = document.body.querySelector<HTMLElement>('.scene-viewport')
    expect(viewport?.getAttribute('style')).toContain('z-index: 3100')
    expect(document.body.querySelector('.game-panel__title')?.textContent).toBe('Test Dialog')
    expect(document.body.querySelector('.dialog-body')?.textContent).toBe('Dialog Content')

    dialogOverlay?.click()
    await nextTick()
    expect(onClose).toHaveBeenCalledTimes(1)
    app.unmount()
  })

  it('forbids duplicate header-hiding :deep(.game-panel__content ...) hacks in components (V5)', () => {
    const vueFiles = collectVueFiles(join(SRC_ROOT, 'components'))
    const offenders: string[] = []

    for (const file of vueFiles) {
      const content = readFileSync(file, 'utf8')
      if (/\.game-panel__content[^{]*\{[^}]*display:\s*none/s.test(content)) {
        offenders.push(relative(SRC_ROOT, file).replace(/\\/g, '/'))
      }
    }

    expect(offenders).toEqual([])
  })
})
