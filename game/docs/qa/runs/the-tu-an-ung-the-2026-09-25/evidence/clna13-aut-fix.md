cleanA13 AUT adjudication fixes (coordinator):
- npm run type-check -> exit 0
- npx vitest run src/core/battle/turn src/core/battle/runtime -> 89 files / 777 tests PASS
- emitAndSettle now returns the CombatTrace; externalWard writes in applyDeclaredBuff
  and the intercept-ward lane gate on the apply_buff op settling 'resolved'
  (contract parity with the plan lane).
- charge-resolve comment corrected to describe both lanes (engine-unit early
  return vs routed null-action fall-through).
- TheTuSkills.ts: 'phan_chan' literal -> PHAN_CHAN_BUFF.id.
- TurnOrderPreview.ts: clone gauge reset via consumeGaugeAfterAction primitive.
