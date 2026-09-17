// ReactionTestFixtures.ts -- fixture world builder + fixture ids
// (megaplan M1). The ONLY place fixture ids live: 5 elemental seal defs
// + 4 status defs + a real BuffSystem + the REAL validating
// ElementalStateRegistry (never a stub -- the gate/board fidelity depends
// on sharing one registry with the system under test).
//
// world.applyElement routes a REAL ApplyBuffRequest (eligibility
// 'eligible' by default) through the system and returns the fabricated
// ElementalApplicationCommitted envelope the committed apply produced.

import type { ElementType } from '../../element/ElementType'
import type {
  BuffDefinitionId,
  BuffInstanceId,
  CombatEntityId,
  CombatEventId,
} from '../../battle/contracts/ids'
import type { ApplyBuffRequest } from '../../battle/contracts/operations'
import type { CombatOperationOrigin } from '../../battle/contracts/origin'
import type { CombatAuthorityExecutionContext } from '../../battle/contracts/context'
import type {
  CombatEventPayload,
  ElementalApplicationCommitted,
  PendingCombatEvent,
} from '../../battle/contracts/events'
import { createCapabilityValidatorRegistry } from '../../battle/runtime/capability/CapabilityValidatorRegistry'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import { BuffRegistry } from '../../buff2/BuffRegistry'
import { BuffStore } from '../../buff2/BuffStore'
import { BuffSystem } from '../../buff2/BuffSystem'
import type {
  BuffEntityReadPort,
  BuffStatReadPort,
  DamageProfileSnapshotPort,
} from '../../buff2/BuffSystem'
import { ApplicationResolver } from '../../buff2/ApplicationResolver'
import {
  makeCollectingSink,
  makeTestDamageProfiles,
  makeTestRng,
  TEST_ENTITIES,
  type CollectedEvents,
  type TestRng,
} from '../../buff2/testing/BuffTestFixtures'
import { createElementalStateRegistry } from '../ElementalStateRegistry'
import type { ElementalStateRegistry } from '../ElementalStateRegistry'
import type { ReactionDefinition } from '../ReactionDefinition'

export { TEST_ENTITIES }

export const TEST_ELEMENT_BUFF_IDS: Record<ElementType, BuffDefinitionId> = {
  fire: 'test_seal_fire' as BuffDefinitionId,
  water: 'test_seal_water' as BuffDefinitionId,
  wood: 'test_seal_wood' as BuffDefinitionId,
  metal: 'test_seal_metal' as BuffDefinitionId,
  earth: 'test_seal_earth' as BuffDefinitionId,
}

export const TEST_STATUS_BUFF_IDS = {
  bleed: 'test_bleed' as BuffDefinitionId,
  defenseBreak: 'test_defense_break' as BuffDefinitionId,
  defenseErosion: 'test_defense_erosion' as BuffDefinitionId,
  camCong: 'test_cam_cong' as BuffDefinitionId,
} as const

function elementalDef(element: ElementType): BuffDefinition {
  return {
    id: TEST_ELEMENT_BUFF_IDS[element],
    name: `Test Seal ${element}`,
    kind: 'ailment',
    element,
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' },
    application: { resistance: 'none' },
    dispellable: true,
  }
}

function statusDef(id: BuffDefinitionId, extra?: Partial<BuffDefinition>): BuffDefinition {
  return {
    id,
    name: `Test Status ${id}`,
    kind: 'ailment',
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' },
    application: { resistance: 'none' },
    dispellable: true,
    ...extra,
  }
}

/** Fixture CANONICAL_REACTIONS -- the locked ids/priorities with minimal
    payoff steps (M4 authors the real payoff data). Covers all 10
    canonical pairs so registry coverage validation passes. */
export function makeCanonicalReactionDefs(): ReactionDefinition[] {
  const sinh = (
    id: string,
    parent: ElementType,
    child: ElementType,
    selectionTiePriority: number,
  ): ReactionDefinition => ({
    id,
    relation: 'sinh',
    selectionTiePriority,
    elements: { parent, child },
    payoff: {
      steps: [{ kind: 'add_child_stacks', stacks: { op: 'const', value: 1 } }],
    },
  })
  const khac = (
    id: string,
    attacker: ElementType,
    defender: ElementType,
    selectionTiePriority: number,
  ): ReactionDefinition => ({
    id,
    relation: 'khac',
    selectionTiePriority,
    elements: { attacker, defender },
    payoff: {
      steps: [
        {
          kind: 'reaction_damage',
          coefficient: { op: 'const', value: 1 },
          damageProfile: 'test_profile',
          element: 'attacker',
        },
      ],
    },
  })
  return [
    sinh('duong_viem', 'wood', 'fire', 10),
    sinh('luyen_tho', 'fire', 'earth', 20),
    sinh('duong_kim', 'earth', 'metal', 30),
    sinh('tu_thuy', 'metal', 'water', 40),
    sinh('nhuan_moc', 'water', 'wood', 50),
    khac('tuc_viem', 'water', 'fire', 60),
    khac('dung_kim', 'fire', 'metal', 70),
    khac('doan_moc', 'metal', 'wood', 80),
    khac('xuyen_tho', 'wood', 'earth', 90),
    khac('tran_thuy', 'earth', 'water', 100),
  ]
}

