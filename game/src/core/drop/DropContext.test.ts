import { describe, expect, it } from 'vitest'
import { modifiersFor } from './DropContext'

const ids = (input: Parameters<typeof modifiersFor>[0]) => modifiersFor(input).map((m) => m.id)

describe('DropContext - active channel', () => {
  it('carries nothing for a plain enemy', () => {
    expect(ids({ channel: 'active', isBoss: false, isElite: false })).toEqual([])
  })

  it('carries tinh_anh for an elite', () => {
    expect(ids({ channel: 'active', isBoss: false, isElite: true })).toEqual(['tinh_anh'])
  })

  it('carries boss for a boss', () => {
    expect(ids({ channel: 'active', isBoss: true, isElite: false })).toEqual(['boss'])
  })

  it('carries both when they stack', () => {
    expect(ids({ channel: 'active', isBoss: true, isElite: true }).sort()).toEqual(['boss', 'tinh_anh'])
  })

  it('deduplicates when tinh_anh is both isElite and in tagIds', () => {
    expect(ids({ channel: 'active', isBoss: false, isElite: true, tagIds: ['tinh_anh'] })).toEqual(['tinh_anh'])
  })

  it('silently ignores unknown tag ids', () => {
    expect(ids({ channel: 'active', isBoss: false, isElite: false, tagIds: ['not_a_real_tag'] })).toEqual([])
  })
})

describe('DropContext - idle channel (spec E10)', () => {
  it('drops the tag but KEEPS the stage property', () => {
    expect(ids({ channel: 'idle', isBoss: true, isElite: true })).toEqual(['boss'])
  })

  it('carries nothing on a normal idle floor', () => {
    expect(ids({ channel: 'idle', isBoss: false, isElite: true })).toEqual([])
  })

  it('still carries boss on idle floor 10', () => {
    expect(ids({ channel: 'idle', isBoss: true, isElite: false })).toEqual(['boss'])
  })
})
