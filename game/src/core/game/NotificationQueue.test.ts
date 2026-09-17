import { describe, expect, it } from 'vitest'
import { NotificationQueue } from './NotificationQueue'
import type { NotificationEvent } from '../notification/NotificationEvent'
import { GameManager } from './GameManager'
import type { Skill } from '../skill/Skill'
import { createDefaultPlayer } from '../player/Player'
import { i18n } from '../../i18n'

// Hàng đợi toast trong core — drain kiểu "rút hết và xoá" để App.vue's
// tick() đẩy lên store mỗi frame (xem NotificationQueue.ts's ghi chú).

function lootEvent(itemId: string): NotificationEvent {
  return { kind: 'loot', message: `Nhặt được ${itemId}` }
}

describe('NotificationQueue — push/drain', () => {
  it('push lưu event với đúng payload, drain trả về theo thứ tự FIFO', () => {
    const queue = new NotificationQueue()

    queue.push(lootEvent('a'))
    queue.push({ kind: 'craft', message: 'Luyện đan thành công' })

    const drained = queue.drain()

    expect(drained).toHaveLength(2)
    expect(drained[0]).toEqual({ kind: 'loot', message: 'Nhặt được a' })
    expect(drained[1]!.kind).toBe('craft')
  })

  it('drain xoá sạch hàng đợi — drain lần 2 trả về mảng rỗng', () => {
    const queue = new NotificationQueue()

    queue.push(lootEvent('a'))

    expect(queue.drain()).toHaveLength(1)
    expect(queue.drain()).toEqual([])
  })

  it('drain trên hàng đợi rỗng trả về mảng rỗng, không throw', () => {
    const queue = new NotificationQueue()

    expect(queue.drain()).toEqual([])
  })

  it('push sau drain tích luỹ lại bình thường', () => {
    const queue = new NotificationQueue()

    queue.push(lootEvent('a'))
    queue.drain()
    queue.push(lootEvent('b'))

    const drained = queue.drain()

    expect(drained).toHaveLength(1)
    expect(drained[0]).toEqual({ kind: 'loot', message: 'Nhặt được b' })
  })

  it('drain trả về array độc lập — đẩy event sau drain không mutating kết quả cũ', () => {
    const queue = new NotificationQueue()

    queue.push(lootEvent('a'))

    const drained = queue.drain()

    queue.push(lootEvent('b'))

    expect(drained).toHaveLength(1)
  })

  it('không cap/dedupe — trùng message vẫn giữ nguyên từng bản (test hành vi thật)', () => {
    const queue = new NotificationQueue()

    queue.push(lootEvent('a'))
    queue.push(lootEvent('a'))

    expect(queue.drain()).toHaveLength(2)
  })

  it('drain trên hàng rỗng không alloc mảng mới mỗi lần — trả về cùng 1 tham chiếu', () => {
    const queue = new NotificationQueue()

    const first = queue.drain()
    const second = queue.drain()

    expect(first).toBe(second)
    expect(first).toEqual([])
  })

  it('giữ nguyên loot presentation payload khi qua queue', () => {
    const queue = new NotificationQueue()
    const event: NotificationEvent = {
      kind: 'loot',
      message: 'Hạ gục Quỷ Lang',
      loot: {
        icon: '/icons/sword.png',
        name: 'Kiểm Đao',
        amountLabel: 'x1',
      },
    }

    queue.push(event)

    expect(queue.drain()[0]!.loot).toEqual({
      icon: '/icons/sword.png',
      name: 'Kiểm Đao',
      amountLabel: 'x1',
    })
  })
})
// T4-37 - the skill-level-up toast used to push mojibake literals
// ("d?t c?p"); it must carry messageKey/messageParams so the renderer
// localizes it, with a correct-Vietnamese fallback message.
describe('skill level-up notification (T4-37)', () => {
  function skillTemplate(id: string): Skill {
    return {
      id,
      name: 'Test Skill',
      description: '',
      type: 'active',
      level: 1,
      maxLevel: 10,
      cooldown: 0,
      cost: 0,
      target: 'enemy',
      effects: [{ type: 'damage', value: 100, damageType: 'physical' }],
      unlocked: false,
      equipped: false,
    }
  }

  it('single-level gain pushes messageKey notifications.skillLevelUp', () => {
    const gm = new GameManager()
    const player = createDefaultPlayer()
    player.skillInsight = 100

    gm.skillSystem.learn(skillTemplate('test_skill'))
    expect(gm.skillSystem.upgradeSkill('test_skill', player)).toBe(true)

    const events = gm.drainNotifications()
    const event = events.find((entry) => entry.kind === 'upgrade')

    expect(event).toBeDefined()
    expect(event!.messageKey).toBe('notifications.skillLevelUp')
    expect(event!.messageParams).toMatchObject({ name: 'Test Skill', level: '2' })
    expect(event!.message).toBe('Test Skill đạt cấp 2')
    expect(i18n.global.t('notifications.skillLevelUp', { name: 'Test Skill', level: '2' })).toBe(
      'Test Skill đạt cấp 2',
    )
  })

  it('multi-level gain pushes messageKey notifications.skillLevelUpMulti', () => {
    const gm = new GameManager()

    gm.skillSystem.learn(skillTemplate('tram'))
    const learned = gm.skillManager.get('tram')!
    learned.totalExperience = 9999

    gm.skillSystem.recordCast('tram')

    const events = gm.drainNotifications()
    const event = events.find((entry) => entry.kind === 'upgrade')

    expect(event).toBeDefined()
    expect(event!.messageKey).toBe('notifications.skillLevelUpMulti')
    expect(event!.messageParams).toMatchObject({ name: 'Test Skill', level: '3', gained: '2' })
    expect(event!.message).toBe('Test Skill tăng 2 cấp, đạt cấp 3')
    expect(
      i18n.global.t('notifications.skillLevelUpMulti', { name: 'Test Skill', level: '3', gained: '2' }),
    ).toBe('Test Skill tăng 2 cấp, đạt cấp 3')
  })
})
