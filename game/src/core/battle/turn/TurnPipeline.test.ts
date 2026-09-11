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

      if (depth === 10) {
        // Push the mechanical step and the doomed 11th reaction from the
        // SAME pushNext() call that trips the limit, so both are genuinely
        // sitting in the queue together at the moment this.queue.filter(...)
        // runs (spec 4.3). Pushing the mechanical step earlier (e.g. at
        // depth 3) would let it run and clear out of the queue long before
        // the cull ever executes, leaving the cull itself unexercised.
        pipeline.push(sync('semantic-vfx', () => order.push('vfx')))
        pipeline.push(sync('reaction', () => order.push('doomed-r11')))
        return
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
    expect(order).not.toContain('doomed-r11') // the culled reaction's body never fires
    expect(order.filter((s) => s.startsWith('r'))).toHaveLength(10) // state up to depth 10 kept
    expect(pipeline.isDrained()).toBe(true)
  })

  it('reset() clears the queue, the park, and the chain-depth counter', () => {
    // Spec 3.3 / 4.1a: reset() must leave a pipeline in the same clean state
    // as a brand-new one, even when called while a reaction chain is
    // mid-flight AND parked on a step that never completed.
    const pipeline = new TurnPipeline()

    let depth = 0
    const pushNext = () => {
      depth += 1

      if (depth === 5) {
        // Park mid-chain on a step that never calls done() - both the
        // queue and the reaction-depth counter (currently 5) are dirty at
        // the moment reset() is called below.
        pipeline.push({ kind: 'animation', actorId: 'a', animationId: 'x', run: () => {} })
        return
      }

      pipeline.push(sync('reaction', pushNext))
    }

    pipeline.push(sync('reaction', pushNext))
    pipeline.drain()

    expect(pipeline.isDrained()).toBe(false) // parked, not drained
    expect(pipeline.getDepth()).toBeGreaterThan(0)

    pipeline.reset()

    expect(pipeline.isDrained()).toBe(true)
    expect(pipeline.getDepth()).toBe(0)

    // Prove the reaction-depth counter itself was cleared, not just the
    // queue: if it had survived reset() at 5, a fresh chain would trip the
    // depth-10 limit after only 5 more reactions instead of a full 10.
    let depth2 = 0
    const pushNext2 = () => {
      depth2 += 1

      if (depth2 < 20) {
        pipeline.push(sync('reaction', pushNext2))
      }
    }

    pipeline.push(sync('reaction', pushNext2))
    const result = pipeline.drain()

    expect(result.chainDepthLimited).toBe(true)
    expect(depth2).toBe(10)
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
