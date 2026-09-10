import { describe, expect, it, vi } from 'vitest'
import { TurnPipeline } from './TurnPipeline'

/** Mechanical steps complete inline; this is the common shape. */
const sync = (kind: any, fn: () => void) => ({ kind, run: (done: () => void) => { fn(); done() } })

describe('TurnPipeline', () => {
  it('runs steps serially in push order', () => {
    const pipeline = new TurnPipeline()
    const order: string[] = []

    pipeline.push({
      kind: 'animation',
      actorId: 'a',
      animationId: 'x',
      run: (done) => { order.push('anim'); done() },
    })
    pipeline.push(sync('hit', () => order.push('hit')))
    pipeline.push(sync('reaction', () => order.push('react')))

    pipeline.drain()

    expect(order).toEqual(['anim', 'hit', 'react'])
    expect(pipeline.isDrained()).toBe(true)
  })

  it('accepts new steps pushed from inside a running step', () => {
    const pipeline = new TurnPipeline()
    const order: string[] = []

    pipeline.push({
      kind: 'hit',
      run: (done) => {
        order.push('hit')
        pipeline.push(sync('reaction', () => order.push('react')))
        done()
      },
    })

    pipeline.drain()

    expect(order).toEqual(['hit', 'react'])
  })

  it('parks on a step that has not completed, then resumes itself', () => {
    // Spec 4.1a: an ANIMATION step finishes when the renderer says so, which is
    // not the instant it started. The pipeline must wait, not skip.
    const pipeline = new TurnPipeline()
    const order: string[] = []
    let finishAnimation: (() => void) | null = null

    pipeline.push({
      kind: 'animation',
      actorId: 'a',
      animationId: 'x',
      run: (done) => { order.push('anim-start'); finishAnimation = done },
    })
    pipeline.push(sync('hit', () => order.push('hit')))

    const result = pipeline.drain()

    expect(result.parked).toBe(true)
    expect(order).toEqual(['anim-start'])
    expect(pipeline.isDrained()).toBe(false)

    finishAnimation!()

    expect(order).toEqual(['anim-start', 'hit'])
    expect(pipeline.isDrained()).toBe(true)
  })

  it('completes a step only once when the event and its fallback timer race', () => {
    const pipeline = new TurnPipeline()
    const order: string[] = []
    let done1: (() => void) | null = null

    pipeline.push({
      kind: 'semantic-vfx',
      run: (done) => { done1 = done },
    })
    pipeline.push(sync('idle-check', () => order.push('idle')))

    pipeline.drain()

    done1!()
    done1!()

    expect(order).toEqual(['idle'])
  })

  it('fires onDrained exactly once when the queue empties', () => {
    const onDrained = vi.fn()
    const pipeline = new TurnPipeline(onDrained)

    pipeline.push(sync('hit', () => {}))
    pipeline.drain()

    expect(onDrained).toHaveBeenCalledTimes(1)
  })

  it('caps chained reactions at depth 10 but still drains mechanical steps', () => {
    // Spec 4.3: the reaction chain is dropped; SEMANTIC_VFX and IDLE_CHECK
    // still run so the turn terminates normally instead of being cut off.
    const pipeline = new TurnPipeline()
    const order: string[] = []
    let depth = 0

    const pushNext = () => {
      depth += 1
      order.push(`r${depth}`)

      // Queued mid-chain, not up front: spec 4.1's step table lists
      // IDLE_CHECK as "pushed by: pipeline empty", i.e. it is never
      // pre-queued alongside a reaction chain. A mechanical step queued
      // mid-chain must SURVIVE the cull (spec 4.3).
      if (depth === 3) {
        pipeline.push(sync('semantic-vfx', () => order.push('vfx')))
      }

      if (depth < 20) {
        pipeline.push(sync('reaction', pushNext))
      }
    }

    pipeline.push(sync('reaction', pushNext))
    const result = pipeline.drain()

    expect(result.chainDepthLimited).toBe(true)
    expect(depth).toBe(10)
    expect(order).toContain('vfx') // mechanical step survived the cull
    expect(order.filter((s) => s.startsWith('r'))).toHaveLength(10) // state up to depth 10 kept
    expect(pipeline.isDrained()).toBe(true)
  })

  it('ignores a re-entrant drain from inside a running step', () => {
    const pipeline = new TurnPipeline()
    const order: string[] = []

    pipeline.push({
      kind: 'hit',
      run: (done) => {
        pipeline.push(sync('reaction', () => order.push('react')))
        // A nested drain must not start a second traversal.
        expect(pipeline.drain().parked).toBe(false)
        order.push('hit')
        done()
      },
    })

    pipeline.drain()

    expect(order).toEqual(['hit', 'react'])
  })

  it('keeps the chain-depth counter across a park and resume', () => {
    const pipeline = new TurnPipeline()
    let depth = 0
    let resume: (() => void) | null = null

    const pushNext = () => {
      depth += 1

      if (depth === 3) {
        pipeline.push({ kind: 'semantic-vfx', run: (done) => { resume = done } })
      }

      if (depth < 20) {
        pipeline.push(sync('reaction', pushNext))
      }
    }

    pipeline.push(sync('reaction', pushNext))
    pipeline.drain()
    resume!()

    // Still 10, not 10-after-reset: the counter belongs to the turn.
    expect(depth).toBe(10)
  })

  it('reports zero depth once drained', () => {
    const pipeline = new TurnPipeline()
    pipeline.push(sync('idle-check', () => {}))

    expect(pipeline.getDepth()).toBe(1)
    pipeline.drain()
    expect(pipeline.getDepth()).toBe(0)
  })
})
