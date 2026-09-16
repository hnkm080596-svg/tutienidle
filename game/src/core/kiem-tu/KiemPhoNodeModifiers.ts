import type { PlayerData } from '../player/Player'
import type { ProgressionNode } from '../progression/ProgressionNode'
import type { KiemPhoCombo, KiemPhoComboModifier } from './KiemPhoSystem'
import { nodeWayApplies } from '../progression/NodeSystem'

// Kiem Tu Reimagined Task 11 (spec §4.2) — converts purchased nodes
// carrying `effect.kiemTuComboModifier` into the runtime modifier hooks
// KiemPhoProvider applies at combo-fire time. Data → behavior mapping
// lives HERE so node defs stay declarative and the provider never
// learns node ids.
//
// Modifier semantics (apply returns a DERIVED copy, spec's mutation ban):
//   minOrbCount          matches(): pattern has >= count of `orb`
//   bonusDamageMultiplier  damage.multiplier *= (1 + x) (no-op w/o damage)
//   appliesBuff          attach to the combo; same definitionId merges
//                        stacks, different ids COEXIST (a combo matching
//                        several capstones keeps every granted buff)
//   bonusAilmentStacks   add stacks to every buff the combo carries
//   priority             sort key, default 0

export function collectKiemPhoComboModifiers(
  player: PlayerData,
  nodes: readonly ProgressionNode[],
): KiemPhoComboModifier[] {
  const modifiers: KiemPhoComboModifier[] = []

  for (const node of nodes) {
    const data = node.effect.kiemTuComboModifier

    if (!data || (player.nodeLevels?.[node.id] ?? 0) <= 0 || !nodeWayApplies(player, node)) {
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

        const granted = data.appliesBuff
        if (granted) {
          const buffs = [...(derived.appliesBuffs ?? [])]
          const existing = buffs.findIndex(
            (b) => b.definitionId === granted.definitionId && b.target === granted.target,
          )
          if (existing >= 0) {
            buffs[existing] = {
              ...buffs[existing]!,
              stacks: (buffs[existing]!.stacks ?? 1) + (granted.stacks ?? 1),
            }
          } else {
            buffs.push({ ...granted })
          }
          derived.appliesBuffs = buffs
        }

        if (data.bonusAilmentStacks && derived.appliesBuffs?.length) {
          derived.appliesBuffs = derived.appliesBuffs.map((b) => ({
            ...b,
            stacks: (b.stacks ?? 1) + data.bonusAilmentStacks!,
          }))
        }

        return derived
      },
    })
  }

  return modifiers
}
