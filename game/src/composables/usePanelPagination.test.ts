// @vitest-environment jsdom
//
// Audit fix 2026-08-31 (H4) — usePanelPagination: container có thể nằm
// trong v-if/v-else nên KHÔNG tồn tại lúc onMounted (tab Hóa Luyện của
// EquipmentHallPanel chỉ render khi activeTab === 'dissolve'; LoreCodex
// grid chỉ render khi có items). Observer phải attach KHI ref containerEl
// được gán (bất kể lúc nào trong đời component), thay vì chỉ thử đúng 1
// lần ở mount — nếu không availableHeight kẹt 0 → pageSize = 1 vĩnh viễn.
//
// KHÔNG có @vue/test-utils trong devDeps → mount thủ công createApp
// (cùng pattern useStageActive.resultLifecycle.test.ts).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, createApp, h, nextTick, ref } from 'vue'
import { usePanelPagination } from './usePanelPagination'

// jsdom không có ResizeObserver thật — stub global bằng class mock:
// constructor giữ callback để test tự fire entry, observe/disconnect/
// unobserve là vi.fn(), static instances để lấy instance cuối.
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
        // Container như tab Hóa Luyện: chỉ tồn tại khi show = true.
        show.value ? h('div', { ref: containerEl }) : null,
        // Render pageSize ra text để assert không cần expose.
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

  it('container render SAU mount (v-if): pageSize fallback 1 → attach khi ref gán → callback cập nhật pageSize', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    MockResizeObserver.instances.length = 0

    const host = mountHost()

    // Chưa show container → availableHeight = 0 → pageSize fallback 1.
    expect(host.root.textContent).toBe('1')

    // Show container (như đổi sang tab Hóa Luyện) → ref gán → observer attach.
    host.show.value = true
    await nextTick()
    await nextTick()

    const observer = MockResizeObserver.instances.at(-1)

    expect(observer).toBeDefined()
    expect(observer!.observe).toHaveBeenCalledTimes(1)

    // Giả lập ResizeObserver entry: container cao 400px → floor(400/80) = 5.
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
