# Fixpoint audit r29 — AUT (adversarial exploit)

Auditor: r29-AUT worker (Devin session). Base: `codex/hoa-cau-fireball-vfx`
@ `faa893c1` (r26 + r27 batches + full r28 adjudication). Role: assume every
r28 fix is exploitable — mint paths through the foldable guard or the new
finite-clock guard, deny/wedge paths, self-brick writes, envelope escapes,
throw-paths past the fail-closed wrapper, bypasses around every new guard,
provenance tricks on the saveIssue scope/clear pairing; then siblings of
each class.

Worktree: `.agent-worktrees/audit-r29-aut` @ `faa893c1`. Read-only on
production code; every claim below carries an EXECUTED deterministic repro
in `src/services/save/auditR29Aut.probe.test.ts` (38 tests, all passing —
`npx vitest run <file> --pool=threads`, `@vitest-environment node`,
`Date.now` mocked). Report branch: `devin/audit-r29-AUT-faa893c1`.

Verification executed:
- `npx vitest run src/services/save/auditR29Aut.probe.test.ts --pool=threads`
  — 38/38 green.
- `npm run type-check` — clean (pre-existing `src/ui-preview/` TS2307s
  excluded per r28-AUT-4).
- Full read of the r28 surfaces at the audit commit:
  `AlchemySystem.ts` (:151-173 digest fold, :184-277 verify order,
  :376-426 restoreJobs shift + foldable gate + normalize clone,
  :601-729 tick + finite-clock guard, :732-745 settleOffline),
  `GameManagerSaveRestore.ts` (:363-366 restoreClockMs, :445-449
  settleNowMs, :471-475 offlineSinceMs, all seam calls :481-560),
  `saveShapeValidation.ts` (:446-459/:463-486 require/optional array caps,
  :790 talentLevels root cap, :856-865 CPS-headroom sibling cap, :1045-1054
  entitlement-sanitize sibling cap, :1122/:2285 collectTalentEffects
  property-access reads, :3041-3274 nodeLevels walks, :3685-3813 alchemy
  jobs validation, :4509-4522 maxJobs bound), `App.vue` (:575-619
  refuse arm + ok-write clear, :705-721 onResume arm, :1225 mount gate),
  `useAppLifecycle.ts` (:313 persistProgress gate, :409/:429/:479 boot
  arms, :556-571 commit-refuse, :679-694 firstSave-refuse),
  `CloudSaveCoordinator.ts` (:141-195 driveSave outgoing gate),
  `SupabaseCloudSaveService.ts` (:968-989 REJECTED->code mapping),
  `BackendStatus.ts` DATA_REFUSE_CODES, `OnlineSessionController.ts`
  (:118 authorityStateForError, :128-131 recovery terminal),
  `saveIssue.ts` report/clear, `SaveIncompatibleScreen.vue`
  remoteResettable, `SaveSystem.ts` :273-316 restoreGameSession envelope,
  `ProductionSystem.restoreStates` :129-171,
  `DecomposeSystem.settleOffline` :284+, `WorkerLaneAdvance` :146-151
  parity guard.

---

## Verdict: PASS WITH EVIDENCE (0 Critical / 0 High / 1 Medium / 1 Low / 3 Nit)

The foldable-witness gate and the finite-clock guard hold under direct
attack (V1-V6 below): every malformed reservation class denies at settle,
every hostile clock zero-advances, the envelope still degrades seam throws
to 'rejected'. One confirmed Medium: the persistPlayer refuse arm's
'local'-scope premise is falsified — server-emitted DATA_REFUSE_CODES reach
the identical result contract, and arming 'local' withholds the only
un-wedge (remote reset) for a deterministic server-side refuse.

