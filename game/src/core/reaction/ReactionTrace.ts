// ReactionTrace.ts -- contract sec.85 evaluation-trace formatter +
// the canonical cross-resolution ordering (spec sec.60). The trace
// type itself lives in ReactionResolution.ts (declared with the
// evaluation types); this module owns presentation + ordering so a
// digest/report stays deterministic across runs.

import type { ReactionEvaluationTrace } from './ReactionResolution'
import { boardStacks } from './ReactionTypes'
import type { ElementType } from '../element/ElementType'

const BOARD_ELEMENTS: readonly ElementType[] = [
  'wood',
  'fire',
  'earth',
  'metal',
  'water',
]

/** spec sec.60 -- resolutions order by combatSequence -> sourceId ->
    targetId -> reactionId. Comparator over traces (the record every
    resolved/no_candidates evaluation leaves behind); usable for batch
    digests and multi-resolution reports. An unselected trace sorts by
    the empty reaction id -- it precedes any selected one at the same
    causal coordinates. */
export function compareReactionTraces(
  a: ReactionEvaluationTrace,
  b: ReactionEvaluationTrace,
): number {
  if (a.combatSequence !== b.combatSequence) {
    return a.combatSequence - b.combatSequence
  }
  if (a.sourceId !== b.sourceId) {
    return a.sourceId < b.sourceId ? -1 : 1
  }
  if (a.targetId !== b.targetId) {
    return a.targetId < b.targetId ? -1 : 1
  }
  const aId = a.selected ?? ''
  const bId = b.selected ?? ''
  if (aId !== bId) return aId < bId ? -1 : 1
  return 0
}

/** Deterministic digest line for one trace -- the full evaluation
    record flattened so two runs compare deep-equal cheaply. */
export function reactionTraceDigest(
  trace: ReactionEvaluationTrace,
): string {
  const candidateLines = trace.candidates
    .map(
      (c) =>
        `${c.reactionId}:base=${c.baseStrength}` +
        `:bias=${c.evaluatedBias.relationBps}/${c.evaluatedBias.elementBps}/${c.evaluatedBias.reactionBps}` +
        `:w=${c.finalWeightScaled}`,
    )
    .join(',')
  const preLines = (trace.preconditions ?? [])
    .map(
      (p) =>
        `${p.instanceId}@${p.expectedSourceId}->${p.expectedTargetId}=${p.expectedStacks}`,
    )
    .join(',')
  return [
    `event=${trace.eventId}`,
    `seq=${trace.combatSequence}`,
    `root=${trace.rootActionId}`,
    `pair=${trace.sourceId}->${trace.targetId}`,
    `board={${boardDigest(trace)}}`,
    `candidates=[${candidateLines}]`,
    `selected=${trace.selected ?? '<none>'}`,
    `preconditions=[${preLines}]`,
    `ops=[${trace.operationIds.join(',')}]`,
  ].join(' ')
}

function boardDigest(trace: ReactionEvaluationTrace): string {
  return BOARD_ELEMENTS.map(
    (element) => `${element}=${boardStacks(trace.board, element)}`,
  ).join(',')
}

/** contract sec.85 -- the human-readable tree: rootAction -> event ->
    candidates (base + bias + final weight) -> selected -> preflight ->
    emitted ops. Deterministic text; used by debug tooling and tests. */
export function formatReactionTrace(
  trace: ReactionEvaluationTrace,
): string {
  const lines: string[] = []
  lines.push(`reaction evaluation`)
  lines.push(`  rootAction: ${trace.rootActionId}`)
  lines.push(
    `  event: ${trace.eventId} seq=${trace.combatSequence} ` +
      `${trace.sourceId}->${trace.targetId}`,
  )
  lines.push(`  candidates:`)
  if (trace.candidates.length === 0) {
    lines.push(`    <none>`)
  }
  for (const c of trace.candidates) {
    const bias = c.evaluatedBias
    lines.push(
      `    ${c.reactionId}: base=${c.baseStrength}` +
        ` bias(rel=${bias.relationBps},el=${bias.elementBps},rx=${bias.reactionBps})` +
        ` final=${c.finalWeightScaled}`,
    )
  }
  lines.push(`  selected: ${trace.selected ?? '<none>'}`)
  lines.push(`  preflight:`)
  const preconditions = trace.preconditions ?? []
  if (preconditions.length === 0) {
    lines.push(`    <none>`)
  }
  for (const p of preconditions) {
    lines.push(
      `    ${p.instanceId} expect ${p.expectedSourceId}->${p.expectedTargetId} stacks=${p.expectedStacks}`,
    )
  }
  lines.push(`  emitted ops:`)
  if (trace.operationIds.length === 0) {
    lines.push(`    <none>`)
  }
  for (const id of trace.operationIds) {
    lines.push(`    ${id}`)
  }
  return lines.join('\n')
}
