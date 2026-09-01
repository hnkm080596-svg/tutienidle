import type { OnHitContext, TriggerBinding, TriggerContextMap, TriggerType } from './SkillTrigger'
import type { CombatEntity } from '../combat/CombatEntity'
import type { SkillEffectContext } from './SkillEffectSystem'
import type { ActionExecutionHelpers } from './SkillActionRegistry'
import { runSkillAction } from './SkillActionRegistry'

/**
 * Matches a firing TriggerType against skill.triggers and runs the bound
 * actions in declared order, sharing one ActionRuntimeContext scratch
 * object per binding so a later action can read an earlier action's
 * result. Each action also receives a `fireNested` helper bound to the
 * SAME triggers/source/target/ctx, so an executor (applyAilment,
 * grantResource, consumeResource) can fire onProc/onResourceFull/onBreak
 * on the same skill without needing its own copy of the runner.
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
      const runtime = {
        ...(hitContext.damageDealt !== undefined
          ? { damageDealt: hitContext.damageDealt, isCrit: hitContext.isCrit }
          : {}),
      }

      const helpers: ActionExecutionHelpers = {
        fireNested: (nestedTrigger, nestedContext) => {
          this.fire(nestedTrigger, nestedContext, triggers, source, target, ctx)
        },
      }

      for (const action of binding.actions) {
        runSkillAction(action, source, target, ctx, runtime, helpers)
      }
    }
  }
}
