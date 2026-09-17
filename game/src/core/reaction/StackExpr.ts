// StackExpr.ts -- the closed payoff-math DSL (megaplan M4 + contract
// sec.31). Evaluated against the FROZEN ReactionContext -- participants'
// stacks are the pre-consume snapshot values (contract sec.38). Doubles
// are allowed here: fixed-point is required only for selection weight.

import type { ReactionParticipantRole } from './ReactionTypes'
import type { ReactionContext } from './ReactionResolution'

export type StackExpr =
  | { op: 'const'; value: number }
  | { op: 'stacks'; role: ReactionParticipantRole }
  | { op: 'add' | 'mul' | 'min' | 'max'; args: readonly StackExpr[] }
  | { op: 'ceil_half' | 'floor_half'; arg: StackExpr }

/** Evaluate an expr against the frozen context. A 'stacks' reference to
    a role the relation does not have is an authoring defect -- throws
    (structural), never a silent 0. */
export function evalStackExpr(
  expr: StackExpr,
  context: ReactionContext,
): number {
  switch (expr.op) {
    case 'const':
      return expr.value
    case 'stacks': {
      const participant = context.participants.find(
        (p) => p.role === expr.role,
      )
      if (participant === undefined) {
        throw new Error(
          `StackExpr: role '${expr.role}' has no participant in reaction '${context.reactionId}'`,
        )
      }
      return participant.stacks
    }
    case 'add':
      return expr.args.reduce((sum, a) => sum + evalStackExpr(a, context), 0)
    case 'mul':
      return expr.args.reduce((acc, a) => acc * evalStackExpr(a, context), 1)
    case 'min':
      return Math.min(...expr.args.map((a) => evalStackExpr(a, context)))
    case 'max':
      return Math.max(...expr.args.map((a) => evalStackExpr(a, context)))
    case 'ceil_half':
      return Math.ceil(evalStackExpr(expr.arg, context) / 2)
    case 'floor_half':
      return Math.floor(evalStackExpr(expr.arg, context) / 2)
  }
}
