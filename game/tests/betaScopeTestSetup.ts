/**
 * BETA-SCOPE-LOCK test seam (2026-09-30) - runs for EVERY vitest file via
 * `test.setupFiles` in vite.config.ts.
 *
 * The beta build ships src/core/betaScope.ts with all scope flags OFF,
 * which suspends sword/body pathway offers, all hidden content, companion
 * gameplay, and the Tran Phap panel entry. Most pre-existing suites pin
 * the MECHANISMS those systems run (they must keep passing the moment the
 * flags flip back), so by default every test file sees the ENABLED shape:
 *
 *   - BETA_SCOPE_LOCKED_PATHWAYS -> empty set (every authored way offers
 *     under its own offerGate)
 *   - BETA_HIDDEN_CONTENT_ENABLED / BETA_COMPANION_CONTENT_ENABLED /
 *     BETA_FORMATION_PANEL_ENABLED -> true
 *
 * A test that asserts the LOCKED state (like
 * tests/architecture/betaScopeLock.test.ts) opts out with
 * `vi.unmock('@/core/betaScope')` at the top of the file - module mocks
 * are resolved per test file, so the unmock restores the real flag
 * module for that file's whole import graph.
 */
import { vi } from 'vitest'

vi.mock('@/core/betaScope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/betaScope')>()

  return {
    ...actual,
    BETA_SCOPE_LOCKED_PATHWAYS: new Set(),
    BETA_HIDDEN_CONTENT_ENABLED: true,
    BETA_COMPANION_CONTENT_ENABLED: true,
    BETA_FORMATION_PANEL_ENABLED: true,
  }
})
