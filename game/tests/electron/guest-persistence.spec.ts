// B1.8 (BETA-FINAL PR6) - durable guest identity across REAL Electron
// process restarts. Each spec drives actual app processes (launch ->
// close -> relaunch against the same --user-data-dir) with GoTrue and
// PostgREST network-stubbed at the context layer: no staging credentials,
// no production-code seams - the credential file under the REAL
// app.getPath('userData') is asserted from the outside.
//
// Covered: encrypted refresh credential persisted/restored, rotated
// refresh token write-through, rejected (terminal) token clearing the
// credential, transient refresh failure retaining it, and the
// pending-confirm finalize replayed after interruption.
import { expect, test, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SESSION_KEY = 'tien-hiep-idle-auth-session'
const CREDENTIAL_NAME = 'guest-credential.bin'

// ---------------------------------------------------------------------------
// Stubbed Supabase surface - one mutable scenario per launched process.
// ---------------------------------------------------------------------------

interface StubScenario {
  userId: string
  refreshStatus: number
  finalizeVerdict: { status: string; code?: string; loginId?: string }
  signupCalls: number
  refreshCalls: number
  finalizeCalls: number
  lastRefreshToken?: string
  tokenCounter: number
  sessionCounter: number
}

function newScenario(userId = 'u-guest-1'): StubScenario {
  return {
    userId,
    refreshStatus: 200,
    finalizeVerdict: { status: 'PENDING_CONFIRMATION' },
    signupCalls: 0,
    refreshCalls: 0,
    finalizeCalls: 0,
    tokenCounter: 0,
    sessionCounter: 0,
  }
}

async function installSupabaseStub(app: ElectronApplication, scenario: StubScenario): Promise<void> {
  const context = app.context()

  const json = (body: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  })

  await context.route(/supabase\.test/, async (route) => {
    const request = route.request()
    const url = request.url()

    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': '*', 'access-control-allow-headers': '*' },
        body: '',
      })
      return
    }

    if (url.includes('/auth/v1/signup')) {
      scenario.signupCalls += 1
      await route.fulfill(json({
        access_token: `at-signup-${++scenario.tokenCounter}`,
        refresh_token: `rt-signup-${scenario.tokenCounter}`,
        expires_in: 3600,
        user: { id: scenario.userId },
      }))
      return
    }

    if (url.includes('grant_type=refresh_token')) {
      scenario.refreshCalls += 1
      scenario.lastRefreshToken = request.postDataJSON()?.refresh_token
      if (scenario.refreshStatus !== 200) {
        await route.fulfill(json({ error: 'refresh rejected' }, scenario.refreshStatus))
        return
      }
      await route.fulfill(json({
        access_token: `at-refresh-${++scenario.tokenCounter}`,
        refresh_token: `rt-refresh-${scenario.tokenCounter}`,
        expires_in: 3600,
        user: { id: scenario.userId },
      }))
      return
    }

    if (url.includes('/auth/v1/user')) {
      await route.fulfill(json({ id: scenario.userId }))
      return
    }

    if (url.includes('/auth/v1/logout')) {
      await route.fulfill(json({}))
      return
    }

    if (url.includes('/rest/v1/rpc/claim_active_session')) {
      await route.fulfill(json({
        status: 'ADMITTED',
        sessionId: `gs-${++scenario.sessionCounter}`,
        protocolVersion: 1,
        serverTimeUtc: new Date().toISOString(),
      }))
      return
    }

    if (url.includes('/rest/v1/rpc/load_game_state')) {
      await route.fulfill(json({ status: 'NO_CHARACTER' }))
      return
    }

    if (url.includes('/rest/v1/rpc/finalize_guest_upgrade')) {
      scenario.finalizeCalls += 1
      await route.fulfill(json(scenario.finalizeVerdict))
      return
    }

    await route.fulfill(json({ status: 'ACTIVE' }))
  })
}

// ---------------------------------------------------------------------------
// Process lifecycle helpers
// ---------------------------------------------------------------------------

interface LaunchResult {
  app: ElectronApplication
  page: Page
  userDataDir: string
  credentialPath: string
}

async function launchGame(userDataDir: string): Promise<LaunchResult> {
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: gameRoot,
    // TUTIEN_E2E_CREDENTIAL_CIPHER=e2e: headless CI ships no OS keyring,
    // so main.ts substitutes the cipher primitive while keeping the real
    // store/IPC/disk path (see electron/main.ts). The file is asserted
    // non-plaintext below either way.
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0', TUTIEN_E2E_CREDENTIAL_CIPHER: 'e2e' },
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { app, page, userDataDir, credentialPath: path.join(userDataDir, CREDENTIAL_NAME) }
}

/** Hard process exit - the honest power-loss/restart path; a graceful
 *  app.quit() would route through the quit-flush dialog instead. */
async function killGame(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => undefined)
  await app.close().catch(() => undefined)
}

function makeUserDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tutien-e2e-userdata-'))
}

