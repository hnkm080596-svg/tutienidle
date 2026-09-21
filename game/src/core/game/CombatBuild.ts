// P2 - canonical build composition. One pure resolver produces the
// player-side combat build ONCE per battle entry, replacing the ad-hoc
// recombination GameManagerTurnBattleOps used to perform inline. The
// resolver composes - it does not own per-channel rules: stat content
// stays owned by GameManagerPersistentEffectOps / path modules / node
// registry / equipment bag; kit semantics by CultivationPathRuntime;
// formation by resolvePartyFormation; companions by core/companion.
//
// Determinism contract: resolveCombatBuild is a pure function of its
// arguments - no Math.random, no Date.now, no Phaser, no store reads.
// Registry reads are snapshotted at resolve time; session-scoped inputs
// (cycle RNG, battle-local buff authority, participant references) arrive
// through bound factories on the build. One sanctioned output write: the
// resolved entity's maxThe - a minted entity is resolver-created, and the
// raw override gets the same in-place stamp TurnBattleAdapter performed.
import type { CombatEntity } from '../combat/CombatEntity'
import type { SurviveLethalSource } from '../combat/CombatSystem'
import type { BuffDefinitionId } from '../battle/contracts/ids'
import type { TurnSkillDefinition, DynamicBasicProvider } from '../battle/turn/TurnSkillAction'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import type { StatDomain } from '../stats/StatDomain'
import type { StatModifier } from '../stats/StatCalculator'
import type { Stats } from '../stats/StatBlock'
import type { PlayerData } from '../player/Player'
import { playerToCombatEntity, resolvePlayerStatAssembly } from '../player/Player'
import type { CultivationPathId, PathCapability, CultivationWayId } from '../player/CultivationPathKit'
import { getActivePath, getActiveWay } from '../player/CultivationPathSystem'
import { resolveCombatSkillRoles } from '../player/CultivationPathRoles'
import type { CultivationPathRuntime } from '../player/CultivationPathRuntime'
import type { ProgressionNode } from '../progression/ProgressionNode'
import type { PartyFormationSlot } from './PartyFormation'
import { DEFAULT_PARTY_FORMATION } from './PartyFormation'
import { resolvePartyFormation } from './FormationPlacement'
import type { CompanionDefinition, CompanionInstance } from '../../data/companion/Companions'
import { companionToCombatEntity } from '../companion/CompanionCombat'
import { resolveCompanionSkillKit } from '../companion/CompanionProgression'
import { TRAN_PHAP_FORMATIONS } from '../../data/formation/TranPhap'
import { VAN_PHAP_THAN_HOA_ID } from '../../data/buff/ReactionStatusBuffs'
import { GENERIC_PHYSICAL_BASIC } from '../../data/skill/TurnBasicAttacks'

/** The static modifier channels a resolved build attributes (M0 census). */
export type BuildStatChannel =
  | 'player_bag'
  | 'technique_tier'
  | 'cultivation_path'
  | 'phap_tu_route'
  | 'node_levels'
  | 'technique_combat'
  | 'way_facet'

export interface ResolvedModifierChannel {
  readonly channel: BuildStatChannel
  readonly partition: 'static'
  readonly modifiers: readonly StatModifier[]
}

export interface ResolvedCombatKit {
  readonly basic: TurnSkillDefinition
  readonly special?: TurnSkillDefinition
  readonly ultimate?: TurnSkillDefinition
  readonly reactivePayloads?: Record<string, TurnSkillDefinition>
  /** NO maxThe here - the build consumed it into entity.maxThe. */
  readonly statDomains?: readonly StatDomain[]
  /**
   * Session-scoped: ops mints the provider with the cycle RNG stream.
   * Closes over the node snapshot taken at resolve time - the only
   * post-resolution input is rng; no registry read may occur inside.
   */
  readonly buildDynamicBasic?: (rng: () => number) => DynamicBasicProvider | undefined
}

export interface ResolvedEntryBuff {
  readonly definitionId: string
  readonly sourceId: string
  readonly targetId: string
  /**
   * True only for save-derived ids (the Tran Phap formation buff):
   * ops graceful-skips when the battle-local registry lacks the id.
   * Compile-time ids (kit clones, aura) are applied unconditionally -
   * a missing definition must surface as an error, not a silent skip.
   */
  readonly gracefulSkip?: boolean
}

export interface ResolvedCompanionBuild {
  readonly instance: CompanionInstance
  readonly definition: CompanionDefinition
  /** row/column already applied from the formation slot. */
  readonly entity: CombatEntity
  /**
   * Priority = source-array index + 100 - a skipped companion must not
   * shift the surviving companions' priorities (flatMap parity).
   */
  readonly priority: number
  readonly basic: TurnSkillDefinition
  readonly special?: TurnSkillDefinition
  readonly ultimate?: TurnSkillDefinition
  /** This companion's kit-clone grants (self-sourced, self-targeted). */
  readonly kitCloneBuffs: readonly ResolvedEntryBuff[]
}

