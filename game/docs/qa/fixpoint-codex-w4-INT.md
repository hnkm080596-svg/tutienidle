# Fixpoint wave-4 INTEGRATION audit — codex aggregate

Branch `codex/hoa-cau-fireball-vfx` @ 0afd0b2f (worktree
`.agent-worktrees/w4-int`, branch `devin/w4-int-report`). Auditor role:
INTEGRATION — adversarially verify the wave-3 fixes compose at their
seams: (1) `src/App.vue` onResume reject path (`markFailed('recovery')`
+ `saveIssue.report('corrupted', JSON.stringify(save))` + skip
`resumeSimulation`), (2) supabase migration `202610050002`
(save-boundary mirror + `characters.realm_id` 'mortal' normalization),
(3) contract fixtures (realm witnesses) + committedPlayer fire bundle.

Method: source trace of every dispatched seam, a 5-case repro harness
(`src/services/save/w4int.repro.test.ts`, all green — kept as
re-runnable pin evidence), `npm run type-check` clean at HEAD,
w3int repro harness re-run green (15/15).

## Verdict

**The wave-3 delta composes: 0 Critical / 0 High. 1 Medium, 3 Low,
4 Nit.** Under the fixpoint threshold ruling landed at 1a0f133f
(stop once no Medium+ remains), W4-INT-1 is the single Medium+
blocker for the next adjudication round. The rejected
live-replacement now lands in the same terminal
('recovery') as every other corrupt-save verdict, and the sim is
correctly left paused — but the `saveIssue.report` half of the fix
writes to a store that can never be read post-boot, so the intended
recovery surface is unreachable in-session (recovery still converges
through re-auth → boot). One inverted-direction mirror gap and one
charset divergence inside `create_character`.

## Surface verdicts (dispatched)

### 1. `markFailed('recovery')` post-boot vs at boot — VERIFIED equivalent

`OnlineSessionController.markFailed('recovery')` →
`enterTerminal('recovery')` is a legal transition from ANY state
(including 'ready' and 'reconnecting') — `OnlineSessionController.ts:211-219,354-365`.
It bumps generation (stale continuations die), clears heartbeat +
retry handles, and fires `onPause('terminal')` →
`useAppLifecycle.pauseSimulation` (`useAppLifecycle.ts:244-270`).

Post-boot ordering: `attemptReconnect` calls `markReady()` **then**
`onResume(...)` (`OnlineSessionController.ts:467-469`), so the reject
path executes 'reconnecting' → 'ready' → 'recovery'; markReady arms
the heartbeat and clears the retry, and enterTerminal immediately
clears the armed heartbeat again. Semantically equivalent to the boot
reject (the boot path runs the same markFailed→terminal sequence from
'checking'). Executed in pin `markFailed('recovery') post-boot` —
final state 'recovery', zero live scheduler handles, pauses contain
'terminal', `resumeSimulation` never invoked.

Sim stays paused **and** cannot leak a half-restored player:
`pauseSimulation` clears the autosave handle (`useAppLifecycle.ts:257-260`)
and `persistProgress` gates on `authority.canMutate()` (line 301) which
is false once 'recovery' is terminal — so even if the mid-try reject
subclass partially applied a restore, no writer flushes it. VERIFIED
containment.

### 2. `saveIssue.report` post-boot → dead write (W4-INT-1, Medium)

`SaveIncompatibleScreen` mounts ONLY inside
`<RouteMount route="error">` (`App.vue:1172-1188`), i.e. only when
`entryStage === 'error'`. The sole `'error'`-stage producer is
`bootFlow.fail()` / `boot.fail()` (`useBootFlow.ts:97-99`), invoked
exclusively inside boot's load/grant/first-save paths
(`useAppLifecycle.ts:382-615`). Post-boot `entryStage === 'game'` and
the resume fix never calls `boot.fail()` — so the report at
`App.vue:673` sets store state no render path can reach. The existing
witness pin (`src/App.routeMountWitness.test.ts`) proves the mount
condition itself.

