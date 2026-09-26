cleanA11 fix batch verification (coordinator):
- npm run type-check -> exit 0
- npx vitest run src/core/battle/turn + save/panel scopes -> 776 scoped tests PASS
- payload named-miss fizzle pin: reactivePayloads named miss -> null (fizzles), unnamed -> basic fallback
- manual-park orphan fix: isPendingQueuedExecution covers pendingQueuedExecution + pendingReactiveEntry
- CombatAnimationRuntime manual-actor exclusion covers pending queued execution
