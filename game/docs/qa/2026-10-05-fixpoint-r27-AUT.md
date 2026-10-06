# Fixpoint r26+r27-COR audit — AUT (adversarial exploit)

- Commit under audit: `7bea330a` (r26 adjudication batch + r27-COR fixes)
- Mode: AUT — assume the fix claims are exploitable; try to break them
- Probe file: `game/src/services/save/auditR27Aut.probe.test.ts`
  (`npx vitest run src/services/save/auditR27Aut.probe.test.ts --pool=threads` —
  **20/20 pass**, deterministic; `Date.now` mocked at 1_725_160_000_000)
- QA-write boundary respected: only this report + the probe file.

## Verdict

**FAIL** — 1 High, 1 Nit. The deadline re-anchor family is clean, but
one element-shape hole inside the fixed verify still throws TypeError
through the admission gate, escaping every classified-refuse surface the
batch armed.

## Findings

### F-AUT-1 — High — `verifyAlchemyJobReservation` throws on null/undefined `specialIngredients` elements → TypeError escapes the refuse envelope at all six `validateGameSaveShape` seams

**The defect.** r27-COR-2 added `Array.isArray(witness.specialIngredients)`
BEFORE the digest fold (`AlchemySystem.ts:212`), so a non-array witness
reports `'specialIngredients'` instead of throwing — verified (probe A1,
B5). But the fold itself dereferences each ELEMENT:

```
AlchemySystem.ts:171  reservation.specialIngredients.map(
    (special) => `${special.materialId}:${special.amount}`).join(',')
```

`specialIngredients: [null]` or `[undefined]` passes the array check and
throws `TypeError: Cannot read properties of null` inside
`alchemyJobReservationDigest`, called at `AlchemySystem.ts:219` from
`verifyAlchemyJobReservation`, called UNGUARDED at
`saveShapeValidation.ts:3800`. The validator's only pre-gate is
`isObject(reservation)` (:3794) — element shape is never checked anywhere.

Reproducible with a fully cheap craft: `costScale: 1` is always in
`ALCHEMY_JOB_PRODUCIBLE_COST_SCALES` (:158-171), so the payload needs no
valid digest — the throw precedes the digest compare.

**Escape inventory** (each is a distinct unguarded `validateGameSaveShape`
call — grep confirms all six):

