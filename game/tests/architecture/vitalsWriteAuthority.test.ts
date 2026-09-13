/**
 * R14.2 guard (R1 / AR-01) — combat vitals may only be written by the
 * vitals authority and the damage pipeline it hands off to.
 *
 * R1 (2026-09-08) made EntityVitalsSystem the single authority for
 * HP / MP / Ward / alive mutation: applyDamage, applyHealing, spendWard,
 * lethal survival (HP=1 grace), exactly-once death. Mission 0 AR-01 was
 * exactly this class of defect: callers wrote `target.currentHp -= ...`
 * directly and split the hit contract.
 *
 * Allowlist policy (evidence-based, not aspirational — R14 charter):
 * every allowed production file must own a distinct vitals contract that
 * R1 explicitly left in place. Anything NOT on the list must go through
 * CombatSystem/EntityVitalsSystem. New entries require a roadmap note with
 * the owning contract, not a silent add.
 *
 * Explicitly OUT of this guard's scope:
 * - Test files — fixtures may set up vitals directly; they are not
 *   production authority.
 *
 * Merge note (2026-09-11): the combat-turn-mechanism branch merged
 * (5718137e); its regions (`core/battle/turn/**`, `core/game/**`,
 * `presentation/**`) are now scanned like everything else. Post-merge
 * classification found exactly ONE unclassified writer — the wave-spawn
 * dead-spawn in GameManagerTurnBattleOps (allowlisted below with its
 * contract). CombatScene.ts and all of src/game/scenes are clean (only
 * the health-bar display mirror, exempted receiver-narrow below).
 */
