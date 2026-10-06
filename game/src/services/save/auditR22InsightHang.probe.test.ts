// @vitest-environment node
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { accrueCultivationInsight } from '../../core/cultivation/CultivationInsight'
import { createDefaultPlayer } from '../../core/player/Player'

declare const process: { env: Record<string, string | undefined> }

// R22-AUT helper - spawned ONLY by auditR22Aut.probe.test.ts with
// R22_INSIGHT_HANG_PROBE=1. Skipped in every normal run so the hang can
// never stall the suite. With the env set, a validator-admitted
// cultivationInsightAccumulator = 1e15 (requireNonNegativeNumber only -
// no magnitude pin) makes the accrue loop iterate ~5e11 times: the
// persisted counter IS the loop bound, so the same magnitude class r21
// pinned on timestamp cursors wedges the cultivate tick / offline accrue.
//
// The marker file is written BEFORE the hanging call: the parent
// distinguishes "armed then died without completing" (hang confirmed)
// from a startup crash (marker absent).
it.skipIf(process.env.R22_INSIGHT_HANG_PROBE !== '1')(
  'accrueCultivationInsight with accumulator=1e15 hangs the conversion loop',
  () => {
    const marker = process.env.R22_HANG_MARKER_FILE

    const player = createDefaultPlayer()
    player.selectedTalentIds = ['ngo_dao'] // authored insight_per_cultivation, threshold 2000
    player.cultivationInsightAccumulator = 1e15

    if (marker) {
      writeFileSync(marker, 'armed')
    }

    accrueCultivationInsight(player, 1)
  },
)
