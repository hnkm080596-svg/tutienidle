// B1-D - the result-bearing quit flush: close only on a 'saved' result
// bound to the PENDING request and the window's own webContents; a
// failed/blocked/timed-out attempt reports 'app:flush-failed' and waits
// on an explicit retry / cancel / force-close quoting its requestId.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQuitFlush } from './quitFlush'

function makeFixture() {
  const handlers = new Map<string, (event: unknown, payload: unknown) => void>()
  const ipcMain = {
    on: vi.fn((channel: string, listener: (event: unknown, payload: unknown) => void) => {
      handlers.set(channel, listener)
    }),
    removeListener: vi.fn(),
  }
  const webContents = { send: vi.fn() }
  const win = { webContents, close: vi.fn() }
  const event = { preventDefault: vi.fn() }
  let minted = 0
  const deps = {
    ipcMain,
    requestIdFactory: () => `req-${++minted}`,
    timeoutMs: 10_000,
  }
  return { ipcMain, handlers, win, webContents, event, deps, minted: () => minted }
}

describe('createQuitFlush — result-bearing close protocol', () => {
  afterEach(() => vi.useRealTimers())

  it('first close: preventDefault + a request-bound flush message; nothing closes yet', () => {
    const { ipcMain, win, webContents, event, deps } = makeFixture()
    const onClose = createQuitFlush(deps)

    onClose(win, event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(webContents.send).toHaveBeenCalledWith('app:before-quit-flush', { requestId: 'req-1' })
    expect(ipcMain.on).toHaveBeenCalledTimes(4) // result + retry + force + cancel
    expect(win.close).not.toHaveBeenCalled()
  })

  it('a saved result bound to the pending request closes exactly once', () => {
    const { ipcMain, handlers, win, webContents, event, deps } = makeFixture()
    const onClose = createQuitFlush(deps)

    onClose(win, event)
    handlers.get('app:flush-result')!(
      { sender: webContents },
      { requestId: 'req-1', generation: 0, status: 'saved', revision: 7 },
    )

    expect(win.close).toHaveBeenCalledTimes(1)

    // The re-entrant close (from win.close()) passes through unblocked.
    onClose(win, event)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(webContents.send).toHaveBeenCalledTimes(1)
  })

  it('a stale/mismatched requestId is ignored - late acks can never close', () => {
    vi.useFakeTimers()
    const { handlers, win, webContents, event, deps } = makeFixture()
    const onClose = createQuitFlush(deps)

    onClose(win, event)
    handlers.get('app:flush-result')!(
      { sender: webContents },
      { requestId: 'req-99', generation: 0, status: 'saved' },
    )

    expect(win.close).not.toHaveBeenCalled()
    expect(webContents.send).toHaveBeenCalledTimes(1)
  })

  it('a result from a foreign sender is ignored even with the right requestId', () => {
    const { handlers, win, event, deps } = makeFixture()
    const onClose = createQuitFlush(deps)

    onClose(win, event)
    handlers.get('app:flush-result')!(
      { sender: { send: vi.fn() } },
      { requestId: 'req-1', generation: 0, status: 'saved' },
    )

    expect(win.close).not.toHaveBeenCalled()
  })

  it('a failed/blocked result notifies the renderer and never closes', () => {
    const { handlers, win, webContents, event, deps } = makeFixture()
    const onClose = createQuitFlush(deps)

    onClose(win, event)
    handlers.get('app:flush-result')!(
      { sender: webContents },
      { requestId: 'req-1', generation: 0, status: 'blocked', code: 'AUTHORITY_REVOKED' },
    )

    expect(win.close).not.toHaveBeenCalled()
    expect(webContents.send).toHaveBeenLastCalledWith('app:flush-failed', {
      requestId: 'req-1',
      status: 'blocked',
      code: 'AUTHORITY_REVOKED',
    })
  })

  it('timeout notifies the renderer - it never closes the window', () => {
    vi.useFakeTimers()
    const { win, webContents, event, deps } = makeFixture()
    const onClose = createQuitFlush(deps)

    onClose(win, event)
    vi.advanceTimersByTime(10_000)

    expect(win.close).not.toHaveBeenCalled()
    expect(webContents.send).toHaveBeenLastCalledWith('app:flush-failed', {
      requestId: 'req-1',
      status: 'timeout',
      code: 'FLUSH_TIMEOUT',
    })
  })

  it('retry quoting the failed requestId issues a NEW request', () => {
    const { handlers, win, webContents, event, deps } = makeFixture()
    const onClose = createQuitFlush(deps)

    onClose(win, event)
    handlers.get('app:flush-result')!(
      { sender: webContents },
      { requestId: 'req-1', generation: 0, status: 'failed', code: 'FLUSH_FAILED' },
    )

    // A retry that quotes a wrong requestId is ignored.
    handlers.get('app:flush-retry')!({ sender: webContents }, { requestId: 'req-99' })
    expect(webContents.send).toHaveBeenCalledTimes(2)

    handlers.get('app:flush-retry')!({ sender: webContents }, { requestId: 'req-1' })
    expect(webContents.send).toHaveBeenLastCalledWith('app:before-quit-flush', { requestId: 'req-2' })

    // The retried request can then succeed.
    handlers.get('app:flush-result')!(
      { sender: webContents },
      { requestId: 'req-2', generation: 0, status: 'saved' },
    )
    expect(win.close).toHaveBeenCalledTimes(1)
  })

  it('force-close quoting the failed requestId closes; cancel clears the attempt', () => {
    const { handlers, win, webContents, event, deps } = makeFixture()
    const onClose = createQuitFlush(deps)

    onClose(win, event)
    handlers.get('app:flush-result')!(
      { sender: webContents },
      { requestId: 'req-1', generation: 0, status: 'failed', code: 'FLUSH_FAILED' },
    )

    handlers.get('app:force-close')!({ sender: webContents }, { requestId: 'req-99' })
    expect(win.close).not.toHaveBeenCalled()

    handlers.get('app:force-close')!({ sender: webContents }, { requestId: 'req-1' })
    expect(win.close).toHaveBeenCalledTimes(1)
  })

  it('a second close while a flush is pending stays blocked without re-sending', () => {
    const { win, webContents, event, deps } = makeFixture()
    const onClose = createQuitFlush(deps)

    onClose(win, event)
    onClose(win, event)

    expect(event.preventDefault).toHaveBeenCalledTimes(2)
    expect(webContents.send).toHaveBeenCalledTimes(1)
  })
})
