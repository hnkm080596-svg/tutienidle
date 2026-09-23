# F-A-6 re-verification at b76cc97b (coordinator execution)

- `src/services/save/SaveSystem.ts:376` — `hiddenChannelCycles: state.hiddenChannelCycles` persisted per site.
- `src/services/save/saveTypes.ts:267-283` — `ProductionSiteStateSave` fields: siteId, level, autoRestart, workerCycles?, assignedWorkers?. **No hiddenChannelCycles.**
- `saveTypes.ts:156` comment acknowledges the field exists on a parent/grotto-level type, but the per-site
  serializer writes it under a key the declared site schema omits — schema drift persists exactly as Round A
  recorded it against PR #19's base.
- Verification kind: SOURCE_PROOF (direct read at the pinned commit).
