import type { CombatEntity } from './CombatEntity'

// stat-system-reimagined Task 3 (D18-retire) -- the bespoke
// poisonRecoveryPercent stat retired from StatType. Poison recovery is
// a buff-effect TRIGGER, not a character stat: CombatSystem.applyDotDamage
// calls this query per DoT tick instead of reading source.stats.
//
// Task 4 implements the real read (authored buff effect on the source,
// e.g. Doc Can's "+2% HP recovery from poison damage per stack"). Until
// then the trigger is intentionally inert and always returns 0, so the
// DoT pipeline no longer depends on a stat that no longer exists.
export function dotRecoveryTriggers(source: CombatEntity): number {
  void source

  return 0
}
