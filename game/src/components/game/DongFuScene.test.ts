// @vitest-environment jsdom
//
// Art base Động Phủ (yêu cầu 2026-08-26): thanh-van-dong-fu-base.png
// phải được mount TRỰC TIẾP trong DongFuScene.vue làm lớp nền cover-fit
// — trước đây mount ở Phaser MainScene.ts nhưng bị overlay DOM opaque
// của chính component này che kín. Test chặn 2 lớp:
// 1. Template render đúng ảnh, ở VỊ TRÍ đúng thứ tự (trên fallback CSS,
//    dưới nội dung).
// 2. File asset tồn tại trên đĩa + là PNG hợp lệ.
/// <reference types="node" />
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import DongFuScene from './DongFuScene.vue'
import { GameManager } from '@/core/game/GameManager'
import {
  BUMP_STATE_KEY,
  GAME_MANAGER_KEY,
  STATE_VERSION_KEY,
} from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'

const BASE_URL = '/assets/backgrounds/dong-fu/thanh-van-dong-fu-master-buildings-v1.png'

// Stub fetch — AtlasSprite con tự tải idle.json lúc mount; jsdom không
// có server dev nên phải giả response rỗng (frames: [] → không chạy timer).
vi.stubGlobal(
  'fetch',
  vi.fn(() =>
    Promise.resolve({
      ok: true,

      json: () => Promise.resolve({ textures: [{ image: '', size: { w: 1, h: 1 }, frames: [] }] }),
    }),
  ),
)

function mountDongFuScene() {
  const container = document.createElement('div')

  document.body.appendChild(container)

  const gameManager = new GameManager()

  const app = createApp({ render: () => h(DongFuScene) })

  const pinia = createPinia()

  app.use(pinia)

  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})

  app.mount(container)

  return {
    ui: useUiStore(pinia),

    html: () => container.innerHTML,

    baseImage: () => container.querySelector('img.home-scene__base') as HTMLImageElement | null,

    playerTrigger: () =>
      container.querySelector<HTMLButtonElement>('.home-player__trigger'),

    unmount: () => {
      app.unmount()

      container.remove()
    },
  }
}

describe('DongFuScene — art base mount', () => {
  it('render img base với đúng đường dẫn asset', () => {
    const mounted = mountDongFuScene()

    const img = mounted.baseImage()

    expect(img).not.toBeNull()
    expect(img!.getAttribute('src')).toBe(BASE_URL)
    expect(img!.getAttribute('alt')).toBe('')
    expect(img!.getAttribute('draggable')).toBe('false')

    mounted.unmount()
  })

  it('base nằm TRÊN các lớp fallback CSS và DƯỚI nội dung (DOM order)', () => {
    const mounted = mountDongFuScene()

    const sceneRoot = document.querySelector('.home-scene')!

    const children = Array.from(sceneRoot.children).map((el) => el.className)

    // Fallback gradient cũ đứng TRƯỚC img; linhnhan/motes/player/vignette
    // đứng SAU để vẽ đè lên art.
    expect(children.indexOf('home-scene__ground')).toBeLessThan(
      children.indexOf('home-scene__base'),
    )
    expect(children.indexOf('home-scene__mountains')).toBeLessThan(
      children.indexOf('home-scene__base'),
    )
    expect(children.indexOf('home-scene__base')).toBeLessThan(
      children.indexOf('home-linhnhan'),
    )
    expect(children.indexOf('home-scene__base')).toBeLessThan(
      children.indexOf('home-motes'),
    )
    expect(children.indexOf('home-scene__base')).toBeLessThan(
      children.indexOf('home-player'),
    )

    mounted.unmount()
  })

  it('CSS source khai báo cover-fit full-viewport cho base', () => {
    // jsdom không áp dụng <style scoped> vào computed style — assert
    // trực tiếp trên nguồn SFC thay vì getComputedStyle.
    const source = readFileSync(resolve(__dirname, 'DongFuScene.vue'), 'utf8')

    const cssBlock = source.slice(source.indexOf('.home-scene__base'), source.indexOf('.home-scene__vignette'))

    expect(cssBlock).toContain('position: absolute')
    expect(cssBlock).toContain('object-fit: cover')
    expect(cssBlock).toContain('width: 100%')
    expect(cssBlock).toContain('height: 100%')
  })

  it('trigger nhân vật bật lại hit-test và click toggle command wheel', async () => {
    const mounted = mountDongFuScene()
    const source = readFileSync(resolve(__dirname, 'DongFuScene.vue'), 'utf8')
    const triggerCss = source.slice(
      source.indexOf('.home-player__trigger {'),
      source.indexOf('.home-player__trigger:focus-visible'),
    )

    expect(triggerCss).toContain('pointer-events: auto')
    expect(mounted.ui.isCommandWheelOpen).toBe(false)

    mounted.playerTrigger()!.click()

    expect(mounted.ui.isCommandWheelOpen).toBe(true)

    mounted.unmount()
  })

  it('asset tồn tại trên đĩa và là PNG hợp lệ', () => {
    const filePath = resolve(__dirname, '../../../public/assets/backgrounds/dong-fu/thanh-van-dong-fu-base.png')

    const buffer = readFileSync(filePath)

    expect(buffer.length).toBeGreaterThan(1_000_000)

    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A.
    expect([...buffer.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  })
})