Actual surface: the generic `authority.recovery` overlay
(`App.vue:1245-1250`, `authorityMessage` default branch line 741) +
`authority.reauth` button → `acknowledgeAuthority()` → `signed-out` +
`bootFlow.showAuth()`. The next sign-in re-runs the full boot; the
still-corrupt remote save then dies on boot's OWN corrupt path
(`useAppLifecycle.ts:396-405`) which re-reports `saveIssue` with the
verbatim bytes and calls `boot.fail()` → the real
SaveIncompatibleScreen. **Recovery converges — one re-auth roundtrip
away — but the wave-3 fix's own surface never renders.**

Secondary harm — stale-state hijack: `saveIssue.clear()` exists
(`stores/saveIssue.ts:32-36`) but has **zero production callers**
(grep-verified). A report written post-boot survives the whole page
session. On any LATER entry to the 'error' stage — e.g. a subsequent
boot whose first-save commit fails on CAS conflict or network
(`useAppLifecycle.ts:515-523,607-616`), a grant throw (567), or a
throwing load — the mount renders `<SaveIncompatibleScreen>` (stale
`raw`) **in place of** the real `boot-error` card, because
`saveIssue.status` wins the `v-if`/`v-else` at `App.vue:1179-1181`.
The user then sees "save corrupted" for an unrelated failure, and the
Export/Delete buttons act on stale bytes.

