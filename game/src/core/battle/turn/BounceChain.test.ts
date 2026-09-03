import { describe, expect, it } from 'vitest'
import { resolveBounceChain, type BounceCandidate } from './BounceChain'

const candidates: BounceCandidate[] = [
  { id: 'target', position: { row: 0, column: 0 }, alive: true },
  { id: 'near', position: { row: 0, column: 1 }, alive: true },
  { id: 'far', position: { row: 0, column: 10 }, alive: true },
  { id: 'dead', position: { row: 0, column: 2 }, alive: false },
]

describe('resolveBounceChain', () => {
  it('nảy tới entity gần nhất còn sống, chưa bị chain, trong bounceArea', () => {
    const chain = resolveBounceChain(candidates, 'target', 3, 1)
    expect(chain).toEqual(['target', 'near'])
  })

  it('bỏ qua entity đã chết', () => {
    const onlyDead: BounceCandidate[] = [
      { id: 'target', position: { row: 0, column: 0 }, alive: true },
      { id: 'dead', position: { row: 0, column: 1 }, alive: false },
    ]
    const chain = resolveBounceChain(onlyDead, 'target', 3, 1)
    expect(chain).toEqual(['target'])
  })

  it('dừng sớm nếu không còn entity hợp lệ trong bounceArea (không lỗi)', () => {
    const chain = resolveBounceChain(candidates, 'target', 1, 5)
    expect(chain).toEqual(['target', 'near'])
  })

  it('không bounce tới entity đã bị chain trước đó', () => {
    const trio: BounceCandidate[] = [
      { id: 'a', position: { row: 0, column: 0 }, alive: true },
      { id: 'b', position: { row: 0, column: 1 }, alive: true },
      { id: 'c', position: { row: 0, column: 2 }, alive: true },
    ]
    const chain = resolveBounceChain(trio, 'a', 5, 2)
    expect(chain).toEqual(['a', 'b', 'c'])
  })

  it('bounceCount=0 chỉ trả về target gốc', () => {
    expect(resolveBounceChain(candidates, 'target', 5, 0)).toEqual(['target'])
  })
})
