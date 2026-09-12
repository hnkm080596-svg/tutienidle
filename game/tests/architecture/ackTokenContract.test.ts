/**
 * R14.6c guard — presentation ACKs require a generation token (roadmap R14
 * "all presentation ACKs require generation token"; R5/AR-20 runtime
 * contract in CombatAnimationRuntime).
 *
 * The runtime already rejects missing/mismatched/stale tokens; behavioral
 * coverage lives in CombatAnimationRuntime.test.ts. This STATIC guard pins
 * the contract against silent refactor regressions: each public ack method
 * must reject a missing or mismatched token BEFORE touching pending state.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { readTs } from './helpers/scanTs'

const RUNTIME = join(process.cwd(), 'src/core/battle/turn/CombatAnimationRuntime.ts')

/** Slice a method body from its `name(token?: string)` signature to the next same-level `}` line. */
function methodBody(source: string, methodName: string): string {
  // Anchor on the DEFINITION signature (doc comments and call sites lack `token?:`).
  const start = source.search(new RegExp(`\\b${methodName}\\s*\\(\\s*token\\?:`))
  expect(start, `${methodName}(token?: ...) definition not found`).toBeGreaterThanOrEqual(0)

  const rest = source.slice(start)
  const end = rest.search(/\n {2}\}/) // class-method closing brace at 2-space indent
  expect(end, `${methodName} body end not found`).toBeGreaterThan(0)

  return rest.slice(0, end)
}

describe('R14.6c — every presentation ack requires the current playback token', () => {
  const source = readTs(RUNTIME)

  for (const method of [
    'acknowledgeTurnReady',
    'acknowledgeActionImpact',
    'acknowledgeActionComplete',
  ]) {
    it(`${method} rejects missing/mismatched token before mutating pending state`, () => {
      const body = methodBody(source, method)

      // The signature anchor already proves the method accepts a token param.

      // The R5/AR-20 rejection: missing, empty, or mismatched -> no-op.
      const check = body.search(/!\s*token\s*\|\|\s*token\s*!==\s*this\.playbackToken/)
      expect(check, `${method} must reject !token || token !== this.playbackToken`).toBeGreaterThanOrEqual(0)

      // The rejection must run BEFORE the first pending-state mutation.
      const firstMutation = body.search(/this\.pending\w+\s*=/)
      if (firstMutation >= 0) {
        expect(
          check < firstMutation,
          `${method}: token check must precede pending-state mutation`,
        ).toBe(true)
      }
    })
  }

  it('the playback token is regenerated on every phase advance (nextPlaybackToken call sites)', () => {
    // Each phase transition must mint a fresh token so a stale ack from a
    // previous phase/battle cannot replay.
    const calls = source.match(/nextPlaybackToken\(\)/g) ?? []
    // definition (1) + ready/cast/complete transitions (>=3)
    expect(calls.length).toBeGreaterThanOrEqual(4)
  })
})