export interface ReactionTestWorld {
  readonly system: BuffSystem
  readonly registry: BuffRegistry
  readonly store: BuffStore
  readonly elements: ElementalStateRegistry
  readonly rng: TestRng
  readonly alive: Set<CombatEntityId>
  readonly sink: CollectedEvents & { emit(e: CombatEventPayload): void }
  /** Scripted op ctx (sequence mints per world). */
  makeCtx(origin?: Partial<CombatOperationOrigin>): CombatAuthorityExecutionContext
  /** Real apply through the system; returns the fabricated committed
      envelope (eventId/combatSequence) or undefined when the apply
      produced no elemental commit (failed roll / non-elemental). */
  applyElement(
    sourceId: CombatEntityId,
    targetId: CombatEntityId,
    element: ElementType,
    stacks: number,
    opts?: { reactionEligibility?: 'eligible' | 'suppressed' },
  ): ElementalApplicationCommitted | undefined
}

export function createReactionTestWorld(): ReactionTestWorld {
  const elements = createElementalStateRegistry(TEST_ELEMENT_BUFF_IDS)
  const rng = makeTestRng()
  const alive = new Set<CombatEntityId>(Object.values(TEST_ENTITIES))
  const sink = makeCollectingSink()

  const registry = new BuffRegistry({
    damageProfiles: makeTestDamageProfiles(),
    capabilityValidators: createCapabilityValidatorRegistry(),
  })
  for (const e of Object.keys(TEST_ELEMENT_BUFF_IDS) as ElementType[]) {
    registry.register(elementalDef(e))
  }
  registry.register(statusDef(TEST_STATUS_BUFF_IDS.bleed))
  registry.register(statusDef(TEST_STATUS_BUFF_IDS.defenseBreak))
  registry.register(statusDef(TEST_STATUS_BUFF_IDS.defenseErosion))
  registry.register(
    statusDef(TEST_STATUS_BUFF_IDS.camCong, { forbiddenActionTags: ['attack'] }),
  )
  registry.seal()

  const store = new BuffStore(
    (() => {
      let n = 0
      return () => `buff.test_reaction.${++n}` as BuffInstanceId
    })(),
  )

  const stats: BuffStatReadPort = { getStats: () => undefined }
  const entities: BuffEntityReadPort = { isAlive: (id) => alive.has(id) }
  const snapshots: DamageProfileSnapshotPort = {
    capture: () => ({}),
  }

  const system = new BuffSystem(
    store,
    registry,
    new ApplicationResolver(rng),
    stats,
    entities,
    snapshots,
    elements,
  )

  let seq = 0
  let eventSeq = 0

  const makeCtx: ReactionTestWorld['makeCtx'] = (origin = {}) => {
    const full: CombatOperationOrigin = {
      kind: 'skill',
      originId: 'test_reaction_op',
      sourceId: TEST_ENTITIES.sourceA,
      rootActionId: 'root.test_reaction.1',
      ...origin,
    }
    return {
      operationId: `op.test_reaction.${++seq}`,
      origin: full,
      events: sink,
      combatSequence: ++seq * 100,
    }
  }

  return {
    system,
    registry,
    store,
    elements,
    rng,
    alive,
    sink,
    makeCtx,
    applyElement(sourceId, targetId, element, stacks, opts = {}) {
      const ctx = makeCtx()
      const req: ApplyBuffRequest = {
        definitionId: TEST_ELEMENT_BUFF_IDS[element],
        sourceId,
        targetId,
        stacks,
        baseChance: 1,
        reactionEligibility: opts.reactionEligibility ?? 'eligible',
        origin: ctx.origin,
      }
      const before = sink.events.length
      const result = system.apply(req, ctx)
      if (!result.applied) return undefined
      const emitted = sink.events
        .slice(before)
        .find(
          (e): e is Extract<PendingCombatEvent, { type: 'elemental_application_committed' }> =>
            e.type === 'elemental_application_committed',
        )
      if (emitted === undefined) return undefined
      // Fabricate the envelope the scheduler would have stamped -- the
      // collecting sink stores the envelope-free payload verbatim.
      const { eventId: _unminted, ...rest } = emitted
      void _unminted
      return {
        ...rest,
        eventId: `evt.test_reaction.${++eventSeq}` as CombatEventId,
        combatSequence: ++seq * 100,
      }
    },
  }
}
