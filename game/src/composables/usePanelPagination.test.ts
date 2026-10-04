// @vitest-environment jsdom
//
// Audit fix 2026-08-31 (H4) - usePanelPagination: container co the nam
// trong v-if/v-else nen KHONG ton tai luc onMounted (tab Hoa Luyen cua
// EquipmentHallPanel chi render khi activeTab === 'dissolve'; LoreCodex
// grid chi render khi co items). Observer phai attach KHI ref containerEl
// duoc gan (bat ke luc nao trong doi component), thay vi chi thu dung 1
// lan o mount - neu khong availableHeight ket 0 -> pageSize = 1 vinh vien.
//
// KHONG co @vue/test-utils trong devDeps -> mount thu cong createApp
// (cung pattern useStageActive.resultLifecycle.test.ts).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, createApp, h, nextTick, ref } from 'vue'
import { usePanelPagination } from './usePanelPagination'

// jsdom khong co ResizeObserver that - stub global bang class mock:
// constructor giu callback de test tu fire entry, observe/disconnect/
// unobserve la vi.fn(), static instances de lay instance cuoi.
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

function mountHost() {
  const show = ref(false)

  const container = document.createElement('div')

  document.body.appendChild(container)

  const app = createApp({
    setup() {
      const rowCount = computed(() => 100)
      const { containerEl, pageSize } = usePanelPagination(rowCount, 80)

      return () => [
        // Container nhu tab Hoa Luyen: chi ton tai khi show = true.
        show.value ? h('div', { ref: containerEl }) : null,
        // Render pageSize ra text de assert khong can expose.
        h('div', String(pageSize.value)),
      ]
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

describe('usePanelPagination — attach observer reactive (H4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('container render SAU mount (v-if): pageSize fallback 6 (T2.3 — từng fallback 1 gây "chỉ show đúng 1 món") → attach khi ref gán → callback cập nhật pageSize', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    MockResizeObserver.instances.length = 0

    const host = mountHost()

    // Chua show container -> availableHeight = 0 -> pageSize fallback 6
    // (T2.3 2026-09-01: fallback 1 khien grid overflow:hidden giau
    // toan bo items ngoai trang 1 khi observer chua fire).
    expect(host.root.textContent).toBe('6')

    // Show container (nhu doi sang tab Hoa Luyen) -> ref gan -> observer attach.
    host.show.value = true
    await nextTick()
    await nextTick()

    const observer = MockResizeObserver.instances.at(-1)

    expect(observer).toBeDefined()
    expect(observer!.observe).toHaveBeenCalledTimes(1)

    // Gia lap ResizeObserver entry: container cao 400px -> floor(400/80) = 5.
    observer!.callback(
      [{ contentRect: { height: 400 } } as unknown as ResizeObserverEntry],
      observer as unknown as ResizeObserver,
    )
    await nextTick()

    expect(host.root.textContent).toBe('5')

    host.unmount()
  })

  it('unmount: observer được disconnect', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    MockResizeObserver.instances.length = 0

    const host = mountHost()

    host.show.value = true
    await nextTick()
    await nextTick()

    const observer = MockResizeObserver.instances.at(-1)

    expect(observer).toBeDefined()

    host.unmount()

    expect(observer!.disconnect).toHaveBeenCalled()
  })
})
