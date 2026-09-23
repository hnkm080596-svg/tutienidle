// M-F-BODY-HIDDEN (spec sec.2, plan Step 2) - authored registry of the
// HIDDEN acquisition channels through which Body-perfection materials
// reach the player. "Hidden" means unreachable via normal loot: never on
// STAGE_DROP_TABLES, never on FAMILY_DROP_TABLES, never on a
// signatureDrops line of an enemy that is not a channel enemy.
//
// Two channel kinds ship today:
//   - 'hidden_beast': banded-kill window + spawn substitution (the
//     generalized huyet_mong precedent, spec sec.3). The channel emits
//     whatever material lines the channel enemy's signatureDrops author.
//   - 'grotto': per-settle-cycle emission inside a grotto's reward grant
//     (spec sec.4). The channel emits exactly `materialId`.
//
// Anti-frustration contract (spec sec.6): every channel that emits a
// perfection material MUST author a hard bound
// (guaranteedSpawnAfterKills / guaranteedAfterCycles) AND every
// perfection signature line on a channel enemy must be unconditional
// (`requiresModifier === undefined`) and `chance: 1` - so the bound is
// the acquisition bound, not a probabilistic hope. The cross-catalog
// arms live in HiddenMaterialChannels.test.ts (data/ purity: this
// module validates SHAPE only, no catalog imports).
//
// Save: counters persist as player.hiddenBeastKills (per-channel map)
// and ProductionSiteState.hiddenChannelCycles (per-site channel map).

export type HiddenMaterialChannelKind = 'hidden_beast' | 'grotto'

interface HiddenMaterialChannelBase {
  kind: HiddenMaterialChannelKind

  /** Unique channel id - also the key of the persisted counter maps. */
  id: string

  /** Realm band the channel operates in. hidden_beast: matched against
      the stage realm; grotto: reach eligibility vs
      cycle.collectionRealmId (cycle tier >= band -> eligible, so
      channels never expire as the player outlevels them). */
  bandRealmId: string
}

export interface HiddenBeastChannel extends HiddenMaterialChannelBase {
  kind: 'hidden_beast'

  /** Enemy template substituted into spawns once the window opens. */
  enemyId: string

  /** Banded kills (band match, enemy != channel enemy) that open the window. */
  killThreshold: number

  /** Substitution chance per eligible ACTIVE spawn. */
  spawnChancePerSpawn: number

  /** Anti-frustration bound: when the counter reaches this value the
      next eligible ACTIVE spawn substitutes unconditionally. Must be
      >= killThreshold (the window must be open for the bound to mean
      anything). */
  guaranteedSpawnAfterKills?: number
}

export interface GrottoChannel extends HiddenMaterialChannelBase {
  kind: 'grotto'

  /** Material emitted per successful settle-cycle draw. */
  materialId: string

  /** Emission chance per eligible settled grotto cycle. */
  chancePerCycle: number

  /** Anti-frustration bound: the eligible settle cycle at this count
      emits unconditionally (no channel draw consumed). */
  guaranteedAfterCycles?: number
}

export type HiddenMaterialChannel = HiddenBeastChannel | GrottoChannel

/**
 * Authored channel registry. Ships with exactly the migrated huyet_mong
 * precedent (threshold 1000 / 5% spawn / qi_refining band - behavior
 * identical to the deleted HIDDEN_BEAST_* constants). Perfection
 * channels are authored by the later content pass; this mission pins
 * the shape + invariants only.
 */
export const HIDDEN_MATERIAL_CHANNELS: readonly HiddenMaterialChannel[] = [
  {
    kind: 'hidden_beast',
    id: 'huyet_mong',
    bandRealmId: 'qi_refining',
    enemyId: 'huyet_mong',
    killThreshold: 1000,
    spawnChancePerSpawn: 0.05,
  },
]

export function hiddenBeastChannels(
  channels: readonly HiddenMaterialChannel[] = HIDDEN_MATERIAL_CHANNELS,
): readonly HiddenBeastChannel[] {
  return channels.filter((channel): channel is HiddenBeastChannel => channel.kind === 'hidden_beast')
}

export function hiddenGrottoChannels(
  channels: readonly HiddenMaterialChannel[] = HIDDEN_MATERIAL_CHANNELS,
): readonly GrottoChannel[] {
  return channels.filter((channel): channel is GrottoChannel => channel.kind === 'grotto')
}

/**
 * The material-id set a channel can emit (spec sec.2 completeness arm):
 * grotto emits `materialId` directly; hidden_beast emits whatever the
 * channel enemy's signatureDrops author - the signature-line oracle is
 * injected so this module stays catalog-free (the integrity test
 * supplies the real catalog lookup).
 */
export function channelEmittedMaterialIds(
  channel: HiddenMaterialChannel,
  signatureMaterialIdsOf: (enemyId: string) => readonly string[],
): readonly string[] {
  if (channel.kind === 'grotto') {
    return [channel.materialId]
  }

  return signatureMaterialIdsOf(channel.enemyId)
}

