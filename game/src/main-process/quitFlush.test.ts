// B1 — quit-flush close handler: the renderer save is requested once per
// window; a second 'close' during the flush window stays blocked but must
// not re-send the request or stack a second flush-complete listener
// (audit T6-52).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQuitFlush, FLUSH_TIMEOUT_MS } from './quitFlush'

function makeFixture() {
  const listeners: Array<() => void> = []
  const ipcMain = {
    once: vi.fn((_channel: string, listener: () => void) => { listeners.push(listener) }),
    removeListener: vi.fn((_channel: string, listener: () => void) => {
      const index = listeners.indexOf(listener)
      if (index >= 0) listeners.splice(index, 1)
    }),
  }
  const win = { webContents: { send: vi.fn() }, close: vi.fn() }
  const event = { preventDefault: vi.fn() }
  return { ipcMain, listeners, win, event }
}

describe('createQuitFlush — close handler', () => {
  afterEach(() => vi.useRealTimers())

  it('first close: preventDefault + one flush request + one listener; nothing closes yet', () => {
    const { ipcMain, listeners, win, event } = makeFixture()
    const onClose = createQuitFlush({ ipcMain })

    onClose(win, event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(win.webContents.send).toHaveBeenCalledTimes(1)
    expect(win.webContents.send).toHaveBeenCalledWith('app:before-quit-flush')
    expect(ipcMain.once).toHaveBeenCalledTimes(1)
    expect(listeners).toHaveLength(1)
    expect(win.close).not.toHaveBeenCalled()
  })

  it('second close while flush is in-flight: still blocked, but NO duplicate send/listener (T6-52)', () => {
    vi.useFakeTimers()
    const { ipcMain, listeners, win, event } = makeFixture()
    const onClose = createQuitFlush({ ipcMain })

    onClose(win, event)
    onClose(win, event)

    // The user close is still held (preventDefault again) — but the renderer
    // save must not be re-triggered and no second flush-complete listener may
    // be registered.
    expect(event.preventDefault).toHaveBeenCalledTimes(2)
    expect(win.webContents.send).toHaveBeenCalledTimes(1)
    expect(ipcMain.once).toHaveBeenCalledTimes(1)
    expect(listeners).toHaveLength(1)
  })

  it('flush-complete → win.close() re-enters close and passes through (no preventDefault/send)', () => {
    const { ipcMain, listeners, win, event } = makeFixture()
    const onClose = createQuitFlush({ ipcMain })

    onClose(win, event)
    listeners[0]!() // renderer acked

    expect(win.close).toHaveBeenCalledTimes(1)
    expect(listeners).toHaveLength(0) // removeListener ran

    // Simulated re-entrant close from win.close(): already-flushed → return early.
    onClose(win, event)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(win.webContents.send).toHaveBeenCalledTimes(1)
  })

  it('timeout backstop finishes the flush when the renderer never acks', () => {
    vi.useFakeTimers()
    const { ipcMain, win, event } = makeFixture()
    const onClose = createQuitFlush({ ipcMain })

    onClose(win, event)
    vi.advanceTimersByTime(FLUSH_TIMEOUT_MS)

    expect(win.close).toHaveBeenCalledTimes(1)
  })
})