import { describe, expect, it } from 'vitest'
import { join, relative } from 'node:path'
import { listProductionTs, readTs, SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()
const SRC_DIR = join(GAME_ROOT, 'src')

/**
 * Production files allowed to write vitals, with the contract each owns.
 * `vitalsFieldPattern` matches writes like `x.currentHp =`, `x.currentHp +=`,
 * `x.currentWard -=`, `entity.alive =`.
 */
const VITALS_WRITE_RE = /\.(currentHp|currentWard|currentMp|alive)\s*(?:[+\-*/]?=(?!=)|\+\+|--)/

interface AllowedFile {
  path: string
  contract: string
}

const ALLOWED: AllowedFile[] = [
  {
    path: 'src/core/combat/EntityVitalsSystem.ts',
    contract: 'THE vitals authority (R1): applyDamage/applyHealing/spendWard/lethal grace.',
  },
  {
    path: 'src/core/combat/CombatSystem.ts',
    contract:
      'Damage pipeline wrapping EntityVitalsSystem: manaShield absorption (currentMp), survive-lethal HP=1 grace, death flag write after lethal resolution.',
  },
  {
    path: 'src/core/artifact/ArtifactSystem.ts',
    contract:
      'Persistent overworld ward regen (THU_T12 ward-break recovery) — combat-independent vitals recovery, deliberately outside battle (R1 evidence).',
  },
  {
    path: 'src/core/skill/SkillActionRegistry.ts',
    contract:
      'Ward-break detonate: consumes SOURCE ward (currentWard = 0) before delegating damage to combatSystem.applyDirectDamage (R3 ward-consumption path).',
  },
  {
    path: 'src/core/skill/SkillEffectSystem.ts',
    contract:
      'Phap Tu ward-consumption bonus (consumesWardForDamage on SOURCE, currentWard = 0) delegating damage to combatSystem.applyDirectDamage (R3).',
  },
  {
    path: 'src/core/tribulation/TribulationDirector.ts',
    contract:
      'Mind-tribulation ghost HP snapshot restore (own director entity, not battle participants) — tribulation has its own time/outcome handling.',
  },
  {
    path: 'src/core/game/GameManagerAutoFarmOps.ts',
    contract:
      'Wave-spawn dead-spawn (post-merge 5718137e; moved to GameManagerAutoFarmOps during the large-file split): pre-defeated reward-shim entities spawn with alive=false before entering the reward stream — entity construction-time flag, not battle resolution. Sole write is `entity.alive = false` at spawn.',
  },
]

/**
 * Authority-synced mirrors: these files write vitals-named fields on
 * their own Phaser display structs (health-bar widgets), never on battle
 * entities. The exemption is receiver-narrow (`sprite.healthBar.*`) so a
 * real entity write (`entity.currentHp = ...`) inside the same file still
 * fails the guard. A7: mirrors consume display copies; they are not the
 * vitals authority.
 */
const MIRRORS: { path: string; narrow: RegExp; contract: string }[] = [
  {
    path: 'src/game/scenes/combat/combat-grid-view.ts',
    // Accepts both the sprite.healthBar.x form and the local-variable form
    // (`const healthBar = sprite.healthBar` then `healthBar.x =`); the
    // receiver is still the widget struct, never a battle entity.
    narrow: /(?:sprite\.)?healthBar\.(currentHp|maxHp)\s*[+\-]?=/,
    contract:
      'Mirrors the received HP display copy onto the Phaser EnemyHealthBar widget struct (own display state), not onto a CombatEntity.',
  },
  {
    path: 'src/core/battle/turn/TurnBattleSystem.ts',
    // Post-merge 5718137e: participant wrapper syncs its cache FROM the
    // vitals authority (`participant.alive = participant.entity.alive`).
    // RHS reads the authority; LHS is the wrapper's own cache field. Any
    // other vitals write in this file still fails.
    narrow: /participant\.alive\s*=\s*participant\.entity\.alive/,
    contract:
      'Participant wrapper re-syncs its alive cache from the entity (the vitals authority) at turn recompute/pacing (R2 AR-05 speed-cache sync does the same for speed).',
  },
]

interface Offender {
  file: string
  line: number
  text: string
  contract?: string
}

function collectOffenders(): { violations: Offender[]; unclassified: Offender[] } {
  const violations: Offender[] = []
  const unclassified: Offender[] = []
  for (const file of listProductionTs(SRC_DIR)) {
    const rel = relative(GAME_ROOT, file)
    const normalized = rel.replaceAll('\\', '/')
    const allowed = ALLOWED.find((a) => a.path === normalized)
    const mirror = MIRRORS.find((m) => m.path === normalized)
    const lines = readTs(file).split('\n')
    lines.forEach((line, idx) => {
      if (!VITALS_WRITE_RE.test(line)) return
      // Receiver-narrow display-mirror exemption: only the exact mirrored
      // receiver pattern is legal; any other vitals write in the same file
      // still lands in `unclassified`.
      if (mirror && mirror.narrow.test(line)) return
      const offender: Offender = { file: rel, line: idx + 1, text: line.trim() }
      if (allowed) {
        offender.contract = allowed.contract
        // Allowlisted but still recorded so the roadmap can audit volume.
        violations.push(offender)
      } else {
        unclassified.push(offender)
      }
    })
  }
  return { violations, unclassified }
}

describe('R14.2 — R1/AR-01: vitals writes only inside the vitals authority allowlist', () => {
  const { violations, unclassified } = collectOffenders()

  it('guard corpus is real (does not silently pass on an empty scan)', { timeout: SCAN_TIMEOUT }, () => {
    expect(violations.length + unclassified.length).toBeGreaterThan(5)
  })

  it('every allowlisted writer is still present in the codebase (no stale allowlist entries)', { timeout: SCAN_TIMEOUT }, () => {
    // A stale entry hides future files that might reuse the same path with a
    // DIFFERENT contract — force allowlist hygiene.
    const stale = ALLOWED.filter(
      (a) => !violations.some((v) => v.file.replaceAll('\\', '/') === a.path),
    )
    expect(
      stale.map((s) => `${s.path} no longer writes vitals — remove from allowlist`),
    ).toEqual([])
  })

  it('no production file outside the allowlist writes combat vitals directly', { timeout: SCAN_TIMEOUT }, () => {
    expect(
      unclassified.map((o) => `${o.file}:${o.line} ${o.text}`),
    ).toEqual([])
  })
})