/**
 * Perfection materials intentionally reachable ONLY via visible
 * authored grants - a CENSUS, not a bare id list: every row pairs the
 * material to an authored grant source that the integrity test proves
 * exists AND delivers the material (quest -> reward.itemDrops contains
 * materialId; building -> producesMaterialId === materialId). Ships
 * []; content fills it. The union extends when content needs another
 * grant surface - each new kind ships its per-kind resolution rule.
 */
export type VisibleGrantSourceKind = 'quest' | 'building'

export interface VisibleGrantSource {
  materialId: string
  kind: VisibleGrantSourceKind
  grantId: string
}

export const VISIBLE_GRANT_SOURCES: readonly VisibleGrantSource[] = []

/**
 * XOR tag that derives the grotto-channel RNG stream from the cycle
 * seed (spec sec.4): `mulberry32(cycle.rollSeed ^ GROTTO_CHANNEL_SEED_TAG)`.
 * Channel draws never consume the table-roll stream, so a cycle's table
 * rewards are bit-identical with and without channels.
 */
export const GROTTO_CHANNEL_SEED_TAG = 0x9e3779b9

/**
 * Pure shape validator - injectable so tests can exercise malformed
 * registries without mutating the canonical constant. Cross-catalog
 * checks (realm/enemy/material resolution, completeness, census) live
 * in the integrity test, not here.
 */
export function validateHiddenMaterialChannels(
  channels: readonly HiddenMaterialChannel[] = HIDDEN_MATERIAL_CHANNELS,
): string[] {
  const issues: string[] = []
  const ids = new Set<string>()
  const beastPairs = new Set<string>()

  for (const channel of channels) {
    if (typeof channel.id !== 'string' || channel.id.length === 0) {
      issues.push(`channel id rong`)
    } else if (ids.has(channel.id)) {
      issues.push(`channel id lap lai '${channel.id}'`)
    } else {
      ids.add(channel.id)
    }

    if (typeof channel.bandRealmId !== 'string' || channel.bandRealmId.length === 0) {
      issues.push(`channel '${channel.id}' bandRealmId rong`)
    }

    if (channel.kind === 'hidden_beast') {
      if (typeof channel.enemyId !== 'string' || channel.enemyId.length === 0) {
        issues.push(`channel '${channel.id}' enemyId rong`)
      }

      if (!Number.isInteger(channel.killThreshold) || channel.killThreshold <= 0) {
        issues.push(`channel '${channel.id}' killThreshold phai la int > 0`)
      }

      if (!(channel.spawnChancePerSpawn > 0 && channel.spawnChancePerSpawn <= 1)) {
        issues.push(`channel '${channel.id}' spawnChancePerSpawn ngoai (0,1]`)
      }

      if (
        channel.guaranteedSpawnAfterKills !== undefined &&
        (!Number.isInteger(channel.guaranteedSpawnAfterKills) ||
          channel.guaranteedSpawnAfterKills < channel.killThreshold)
      ) {
        issues.push(
          `channel '${channel.id}' guaranteedSpawnAfterKills phai la int >= killThreshold`,
        )
      }

      const pair = `${channel.bandRealmId}:${channel.enemyId}`
      if (beastPairs.has(pair)) {
        issues.push(`hai hidden_beast channel cung (band, enemy) '${pair}'`)
      }
      beastPairs.add(pair)
    } else if (channel.kind === 'grotto') {
      if (typeof channel.materialId !== 'string' || channel.materialId.length === 0) {
        issues.push(`channel '${channel.id}' materialId rong`)
      }

      if (!(channel.chancePerCycle > 0 && channel.chancePerCycle <= 1)) {
        issues.push(`channel '${channel.id}' chancePerCycle ngoai (0,1]`)
      }

      if (
        channel.guaranteedAfterCycles !== undefined &&
        (!Number.isInteger(channel.guaranteedAfterCycles) || channel.guaranteedAfterCycles <= 0)
      ) {
        issues.push(`channel '${channel.id}' guaranteedAfterCycles phai la int > 0`)
      }
    } else {
      const malformed: HiddenMaterialChannelBase = channel
      issues.push(`channel '${malformed.id}' kind khong hop le`)
    }
  }

  return issues
}

export function assertHiddenMaterialChannels(
  channels: readonly HiddenMaterialChannel[] = HIDDEN_MATERIAL_CHANNELS,
): void {
  const issues = validateHiddenMaterialChannels(channels)

  if (issues.length > 0) {
    throw new Error(`HIDDEN_MATERIAL_CHANNELS khong hop le: ${issues.join('; ')}`)
  }
}

// Module-load gate: a malformed canonical registry fails the suite at
// import time instead of silently shipping broken channels.
assertHiddenMaterialChannels()
