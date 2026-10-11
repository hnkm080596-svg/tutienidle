# Wave-5 seam hunt — unify save version-acceptance (e6d8796a + aec8fcc7 + 3b30a810)

Blind adversarial review of the wave-4 fixes on `devin/khai-mach`. Scope: the
`migrateSaveToCurrentVersion` extraction into `saveVersion.ts` and its four
call sites (local boot, cloud SAVE_READY pull, `adoptCommittedPending`,
`validateRecoveryData`), plus the dead queued-artifact removal (alchemy
`.queued` locale + `--queued` CSS).

## Verdict

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| R5-SAVE-1 | `migrateSaveToCurrentVersion` throws `TypeError` on `null`/`undefined` input at `saveVersion.ts:309` (`save.version` deref). Callers `SupabaseCloudSaveService.ts:755` (SAVE_READY) and `:441` (`adoptCommittedPending`) are unguarded. Throw escapes `bootGame()` — `useAppLifecycle.ts:396` try has only `finally` — as unhandled rejection: permanent loading screen, recovery surface never mounts. Old code classified the same row `'incompatible'`. | MEDIUM | CONFIRMED — repro `SupabaseCloudSaveR5NullPayload.qa.test.ts` (3 FAIL on HEAD) |
| Attack 1 (chain edge cases) | String `'88'`, float `89.5`, `90.x`, `NaN`, frozen payloads all rejected/accepted correctly by `===` comparisons; `existing.amount +=` mutation touches only caller-discarded objects. | — | HELD |
| Attack 2 (schemaVersion === foundVersion) | Write path stamps `p_schema_version` and journal `schemaVersion` from the same `build.saveSchemaVersion` (:873, :897) — symmetric. v89-row + v90-payload mismatch correctly rejected (89 !== 90): a genuinely inconsistent server row, not a legitimate upgrade-in-flight. | — | HELD |
| Attack 3 (raw vs migrated divergence) | `record.rawPayload` keeps v89 bytes while `parsed` becomes v90 — traced every raw consumer (`resumeSession` name extraction, `saveIssue` export surface, master salvage, `SettingsPanel` export): all read fields unaffected by the version delta, or legitimately want server-truth bytes. `mirrorAcked` storing pre-migration bytes is correct (mirror = server truth). | — | HELD |
| Attack 4 (recoveryApi `version`) | `'valid'` now returns `normalized.version` (always 90). Only consumers (`SaveIncompatibleScreen.vue`, `SettingsPanel.vue`) use `status`/`normalizedRaw`; nothing reads the field's file-version semantics. | — | HELD |
| Attack 5 (queued remnants) | Zero live references to `alchemy.queued` / `.job-card--queued` outside the pin test that documents the removal. | — | HELD |

## Notes (not filed)

- `adoptCommittedPending` crash exposure is the same R5-SAVE-1 root cause but
  needs a crafted journal record (`rawPayload:"null"` inside a hash-valid
  record) — no honest producer emits it (`save()` always serializes a
  `GameSave`). Same line fix covers it.
- `importSaveRaw` (`SaveSystem.ts:772`) still gates on `=== CURRENT_SAVE_VERSION`
  and writes non-90 payloads verbatim — the commit's "file import" gate was
  only the remote-mode `validateRecoveryData`. End-to-end still works because
  boot migrates; exposure identical to before the commit. NIT.
- Non-object non-null payloads (string/number/array) degrade gracefully to
  `'incompatible'` (property access boxes safely) — only `null`/`undefined`
  crash.

## Repros

`src/services/cloudSave/SupabaseCloudSaveR5NullPayload.qa.test.ts` — 3 tests,
all FAIL on `e6d8796a` with `TypeError: Cannot read properties of
null/undefined (reading 'version')`:

1. `migrateSaveToCurrentVersion leaf: null/undefined/42/'x'/[] must not throw`
   (leaf contract: return null, never throw).
2. `SAVE_READY with payload:null resolves a typed result` — honest drift row
   (`payload` explicitly null) must classify, currently crashes.
3. `SAVE_READY with the payload key absent resolves a typed result` — partial
   server row / contract drift, currently crashes.

Baseline: full save + cloudSave suite on HEAD = only the 4 documented
pre-existing Windows env failures.
