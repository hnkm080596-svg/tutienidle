// @vitest-environment jsdom
//
// F-REALM-PASSIVE-CARD (FIX WAVE 4) - regression guard asserting
// CLOSED. The card rendered +% lines straight from
// grantedRealmPassiveIds without consulting hiddenBreakthroughRealmIds,
// while the model (Player.ts resolvePlayerStatAssembly) withholds those
// passives on carried hidden_progression_state saves - a model-vs-
// surface lie. The card now applies the same hidden-realm-id filter
// the assembly does, and reads its lines through
// authoredRealmPassiveEntries (the canonical normal-vs-enhanced pick).
import { describe, expect, it } from 'vitest'
import { createApp, h, ref } from 'vue'
import { createPinia, type Pinia } from 'pinia'
import type { ComputedRef } from 'vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { unlockAllFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { useRealmStatPassives, type RealmStatPassiveRow } from './useRealmStatPassives'
import { usePlayerStore } from '@/stores/player'

// Re-pin the canonical beta lock (global setup unlocks features).
lockBetaFeaturesForTests()

function mountRows(prepare?: (pinia: Pinia) => void): ComputedRef<RealmStatPassiveRow[]> {
  const container = document.createElement('div')
  const pinia = createPinia()
  const manager = new GameManager()
  const version = ref(0)
  prepare?.(pinia)

  let captured: ComputedRef<RealmStatPassiveRow[]> | undefined
  const app = createApp({
    setup() {
      captured = useRealmStatPassives().realmStatPassiveRows as ComputedRef<RealmStatPassiveRow[]>
      return () => h('div')
    },
  })
  app.use(pinia)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return captured!
}

function carriedHiddenSave(pinia: Pinia): void {
  const player = usePlayerStore(pinia)
  player.realmId = 'foundation_establishment'
  // Acceptance-coherent hidden record: the hidden entry into foundation
  // rides the completed qi_refining hidden body; the grant already ran
  // with the hidden variant, so both markers are persisted.
  player.hiddenPerfection.lineageActive = true
  player.hiddenPerfection.completedHiddenBodyRealmIds = ['mortal', 'qi_refining']
  player.hiddenPerfection.realms = {
    mortal: { bodyCompleted: true, discovered: true, frozen: false },
    qi_refining: { bodyCompleted: true, discovered: true, frozen: false },
  }
  player.hiddenPerfection.hiddenBreakthroughRealmIds = ['foundation_establishment']
  player.grantedRealmPassiveIds = ['foundation_establishment']
}

describe('useRealmStatPassives - hidden-breakthrough grants stay withheld', () => {
  it('a carried hidden_progression_state save renders no Kien Co row', () => {
    const rows = mountRows(carriedHiddenSave)

    expect(rows.value.map((row) => row.id)).toEqual([])
  })

  it('mixed grants render only the non-hidden row', () => {
    const rows = mountRows((pinia) => {
      carriedHiddenSave(pinia)
      const player = usePlayerStore(pinia)
      player.breakthroughGrade = 4
      player.grantedRealmPassiveIds = ['qi_refining', 'foundation_establishment']
    })

    expect(rows.value.map((row) => row.id)).toEqual(['qi_refining'])
    expect(rows.value[0]!.name).toBe('Nhập Đạo')
    expect(rows.value[0]!.effectLines).toHaveLength(4)
  })

  it('a hidden-breakthrough qi_refining grant is withheld the same way', () => {
    const rows = mountRows((pinia) => {
      const player = usePlayerStore(pinia)
      player.realmId = 'qi_refining'
      player.breakthroughGrade = 4
      player.hiddenPerfection.hiddenBreakthroughRealmIds = ['qi_refining']
      player.grantedRealmPassiveIds = ['qi_refining']
    })

    expect(rows.value).toEqual([])
  })

  it('control: a normal foundation grant still renders its Kien Co lines', () => {
    const rows = mountRows((pinia) => {
      const player = usePlayerStore(pinia)
      player.realmId = 'foundation_establishment'
      player.highestFoundationAchieved = 'earth'
      player.grantedRealmPassiveIds = ['foundation_establishment']
    })

    expect(rows.value.map((row) => row.id)).toEqual(['foundation_establishment'])
    expect(rows.value[0]!.name).toBe('Kiến Cơ')
    expect(rows.value[0]!.effectLines).toHaveLength(5)
    expect(rows.value[0]!.effectLines[0]).toContain('+5')
  })

  it('unlocked hiddenContent renders the enhanced variant on the same save', () => {
    unlockAllFeaturesForTests()
    try {
      const rows = mountRows(carriedHiddenSave)

      // The record was always legal - the lock only defers it. Unlocked,
      // the card shows the same enhanced (hidden-breakthrough) entries
      // the assembly resolves (20% all main stats, not the normal tier).
      expect(rows.value.map((row) => row.id)).toEqual(['foundation_establishment'])
      expect(rows.value[0]!.effectLines).toHaveLength(5)
      expect(rows.value[0]!.effectLines[0]).toContain('+20')
    } finally {
      lockBetaFeaturesForTests()
    }
  })
})