- Classification: REAL_DEFECT — CRS-02 (cross-layer contract violated:
  fix composes two layers whose surfaces don't intersect) + STA-04
  (uncleared stale state hijacks a later render).
- Evidence: EXECUTED_UNIT_STRUCTURAL (pin `markFailed('recovery')
  post-boot` + `saveIssue state persists`) + SOURCE_PROOF
  (App.routeMountWitness.test.ts, `useBootFlow.ts:97`).
- Repro: run the pin — authority ends 'recovery', sim paused,
  `saveIssue.status==='corrupted'` with no clear; then any boot.fail()
  on a subsequent session mounts the stale screen.
- Minimal correct fix (NOT applied — audit scope): either call
  `boot.fail()` after `saveIssue.report` to route into the error stage,
  or drop the report and let the terminal overlay + next-boot report
  own the surface (the latter matches the reconnect-pipeline's own
  convention — see §6).

### 3. `raw` shape for the export path — divergence (W4-INT-2, Low)

The resume wiring reports `JSON.stringify(save)` where `save` is
`loaded.save` = the **normalized** GameSave (`saveShapeValidation.ts:4792-4806`
replaces `player.cultivationPerSecond` with the F-TC9-4 clamp and
rebuilds `equipment`/`equipmentSlots`). Boot and pending-journal paths
report `loaded.raw` / `loaded.pendingRaw` — verbatim stored bytes
(`useAppLifecycle.ts:400,415,456`). `SaveIncompatibleScreen` exports
`saveIssue.raw` verbatim (`SaveIncompatibleScreen.vue:46-47`), so a
post-boot export would hand back the clamped re-serialization, not the
bytes the server stored — a debugging/forensics regression for the
exact save class this surface exists for.

Root: `ReconnectOutcome` (`OnlineSessionController.ts:48-60`) carries
`save?: GameSave` only — `runReconnectPipeline` drops `loaded.raw`
entirely (`reconnectPipeline.ts:60-65`). The resume path cannot reach
verbatim bytes even if wanted.

- Classification: REAL_DEFECT — PER-09 (byte-shape contract divergence
  between sibling seams) + CRS-08 (payload dropped across a seam).
- Evidence: EXECUTED (pin `saveIssue.raw from resume`): over-ceiling
  cps fixture is clamped silently (`shape.ok===true`), and
  `JSON.stringify(normalized) !== raw`.
- Note: severity held at Low because the write is already dead
  (W4-INT-1) — no reachable consumer today. The divergence materializes
  the moment the surface is wired through.

### 4. Contract fixtures vs production writer shapes — VERIFIED with Nits

- `committedPlayer`/`committedSave` in
  `tests/architecture/scopeWriteSeamsBlind.qa.test.ts:454-517` now carry
  the atomic commit's own witnesses: `spellPath.element:'fire'`,
  `nodeLevels {hoa_linh_ngo:1, core_hoa_cau_thuat:1}` + matching
  `purchasedNodeIds`, `hoa_cau_thuat` in skills, `five_elements_art`
  technique, `breakthroughGrade=1` for qi_refining+ (line 467-469).
  Pin `baseline` proves a REAL `commitSpellInitiationForTest` save
  satisfies every mirror predicate the server now enforces — the
  fixture is writer-producible, not a legal-fiction shape.
- Nit (PTH-06): `realmTechniques(realmId)` in
  `tests/integration/supabase/fixture.ts` returns the hollow stub
  `[{id:'five_elements_art'}]` — enough for today's `jsonb_array_length
  >= 1` mirror but not a faithful writer shape (production writes full
  Technique records). If the mirror ever checks technique identity or
  fields, this fixture silently stops exercising it.
- Nit (PTH-06): `committedSave` omits `linh_bao` — the real atomic
  commit keeps the mortal starter basic alongside the kit basic. The
  minimal `[hoa_cau_thuat]` skills list is shape-legal (no emit
  requires the starter's retention) but is one skill short of the
  writer's actual output.

### 5. `characters.realm_id` 'mortal' normalization — VERIFIED dead field

`RemoteCharacterMetadata.realmId` is parsed by `BackendStatus.ts`
(`readString`) then dropped — **zero readers** of the metadata field
client-side (grep-verified across `src/`). The only SQL consumer is
the `get_backend_status` projection itself, which the client maps
through the same optional field. The default flip 'pham_nhan'→'mortal'
+ backfill is informational-only — no behavior change, no UI seam.
SAFE as designed; Nit (QAI): dead fields that change default invite
exactly this audit question — worth a one-line comment in the
projection noting the field is carried for forward-compat.

### 6. Verdict routing across ingress seams — VERIFIED convergence, divergent surface

| Ingress | reject class | surface |
|---|---|---|
| Boot load corrupt/incompatible (`useAppLifecycle.ts:396-405`) | `markFailed('recovery')` + `saveIssue.report(status, loaded.raw)` + `boot.fail()` | SaveIncompatibleScreen now (export/delete) |
| Boot pending-conflict/quarantined (407-417) | same triple | same |
| Boot restore-reject (445-458) | `markFailed('recovery')` + `saveIssue.report('corrupted', loaded.raw)` + `boot.fail()` | same |
| Manual import (`importSaveRaw`, SaveSystem.ts:740-767) | shape+acceptance re-run; bad file refused before write | import UI error (no terminal) |
| Reconnect load-reject (`reconnectPipeline.ts`) | `{status:'terminal', state:'recovery'}` — no saveIssue write | generic recovery overlay → reauth → boot owns the surface |
| onResume restore-reject (App.vue:663-675, wave-3) | `markFailed('recovery')` + `saveIssue.report` (dead write) | generic recovery overlay → reauth → boot owns the surface |

All corrupt-content classes converge on terminal 'recovery' and reach
SaveIncompatibleScreen exactly once, via the next boot's load path.
The wave-3 resume fix matches the reconnect-pipeline's existing
convention (terminal overlay, boot owns recovery UX) — **but the dead
`saveIssue.report` differs from that convention's no-write**, which is
what produces the W4-INT-1 stale-hijack window.

### 7. Server boundary mirror (migration 202610050002) — mostly mirrors, residual gaps

Checked every mirror predicate against client emits:

- realm witness (unknown realmId / >ceiling / mortal+pair /
  qi_refining+ technique+breakthroughGrade / foundation+
  highestFoundationAchieved) — parity confirmed against
  `saveShapeValidation.ts:513-537` and the F-REALM-1 block;
  `progressionCeilingRealmId='foundation_establishment'` ⇄
  `v_realm_index>2`. Pool minima `lk_*:1 / tc_*:2 / kd_*:3` match
  `BREAKTHROUGH_TALENT_POOLS` exactly (5+6+2 ids verified).
- `pendingTalentEntitlement.realmId`: client rejects BOTH off-catalog
  strings AND any realmId ≠ `player.realmId` (`saveShapeValidation.ts`
  ~848-864); server checks catalog membership only. A catalog-id from
  a different realm, or a non-string value, persists server-side while
  the client wedges it on load — residual server-persists /
  client-rejects class (crafted-payload reachability only; the sole
  writer binds pool realmId to the entered realm).
  LOW — REAL_DEFECT, CRS-02 (unmirrored emit).
- `spellPath.element !== null` on a non-spell_pathway pair: client
  emits unconditionally (PhapTuPath.ts:214-225); the server mirror
  gates element checks under `way='spell_pathway'` — e.g.
  `hidden_spell_pathway` + element 'fire' persists server-side, client
  rejects. Same residual class, crafted-only. LOW — CRS-02.
- Both residual gaps sit inside the class the migration header
  explicitly accepts ("deeper checks stay client-owned ... reject lands
  on SaveIncompatibleScreen"), so they're documented divergences, not
  new defects — flagged so the residual list stays current.
- `create_character` charset gate `trim(p_name) !~ '^[[:alnum:]
  _-]+$'` vs client `/^[\p{L}\p{N} _-]{2,20}$/u`
  (`CharacterCreationService.ts:45-46`): divergent inputs exist under
  EVERY alnum interpretation — JS `\p{N}` covers Nd+Nl+No while PG
  `[[:alnum:]]` excludes Nl/No in all locales (`MinhⅣ`, `Đạo Hữu²`
  pass the client, die server-side — executed pin). Worse,
  `is_character_name_available` (202608240001:116-126) has NO charset
  clause, so the pre-check returns available; the create then rejects
  and the client maps `CHARACTER_NAME_UNAVAILABLE` → `code:
  'name_taken'`, message "Đạo danh này đã có chủ."
  (`SupabaseCharacterCreationService.ts:37-38`) — a **lying message**
  for a name that is free. LOW — REAL_DEFECT, CON-06 (asymmetric
  mirror producing a false diagnostic) + CRS-02.
  Sibling note: real-world trigger is narrow (Nl/No codepoints); the
  wide-impact case (Vietnamese diacritics) is locale-dependent —
  under a UTF-8 database LC_CTYPE they classify as letters on both
  sides, no divergence expected. Astral-plane letters are
  `\p{L}`-accepted client-side and their PG classification is
  version-dependent — flag as unverified edge rather than claim.