/** sessionStorage session slot as the renderer sees it (null when absent). */
async function storedSession(page: Page): Promise<{ userId?: string; mode?: string; refreshToken?: string } | null> {
  return page.evaluate((key) => {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  }, SESSION_KEY)
}

/** Continue button once the auth card has settled (intro + resume probe). */
async function continueButton(page: Page) {
  const button = page.locator('[data-testid="auth-continue-button"]')
  await button.waitFor({ state: 'visible' })
  return button
}

async function guestButton(page: Page) {
  const button = page.locator('[data-testid="auth-guest-button"]')
  await button.waitFor({ state: 'visible' })
  return button
}

async function waitForCredentialFile(credentialPath: string): Promise<void> {
  await expect.poll(() => fs.existsSync(credentialPath)).toBe(true)
}

/** Decodes the TUTIEN_E2E_CREDENTIAL_CIPHER='e2e' format (base64 of
 *  'e2e:<json>') into the record - spec-only view used to assert exactly
 *  which credential bytes reached disk. Real safeStorage bytes are opaque
 *  to us; under the e2e cipher this is the on-disk truth. */
function readE2eCredential(credentialPath: string): Record<string, unknown> | null {
  try {
    const decoded = Buffer.from(fs.readFileSync(credentialPath).toString('utf8'), 'base64').toString('utf8')
    if (!decoded.startsWith('e2e:')) return null
    return JSON.parse(decoded.slice(4)) as Record<string, unknown>
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

test.describe('guest persistence across process restarts', () => {
  test('guest credential is encrypted at rest and the same userId resumes after relaunch', async () => {
    const userDataDir = makeUserDataDir()
    const scenario = newScenario()

    const first = await launchGame(userDataDir)
    await installSupabaseStub(first.app, scenario)

    await (await guestButton(first.page)).click()
    await expect.poll(async () => (await storedSession(first.page))?.userId).toBe('u-guest-1')

    // The durable record exists and is NOT plaintext (safeStorage boundary).
    await waitForCredentialFile(first.credentialPath)
    const bytes = fs.readFileSync(first.credentialPath)
    expect(bytes.toString('utf8')).not.toContain('rt-signup')
    expect(bytes.toString('utf8')).not.toContain('refreshToken')

    const firstUserId = (await storedSession(first.page))?.userId
    await killGame(first.app)

    // Relaunch: the durable credential must mint the SAME user identity.
    const second = await launchGame(userDataDir)
    const scenario2 = newScenario()
    await installSupabaseStub(second.app, scenario2)

    await (await continueButton(second.page)).click()
    await expect.poll(async () => (await storedSession(second.page))?.userId).toBe('u-guest-1')

    // The durable refresh credential was used (never a new anonymous signup).
    expect(scenario2.lastRefreshToken).toBe('rt-signup-1')
    expect(scenario2.signupCalls).toBe(0)

    const reopened = await storedSession(second.page)
    expect(reopened?.userId).toBe(firstUserId)
    expect(reopened?.mode).toBe('guest')

    await killGame(second.app)
    fs.rmSync(userDataDir, { recursive: true, force: true })
  })

  test('a rotated refresh token is persisted back to the durable record', async () => {
    const userDataDir = makeUserDataDir()

    const first = await launchGame(userDataDir)
    await installSupabaseStub(first.app, newScenario())
    await (await guestButton(first.page)).click()
    await waitForCredentialFile(first.credentialPath)
    await expect.poll(async () => (await storedSession(first.page))?.refreshToken).toBe('rt-signup-1')
    await killGame(first.app)

    // Second launch: refresh rotates rt-signup-1 -> rt-refresh-N; the
    // durable record must carry the ROTATED credential, proven by the
    // third launch presenting it to the refresh endpoint.
    const second = await launchGame(userDataDir)
    const scenario2 = newScenario()
    await installSupabaseStub(second.app, scenario2)
    await (await continueButton(second.page)).click()
    await expect.poll(async () => (await storedSession(second.page))?.refreshToken).toBe('rt-refresh-1')
    await killGame(second.app)

    const third = await launchGame(userDataDir)
    const scenario3 = newScenario()
    await installSupabaseStub(third.app, scenario3)
    await (await continueButton(third.page)).click()

    await expect.poll(() => scenario3.lastRefreshToken).toBe('rt-refresh-1')
    expect(scenario3.signupCalls).toBe(0)

    await killGame(third.app)
    fs.rmSync(userDataDir, { recursive: true, force: true })
  })

  test('terminal refresh rejection clears the durable credential and stops entry', async () => {
    const userDataDir = makeUserDataDir()

    const first = await launchGame(userDataDir)
    await installSupabaseStub(first.app, newScenario())
    await (await guestButton(first.page)).click()
    await waitForCredentialFile(first.credentialPath)
    await killGame(first.app)

    const second = await launchGame(userDataDir)
    const scenario2 = newScenario()
    scenario2.refreshStatus = 400
    await installSupabaseStub(second.app, scenario2)

    await (await continueButton(second.page)).click()

    // Entry stops with an explanation - never silently re-mints a guest.
    await expect(second.page.locator('#auth-error-submit')).toBeVisible()
    await expect.poll(() => fs.existsSync(second.credentialPath)).toBe(false)
    expect(scenario2.signupCalls).toBe(0)

    await killGame(second.app)
    fs.rmSync(userDataDir, { recursive: true, force: true })
  })

  test('transient refresh failure blocks entry but RETAINS the credential - no new signup', async () => {
    const userDataDir = makeUserDataDir()

    const first = await launchGame(userDataDir)
    await installSupabaseStub(first.app, newScenario())
    await (await guestButton(first.page)).click()
    await waitForCredentialFile(first.credentialPath)
    await killGame(first.app)

    const second = await launchGame(userDataDir)
    const scenario2 = newScenario()
    scenario2.refreshStatus = 500
    await installSupabaseStub(second.app, scenario2)

    await (await continueButton(second.page)).click()
    await expect(second.page.locator('#auth-error-submit')).toBeVisible()

    // R8/B1.7: the credential survives transient failure for the next
    // reconnect; no new anonymous signup is minted as a workaround.
    expect(fs.existsSync(second.credentialPath)).toBe(true)
    expect(scenario2.signupCalls).toBe(0)

    await killGame(second.app)
    fs.rmSync(userDataDir, { recursive: true, force: true })
  })

  test('interrupted upgrade replays finalize after restart; FINALIZED converges to registered', async () => {
    const userDataDir = makeUserDataDir()

    // Launch 1: guest signup writes the durable record, process dies.
    const first = await launchGame(userDataDir)
    await installSupabaseStub(first.app, newScenario())
    await (await guestButton(first.page)).click()
    await waitForCredentialFile(first.credentialPath)
    await killGame(first.app)

    // Launch 2: the relaunched auth card still holds the stored guest
    // session, so the upgrade surface is available BEFORE continuing.
    // upgrade -> PENDING_CONFIRMATION; the process dies with the
    // pending-confirm marker persisted in the durable record.
    const second = await launchGame(userDataDir)
    const scenario2 = newScenario()
    await installSupabaseStub(second.app, scenario2)

    await (await continueButton(second.page)).isVisible()
    await second.page.locator('[data-testid="auth-upgrade-link"]').click()
    await second.page.locator('[data-testid="upgrade-input-id"]').fill('dao_huu_1')
    await second.page.locator('[data-testid="upgrade-input-password"]').fill('secret6')
    await second.page.locator('[data-testid="upgrade-submit"]').click()
    await expect(second.page.locator('[data-testid="upgrade-recheck"]')).toBeVisible()
    expect(scenario2.finalizeCalls).toBe(1)
    // The pending marker must reach disk before the process dies.
    await expect.poll(() => readE2eCredential(second.credentialPath)?.pendingUpgradeLoginId).toBe('dao_huu_1')

    await killGame(second.app)

    // Launch 3: Continue -> refresh -> claim -> finalize replays from the
    // durable pending marker; this time the server confirms.
    const third = await launchGame(userDataDir)
    const scenario3 = newScenario()
    scenario3.finalizeVerdict = { status: 'FINALIZED', loginId: 'dao_huu_1' }
    await installSupabaseStub(third.app, scenario3)

    // The auth card replays the recorded pending-confirm surface.
    await expect(third.page.locator('[data-testid="upgrade-recheck"]')).toBeVisible()

    await (await continueButton(third.page)).click()
    await expect.poll(() => scenario3.finalizeCalls).toBe(1)

    // Converged: same uuid, registered mode, durable guest record retired.
    await expect.poll(async () => (await storedSession(third.page))?.mode).toBe('login')
    expect((await storedSession(third.page))?.userId).toBe('u-guest-1')
    await expect.poll(() => fs.existsSync(third.credentialPath)).toBe(false)

    await killGame(third.app)
    fs.rmSync(userDataDir, { recursive: true, force: true })
  })

  test('no plaintext refresh credential lands anywhere under userData', async () => {
    const userDataDir = makeUserDataDir()

    const first = await launchGame(userDataDir)
    await installSupabaseStub(first.app, newScenario())
    await (await guestButton(first.page)).click()
    await waitForCredentialFile(first.credentialPath)

    // The ONLY protected surface is the fixed credential file; a leak
    // into any other userData file is a plaintext-fallback violation.
    // (Chromium session-storage leveldb is not a durable credential and
    // is excluded - B1.8 governs the durable refresh credential.)
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name === 'Session Storage') continue
          walk(full)
        } else if (entry.isFile() && entry.name !== CREDENTIAL_NAME) {
          try {
            if (fs.readFileSync(full).toString('latin1').includes('rt-signup')) offenders.push(full)
          } catch { /* unreadable - not ours */ }
        }
      }
    }
    walk(userDataDir)
    expect(offenders).toEqual([])

    await killGame(first.app)
    fs.rmSync(userDataDir, { recursive: true, force: true })
  })
})
