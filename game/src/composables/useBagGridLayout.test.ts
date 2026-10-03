// @vitest-environment jsdom
//
// Remediation Task 4 (2026-09-05) - useBagGridLayout do grid CHI tai
// onMounted: grid nam trong v-if/tab (nhu tab Hoa Luyen, EquipmentHall)
// se KHONG ton tai luc mount -> observer khong bao gio attach -> layout
// ket fallback MIN_COLUMNS/MIN_ROWS vinh vien du container render va
// resize sau do. Sua: watch gridRef (immediate) - disconnect observer cu
// khi ref doi, attach khi element moi xuat hien, cleanup khi unmount.
// Pattern mirror usePanelPagination (audit H4 2026-08-31 da sua cung
// loi cho list doc).
//
// KHONG co @vue/test-utils trong devDeps -> mount thu cong createApp
// (cung pattern usePanelPagination.test.ts).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { useBagGridLayout } from './useBagGridLayout'
import { GRID_GAP, MIN_COLUMNS, MIN_ROWS } from '@/core/ui/SlotSizes'

// jsdom khong co ResizeObserver that - stub global bang class mock
// (giong usePanelPagination.test.ts).
class MockResizeObserver {
  static instances: MockResizeObserver[] = []

  callback: ResizeObserverCallback
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    MockResizeObserver.instances.push(this)
  }
}

function fireLayout(entries: Array<{ width: number; height: number }>) {
  const observer = MockResizeObserver.instances.at(-1)

  if (!observer) {
    return
  }

  observer.callback(
    entries.map(
      (rect) => ({ contentRect: rect }) as unknown as ResizeObserverEntry,
    ),
    observer as unknown as ResizeObserver,
  )
}

function mountHost() {
  const show = ref(false)
  const observedWidths: number[] = []

  const container = document.createElement('div')

  document.body.appendChild(container)

  const app = createApp({
    setup() {
      const { gridRef, layout, pageSize, gridStyle } = useBagGridLayout()

      return () => {
        observedWidths.push(layout.value.columns)

        return [
          // Grid nhu tab bag: chi ton tai khi show = true.
          show.value ? h('div', { ref: gridRef }) : null,
          // Render layout ra text de assert khong can expose.
          h('div', `columns:${layout.value.columns};pageSize:${pageSize.value};style:${gridStyle.value['--grid-columns']}`),
        ]
      }
    },
  })

  app.mount(container)

  return {
    show,
    root: container,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

describe('useBagGridLayout — conditional mount (Remediation Task 4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('grid render SAU mount (v-if): trước đó observer không bao giờ attach — giờ layout cập nhật khi ref gán + callback fire', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    MockResizeObserver.instances.length = 0

    const host = mountHost()

    // Chua show -> layout fallback MIN.
    expect(host.root.textContent).toBe(
      `columns:${MIN_COLUMNS};pageSize:${MIN_COLUMNS * MIN_ROWS};style:${MIN_COLUMNS}`,
    )

    // Show grid (nhu mo tab bag) -> ref gan -> observer attach.
    host.show.value = true
    await nextTick()
    await nextTick()

    const observer = MockResizeObserver.instances.at(-1)

    expect(observer).toBeDefined()
    expect(observer!.observe).toHaveBeenCalledTimes(1)

    // Callback fire: container 600x200 -> layout tinh tu kich thuoc that.
    fireLayout([{ width: 600, height: 200 }])
    await nextTick()

    expect(host.root.textContent).not.toContain(`columns:${MIN_COLUMNS};`)
    expect(host.root.textContent).toContain(`style:`)

    host.unmount()
  })

  it('resize sau khi layout đã đo → columns/pageSize/style cập nhật lại', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    MockResizeObserver.instances.length = 0

    const host = mountHost()

    host.show.value = true
    await nextTick()
    await nextTick()

    fireLayout([{ width: 1600, height: 900 }])
    await nextTick()

    const wideText = host.root.textContent

    expect(wideText).not.toBe(
      `columns:${MIN_COLUMNS};pageSize:${MIN_COLUMNS * MIN_ROWS};style:${MIN_COLUMNS}`,
    )

    fireLayout([{ width: 200, height: 120 }])
    await nextTick()

    const narrowText = host.root.textContent

    expect(narrowText).not.toBe(wideText)

    host.unmount()
  })

  it('ref gán LẠI (grid unmount rồi remount): observer cũ disconnect, observer mới attach', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    MockResizeObserver.instances.length = 0

    const host = mountHost()

    host.show.value = true
    await nextTick()
    await nextTick()

    const first = MockResizeObserver.instances.at(-1)

    expect(first).toBeDefined()
    expect(first!.observe).toHaveBeenCalledTimes(1)

    // An roi hien lai -> ref null roi gan element moi.
    host.show.value = false
    await nextTick()
    await nextTick()

    expect(first!.disconnect).toHaveBeenCalled()

    host.show.value = true
    await nextTick()
    await nextTick()

    const second = MockResizeObserver.instances.at(-1)

    expect(second).toBeDefined()
    expect(second).not.toBe(first)
    expect(second!.observe).toHaveBeenCalledTimes(1)

    host.unmount()

    // Unmount cleanup: observer cuoi disconnect.
    expect(second!.disconnect).toHaveBeenCalled()
  })

  it('grid tồn tại NGAY từ mount (current behavior giữ nguyên): observer attach lúc mounted', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    MockResizeObserver.instances.length = 0

    const show = ref(true)
    const container = document.createElement('div')

    document.body.appendChild(container)

    const app = createApp({
      setup() {
        const { gridRef, layout } = useBagGridLayout()

        return () => [
          h('div', { ref: gridRef }),
          h('div', `gap:${layout.value.gap}`),
        ]
      },
    })

    app.mount(container)

    await nextTick()
    await nextTick()

    const observer = MockResizeObserver.instances.at(-1)

    expect(observer).toBeDefined()
    expect(observer!.observe).toHaveBeenCalledTimes(1)

    fireLayout([{ width: 900, height: 500 }])
    await nextTick()

    expect(container.textContent).toContain(`gap:${GRID_GAP}`)

    app.unmount()
    container.remove()
  })
})
