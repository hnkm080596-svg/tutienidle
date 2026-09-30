// BETA-FINAL PR12 / spec B6 - the real version-to-version signed-candidate
// update journey. This is the one piece of the updater that cannot be
// proven in-process: it needs an installed SIGNED old beta candidate and a
// live restricted feed carrying the next signed candidate.
//
// Env contract (repo idiom: infra absence is a failure, never a skip):
//   TID_UPDATE_OLD_APP       absolute path to the installed OLD signed
//                            beta build (the binary under test).
//   TID_UPDATE_EXPECTED_BUILD_ID  the buildId the update installs - the
//                            'installedBuild.buildId === nextManifest.buildId'
//                            acceptance.
//   TID_UPDATE_USERDATA      writable dir the app's main process is pointed
//                            at (TID_USERDATA_DIR seam) so saves + diagnostics
//                            land in a known place.
//   TID_UPDATE_ACCOUNT_ID    expected localStorage save key suffix (the
//                            Supabase userId the seeded save belongs to) so
//                            the continuity check reads the right slot.
//
// What is proven IN-PROCESS (vitest) instead, because it needs no signing:
//   expect(installCallsForFailedFlush).toBe(0)       UpdateService.test.ts
//   expect(installCallsForStaleGeneration).toBe(0)   UpdateService.test.ts
//   the check/download rejection taxonomy + sender/requestId/generation
//   binding, feed/publisher pinning, install timeout + cancellation.
//
// NOTE: this spec file lives under playwright.electron.config.ts's
// testDir and is NOT part of `npm run verify` (vitest globs exclude it).
import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'

interface UpdateE2EEnv {
  oldApp: string
  expectedBuildId: string
  userData: string
  accountId: string
}

function loadUpdateE2EEnv(): UpdateE2EEnv {
  const required = [
    'TID_UPDATE_OLD_APP',
    'TID_UPDATE_EXPECTED_BUILD_ID',
    'TID_UPDATE_USERDATA',
    'TID_UPDATE_ACCOUNT_ID',
  ]
  const missing = required.filter((k) => !process.env[k])
  if (missing.length) {
    throw new Error(
      `update e2e env incomplete: missing ${missing.join(', ')}. ` +
        'This spec needs an installed SIGNED old beta candidate + the live beta feed; ' +
        'unsigned/dev builds are proven by the vitest suite instead.',
    )
  }
  return {
    oldApp: process.env.TID_UPDATE_OLD_APP!,
    expectedBuildId: process.env.TID_UPDATE_EXPECTED_BUILD_ID!,
    userData: process.env.TID_UPDATE_USERDATA!,
    accountId: process.env.TID_UPDATE_ACCOUNT_ID!,
  }
}

/** The running build id the app logs at boot:
 *  `[build] <product> <version> build=<id> sha=<sha> ...` */
function readBuildId(buffer: string[]): string | null {
  for (const line of buffer) {
    const m = /\[build\].*\bbuild=([^\s]+)/.exec(line)
    if (m) return m[1]!
  }
  return null
}

async function launch(env: UpdateE2EEnv, stdout: string[]): Promise<ElectronApplication> {
  const app = await electron.launch({
    executablePath: env.oldApp,
    args: [],
    env: { ...process.env, TID_USERDATA_DIR: env.userData },
  })
  app.process().stdout?.on('data', (chunk: Buffer | string) => stdout.push(String(chunk)))
  app.process().stderr?.on('data', (chunk: Buffer | string) => stdout.push(String(chunk)))
  return app
}

/** Reads `tien-hiep-idle-save:<accountId>` from the app's localStorage via the
 *  page bridge (same bytes writeGameSave wrote). */
async function readCharacterIdentity(window: Awaited<ReturnType<ElectronApplication['firstWindow']>>, accountId: string) {
  return window.evaluate((key) => {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    try {
      const save = JSON.parse(raw) as { player?: { name?: string; realmId?: string; realmLevel?: number } }
      return save.player
        ? { name: save.player.name ?? null, realmId: save.player.realmId ?? null, realmLevel: save.player.realmLevel ?? null }
        : null
    } catch {
      return null
    }
  }, `tien-hiep-idle-save:${accountId}`)
}

test.describe('beta update journey (signed candidates)', () => {
  test('old signed beta checks the feed, installs after a saved flush, relaunches as the new build with the save intact', async () => {
    const env = loadUpdateE2EEnv()
    const stdout: string[] = []
    const app = await launch(env, stdout)

    let characterBeforeUpdate: { name: string | null; realmId: string | null; realmLevel: number | null } | null = null
    try {
      const window = await app.firstWindow()
      characterBeforeUpdate = await readCharacterIdentity(window, env.accountId)

      // The boot check runs at did-finish-load; a verified beta candidate
      // surfaces as the update banner.
      const banner = window.getByTestId('update-banner')
      await expect(banner).toBeVisible()
      await banner.getByRole('button').first().click() // download

      // downloaded -> install offer; clicking Install runs the admission
      // gate (pause sim, drain flush, generation+requestId bind) before
      // quitAndInstall. The process then exits for the installer.
      await expect(banner).toBeVisible()
      await banner.getByRole('button').first().click() // install

      // quitAndInstall exits the app: wait for the close event.
      await new Promise<void>((resolve) => {
        if ((app as unknown as { isClosed?: () => boolean }).isClosed?.()) resolve()
        app.once('close', () => resolve())
        setTimeout(resolve, 60_000)
      })
    } finally {
      await app.close().catch(() => {})
    }

    // Relaunch the same executable path - it now resolves to the NEW build.
    const relaunchStdout: string[] = []
    const updated = await launch(env, relaunchStdout)
    try {
      const window = await updated.firstWindow()
      await expect(window.locator('body')).toBeVisible()

      // installedBuild.buildId === nextManifest.buildId: the relaunched
      // binary logs the injected identity of the NEW build.
      await expect
        .poll(() => readBuildId(relaunchStdout), { timeout: 30_000 })
        .toBe(env.expectedBuildId)

      // restoredCharacter === characterBeforeUpdate: the save survived.
      await expect
        .poll(() => readCharacterIdentity(window, env.accountId))
        .toEqual(characterBeforeUpdate)
    } finally {
      await updated.close().catch(() => {})
    }
  })
})
