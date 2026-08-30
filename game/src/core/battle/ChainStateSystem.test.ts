import { describe, expect, it } from 'vitest'
import {
  advanceChain,
  canCastChainSkill,
  initChainState,
  resetChainOnKill,
  type ChainDefinition,
} from './ChainStateSystem'

// Spec 2026-08-30-phap-tu-dao-sac §2.1/§7 — chuỗi combo Thuần hệ:
// cast A mới mở B, B mới mở C...; E quay về A; quái chết → reset về
// A; skill ngoài chuỗi cast tự do. Loadout nhỏ hơn chuỗi (2/5 slot
// Luyện Khí/Trúc Cơ) → chỉ đầu chuỗi khả dụng (C/D/E data khóa realm).
const CHAIN: ChainDefinition = { skillIds: ['chain_a', 'chain_b', 'chain_c', 'chain_d', 'chain_e'] }

describe('ChainStateSystem (spec §2.1/§7)', () => {
  it('ban đầu chỉ cast được A', () => {
    const state = initChainState()

    expect(canCastChainSkill(CHAIN, state, 'chain_a', 5)).toBe(true)
    expect(canCastChainSkill(CHAIN, state, 'chain_b', 5)).toBe(false)
    expect(canCastChainSkill(CHAIN, state, 'chain_e', 5)).toBe(false)
  })

  it('cast A xong mới mở B,依次 đến E rồi quay về A', () => {
    const state = initChainState()

    advanceChain(CHAIN, state, 'chain_a')
    expect(canCastChainSkill(CHAIN, state, 'chain_b', 5)).toBe(true)

    advanceChain(CHAIN, state, 'chain_b')
    advanceChain(CHAIN, state, 'chain_c')
    advanceChain(CHAIN, state, 'chain_d')
    expect(canCastChainSkill(CHAIN, state, 'chain_e', 5)).toBe(true)

    advanceChain(CHAIN, state, 'chain_e')
    expect(canCastChainSkill(CHAIN, state, 'chain_a', 5)).toBe(true)
    expect(canCastChainSkill(CHAIN, state, 'chain_b', 5)).toBe(false)
  })

  it('quái chết → reset về A', () => {
    const state = initChainState()

    advanceChain(CHAIN, state, 'chain_a')
    advanceChain(CHAIN, state, 'chain_b')
    resetChainOnKill(state)

    expect(canCastChainSkill(CHAIN, state, 'chain_a', 5)).toBe(true)
    expect(canCastChainSkill(CHAIN, state, 'chain_c', 5)).toBe(false)
  })

  it('loadout 2 slot → C khóa dù nextIndex trỏ C (data khóa realm, spec §6)', () => {
    const state = initChainState()

    advanceChain(CHAIN, state, 'chain_a')
    expect(canCastChainSkill(CHAIN, state, 'chain_b', 2)).toBe(true)

    advanceChain(CHAIN, state, 'chain_b')
    expect(canCastChainSkill(CHAIN, state, 'chain_c', 2)).toBe(false)
  })

  it('skill ngoài chuỗi cast tự do, không advance', () => {
    const state = initChainState()

    expect(canCastChainSkill(CHAIN, state, 'tram', 5)).toBe(true)
    advanceChain(CHAIN, state, 'tram')
    expect(canCastChainSkill(CHAIN, state, 'chain_a', 5)).toBe(true)
  })

  it('advanceChain với skillId sai vị trí → no-op (nextIndex không đổi)', () => {
    const state = initChainState()

    advanceChain(CHAIN, state, 'chain_c')
    expect(canCastChainSkill(CHAIN, state, 'chain_a', 5)).toBe(true)
    expect(canCastChainSkill(CHAIN, state, 'chain_b', 5)).toBe(false)
  })
})