export interface ResolvedCombatBuild {
  /** Committed pair via catalog resolution - undefined = mortal/fail-closed. */
  readonly identity: { path: CultivationPathId; way: CultivationWayId } | undefined
  readonly capabilities: ReadonlySet<PathCapability>
  /** undefined on the raw-entity path - ops supplies the entity. */
  readonly stats: Stats | undefined
  readonly modifierChannels: readonly ResolvedModifierChannel[]
  /**
   * The primary battle entity (players[0].entity): the minted entity when a
   * player source exists, the caller's primaryEntityOverride untouched on
   * the raw-entity path, undefined only when neither exists (ops throws).
   */
  readonly entity: CombatEntity | undefined
  readonly kit: ResolvedCombatKit
  readonly formation: readonly PartyFormationSlot[]
  readonly companions: readonly ResolvedCompanionBuild[]
  readonly entryBuffs: readonly ResolvedEntryBuff[]
  readonly survive: {
    readonly talentIds: readonly string[]
    readonly extraSources?: (
      participant: TurnBattleParticipant,
      hasActiveBuff: (definitionId: BuffDefinitionId) => boolean,
    ) => SurviveLethalSource[]
  }
  /**
   * ARCH-002 live partition binding - the engine calls this per refresh.
   * Literal entity.id === 'player' gate + LIVE getActivePlayer() read
   * (the ops closure semantics - a raw-entity battle receives []).
   */
  readonly liveModifiers: (entity: CombatEntity) => StatModifier[]
}

export interface CombatBuildDeps {
  getBattleBaseChannels(player: PlayerData): readonly ResolvedModifierChannel[]
  resolveCapabilities(player: PlayerData): ReadonlySet<PathCapability>
  getSkillLevels(): Record<string, number>
  /** Called ONCE at resolve - the provider thunk closes over the snapshot. */
  getProgressionNodes(): readonly ProgressionNode[]
  getCompanionDefinition(id: string): CompanionDefinition | undefined
  getLiveBattleModifiers(player: PlayerData): StatModifier[]
  /** Live read inside the provider closure - mirrors the ops seam. */
  getActivePlayer(): PlayerData | undefined
}

/**
 * The ARCH-002 live-partition provider, bound once and shared by the
 * resolved build AND the bootstrap engine in the ops ctor - one
 * implementation of the literal 'player' id gate + live getActivePlayer
 * read (a raw-entity id receives []; the modifiers follow the ACTIVE
 * player, refreshed per call).
 */
export function bindLiveModifiersProvider(deps: {
  getActivePlayer(): PlayerData | undefined
  getLiveBattleModifiers(player: PlayerData): StatModifier[]
}): (entity: CombatEntity) => StatModifier[] {
  return (entity) => {
    if (entity.id !== 'player') {
      return []
    }

    const player = deps.getActivePlayer()

    return player ? deps.getLiveBattleModifiers(player) : []
  }
}

