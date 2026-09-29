/**
 * No per-skill-id runtime branches (impact-sync sec.70).
 *
 * The whole point of the impact-sync path is that presentation resolves
 * from DECLARED facts (castClips maps, slotRole, markers) - never from a
 * hardcoded skill id. A regression that adds `skillId === 'phan_kich'` or
 * `cast.resolvedSkillId === 'linh_bao'` in the runtime path would quietly
 * reintroduce the per-skill runtime branch this work deletes. The scan
 * pins the four surfaces that must stay data-driven.
 *
 * Companion proof lives in companionSeam.test.ts: a brand-new mapping works
 * with zero edits to any of these files.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const GAME_ROOT = path.resolve(__dirname, '..', '..')

// The cast/presentation path surfaces that must never branch on a skill id.
const SCANNED = [
  'src/game/scenes/CombatScene.ts',
  'src/core/battle/turn/CombatAnimationRuntime.ts',
  'src/presentation/skills/SkillPresentationRunner.ts',
  'src/game/scenes/combat/combat-animation-playback.ts',
]

// A skill-id branch is a comparison whose literal is a member of a known
// skill-id namespace or a `-`/`_`-joined identifier compared to a skill-ish
// binding. Detected shapes:
//   resolvedSkillId === 'x'   rootSkillId === 'x'   skillId === 'x'
//   castClips['x']            cast.resolvedSkillId === 'x'
// `slotRole` values ('basic'|'special'|'ultimate'|'none') are roles, not
// skill ids - those comparisons stay legal.
const BRANCH_RE =
  /\b(?:resolvedSkillId|rootSkillId|skillId)\s*(?:===|!==)\s*'[^']+'|castClips\s*\[\s*'[^']+'\s*\]/

describe('no per-skill-id runtime branches (sec.70)', () => {
  it('the cast path never compares a skill-id field to a literal', () => {
    const offenders: string[] = []

    for (const file of SCANNED) {
      const source = readFileSync(path.join(GAME_ROOT, file), 'utf8')
      for (const [index, line] of source.split('\n').entries()) {
        // Comment lines may legitimately mention skill ids in prose.
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
          continue
        }
        if (BRANCH_RE.test(line)) {
          offenders.push(`${file}:${index + 1}: ${trimmed}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('the scan itself has teeth - a canary branch is detected', () => {
    expect(BRANCH_RE.test("if (cast.resolvedSkillId === 'linh_bao') return")).toBe(true)
    expect(BRANCH_RE.test("const c = variant.castClips['linh_bao']")).toBe(true)
    // Legal shapes the scan must NOT flag:
    expect(BRANCH_RE.test("cast.slotRole === 'ultimate'")).toBe(false)
    expect(BRANCH_RE.test('variant.castClips[cast.resolvedSkillId]')).toBe(false)
    expect(BRANCH_RE.test('variant.castClips[key]')).toBe(false)
  })
})
