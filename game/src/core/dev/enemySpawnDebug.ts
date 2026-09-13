// DEV ONLY debug helpers (spec v3 B5) - never part of the production
// API surface. Registered on window during dev builds only, following
// the DevMode.ts / import.meta.env.DEV guard pattern.
//
// window.__tutienEnemySpawnDebug.spawnEnemy(enemyId, tags?) - force-spawn
//   an enemy through applyEnemyTags for manual tag-interaction testing.
// window.__tutienEnemySpawnDebug.forcePerfectClear(stageId, clearSeconds?)
//   - mark a stage perfect-cleared to try the idle gate without grinding.
//
// Deps are injected by the caller (App.vue) - no reaching into
// GameManager privates or the Phaser registry.

import type { GameManager } from '../game/GameManager'
import type { PlayerData } from '../player/Player'
import type { Stats } from '../stats/StatBlock'
import { applyEnemyTags } from '../enemy/EnemyTag'
import { ENEMY_TAGS } from '../../data/enemy/EnemyTags'
import { isBattleInProgress } from '../battle/BattleTypes'

export interface EnemySpawnDebugDeps {
  gameManager: GameManager
  player: PlayerData
  getStats: () => Stats
}

interface TutienEnemySpawnDebug {
  spawnEnemy: (enemyId: string, tags?: string[]) => string
  forcePerfectClear: (stageId: string, clearSeconds?: number) => string
}

declare global {
  interface Window {
    __tutienEnemySpawnDebug?: TutienEnemySpawnDebug
  }
}

export function registerEnemySpawnDebug(deps: EnemySpawnDebugDeps): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return
  }

  window.__tutienEnemySpawnDebug = {
    spawnEnemy(enemyId: string, tags: string[] = []) {
      const battle = deps.gameManager.getBattle()

      if (battle && isBattleInProgress(battle.state)) {
        return 'battle already in progress'
      }

      const template = deps.gameManager.catalogOps.getEnemyTemplate(enemyId)

      if (!template) {
        return `enemy template not found: ${enemyId}`
      }

      const enemy = applyEnemyTags(template, tags, ENEMY_TAGS)

      deps.gameManager.startBattleWithPlayer(deps.player, deps.getStats(), enemy)

      return `spawned ${enemy.name} (tags: [${tags.join(', ')}])`
    },

    forcePerfectClear(stageId: string, clearSeconds = 60) {
      const player = deps.player

      if (!player.perfectClearStageIds.includes(stageId)) {
        player.perfectClearStageIds.push(stageId)
      }

      player.perfectClearSeconds[stageId] ??= clearSeconds

      return `stage ${stageId} marked perfect-cleared (${player.perfectClearSeconds[stageId]}s) - idle gate open`
    },
  }
}
