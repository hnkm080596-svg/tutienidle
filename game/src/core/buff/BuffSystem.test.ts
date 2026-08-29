import { describe, expect, it } from 'vitest'
import { BuffSystem } from './BuffSystem'
import { BuffManager } from './BuffManager'
import type { Buff } from './Buff'
import type { StatModifier } from '../stats/StatCalculator'

function makeModifier(overrides: Partial<StatModifier> = {}): StatModifier {
  return {
    id: 'test_modifier',
    sourceId: 'test_buff',
    sourceType: 'buff',
    stat: 'attack',
    flat: 5,
    ...overrides,
  }
}

function makeBuff(overrides: Partial<Buff> = {}): Buff {
  return {
    id: 'test_buff',
    name: 'Buff thử nghiệm',
    category: 'buff',
    duration: 5,
    stacks: 1,
    stackMode: 'refresh',
    modifiers: [makeModifier()],
    ...overrides,
  }
}

function setup() {
  const manager = new BuffManager()
  const system = new BuffSystem(manager)

  return { manager, system }
}

describe('BuffSystem — áp buff và getActiveModifiers()', () => {
  it('buff mới áp vào → modifier xuất hiện trong getActiveModifiers() với stacks đúng', () => {
    const { manager, system } = setup()

    system.apply(makeBuff())

    expect(manager.has('test_buff')).toBe(true)

    const active = system.getActiveModifiers()

    expect(active).toHaveLength(1)
    expect(active[0]).toMatchObject({
      id: 'test_modifier',
      sourceId: 'test_buff',
      sourceType: 'buff',
      stat: 'attack',
      flat: 5,
      stacks: 1,
    })
  })

  it('buff áp vào với stacks: 0 được chuẩn hoá về 1 (buff.stacks || 1)', () => {
    const { system } = setup()

    system.apply(makeBuff({ stacks: 0 }))

    expect(system.getActiveModifiers()[0]!.stacks).toBe(1)
  })

  it('getActiveModifiers() gắn stacks hiện hành của buff vào TỪNG modifier', () => {
    const { system } = setup()

    const buff = makeBuff({
      stackMode: 'stack',
      modifiers: [
        makeModifier({ id: 'mod_a' }),
        makeModifier({ id: 'mod_b', stat: 'defense', flat: 2 }),
      ],
    })

    system.apply(buff)
    system.apply(buff)

    const active = system.getActiveModifiers()

    expect(active).toHaveLength(2)
    expect(active.map((modifier) => modifier.stacks)).toEqual([2, 2])
  })
})

describe('BuffSystem — áp lại cùng buff theo stackMode', () => {
  it('stackMode stack: cộng tầng tới trần maxStacks và làm mới remainingTime', () => {
    const { manager, system } = setup()

    const buff = makeBuff({ stackMode: 'stack', maxStacks: 2 })

    system.apply(buff)
    system.apply(buff)
    system.apply(buff)

    // 3 lần áp nhưng trần maxStacks 2 → dừng ở 2 tầng.
    expect(manager.get('test_buff')!.stacks).toBe(2)

    system.update(4)

    system.apply(buff)

    // re-applied làm mới thời gian về full duration (nguồn: existing.duration).
    expect(manager.get('test_buff')!.remainingTime).toBe(5)
  })

  it('stackMode refresh: giữ nguyên tầng, remainingTime làm mới theo duration của lần áp MỚI', () => {
    const { manager, system } = setup()

    system.apply(makeBuff({ stackMode: 'refresh', duration: 5 }))

    system.update(3)

    expect(manager.get('test_buff')!.remainingTime).toBe(2)

    system.apply(makeBuff({ stackMode: 'refresh', duration: 8 }))

    const stored = manager.get('test_buff')!

    expect(stored.remainingTime).toBe(8)
    expect(stored.stacks).toBe(1)
  })

  it('stackMode replace: bản cũ bị xoá, bản mới thêm với duration/stacks tươi', () => {
    const { manager, system } = setup()

    const buff = makeBuff({ stackMode: 'replace' })

    system.apply(buff)

    // Giả lập tầng đã tích luỹ trên bản cũ — replace KHÔNG mang sang.
    manager.get('test_buff')!.stacks = 3

    system.update(3)

    system.apply(buff)

    expect(manager.getAll()).toHaveLength(1)

    const stored = manager.get('test_buff')!

    expect(stored.stacks).toBe(1)
    expect(stored.remainingTime).toBe(5)
  })
})

describe('BuffSystem — hết hạn qua update()', () => {
  it('update() quá duration → buff gỡ khỏi manager và modifier biến mất', () => {
    const { manager, system } = setup()

    system.apply(makeBuff({ duration: 2 }))

    system.update(1)

    expect(manager.has('test_buff')).toBe(true)
    expect(system.getActiveModifiers()).toHaveLength(1)

    system.update(1)

    expect(manager.has('test_buff')).toBe(false)
    expect(system.getActiveModifiers()).toHaveLength(0)
  })

  it('buff vĩnh viễn (không duration) không bị update() xoá', () => {
    const { manager, system } = setup()

    system.apply(makeBuff({ duration: undefined }))

    system.update(100)

    expect(manager.has('test_buff')).toBe(true)
    expect(system.getActiveModifiers()).toHaveLength(1)
  })

  it('nhiều buff hết hạn độc lập theo duration riêng', () => {
    const { manager, system } = setup()

    system.apply(makeBuff({ id: 'buff_ngan', duration: 1 }))
    system.apply(makeBuff({ id: 'buff_dai', duration: 10 }))

    system.update(2)

    expect(manager.has('buff_ngan')).toBe(false)
    expect(manager.has('buff_dai')).toBe(true)
    expect(system.getActiveModifiers()).toHaveLength(1)
  })
})
