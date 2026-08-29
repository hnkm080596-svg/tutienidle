import { describe, expect, it, vi } from 'vitest'
import { resolveOnHitEffects } from './KiemTranOnHitSystem'
import type { CombatEntity } from '../combat/CombatEntity'
import { createBaseStats } from '../stats/StatBlock'
import type { OnHitEffectKind } from '../progression/ProgressionNode'

// On-hit kiếm trận (spec 2026-08-29-kiem-the-kiem-y mục 4) — roll tỉ
// lệ độc lập mỗi hit theo cấp node (3%/level, max 15%), hiệu ứng qua
// modifier pipeline/buff/ailment sẵn có, KHÔNG hack damage trực tiếp.

function makeEntity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats() }
  return {
    id: 'player',
    name: 'P',
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentKiemThe: 0,
    currentKiemYTemp: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity
}

describe('KiemTranOnHitSystem — proc roll + dispatch', () => {
  it('node level 0 → KHÔNG roll', () => {
    const roll = vi.fn(() => 0.01)
    const source = makeEntity()
    const target = makeEntity({ id: 'enemy', type: 'enemy' })
    const applied: OnHitEffectKind[] = []

    resolveOnHitEffects(
      { 'onhit_khiem_khi': 0 },
      roll,
      source,
      target,
      2,
      (kind) => { applied.push(kind) },
    )

    expect(applied).toEqual([])
  })

  it('node Lv5 (15%) — roll 0.14 proc, roll 0.16 không proc', () => {
    const applied: OnHitEffectKind[] = []

    resolveOnHitEffects(
      { 'onhit_khiem_khi': 5 },
      () => 0.14,
      makeEntity(),
      makeEntity({ id: 'enemy' }),
      2,
      (kind) => { applied.push(kind) },
    )
    expect(applied).toEqual(['khiem_khi_dmg'])

    applied.length = 0
    resolveOnHitEffects(
      { 'onhit_khiem_khi': 5 },
      () => 0.16,
      makeEntity(),
      makeEntity({ id: 'enemy' }),
      2,
      (kind) => { applied.push(kind) },
    )
    expect(applied).toEqual([])
  })

  it('chance = 3% × level (Lv2 = 6%, Lv5 = 15%)', () => {
    // Lv2: chance 0.06 — roll 0.059 proc, 0.061 không
    const applied: OnHitEffectKind[] = []

    resolveOnHitEffects(
      { 'onhit_khiem_khi': 2 },
      () => 0.059,
      makeEntity(),
      makeEntity({ id: 'enemy' }),
      2,
      (kind) => { applied.push(kind) },
    )
    expect(applied).toEqual(['khiem_khi_dmg'])

    applied.length = 0
    resolveOnHitEffects(
      { 'onhit_khiem_khi': 2 },
      () => 0.061,
      makeEntity(),
      makeEntity({ id: 'enemy' }),
      2,
      (kind) => { applied.push(kind) },
    )
    expect(applied).toEqual([])
  })

  it('nhiều node: mỗi node roll ĐỘC LẬP (2 node đầu hiệu lực ở trận 2 kiếm, roll cặp 0.14/0.14 → cả 2)', () => {
    const applied: OnHitEffectKind[] = []
    let call = 0
    const rolls = [0.14, 0.14]
    const roll = () => rolls[call++] ?? 1

    resolveOnHitEffects(
      { 'onhit_khiem_khi': 5, 'onhit_khiem_phong': 5 },
      roll,
      makeEntity(),
      makeEntity({ id: 'enemy' }),
      2,
      (kind) => { applied.push(kind) },
    )
    expect(applied).toEqual(['khiem_khi_dmg', 'khiem_phong_haste'])
  })

  it('số node mở bị chặn theo cấp trận: Tam Tài (3 kiếm) chỉ cho 3 node đầu', () => {
    const applied: OnHitEffectKind[] = []

    resolveOnHitEffects(
      { 'onhit_khiem_khi': 5, 'onhit_khiem_phong': 5, 'onhit_xuat_huyet': 5, 'onhit_tran_tru': 5 },
      () => 0, // luôn trúng roll
      makeEntity(),
      makeEntity({ id: 'enemy' }),
      3, // Tam Tài — 3 kiếm
      (kind) => { applied.push(kind) },
    )
    // onhit_tran_tru là node thứ 4 — vượt số kiếm trận 3 → bị chặn
    expect(applied).toEqual(['khiem_khi_dmg', 'khiem_phong_haste', 'xuat_huyet_dot'])
  })
})