| ID | Severity | Class | Surface |
|---|---|---|---|
| R29-AUT-1 | Medium | scope misclassification / recovery dead-end | `App.vue:591-605` — the arm reports `saveIssue.report('corrupted', payload, undefined, 'local')` unconditionally on the premise (comment :578-584) that DATA_REFUSE_CODES "only fire when the adapter was never invoked". That premise is false: `SupabaseCloudSaveService.ts:974-989` maps a server REJECTED response onto `{status:'unavailable', retryable:false, code:'SAVE_INVALID'|'SAVE_TOO_LARGE'}` — the identical contract the arm consumes, with the adapter invoked and the remote row read. For a deterministic server-side refuse (server-side rule that also fires on last-good content — e.g. `SAVE_SCHEMA_UNSUPPORTED`, cap shrinkage, version skew) the armed 'local' card offers only `deleteSave()` on the local mirror: remote `remoteResettable` is false, so `resetCharacter()` — the documented only un-wedge — is withheld. Flow: delete local → remote last-good restores → next write refuses identically → card → loop, forever. Sibling precedent contradicts the scope choice: `useAppLifecycle.ts:568` (commit-refuse) and `:691` (firstSave-refuse) scope 'remote' for the exact same refuse class, reasoning "remote reset is the only real un-wedge". Provenance is recoverable — `result.detail` is `OUTGOING_*` only for gate-emitted refuses — the arm ignores it. Probe: `F1` suite (adapter-emitted contract through the real `CloudSaveCoordinator.driveSave`, predicate match on both codes, gate-vs-adapter `detail` distinction). |
| R29-AUT-2 | Low | missing guard parity | `AlchemySystem.restoreJobs(jobs, restoreNowMs)` and `ProductionSystem.restoreStates(states, restoreNowMs)` take `restoreNowMs` with no `Number.isFinite` guard — asymmetric with the tick/settleOffline guard this batch added. A `-Infinity` feed re-anchors every began-pair to `-Infinity` completes (`startedAtMs > -Infinity` is always true → shift → `start - (start + Inf)` = -Inf), the foldable arm re-derives the digest over the -Infinity stamps so the witness stays self-consistent, and the next honest `tick` mints the whole queue (probe proves end-to-end mint: shifted stamps asserted `-Infinity`, settle event success, pill granted). `NaN`/`+Infinity` feeds are verbatim/deny (NaN comparisons false; nothing post-dates +Inf). Reachability: ungated feeds only — production `restoreClockMs` is `Math.min(isFinite(lastSavedAt) ? lastSavedAt : Date.now(), Date.now())` (:363-366) with `lastSavedAt` bounded `|v| < 2^52` at admission, so a hostile clock cannot reach the seam through saves. Guard-parity sibling of the fixed r28-AUT-2 — same "zero-advance on hostile clock" doctrine applies to the restore feed. |
| R29-AUT-3 | Nit | cap-walk coverage asymmetry | The r28 caps gate `talentLevels`' derived consumers (:856, :1045) but the refused-collection iteration class survives elsewhere: an over-cap `nodeLevels` is refused at :2026 yet walks :3158/:3225/:3253 still `Object.entries` the refused record — the probe observes their per-entry issues emitted (`player.nodeLevels.core_*` 'không có nguồn grant'), i.e. the iteration provably runs. Same for every `requireArray`/`optionalArray` consumer: `purchasedNodeIds` pushes the cap issue at :455 then still walks all 2000 entries at :1206 emitting 2000 issues (asserted exactly). Verdict is unchanged (refused either way) — wasted iteration + issue noise on crafted payloads, consistent-class leftover of the fix. |
| R29-AUT-4 | Nit | double-signal on terminal card | The refuse arm has no early return: after `saveIssue.report + bootFlow.fail()` the shared `result.status !== 'ok'` tail (:609-612) still fires the `autosaveFailed` toast and latches `saveFailureNotified` — one deterministic refuse shows both the terminal corrupted-save card and a transient "autosave failed" toast. Cosmetic UX noise on the way to the error mount. |
| R29-AUT-5 | Nit | dead protection | The ok-arm `saveIssue.clear()` (:618) can never run inside the session that armed a card: every `report()` arm pairs with `bootFlow.fail()` (entryStage 'error' gates `persistProgress` :313) or trips `observeAuthoritySaveResult` → 'recovery' terminal (`authorityStateForError('SAVE_INVALID'|'SAVE_TOO_LARGE') === 'recovery'`, probe-asserted), after which `authority.canMutate()` refuses every later `persistPlayer`. Harmless defensive dead code; the claim "a stale card can be swept by a later ok write" is unreachable by construction. |

---

## Attack verdicts — every r28 fix held (V1-V6)

