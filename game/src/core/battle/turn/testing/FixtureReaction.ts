// testing/FixtureReaction.ts -- M7 shared fixture composition for
// whole-stack contract/determinism suites.
//
// The deferred production wiring shape, fixture-only: an
// ElementalStateRegistry shared with the BuffSystem, a
// ReactionRegistry carrying all 10 canonical pairs, a capability query
// granting elemental_reaction_enabled to chosen sources, and the
// ReactionDispatcher registered as the scheduler's
// 'elemental_application_committed' immediate handler. Production
// stays inert -- nothing here may be imported by src code outside
// tests.

import type { BuffDefinition } from '../../../buff2/BuffDefinition'
import type { BuffRegistry } from '../../../buff2/BuffRegistry'
import type { ElementType } from '../../../element/ElementType'
import type { BuffDefinitionId, CombatEntityId } from '../../contracts/ids'
import type { ElementalApplicationCommitted } from '../../contracts/events'
import {
  createElementalStateRegistry,
  type ElementalStateRegistry,
} from '../../../reaction/ElementalStateRegistry'
import { BuffSystemBoardQuery } from '../../../reaction/ReactionBoard'
import { ReactionTriggerGate } from '../../../reaction/ReactionTriggerGate'
import { ReactionSystem } from '../../../reaction/ReactionSystem'
import { ReactionDispatcher } from '../../../reaction/ReactionDispatcher'
import { ReactionRegistry } from '../../../reaction/ReactionRegistry'
import { resolutionToBatch } from '../../../reaction/ReactionResolution'
import { ELEMENTAL_REACTION_CAPABILITY } from '../../../reaction/ReactionTypes'
import type { ReactionDefinition } from '../../../reaction/ReactionDefinition'
import { StaticCapabilityQuery } from '../../runtime/capability/StaticCapabilityQuery'
import type { TurnRuntimeFixture } from './TurnRuntimeFixtures'

// ---------------------------------------------------------------------------
// Element ids + the per-source elemental ailment def factory -- the same
// five-element map TurnRuntimeFixtures binds by default.
// ---------------------------------------------------------------------------

export const FIXTURE_ELEMENT_IDS: Record<ElementType, string> = {
  fire: 'hoa_an',
  water: 'han_tuc',
  wood: 'doc_can',
  metal: 'liet_thuong',
  earth: 'tran_an',
}

export function fixtureElementalDef(element: ElementType): BuffDefinition {
  return {
    id: FIXTURE_ELEMENT_IDS[element] as BuffDefinitionId,
    name: `Contract Seal ${element}`,
    kind: 'ailment',
    element,
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' },
    application: { resistance: 'none' },
    dispellable: true,
  }
}

/** The shared elemental-state registry -- pass the SAME instance to
    makeTurnRuntime({ elements }) and attachFixtureReaction so the
    BuffSystem and the fixture reaction components read one map. */
export function createFixtureElementalStates(): ElementalStateRegistry {
  return createElementalStateRegistry(
    Object.fromEntries(
      (Object.entries(FIXTURE_ELEMENT_IDS) as [ElementType, string][]).map(
        ([e, id]) => [e, id as BuffDefinitionId],
      ),
    ) as Record<ElementType, BuffDefinitionId>,
  )
}

// ---------------------------------------------------------------------------
// Fixture reaction defs -- all 10 canonical pairs (registry coverage rule).
// Payoff damage rides the 'reaction' damage-profile channel the real
// CombatSystemDamageAdapter resolves by origin.kind 'reaction'.
// ---------------------------------------------------------------------------

export function makeFixtureReactionDefs(): ReactionDefinition[] {
  const sinh = (
    id: string,
    parent: ElementType,
    child: ElementType,
    selectionTiePriority: number,
  ): ReactionDefinition => ({
    id: id as ReactionDefinition['id'],
    relation: 'sinh',
    selectionTiePriority,
    elements: { parent, child },
    payoff: { steps: [{ kind: 'add_child_stacks', stacks: { op: 'const', value: 1 } }] },
  })
  const khac = (
    id: string,
    attacker: ElementType,
    defender: ElementType,
    selectionTiePriority: number,
    extraSteps: ReactionDefinition['payoff']['steps'] = [],
  ): ReactionDefinition => ({
    id: id as ReactionDefinition['id'],
    relation: 'khac',
    selectionTiePriority,
    elements: { attacker, defender },
    payoff: {
      steps: [
        {
          kind: 'reaction_damage',
          coefficient: { op: 'const', value: 1 },
          damageProfile: 'reaction',
          element: 'attacker',
        },
        ...extraSteps,
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
    // tran_thuy carries the kill-sized payoff + trailing apply_status the
    // sec.96 whole-stack scenario needs (the other khac defs stay lethal-
    // neutral so unrelated scenarios keep their targets alive).
    {
      id: 'tran_thuy' as ReactionDefinition['id'],
      relation: 'khac',
      selectionTiePriority: 100,
      elements: { attacker: 'earth', defender: 'water' },
      payoff: {
        steps: [
          {
            kind: 'reaction_damage',
            coefficient: { op: 'const', value: 999_999_999 },
            damageProfile: 'reaction',
            element: 'attacker',
          },
          { kind: 'apply_status', definitionId: 'qa_bleed' as BuffDefinitionId },
        ],
      },
    },
  ]
}

// ---------------------------------------------------------------------------
// Composition -- the deferred production wiring, attached inside tests only.
// ---------------------------------------------------------------------------

export interface FixtureReactionComposition {
  readonly capabilities: StaticCapabilityQuery
  readonly boardQuery: BuffSystemBoardQuery
  readonly gate: ReactionTriggerGate
  readonly reactionRegistry: ReactionRegistry
  readonly reactionSystem: ReactionSystem
  readonly dispatcher: ReactionDispatcher
}

/** Grants elemental_reaction_enabled to the listed sources and registers
    the dispatcher on the runtime scheduler's immediate lane. */
export function attachFixtureReaction(opts: {
  runtime: TurnRuntimeFixture
  registry: BuffRegistry
  elements: ElementalStateRegistry
  grantedSourceIds: readonly string[]
}): FixtureReactionComposition {
  const capabilities = new StaticCapabilityQuery(
    new Map(
      opts.grantedSourceIds.map((id) => [
        id as CombatEntityId,
        new Set([ELEMENTAL_REACTION_CAPABILITY]),
      ]),
    ),
  )
  const boardQuery = new BuffSystemBoardQuery(opts.runtime.buffs, opts.elements)
  const gate = new ReactionTriggerGate(capabilities, opts.elements)
  const reactionRegistry = new ReactionRegistry(
    makeFixtureReactionDefs(),
    opts.elements,
    (id) => opts.registry.has(id as BuffDefinitionId),
  )
  const reactionSystem = new ReactionSystem(reactionRegistry, boardQuery, gate)
  const dispatcher = new ReactionDispatcher(gate, reactionSystem, opts.elements, resolutionToBatch)
  opts.runtime.scheduler.registerImmediateHandler(
    'elemental_application_committed',
    (event, sink) =>
      dispatcher.onElementalApplicationCommitted(
        event as ElementalApplicationCommitted,
        sink,
      ),
  )
  return { capabilities, boardQuery, gate, reactionRegistry, reactionSystem, dispatcher }
}
