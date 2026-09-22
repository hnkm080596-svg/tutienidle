// @vitest-environment jsdom
//
// ARCH-005 (M12) — real-engine HUD invalidation regression.
//
// The 2026-09-14 Edge probe found the skill bar invisible in live combat:
// TurnCombatSkillBar stayed `isBattleFighting:false` while the engine
// reported state:fighting with turns resolved. Root cause: the engine
// MUTATES the TurnBattle object in place, so `battle` computed resolves
// to the same reference forever and derived projections never invalidate.
//
// This test mounts the REAL consumers (TurnCombatSkillBar + BattleLogPanel
// + TurnOrderStrip) against a REAL GameManager + ManualClockSource — the
// same domain object, the same in-place mutations, the same shared
// stateVersion bridge App.vue drives. It asserts:
//   countdown/intro -> HUD hidden
//   engine reaches 'fighting' (same object identity) -> still hidden until
//     the version bump (proves the bump is the invalidation channel)
//   after bump -> skill bar + 3 slot buttons + order strip render
//   auto turns append battle.log -> log panel lines render after bump
//   manual mode pause -> awaiting indicator + tappable slot button
import { describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref, type App } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from '@/i18n'
import {
  GAME_MANAGER_KEY,
  STATE_VERSION_KEY,
  BUMP_STATE_KEY,
} from '@/composables/useGameState'
import { GameManager } from '@/core/game/GameManager'
import { toTurnSkillDefinition } from '@/core/skilldef/LegacySkillAdapter'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '@/core/battle/turn/CombatClock'
import { defineEnemy } from '@/core/enemy/Enemy'
import { createBaseStats } from '@/core/stats/StatBlock'
import type { CombatEntity } from '@/core/combat/CombatEntity'
import type { Skill } from '@/core/skill/Skill'
import { createDefaultPlayer } from '@/core/player/Player'
import TurnCombatSkillBar from './hud/TurnCombatSkillBar.vue'
import BattleLogPanel from './BattleLogPanel.vue'
import TurnOrderStrip from './TurnOrderStrip.vue'

const ENEMY_STATS_INPUT = {
  maxHp: 10_000_000,
  might: 0,
  attackSpeed: 1,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function createPlayer(): CombatEntity {
  const stats = createBaseStats({ might: 50, speed: 100, criticalRate: 0 })

  return {
    id: 'player',
    name: 'Player',
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,

    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 4,
    alive: true,
  }
}

function createBasicSkill(): Skill {
  return {
    id: 'basic_test',
    name: 'Basic (test)',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'attack_speed' },
    resourceType: 'none',
  }
}

function createDummyEnemy() {
  return defineEnemy({
    id: 'reactivity_dummy',
    name: 'Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: { ...ENEMY_STATS_INPUT },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

function mountHud(gameManager: GameManager): {
  app: App
  container: HTMLDivElement
  bump: () => Promise<void>
} {
  const stateVersion = ref(0)
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({
    render: () =>
      h('div', [h(TurnCombatSkillBar), h(BattleLogPanel), h(TurnOrderStrip)]),
  })

  app.use(createPinia())
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })
  app.mount(container)

  return {
    app,
    container,
    bump: async () => {
      stateVersion.value += 1
      await nextTick()
    },
  }
}

describe('ARCH-005 (M12) — combat HUD reactivity over the in-place-mutated TurnBattle', () => {
  it('countdown -> fighting -> manual choice: every consumer refreshes only via stateVersion on the SAME battle object', async () => {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = createPlayer()

    gameManager.catalogOps.registerSkillTemplates([createBasicSkill()])
    gameManager.catalogOps.registerProgressionNodes([{
      id: 'core_basic_test',
      name: 'Core: Basic',
      type: 'minor',
      insightCost: 0,
      maxLevel: 10,
      levelsSkillId: 'basic_test',
      effect: {},
    }])
    gameManager.progressionOps.learnSkill('basic_test', createDefaultPlayer())
    const basicSkill = gameManager.skillManager.get('basic_test')!
    gameManager.setPathRuntimeResolver(() => ({
      resolveBasic: () =>
        toTurnSkillDefinition(basicSkill, gameManager.skillSystem.getEffectiveSkill(basicSkill)),
      resolveSpecialUltimate: () => undefined,
      resolveMaxThe: () => 0,
      resolveStatDomains: () => undefined,
    }))

    gameManager.startBattle(player, createDummyEnemy())

    const { app, container, bump } = mountHud(gameManager)
    const battle = gameManager.getTurnBattle()!

    expect(battle.state).toBe('intro')
    expect(container.querySelector('.turn-combat-skill-bar')).toBeNull()
    expect(container.querySelector('.turn-order-strip')).toBeNull()
    expect(container.querySelector('.battle-log-panel')).toBeNull()

    // Drive the engine to 'fighting' WITHOUT a version bump: state is
    // mutated in place on the very same object.
    for (let i = 0; i < 200 && gameManager.getTurnBattle()?.state !== 'fighting'; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(gameManager.getTurnBattle()?.state).toBe('fighting')
    expect(gameManager.getTurnBattle()).toBe(battle) // same identity

    // No invalidation signal yet -> projections keep their stale cache.
    await nextTick()
    expect(container.querySelector('.turn-combat-skill-bar')).toBeNull()
    expect(container.querySelector('.turn-order-strip')).toBeNull()

    // The version bump (what App.vue does every tick) must invalidate.
    await bump()

    expect(container.querySelector('.turn-combat-skill-bar')).not.toBeNull()
    expect(container.querySelectorAll('.turn-combat-skill-bar__slot-button')).toHaveLength(3)
    expect(container.querySelector('.turn-order-strip')).not.toBeNull()

    // Auto turns append battle.log in place; the panel surfaces after bump.
    for (let i = 0; i < 150 && (battle.log?.length ?? 0) === 0; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(battle.log?.length ?? 0).toBeGreaterThan(0)
    await bump()
    expect(container.querySelectorAll('.battle-log-panel__line').length).toBeGreaterThan(0)

    // Manual mode pauses the engine at the player's turn; the bar must show
    // the awaiting indicator and enable a tappable ready slot.
    gameManager.setBattleManualMode(true)

    for (let i = 0; i < 300 && !gameManager.isAwaitingManualTurnChoice(); i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(gameManager.isAwaitingManualTurnChoice()).toBe(true)
    await bump()

    expect(container.querySelector('.turn-combat-skill-bar__awaiting')).not.toBeNull()

    const tappable = container.querySelector<HTMLButtonElement>(
      '.turn-combat-skill-bar__slot-button.is-tappable',
    )

    expect(tappable).not.toBeNull()
    expect(tappable!.disabled).toBe(false)

    app.unmount()
    container.remove()
  })
})