1. **Remote committed row** — `SupabaseCloudSaveService.load()` calls
   `validateGameSaveShape(save.payload)` at `:748` with no try/catch; the
   `rpc()` call IS wrapped (:573-582) but the validator is not. The throw
   propagates through `coordinator.load()` (`CloudSaveCoordinator.ts:52`,
   unguarded) → `bootGame`'s try has only `finally` — no catch
   (`useAppLifecycle.ts:347-728`) → `await lifecycle.bootGame` rethrows →
   `bootGame` (App.vue:954-993, no catch) → `void bootGame(false)` /
   `await bootGame(true)` (:1077/:1095) → **unhandled rejection →
   permanent loading-screen wedge; `boot.fail()` never runs so
   `SaveIncompatibleScreen` (export/delete) never mounts** — exactly the
   hazard the code names twice (`useAppLifecycle.ts:612-614` and
   `:643-644`: "must not escape bootGame as an unhandled rejection ...
   leaving the app on the loading screen forever"), which the batch
   guarded for `onNewCharacter` and `player.save` but not for
   `coordinator.load()`.
2. **Pending-journal replay** — `adoptCommittedPending`
   (`SupabaseCloudSaveService.ts:441`) — same propagation, same wedge.
   Reachable via a pre-gate journal record (the documented self-limiting
   residual) or a corrupt committed payload.
3. **Local slot** — `inspectLocalSave` (`SaveSystem.ts:524`) throws →
   caught by `LocalCloudSaveService.load`'s blanket catch (:28-32) →
   misclassified `{status:'unavailable'}` instead of `'corrupted'` →
   boot takes the generic-failure branch (`onError` + `boot.fail()`) —
   the corrupted-save recovery surface is never offered, and the poisoned
   slot re-throws on every boot. Wedge, degraded classification.
   Probe B2 asserts `loaded.status === 'unavailable'`.
4. **Write gate** — `driveSave`'s `validateGameSaveShape(wire)` call at
   `CloudSaveCoordinator.ts:182` is outside the serialize try/catch → the
   throw lands in `.catch(adapterThrow)` (:122/:131) → codeless
   `{status:'unavailable', retryable:false, detail:'SAVE_ADAPTER_THROW'}`
   (:15-22). The `DATA_REFUSE_CODES` arm requires `code !== undefined`
   (App.vue persistPlayer :568-596; firstSave arm
   `useAppLifecycle.ts:679-694`) → the result reads as a transient
   backend failure — autosave churns silently, the corrupted-surface
   escalation never fires. (Fair note: the code comment at
   `useAppLifecycle.ts:673-675` deliberately keeps *uncoded adapter
   faults* off the remote-reset arm — the defect here is upstream: a
   validator that throws at all, converting a data-class refusal into a
   fake adapter fault.) Probe B1 asserts `code === undefined`.
5. **Import file** — `importSaveRaw` (`SaveSystem.ts:758`) and
   `validateRecoveryData` (`recoveryApi.ts:58`) throw into the
   FileReader `onload` callbacks in `SettingsPanel.vue:189` and
   `SaveIncompatibleScreen.vue:125` — uncaught exception → **silent
   no-op**: no error toast, no failure surface. Probes B3/B4 assert the
   throws.

**Reachability.** Crafted payload only — `startJob` builds reservations
from authored recipe specials, and nothing honest writes null/undefined
elements. HOWEVER: JSON serializes `[undefined]` as `[null]`, so ANY
future producer bug that pushes an `undefined` element into
`specialIngredients` converts that player's save into a permanently
unloadable payload — the write-side gate "protects" the slot by refusing
with a codeless result, and the next boot wedges on whatever already
landed. The fix intent at `AlchemySystem.ts:208-211` is explicit:
"a malformed reservation reports its field instead of throwing through
the save validator" — the element class is the same defect one level
down.

**Repro evidence.** Probes A2/A3/A4 (`[null]`, `[undefined]`, mixed
`[null, real]` all `toThrow(TypeError)` through `validateGameSaveShape`);
B1 (driveSave → codeless non-retryable unavailable); B2 (local slot →
`unavailable` misclassification); B3/B4 (import/recovery throw); B5
(fold-level: digest throws; sibling witness fold never throws).

**Fix direction (recommendation, no production edit made).** Gate
elements before the fold — e.g. `witness.specialIngredients.every(
s => s && typeof s === 'object' && typeof s.materialId === 'string' &&
typeof s.amount === 'number')` → report `'specialIngredients'`.
The belt-and-braces fix is a try/catch around `validateGameSaveShape` at
the load seams (a throwing validator must classify `corrupted`, never
propagate) and a `code:'SAVE_INVALID'` on the adapter-throw arm.

### F-AUT-2 — Nit — restore-seam `.map` on unshaped collections throws on ungated paths (contained)

`AlchemySystem.restoreJobs` (:397) runs
`(job.reservation?.specialIngredients ?? []).map(...)` — a truthy
non-array value (`5`, `'x'`, `{}`) throws TypeError; same class in
`ProductionSystem.restoreStates` (`(state.workerCycles ?? []).map`,
:147) and `restoreJobs`'s own `jobs.map` (:367). Gated loads never reach
it (admission throws/rejects first); the ungated `restoreBackup` /
`restoreGameSession` paths wrap the whole restore in try → `'rejected'`,
so this is contained — a defense-in-depth inconsistency, not an exploit.
`{...null}` elements degrade to `{}` harmlessly; `{...job}` spreads on
non-object reservations stay safe.

## Rejected hypotheses (fix claims verified)

| # | Attack | Result |
|---|---|---|
| R1 | Crafted near-2^52 post-dated workerCycle parks the lane forever (deny) or mints | REJECTED — `restoreStates` re-grounds at `restoreNowMs`, span exact (probe R1) |
| R2 | Shifted alchemy job breaks the witness → silently drops job / fails verify | REJECTED — digest re-derived over shifted stamps; replays at settle; early tick pays nothing (probe R2) |
| R3 | Far-future `cooldownUntil` pins tribulation channel (deny) | REJECTED — clamps at `restoreNow + 300s` (probe R3) |
| R4 | Far-future `nextCycleAt` idles decompose forever; re-restore drags timer back (mint) | REJECTED — clamps at `restoreNow+cycleMs`; `Math.max` keeps the timer monotonic (probe R4) |
| R5 | Corrupt-LOW authority (`untilMs≈1.7e9`, seconds-for-millis) re-anchors honest began pairs into instant-completion mint | REJECTED — `restoreClockMs = min(lastSavedAt, Date.now())` excludes authority; stamps verbatim, job stays in-flight = deny-only (probe R5) |
| R6 | Corrupt-HIGH `untilMs` (~142k years) mints unbounded offline accrual | REJECTED — raw window uncapped by design but every consumer caps: production `PRODUCTION_OFFLINE_CAP_SECONDS`=10h, decompose 10h+5000-loop, autofarm 24h (`DEFAULT_MAX_OFFLINE_SECONDS`), cultivation payout 24h (probe R6: `elapsedSeconds === 86400`) |
| R7 | `sanitizeRestoreAuthority` admits crafted authority | REJECTED — `null`, unknown kind, NaN, `|x|≥2^52` all degrade to `live-replacement` deny primitive; honest cold-boot preserved (probe R7) |
| R8 | Sibling collections still uncapped (`talentLevels`, `learnedSkillIds`, …) | REJECTED — sweep complete: every array via `requireArray`/`optionalArray` (cap 1024 centrally), every `Record` via `Object.keys` cap; `talentLevels` + `learnedSkillIds` distinct messages verified (probe R8) |
| R9 | `DATA_REFUSE_CODES` set contents wrong | REJECTED — exactly `{SAVE_INVALID, SAVE_TOO_LARGE}` (probe R9) |
| R10 | Malformed tribulation `witness` throws through the gate | REJECTED — `isObject` gate :4793, scalar `Number.isInteger` reads, `!chapters` guard :108 — issue, not throw (probe R10) |
| R11 | Negative `lastSavedAt` adversarial marker | REJECTED — `startedAtMs ≤ lastSavedAt` pins reject every positive stamp; only negative stamps enter = all dues already paid = honest-equivalent |
| R12 | `lastDailyResetAtMs`/`questFlags` `.every`/`new Set` on non-array | REJECTED — `!Array.isArray` short-circuits first (:3317, :3334) |
| R13 | `getTribulationChapters` non-array return | REJECTED — `!chapters` guard at TribulationCommitWitness.ts:108 |
| R14 | Unknown-recipe job with self-consistent digest mints pill | REJECTED — `!recipe \|\| !pill` failure arm at AlchemySystem.ts:616 consumes it before verify pays; `job.pillId` never trusted (pill resolved from authored recipe) |
| R15 | `persistentTimedEffects` far-future `expiresAtMs` mints permanent buff / bricks next write | REJECTED — `boundTimedEffectClocks` (stores/player.ts:119-163) pre-dates this batch: `expires ≤ min(provenance,now)+duration` live arm / `min(expires, now)` dead arm; write pin `lastSavedAt+duration+7d` stays consistent |
| R16 | `specialIngredients` non-array still throws (r27 claim failure) | REJECTED — `Array.isArray` gate verified; non-array reports `'specialIngredients'` field (probes A1, B5) |
| R17 | `Object.values(params).every` on non-object (tribulation receipt params) | REJECTED — `!isObject(params)` precedes (:4706) |
| R18 | `readCachedSave` consumers restore raw bytes ungated | REJECTED — only consumer is file export (SettingsPanel.vue:139-149) |

## Audit notes / reachability ledger

- The one real hole is **element-level**, inside the exact fold r27
  repaired — the sibling-of-the-fix class the mandate asks for. The
  non-array arm holds; the element arm was never gated.
- All six `validateGameSaveShape` call sites are unguarded (`grep`
  inventory): Supabase:441, Supabase:748, CloudSaveCoordinator:182,
  recoveryApi:58, SaveSystem:524, SaveSystem:758. The throw therefore
  escapes classification at ALL of them — the only difference is which
  downstream catch misfires.
- Honest-writer reachability for F-AUT-1 is nil (needs crafted/corrupt
  payload or a producer bug emitting `undefined` elements — which JSON
  round-trip then converts to `null`, self-bricking the save).
- Known-adjudicated residuals re-checked, none upgraded: cursor-channel
  far-future stamps, equipment hoard cap (D-02), pre-gate journal replay,
  ungated `restoreBackup`, unreachable `OUTGOING_UNSERIALIZABLE`,
  join-or-displace, >24h chain tail loss, R27-COR-4 skew-early pay,
  R27-005 witnessless `[{specialIngredients: []}]` clone.
