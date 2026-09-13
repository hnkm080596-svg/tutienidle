/**
 * R14 guard (R13/AR-19 + AR-25 retirement contracts).
 *
 * Regression classes protected:
 * - The retired `TurnBuff*` alias layer must not be resurrected: no
 *   production file may reference `TurnBuff` (identifier, path, or symbol).
 *   Canonical buff mechanics live in `src/core/buff/*` (BuffSystem/BuffPool/
 *   BuffTypes/BuffNames) and `src/data/buff/BuffRegistry.ts`; a second
 *   naming surface is the parallel-authority defect R13 retired.
 * - The `syncLegacyBattleState` no-op hook must not return: presentation
 *   ACK handling is owned by CombatAnimationRuntime; a resync hook is the
 *   legacy-synchronization scaffolding R13 removed.
 *
 * Scans production source only — test files may name the retired surfaces
 * when documenting the history of the retirement.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { listProductionTs, listVue, readTs, SCAN_TIMEOUT } from './helpers/scanTs'

const SRC = join(process.cwd(), 'src')

describe('R14 — retired buff/legacy-sync surfaces stay retired', () => {
  it(
    'no production file references the TurnBuff* alias surface',
    () => {
      const offenders: string[] = []

      for (const file of [...listProductionTs(SRC), ...listVue(SRC)]) {
        if (readTs(file).includes('TurnBuff')) {
          offenders.push(file)
        }
      }

      expect(
        offenders,
        `TurnBuff* alias references found (canonical surface is core/buff/*):\n${offenders.join('\n')}`,
      ).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'no production file references the retired syncLegacyBattleState hook',
    () => {
      const offenders: string[] = []

      for (const file of [...listProductionTs(SRC), ...listVue(SRC)]) {
        if (readTs(file).includes('syncLegacyBattleState')) {
          offenders.push(file)
        }
      }

      expect(
        offenders,
        `syncLegacyBattleState references found (ACK flow is owned by CombatAnimationRuntime):\n${offenders.join('\n')}`,
      ).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
