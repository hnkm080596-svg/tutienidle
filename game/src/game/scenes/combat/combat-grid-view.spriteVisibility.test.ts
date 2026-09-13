// @vitest-environment jsdom
//
// combat-grid-view.spriteVisibility.test.ts — regression for the 2026-09-12
// "floating HP bars" bug: sprite.rect.setVisible() hid ONLY the body
// GameObject, while label / shadow / healthBar (background + fill) are
// separate GameObjects and kept rendering over the invisible combatant
// during intro / countdown. CombatGridView.setSpriteVisible() is now the
// single owner that toggles all parts together - callers must not touch
// sprite.rect.setVisible directly.
import { describe, expect, it, vi } from 'vitest'
import { CombatGridView } from './combat-grid-view'
import type { CombatGridViewHost } from './CombatGridViewHost'
import type { EntitySprite } from './combatTypes'

function part() {
  return { setVisible: vi.fn() }
}

// EntitySprite-shaped fake: every GameObject part is an object that only
// records setVisible calls. `withExtras` toggles shadow + healthBar off
// to model the player-shaped sprite (no shadow in flat mode, no bar).
function fakeSprite(withExtras = true) {
  const sprite = {
    rect: part(),
    label: part(),
    ...(withExtras
      ? {
          shadow: part(),
          healthBar: { background: part(), fill: part() },
        }
      : {}),
  }

  return sprite as unknown as EntitySprite
}

// setSpriteVisible never touches the host, so an empty fake host is
// enough to build the view.
const gridView = new CombatGridView({} as unknown as CombatGridViewHost)

describe('CombatGridView.setSpriteVisible - whole-sprite visibility owner', () => {
  it('false hides all five parts, true shows all five (enemy-shaped sprite)', () => {
    const sprite = fakeSprite()
    const parts = [
      sprite.rect,
      sprite.label,
      sprite.shadow,
      sprite.healthBar?.background,
      sprite.healthBar?.fill,
    ]

    gridView.setSpriteVisible(sprite, false)

    for (const p of parts) {
      expect(p?.setVisible).toHaveBeenCalledWith(false)
    }

    gridView.setSpriteVisible(sprite, true)

    for (const p of parts) {
      expect(p?.setVisible).toHaveBeenCalledWith(true)
    }
  })

  it('player-shaped sprite (no shadow, no healthBar) toggles rect + label without throwing', () => {
    const sprite = fakeSprite(false)

    expect(() => gridView.setSpriteVisible(sprite, false)).not.toThrow()
    expect(sprite.rect.setVisible).toHaveBeenCalledWith(false)
    expect(sprite.label.setVisible).toHaveBeenCalledWith(false)

    expect(() => gridView.setSpriteVisible(sprite, true)).not.toThrow()
    expect(sprite.rect.setVisible).toHaveBeenCalledWith(true)
    expect(sprite.label.setVisible).toHaveBeenCalledWith(true)
  })
})