## Finding ledger

| ID | Severity | Class | Root class | Surface |
|---|---|---|---|---|
| W4-INT-1 | Medium | REAL_DEFECT | CRS-02 / STA-04 | saveIssue.report post-boot is unreachable dead write + stale hijack of later error-stage mounts |
| W4-INT-2 | Low | REAL_DEFECT | PER-09 / CRS-08 | resume reports JSON.stringify(normalized) not verbatim loaded.raw — export byte contract diverges from boot |
| W4-INT-3 | Low | REAL_DEFECT | CON-06 / CRS-02 | create_character charset mirror narrower than client regex; pre-check can't see it; rejection misreported as 'name_taken' |
| W4-INT-4 | Low | REAL_DEFECT | CRS-02 | mirror omits client's entitlement-realmId-mismatch and non-spell_pathway element-ownership emits (acknowledged residual class, kept on ledger) |
| W4-NIT-1 | Nit | DOCUMENTED | CRS-03 | AUTH_RESUMED diagnostic logs before the reject check — 'authority resumed' noise precedes a terminal 'recovery' |
| W4-NIT-2 | Nit | COVERAGE_GAP | PTH-06 | realmTechniques hollow `{id}` stub; committedSave skills list omits the retained linh_bao starter |
| W4-NIT-3 | Nit | DOCUMENTED | CRS-02 | realm_id 'mortal' normalization touches a wire field with zero client readers — correct but invisible; deserves a forward-compat comment |
| W4-NIT-4 | Nit | DOCUMENTED | ROB | mid-restore 'rejected' (post-preflight throw) leaves partial player state — contained by terminal pause + canMutate gate; M1's retry-converge semantics intentionally dropped by terminal routing |

## Repro harness

`src/services/save/w4int.repro.test.ts` — 5 cases, all green at
0afd0b2f. On a tree without the wave-3 fix the
`markFailed('recovery') post-boot` case still passes (it asserts the
*mechanism*, not the fix) — it is a composition pin, not a regression
pin; the invariants it locks (terminal='recovery', sim paused, no
resumeSimulation, saveIssue holds normalized bytes) are exactly the
state the fix must produce, and the stale-persistence assertion fails
if a future fix adds `boot.fail()` + clear wiring incorrectly.

Verification at HEAD: `npm run type-check` clean;
`npx vitest run src/services/save/w4int.repro.test.ts` 5/5;
`npx vitest run src/services/save/w3int.repro.test.ts` 15/15 (wave-3
pins still green at 0afd0b2f).
