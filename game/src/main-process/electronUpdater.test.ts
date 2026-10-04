// BETA-FINAL PR12 / spec B6 - the electron-updater adapter: normalized
// Provider results, error classification, progress forwarding, and the
// safety flags (never auto-download, never auto-install on quit, no
// downgrade). The updater object is faked - this file is what keeps the
// mapping provable without a running Electron.
import { describe, expect, it, vi } from 'vitest'
import { createElectronUpdateProvider, type AutoUpdaterLike } from './electronUpdater'

interface FakeUpdater extends AutoUpdaterLike {
  events: Map<string, (...args: unknown[]) => void>
  checkImpl: () => Promise<unknown>
  downloadImpl: (token?: unknown) => Promise<unknown>
  quitCalls: number
}

function makeAutoUpdater(): FakeUpdater {
  const events = new Map<string, (...args: unknown[]) => void>()
  return {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    allowDowngrade: true,
    allowPrerelease: false,
    events,
    checkImpl: async () => ({ isUpdateAvailable: false, updateInfo: null }),
    downloadImpl: async () => ['/tmp/x.exe'],
    quitCalls: 0,
    on(event: string, listener: (...args: unknown[]) => void) {
      events.set(event, listener)
      return this
    },
    checkForUpdates() {
      return this.checkImpl()
    },
    downloadUpdate(token?: unknown) {
      this.lastToken = token
      return this.downloadImpl(token)
    },
    quitAndInstall() {
      this.quitCalls += 1
    },
  } as FakeUpdater & { lastToken?: unknown }
}

const CANCEL_TOKEN = { cancel: vi.fn() }

describe('createElectronUpdateProvider', () => {
  it('sets the safety flags: no silent download, no quit-bypass install, no downgrade', () => {
    const updater = makeAutoUpdater()
    createElectronUpdateProvider(updater, () => CANCEL_TOKEN)
    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(false)
    expect(updater.allowDowngrade).toBe(false)
    expect(updater.allowPrerelease).toBe(true)
  })

  it('check maps a real update into a normalized candidate', async () => {
    const updater = makeAutoUpdater()
    updater.checkImpl = async () => ({
      isUpdateAvailable: true,
      updateInfo: {
        version: '0.2.0-beta.0',
        files: [{ url: 'x.exe', sha512: 'abc=' }],
        releaseName: 'Beta',
        releaseNotes: [{ note: 'a' }, { note: 'b' }],
        releaseDate: '2026-09-30',
      },
    })
    const provider = createElectronUpdateProvider(updater, () => CANCEL_TOKEN)
    const result = await provider.check()
    expect(result).toEqual({
      status: 'available',
      info: {
        version: '0.2.0-beta.0',
        files: [{ url: 'x.exe', sha512: 'abc=' }],
        releaseName: 'Beta',
        releaseNotes: 'a\n\nb',
        releaseDate: '2026-09-30',
      },
    })
  })

  it('check maps no-update and errors to classified results', async () => {
    const updater = makeAutoUpdater()
    const provider = createElectronUpdateProvider(updater, () => CANCEL_TOKEN)
    expect(await provider.check()).toEqual({ status: 'none' })

    updater.checkImpl = async () => { throw new Error('ETIMEDOUT') }
    expect(await provider.check()).toMatchObject({ status: 'error', code: 'CHECK_FAILED', retryable: true })

    updater.checkImpl = async () => ({ isUpdateAvailable: true, updateInfo: {} })
    expect(await provider.check()).toMatchObject({ status: 'error', code: 'MANIFEST_INVALID' })
  })

  it('download resolves on verified bytes and classifies failures', async () => {
    const updater = makeAutoUpdater()
    const provider = createElectronUpdateProvider(updater, () => CANCEL_TOKEN)
    expect(await provider.download()).toEqual({ status: 'downloaded' })

    updater.downloadImpl = async () => { throw new Error('sha512 checksum mismatch') }
    expect(await provider.download()).toMatchObject({ code: 'CANDIDATE_CORRUPT' })

    updater.downloadImpl = async () => { throw new Error('cancelled by user') }
    expect(await provider.download()).toMatchObject({ code: 'DOWNLOAD_CANCELLED' })

    updater.downloadImpl = async () => { throw new Error('ECONNRESET') }
    expect(await provider.download()).toMatchObject({ code: 'DOWNLOAD_FAILED' })
  })

  it('cancelDownload cancels the token passed to downloadUpdate', async () => {
    const updater = makeAutoUpdater()
    const provider = createElectronUpdateProvider(updater, () => CANCEL_TOKEN)
    let resolveDl!: (v: unknown) => void
    updater.downloadImpl = () => new Promise((r) => { resolveDl = r })
    const pending = provider.download()
    provider.cancelDownload()
    expect(CANCEL_TOKEN.cancel).toHaveBeenCalledTimes(1)
    resolveDl([])
    await pending
  })

  it('forwards download-progress events to progress listeners', () => {
    const updater = makeAutoUpdater()
    const provider = createElectronUpdateProvider(updater, () => CANCEL_TOKEN)
    const seen: number[] = []
    provider.onProgress((p) => seen.push(p.percent))
    updater.events.get('download-progress')!({ percent: 40 })
    updater.events.get('download-progress')!({ percent: 80 })
    expect(seen).toEqual([40, 80])
  })

  it('quitAndInstall delegates to the updater', () => {
    const updater = makeAutoUpdater()
    const provider = createElectronUpdateProvider(updater, () => CANCEL_TOKEN)
    provider.quitAndInstall()
    expect(updater.quitCalls).toBe(1)
  })
})
