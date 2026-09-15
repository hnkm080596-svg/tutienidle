import type { PlayerData } from '../player/Player'
import type { ProgressionNode } from '../progression/ProgressionNode'
import type { KiemPhoCombo, KiemPhoComboModifier } from './KiemPhoSystem'
import { nodeModeApplies } from '../progression/NodeSystem'

// Kiem Tu Reimagined Task 11 (spec §4.2) — converts purchased nodes
// carrying `effect.kiemTuComboModifier` into the runtime modifier hooks
// KiemPhoProvider applies at combo-fire time. Data → behavior mapping
// lives HERE so node defs stay declarative and the provider never
// learns node ids.
//
// Modifier semantics (apply returns a DERIVED copy, spec's mutation ban):
//   minOrbCount          matches(): pattern has >= count of `orb`
//   bonusDamageMultiplier  damage.multiplier *= (1 + x) (no-op w/o damage)
//   appliesBuff          attach to the combo; same definitionId merges stacks
//   bonusAilmentStacks   add stacks to an existing appliesBuff
//   priority             sort key, default 0

export function collectKiemPhoComboModifiers(
  player: PlayerData,
  nodes: readonly ProgressionNode[],
): KiemPhoComboModifier[] {
  const modifiers: KiemPhoComboModifier[] = []

  for (const node of nodes) {
    const data = node.effect.kiemTuComboModifier

    if (!data || (player.nodeLevels?.[node.id] ?? 0) <= 0 || !nodeModeApplies(player, node)) {
      continue
    }

    modifiers.push({
      nodeId: node.id,
      priority: data.priority ?? 0,

      matches: combo =>
        combo.pattern.filter(orb => orb === data.minOrbCount.orb).length >= data.minOrbCount.count,

      apply: combo => {
        const derived: KiemPhoCombo = { ...combo, pattern: [...combo.pattern] }

        if (data.bonusDamageMultiplier && derived.damage) {
          derived.damage = { multiplier: derived.damage.multiplier * (1 + data.bonusDamageMultiplier) }
        }

        if (data.appliesBuff) {
          derived.appliesBuff =
            derived.appliesBuff?.definitionId === data.appliesBuff.definitionId
              ? {
                  ...derived.appliesBuff,
                  stacks: (derived.appliesBuff.stacks ?? 1) + (data.appliesBuff.stacks ?? 1),
                }
              : { ...data.appliesBuff }
        }

        if (data.bonusAilmentStacks && derived.appliesBuff) {
          derived.appliesBuff = {
            ...derived.appliesBuff,
            stacks: (derived.appliesBuff.stacks ?? 1) + data.bonusAilmentStacks,
          }
        }

        return derived
      },
    })
  }

  return modifiers
}