**V1 — finite-clock guard boundary sweep.** `tick`/`settleOffline` zero-advance
on `NaN`, `±Infinity`, `±2^53`, `±1e300`, string/null/undefined/object
clocks — job preserved, no events, no pill (11 cases). The admitted boundary
`2^53 - 1` settles a due job normally (guard is `>= 2**53`, consistent with
`isBoundedTimestamp`'s `2**52` admission bound — every admitted stamp is
strictly inside the guard's admitted range). `settleOffline(NaN)` returns 0.

**V2 — foldable-witness matrix.** Post-dated job + malformed reservation
(`null`, scalar, `{}`, `specialIngredients:{}`, `=5`, `[null]`, `[1,2]`,
`[{}]` — 9 classes) restores without throw, the began-pair shifts onto the
restore clock, the stale digest is kept, and the job settles as `success:
false` with no pill — deny direction confirmed for every class.

**V3 — foldable honest path.** Valid `specialIngredients` re-derives the
digest over shifted stamps; `verifyAlchemyJobReservation` returns null and
the settle mints the authored pill — no honest regression.

**V4 — foldable-but-semantically-bad specials.** `{materialId:5,
amount:'x'}` elements are foldable (digest re-derived, self-consistent) but
grant-verify denies at the `specialIngredients` shape arm before the digest
compare. Sparse `[hole,hole]` arrays are foldable (`every` skips holes) but
deny at the recipe-length check. No mint through the foldable gate.

**V5 — envelope still fail-closed.** A shape-valid save failing acceptance
preflight degrades to `{status:'rejected'}` through `restoreGameSession`,
never an unhandled boot throw — the foldable-gate throw-path closure did
not open an envelope escape.

**V6 — digest determinism on shifted stamps.** `alchemyJobReservationDigest`
re-folds identically over `-Infinity` stamps (precondition for both the
V2/V3 deny mechanics and R29-AUT-2's ungated mint).

## Rejected candidates (attacked, mechanism disproven)

| Candidate | Rejection |
|---|---|
| Post-dated gated jobs reaching the shift arm with wild stamps | `startedAtMs <= playerLastSavedAt` admission pin (:3788) + `restoreClockMs = min(lastSavedAt, Date.now())` — a gated save can never carry stamps post-dating the restore clock. Ungated feeds only, accepted residual. |
| Wedge via non-foldable reservation (shift refused, job parks forever) | Not a wedge — the job restores, fails verify at settle, surfaces as a failed settle event; the save loads and the queue drains. Deny, not deadlock. |
| `saveIssue.report` idempotent overwrite racing between arms | Every arm pairs with `bootFlow.fail()` → terminal error mount; `persistProgress` gates on `entryStage !== 'game'` so no later persist can overwrite the card. Accepted residual confirmed structurally. |
| In-flight ok-write `saveIssue.clear()` racing an armed report | Impossible in-session: an armed card implies 'recovery' authority (terminal) or pre-'game' stage; `persistPlayer` can never observe an ok result after arming (R29-AUT-5 is the flip side — the arm is dead code, not a bug). |
| `restoreJobs` clones `{specialIngredients: []}` onto witnessless jobs | Accepted residual — the normalize clause (:414-424) builds a bare `{specialIngredients: []}` reservation with no `woodId`/`fuelWoodAmount`/`digest`, and grant-verify denies it (digest compare fails: `undefined !==` the re-derived hash). Deny direction, never mint. |
| `tick` admits `±(2^53 - 1)` while admission bounds at `2^52` | Consistent — the guard's admitted range strictly covers every stamp the validator can admit; the slack is safe headroom, not a hole. |
| `nodeLevels`-adjacent: `collectTalentEffects` reads uncapped `talentLevels` at :1122/:2285 | Property-access reads `talentLevels?.[id]` over bounded `selectedTalentIds` — no iteration of the refused record. Benign asymmetry, not the R29-AUT-3 class. |

## Deliverables

- Probe: `src/services/save/auditR29Aut.probe.test.ts` — 38 tests, all
  passing, deterministic (`Date.now` mocked via `vi.spyOn`,
  `@vitest-environment node`, `--pool=threads`).
- This report.
- Branch `devin/audit-r29-AUT-faa893c1` carrying only these two files.