// Runtime arrives resolved (ops' override-aware method); the resolver never
// dispatches itself. source === undefined returns the no-player minimal
// build: the override entity untouched (raw path keeps its own stats/
// skillLevels/maxThe), generic basic, default formation, no companions or
// entry buffs - identical to the old undefined-playerPath assembly branch.
export function resolveCombatBuild(
  source: PlayerData | undefined,
  runtime: CultivationPathRuntime | undefined,
  deps: CombatBuildDeps,
  primaryEntityOverride?: CombatEntity,
): ResolvedCombatBuild {
  const liveModifiers = bindLiveModifiersProvider(deps)

  if (source === undefined) {
    return {
      identity: undefined,
      capabilities: new Set(),
      stats: undefined,
      modifierChannels: [],
      entity: primaryEntityOverride,
      kit: { basic: GENERIC_PHYSICAL_BASIC },
      formation: DEFAULT_PARTY_FORMATION,
      companions: [],
      entryBuffs: [],
      survive: { talentIds: [] },
      liveModifiers,
    }
  }

  const path = getActivePath(source)
  const way = getActiveWay(source)
  const identity = path !== undefined && way !== undefined ? { path, way } : undefined
  const capabilities = deps.resolveCapabilities(source)

  const baseChannels = deps.getBattleBaseChannels(source)
  const assembly = resolvePlayerStatAssembly(
    source,
    baseChannels.flatMap((channel) => channel.modifiers),
  )

  const modifierChannels: ResolvedModifierChannel[] = [
    { channel: 'player_bag', partition: 'static', modifiers: source.modifiers },
    ...baseChannels,
    { channel: 'way_facet', partition: 'static', modifiers: assembly.wayFacetModifiers },
  ]

  const entity = primaryEntityOverride ?? playerToCombatEntity(source, assembly.stats, deps.getSkillLevels())

  // --- Kit (M2) ----------------------------------------------------------
  // P7-M4 - role composition goes through the ONE seam
  // (resolveCombatSkillRoles): emblem precedence, reactive payloads and
  // the kit-declared The cap arrive resolved; the UI accessor consumes
  // the same composition so build and display cannot drift apart.
  // The node registry is read ONCE here; the provider thunk closes over the
  // snapshot so no registry read can occur after resolve returns.
  const nodes = deps.getProgressionNodes()
  const roles = runtime ? resolveCombatSkillRoles(source, runtime) : undefined
  const statDomains = runtime?.resolveStatDomains(source)
  const kit: ResolvedCombatKit = {
    basic: roles?.basic ?? GENERIC_PHYSICAL_BASIC,
    special: roles?.special,
    ultimate: roles?.ultimate,
    reactivePayloads: roles?.reactivePayloads,
    statDomains,
    buildDynamicBasic: runtime?.buildDynamicBasic
      ? (rng) => runtime.buildDynamicBasic!(source, nodes, rng)
      : undefined,
  }

  // entity.maxThe - the single write, per-path: a kit-declared cap
  // wins on both branches; otherwise the MINTED entity resolves through
  // the runtime (ops:1678 + the adapter stamp folded into one) while a
  // raw override keeps its own cap - resolveMaxThe never runs on the raw
  // path (today it never did; the adapter stamp was the only write).
  if (roles?.maxThe !== undefined) {
    entity.maxThe = roles.maxThe
  } else if (primaryEntityOverride === undefined) {
    entity.maxThe = runtime?.resolveMaxThe(source)
  }

  // --- Formation + companions (M3) --------------------------------------
  const formation = resolvePartyFormation(source)

  // Each companion mints a fresh CombatEntity per battle; a missing
  // definition OR a missing formation slot skips silently (ops parity).
  const collectClones = (
    slots: readonly (TurnSkillDefinition | undefined)[],
    ownerId: string,
  ): ResolvedEntryBuff[] =>
    slots.flatMap((slot) =>
      (slot?.grantsBuffsAtBuild ?? []).map((clone) => ({
        definitionId: clone.id as string,
        sourceId: ownerId,
        targetId: ownerId,
      })),
    )

  const companions: ResolvedCompanionBuild[] = (source.companions ?? []).flatMap((instance, index) => {
    const definition = deps.getCompanionDefinition(instance.definitionId)
    const slot = formation.find((entry) => entry.combatantId === instance.definitionId)

    if (!definition || !slot) {
      return []
    }

    const companionEntity = companionToCombatEntity(instance, definition)
    companionEntity.row = slot.row
    companionEntity.x = slot.column
    const companionKit = resolveCompanionSkillKit(definition, instance)

    return [
      {
        instance,
        definition,
        entity: companionEntity,
        priority: index + 100,
        basic: companionKit.basic,
        special: companionKit.special,
        ultimate: companionKit.ultimate,
        kitCloneBuffs: collectClones(
          [companionKit.basic, companionKit.special, companionKit.ultimate],
          companionEntity.id,
        ),
      },
    ]
  })

  // --- Entry-buff declarations (M3) - same order applyEntryBuffs applied:
  // formation buff x allies, aura x living allies, then kit clones scanning
  // player first then companions. The registry-membership skip stays in ops
  // (battle-local registry read, not build state).
  const allies: readonly CombatEntity[] = [entity, ...companions.map((c) => c.entity)]
  const entryBuffs: ResolvedEntryBuff[] = []

  const formationBuffId = source.formationLoadout
    ? TRAN_PHAP_FORMATIONS.find((c) => c.id === source.formationLoadout!.formationId)?.buff
        .definitionId
    : undefined
  if (formationBuffId !== undefined) {
    for (const ally of allies) {
      entryBuffs.push({
        definitionId: formationBuffId,
        sourceId: ally.id,
        targetId: ally.id,
        gracefulSkip: true,
      })
    }
  }

  if (capabilities.has('spell.reaction_aura')) {
    for (const ally of allies) {
      if (!ally.alive) continue
      entryBuffs.push({
        definitionId: VAN_PHAP_THAN_HOA_ID,
        sourceId: entity.id,
        targetId: ally.id,
      })
    }
  }

  // Kit-clone build buffs from the EFFECTIVE slots - the seam already
  // resolved emblem precedence into kit.special/ultimate, so the same
  // read applyEntryBuffs ran on the assembled participant (basic, then
  // special, then ultimate) holds.
  entryBuffs.push(
    ...collectClones(
      [kit.basic, kit.special, kit.ultimate],
      entity.id,
    ),
  )
  for (const companion of companions) {
    entryBuffs.push(...companion.kitCloneBuffs)
  }

  return {
    identity,
    capabilities,
    stats: assembly.stats,
    modifierChannels,
    entity,
    kit,
    formation,
    companions,
    entryBuffs,
    survive: {
      talentIds: source.selectedTalentIds,
      extraSources: runtime?.buildSurviveSources
        ? (participant, hasActiveBuff) => runtime.buildSurviveSources!(source, participant, hasActiveBuff)
        : undefined,
    },
    liveModifiers,
  }
}
