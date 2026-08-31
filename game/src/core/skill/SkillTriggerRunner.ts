import type { OnHitContext, TriggerBinding, TriggerContextMap, TriggerType } from './SkillTrigger'
import type { CombatEntity } from '../combat/CombatEntity'
import type { SkillEffectContext } from './SkillEffectSystem'
import type { ActionRuntimeContext } from './SkillAction'
import { runSkillAction } from './SkillActionRegistry'

/**
 * Matches a firing TriggerType against skill.triggers and runs the bound
 * actions in declared order, sharing one ActionRuntimeContext scratch
 * object per binding so a later action can read an earlier action's
 * result (e.g. a future consumeForDamage → heal chain).
 */
export class SkillTriggerRunner {
  fire<T extends TriggerType>(
    trigger: T,
    context: TriggerContextMap[T],
    triggers: TriggerBinding[] | undefined,
    source: CombatEntity,
    target: CombatEntity,
    ctx: SkillEffectContext,
  ): void {
    const bindings = (triggers ?? []).filter(
      (binding): binding is TriggerBinding<T> => binding.trigger === trigger,
    )

    for (const binding of bindings) {
      const hitContext = context as Partial<OnHitContext>
      const runtime: ActionRuntimeContext =
        hitContext.damageDealt !== undefined
          ? { damageDealt: hitContext.damageDealt, isCrit: hitContext.isCrit }
          : {}

      for (const action of binding.actions) {
        runSkillAction(action, source, target, ctx, runtime)
      }
    }
  }
}
