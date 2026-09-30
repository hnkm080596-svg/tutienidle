import type { PlayerData } from '../player/Player'
import type { Enemy } from '../enemy/Enemy'
import { rollChance } from '../reward/DropRoll'
import {
  hiddenBeastChannels,
  type HiddenBeastChannel,
} from '../../data/drop/HiddenMaterialChannels'
import { isRealmAvailable } from '../realm/ReleasePolicy'
import { isBetaFeature } from '../betaScope'

// Quai an (spec m-f-body-hidden sec.3) - generalized channel-driven
// spawn substitution: each authored hidden_beast channel opens its own
// window when the player's per-channel banded-kill counter reaches
// killThreshold, then substitutes the channel enemy into spawns at
// spawnChancePerSpawn (or unconditionally at guaranteedSpawnAfterKills).
// Kills count per band symmetrically: for every channel whose
// bandRealmId matches the defeated enemy's band, that channel's own
// beast resets its counter while every OTHER banded enemy (including
// another channel's beast) is an ordinary increment. Khong spoil: quai
// an khong hien danh sach stage/map nao.
export class HiddenBeastSystem {
  constructor(
    private readonly deps: {
      getEnemyTemplate: (id: string) => Enemy | undefined
      channels?: readonly HiddenBeastChannel[]
    },
  ) {}

  private channels(): readonly HiddenBeastChannel[] {
    return this.deps.channels ?? hiddenBeastChannels()
  }

  isWindowOpen(player: PlayerData, channel: HiddenBeastChannel): boolean {
    return (player.hiddenBeastKills[channel.id] ?? 0) >= channel.killThreshold
  }

  /**
   * Moi luot spawn ACTIVE stage: iterate authored channels in order;
   * the first channel whose band matches the stage realm, whose band is
   * release-available, whose window is open, and whose bound-or-chance
   * roll wins substitutes its enemy for the pool spawn. The
   * guaranteedSpawnAfterKills bound substitutes without consuming a roll
   * (spec sec.6 - the bound is the acquisition bound).
   */
  maybeReplaceSpawn(
    player: PlayerData,
    stageRealmId: string | undefined,
    rng: () => number = Math.random,
  ): Enemy | undefined {
    // BETA SCOPE LOCK v2 (Phase-6): hidden beasts are scope-hidden -
    // no substitution regardless of persisted counters (they stay
    // dormant, not deleted).
    if (!isBetaFeature('hiddenContent')) {
      return undefined
    }

    for (const channel of this.channels()) {
      if (channel.bandRealmId !== stageRealmId) {
        continue
      }

      if (!isRealmAvailable(channel.bandRealmId) || !this.isWindowOpen(player, channel)) {
        continue
      }

      const kills = player.hiddenBeastKills[channel.id] ?? 0
      const bound = channel.guaranteedSpawnAfterKills

      if (!(bound !== undefined && kills >= bound) && !rollChance(channel.spawnChancePerSpawn, rng)) {
        continue
      }

      const template = this.deps.getEnemyTemplate(channel.enemyId)

      if (template) {
        return template
      }
    }

    return undefined
  }

  /**
   * Goi tu BattleLootSystem khi 1 quai chet (ke ca idle auto-farm).
   * Symmetric per-channel semantics: for every channel in the defeated
   * enemy's band, killing that channel's own beast resets it; every
   * other banded enemy is an ordinary increment.
   *
   * Sound System W6: returns the channel ids whose kill count CROSSED
   * `killThreshold` in this call (before < threshold <= after) so the
   * caller (BattleLootSystem, owns deps.eventBus) can emit
   * `hidden_window_opened`. Resets never report; this system stays
   * eventBus-free - return value, not a dep.
   */
  onEnemyDefeated(player: PlayerData, enemyId: string, enemyRealmId: string): string[] {
    // BETA SCOPE LOCK v2 (Phase-6): hidden beasts are scope-hidden -
    // counters do not advance and no `hidden_window_opened` channel is
    // ever reported (the Phase-4-flagged audio cue goes silent).
    if (!isBetaFeature('hiddenContent')) {
      return []
    }

    const opened: string[] = []

    for (const channel of this.channels()) {
      if (channel.bandRealmId !== enemyRealmId) {
        continue
      }

      if (enemyId === channel.enemyId) {
        player.hiddenBeastKills[channel.id] = 0
      } else {
        const killsBefore = player.hiddenBeastKills[channel.id] ?? 0
        const killsAfter = killsBefore + 1
        player.hiddenBeastKills[channel.id] = killsAfter
        if (killsBefore < channel.killThreshold && killsAfter >= channel.killThreshold) {
          opened.push(channel.id)
        }
      }
    }

    return opened
  }
}
