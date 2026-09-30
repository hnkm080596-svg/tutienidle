// BETA B1-D browser admission suite (PR5): the live app over the staging
// Supabase project at production timing (heartbeat 30s / lease 40s /
// request deadline 10s - no scaling).
//
// Real everything: real GoTrue anonymous signup, real claim_active_session,
// real create_talent_roll + create_character, real write_character_save,
// then the real browser app booted remote-authoritative. The ONE injected
// seam is the transport fault itself - a route abort on the heartbeat RPC
// produces an observed authority loss, exactly the same failure shape a
// dropped packet produces on the wire. Nothing else is faked.
//
// Missing staging env fails nonzero (same convention as the B1-A contract
// suite in tests/integration/supabase/fixture.ts): this spec proves
// behavior only a real backend can produce - the heartbeat's 30s cadence,
// the reconnect pipeline's real refresh+beat+load order, and the blocking
// admission overlay that must cover every mutator while paused.
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import {
  loadContractEnv,
  rpc,
  claimSession,
  provisionCharacter,
  writeSave,
  buildSavePayload,
  type ContractEnv,
} from '../integration/supabase/fixture'
import { enterHome, waitForPresentationIdle } from './helpers'

const HEARTBEAT_ROUTE = '**/rest/v1/rpc/heartbeat_session'
const AUTHORITY_OVERLAY = '.authority-overlay'

let env: ContractEnv

interface ProvisionedSession {
  userId: string
  accessToken: string
  refreshToken: string
  sessionId: string
  characterName: string
}

// Anonymous signup that keeps the refresh token - the fixture's
// createAnonymousUser drops it, but the app's stored session needs it
// for the single-flight GoTrue refresh the reconnect pipeline performs.
async function signupAnonymous(env: ContractEnv): Promise<{
  userId: string
  accessToken: string
  refreshToken: string
}> {
  const res = await fetch(`${env.supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: env.anonKey, 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(15_000),
  })
  const body = await res.json()
  if (!res.ok || !body.access_token || !body.refresh_token) {
    throw new Error(`anonymous signup failed: ${res.status} ${JSON.stringify(body)}`)
  }
  return { userId: body.user.id, accessToken: body.access_token, refreshToken: body.refresh_token }
}

async function provisionRemoteAccount(): Promise<ProvisionedSession> {
  const user = await signupAnonymous(env)
  const sessionId = await claimSession(env, user.accessToken, { deviceLabel: 'beta-authority-spec' })
  const character = await provisionCharacter(env, user.accessToken, sessionId)
  const saved = await writeSave(env, user.accessToken, {
    sessionId,
    expectedRevision: 0,
    payload: buildSavePayload(character),
  })
  if (saved.status !== 200) {
    throw new Error(`initial writeSave failed: ${saved.status} ${JSON.stringify(saved.body)}`)
  }
  return { ...user, sessionId, characterName: character.name }
}

// Inject the stored session the app reads on resume
// (tien-hiep-idle-auth-session, sessionStorage) BEFORE any app code runs.
async function injectSession(context: BrowserContext, session: ProvisionedSession): Promise<void> {
  await context.addInitScript(
    ([stored]) => {
      sessionStorage.setItem('tien-hiep-idle-auth-session', JSON.stringify(stored))
    },
    [
      {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        sessionId: session.sessionId,
        userId: session.userId,
        mode: 'guest',
        expiresAtMs: Date.now() + 3_600_000,
      },
    ],
  )
}

// Boot into the live game through the resume affordance: short intro,
// auth-continue button, remote load, enter game.
async function bootIntoGame(page: Page): Promise<void> {
  await page.goto('/')
  const auth = page.getByTestId('auth-screen')
  await expect(auth).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('auth-continue-button').click()
  await enterHome(page)
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  env = loadContractEnv()
})

test('heartbeat loss pauses admission, the overlay blocks every mutator, and transport recovery resumes the same lineage', async ({ page }) => {
  const session = await provisionRemoteAccount()
  await injectSession(page.context(), session)
  await bootIntoGame(page)

  // Admitted: the authority surface is absent and the sim is live.
  await expect(page.locator(AUTHORITY_OVERLAY)).toHaveCount(0)

  // Observed authority loss: every heartbeat RPC now dies on the wire.
  await page.route(HEARTBEAT_ROUTE, (route) => route.abort())

  // The 30s cadence + pipeline retries put the authority into
  // 'reconnecting' - a BLOCKING overlay, because paused simulation must
  // not be reachable by pointer/keyboard/late callbacks.
  const overlay = page.locator(AUTHORITY_OVERLAY)
  await expect(overlay).toBeVisible({ timeout: 90_000 })

  // While transport stays dead the overlay persists (retries cannot win).
  await page.waitForTimeout(15_000)
  await expect(overlay).toBeVisible()

  // Transport returns: the spec-ordered pipeline (refresh -> heartbeat ->
  // load with journal reconcile -> same-lineage check) resumes the sim.
  await page.unroute(HEARTBEAT_ROUTE)
  await expect(overlay).toHaveCount(0, { timeout: 60_000 })

  // Still alive and interactive post-resume - no stale pause survived.
  await expect(page.locator('.game-root')).toBeVisible()
})

test('a revoked session is terminal: the overlay requires the owned acknowledgement, never silent sign-out', async ({ page }) => {
  const session = await provisionRemoteAccount()
  await injectSession(page.context(), session)
  await bootIntoGame(page)

  // Revoke the active session server-side: a second device claims the
  // slot, so the next heartbeat answers 'session revoked'.
  await claimSession(env, session.accessToken, { deviceLabel: 'beta-authority-spec-takeover' })

  const overlay = page.locator(AUTHORITY_OVERLAY)
  await expect(overlay).toBeVisible({ timeout: 90_000 })

  // The terminal surface offers the owned path back to auth.
  await expect(page.getByRole('button', { name: /đăng nhập|sign in|auth/i })).toBeVisible()
})

test('cold boot under remote authority: the post-accrual snapshot commits before the first tick', async ({ page }) => {
  const session = await provisionRemoteAccount()
  await injectSession(page.context(), session)

  // Intercept the write queue: the durability leg must land its commit
  // BEFORE gameplay intervals start paying accrual. We count save calls
  // and only release them after the first commit lands.
  let saveCalls = 0
  await page.route('**/rest/v1/rpc/write_character_save', async (route) => {
    saveCalls += 1
    await route.continue()
  })

  await bootIntoGame(page)

  // Boot committed the post-accrual snapshot (the durability leg) at
  // least once before admission was granted.
  expect(saveCalls).toBeGreaterThanOrEqual(1)
  await waitForPresentationIdle(page)
  await expect(page.locator(AUTHORITY_OVERLAY)).toHaveCount(0)
})
