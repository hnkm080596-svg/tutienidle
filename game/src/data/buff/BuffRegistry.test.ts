import { describe, expect, it } from 'vitest'
import { BUFF_REGISTRY } from './BuffRegistry'
import { buffs as LIVE_BUFFS } from './buffs'

// M4 — the registry IS the validating buff2 catalog now: every def is
// authored in the canonical shape and was already validated at module
// load (a malformed def would throw on import, before any test runs).
// These tests pin the migration invariants, not the legacy converter.

describe('BUFF_REGISTRY completeness', () => {
  it('loads every authored definition (sealed, validated)', () => {
    expect(LIVE_BUFFS.length).toBeGreaterThan(40)

    for (const def of LIVE_BUFFS) {
      const registered = BUFF_REGISTRY.get(def.id)
      expect(registered, `missing def: ${def.id}`).toBeDefined()
      expect(registered.name).toBe(def.name)
    }
  })

  it('no def keeps legacy `effects`/`stackMode`/`duration` fields', () => {
    for (const def of LIVE_BUFFS) {
      expect('effects' in def, `${def.id} still has effects[]`).toBe(false)
      expect('stackMode' in def, `${def.id} still has stackMode`).toBe(false)
      expect('duration' in def, `${def.id} still has top-level duration`).toBe(false)
    }
  })

  it('convertsToId refs resolve inside the catalog', () => {
    for (const def of LIVE_BUFFS) {
      if (def.convertsToId !== undefined) {
        const targetId = def.convertsToId
        expect(() => BUFF_REGISTRY.get(targetId), `${def.id}.convertsToId`).not.toThrow()
      }
    }
  })

  it('dot defs carry a legacy_dot periodic recipe', () => {
    for (const def of LIVE_BUFFS) {
      for (const p of def.periodic ?? []) {
        expect(p.type).toBe('damage')
        if (p.type !== 'damage') continue
        expect(p.damageProfile, `${def.id}.${p.id}`).toBe('legacy_dot')
        expect(p.timing).toBe('holder_turn_end')
      }
    }
  })

  it('capability grants carry owner-validated payloads', () => {
    const typed = LIVE_BUFFS.flatMap((d) =>
      (d.capabilities ?? []).map((c) => ({ def: d.id, type: c.type })),
    )
    const types = new Set(typed.map((t) => t.type))
    // every migrated capability family is represented
    for (const expected of ['on_hit_proc', 'reactive_trigger', 'reactive_proc', 'the_economy', 'reactive_economy', 'dot_recovery', 'marker']) {
      expect(types.has(expected), `missing capability type ${expected}`).toBe(true)
    }
  })

  it('uniquePerTarget defs became per_target + latest', () => {
    for (const id of ['khiem_khich', 'son_nhac_ho_the', 'ho_ve']) {
      const def = BUFF_REGISTRY.get(id)
      expect(def.instanceScope, id).toBe('per_target')
      expect(def.sourceOwnership, id).toBe('latest')
    }
  })

  it('elemental ailments keep their element tag and resistance gate', () => {
    for (const id of ['bong', 'trung_doc', 'chay_mau', 'te_cong', 'thach_hoa']) {
      const def = BUFF_REGISTRY.get(id)
      expect(def.kind, id).toBe('ailment')
      expect(def.element, id).toBeDefined()
      expect(def.application?.resistance, id).toBe('ailment')
    }
  })
})
