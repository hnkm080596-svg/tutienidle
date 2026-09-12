/**
 * Guard — per-combatant sprite visibility has exactly one owner:
 * `combat/combat-entity-visual-lifecycle.ts` decides, and
 * `combat/combat-grid-view.ts` applies (it owns the sprite parts).
 *
 * Sources of authority:
 * - docs/qa/2026-09-12-hp-bar-visibility-quick.md — the user-reported bug:
 *   toggling only sprite.rect left label/shadow/health-bar floating on the
 *   field during intro/countdown.
 * - docs/roadmap.md "CombatScene rule" — CombatScene-owned lifecycle state
 *   extracts into a helper class (same precedent as combat-cast-bar.ts /
 *   combat-position-interpolation.ts) once evidence supports it.
 *
 * What this polices under src/game/scenes (non-test .ts, comment-blind):
 *   1. No sprite-part .setVisible() outside combat-grid-view.ts.
 *   2. No setSpriteVisible() call outside the two owner files.
 *   3. The retired ad-hoc field names (turnCountdownPendingIds,
 *      materializingIds, this/scene.playerMaterialized) stay gone.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { listProductionTs, readTs, SCAN_TIMEOUT } from './helpers/scanTs'

const SCENES_DIR = join(process.cwd(), 'src/game/scenes')
const GRID_VIEW = 'combat-grid-view.ts'
const LIFECYCLE = 'combat-entity-visual-lifecycle.ts'
// PlayerHudLayer owns its own screen-space HUD group (background/fill/label
// there are bar chrome, not entity-sprite parts) — outside this contract.
const HUD_LAYER = 'PlayerHudLayer.ts'

function stripComments(raw: string): string {
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function files() {
  return listProductionTs(SCENES_DIR).map((path) => ({
    path,
    name: path.replace(/\\/g, '/').split('/').pop() ?? path,
    code: stripComments(readTs(path)),
  }))
}

describe('entity visual lifecycle ownership', () => {
  it('only combat-grid-view touches sprite-part .setVisible()', { timeout: SCAN_TIMEOUT }, () => {
    const partSetVisible = /\b(rect|label|shadow|background|fill)\.setVisible\(/

    for (const file of files()) {
      if (file.name === GRID_VIEW || file.name === HUD_LAYER) {
        continue
      }

      expect(
        partSetVisible.test(file.code),
        `${file.name} must not toggle a sprite part directly — route through entityVisual/gridView.setSpriteVisible`,
      ).toBe(false)
    }
  })

  it('only the grid view and the lifecycle call setSpriteVisible()', { timeout: SCAN_TIMEOUT }, () => {
    for (const file of files()) {
      if (file.name === GRID_VIEW || file.name === LIFECYCLE) {
        continue
      }

      expect(
        /setSpriteVisible\(/.test(file.code),
        `${file.name} must not call setSpriteVisible — visibility decisions live in CombatEntityVisualLifecycle`,
      ).toBe(false)
    }
  })

  it('the retired ad-hoc lifecycle field names stay retired', { timeout: SCAN_TIMEOUT }, () => {
    const retired = /turnCountdownPendingIds|materializingIds|\b(this|scene)\.playerMaterialized\b/

    for (const file of files()) {
      expect(
        retired.test(file.code),
        `${file.name} references a retired visibility-state name — use scene.entityVisual`,
      ).toBe(false)
    }
  })
})
