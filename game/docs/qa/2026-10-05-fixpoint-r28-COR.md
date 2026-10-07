# QA Review: fixpoint r28 — COR audit of the r26 batch + r27-COR + r27-AUT/INT fixes (1582467f)

- Date: 2026-10-05
- Mode: deep (scoped to the r26+r27 diffs at `1582467f` + class siblings)
- Verdict: **PASS WITH EVIDENCE** — zero Critical/High/Medium. One Confirmed **Low** (the r27-INT-Low normalize fix missed the sibling arm inside the same function), three Nits/pre-existing notes.
- Audit commit: `1582467f` on `codex/hoa-cau-fireball-vfx` (detached worktree `.agent-worktrees/audit-r28-cor`)
- Probe: `game/src/services/save/auditR28Cor.probe.test.ts` — 15 probes, all green (`npx vitest run src/services/save/auditR28Cor.probe.test.ts --pool=threads`)
- Task-owned paths: report + probe only (read-only audit; QA-write paths only)

## Scope and Risk Map

Verified mechanisms and their contracts:

1. `restoreClockMs = Math.min(finite(lastSavedAt) ? lastSavedAt : Date.now(), Date.now())` (`GameManagerSaveRestore.ts:363`) — authority excluded (r27-COR-1), feeds the four seams.
2. `ProductionSystem.restoreStates` (`:129-171`) — post-dated began-pairs shift by `startedAtMs - restoreNowMs`, span preserved, strict `>`; `states.clear()` then replace; unknown siteIds dropped at the boundary.
3. `AlchemySystem.restoreJobs` (`:376-415`) — same shift + reservation digest re-derived over shifted stamps; clone arm normalizes non-array `specialIngredients` → `[]`.
4. `TribulationDirector.restoreRuntime` (`:843-865`) — `cooldownUntil` clamps at `restoreNow + TRIBULATION_COOLDOWN_SECONDS*1000`.
5. `DecomposeSystem.restore` (`:232-272`) — `nextCycleAt` clamps at `restoreNow + cycleMs`, merged `max(live, restored)`.
6. `verifyAlchemyJobReservation` (`:184-277`) — `costScale` checks → `specialIngredients` collection+element shape arm → digest fold → recipe compares; dead `Array.isArray` arm removed.
7. `validateGameSaveShape` (`:5059-5068`) — fail-closed try/catch → refused verdict; all six call sites (`SupabaseCloudSaveService:441,748`, `SaveSystem:524,758`, `recoveryApi:58`, `CloudSaveCoordinator:182`) read `normalizedSave` only after the `ok` narrow and classify `!ok` → `corrupted`.
8. `driveSave` refuses carry `code:'SAVE_INVALID'` + `retryable:false`; `DATA_REFUSE_CODES` escalation mounts the `saveIssue` recovery surface (`App.vue:594`, `useAppLifecycle:568,691`).
9. `ID_COLLECTION_CAP` coverage census: every `Record<string,number>` on PlayerData is capped (`baseStats:662`, `talentLevels:790`, `skillCastCounts`, `nodeLevels:2015`, `nodeFreePurchaseRecord:2301`, `nodeOneShotGrants:2319`, `perfectClearSeconds:2462`, `hiddenBeastKills`, `hiddenChannelCycles` per-site); all id arrays go through `requireArray`/`optionalArray`; `learnedSkillIds` has distinct cap-vs-shape messages (`:2331-2345`).
10. `sanitizeRestoreAuthority` (`saveTypes.ts:298-325`) — `undefined`→`undefined`; `null`→deny; kind whitelist; `|stamp|>=2^52`/non-finite→deny primitive.

One-hop consumers attacked: `alchemyJobReservationDigest` (fold over shifted stamps), `restoreGameSession` try/catch → `'rejected'` (`SaveSystem.ts:292-322`), `SaveIncompatibleScreen.vue` `remoteResettable` gate, `advanceWorkerLanes` lane heads, `calculateOfflineTime`/channel caps (10h production, 24h autofarm), every negative/boundary value of the admitted timestamp domain.

Excluded (adjudicated residuals, per brief — re-verified not re-reported): cursor-channel far-future stamps, equipment hoard >1024 (D-02), `PendingSaveJournal`/`restoreBackup` ungated, `OUTGOING_UNSERIALIZABLE` unreachability, join-or-displace, stackable-chain tail loss, skewed-honest began-pairs paying skew-early, witnessless-job `{specialIngredients:[]}` clone, cap-reporting asymmetry, decompose merge-max ≤30s deny, `saveIssue.report` idempotent overwrite.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-R28-A1 | `alchemyJobs[]` / restoreJobs | post-dated job + malformed reservation | Recoverability: normalize arm must not throw AND no earlier arm may throw first | Value mutation (null reservation, `{}` specials) | TypeError escapes `.map` | probes A1/A1b | medium |
| INV-R28-A2 | same input, non-post-dated | restore | Asymmetry check: identical class must behave identically | same payload, began ≤ clock | `specialIngredients` → `[]` | probe A2 | medium |
| INV-R28-A3 | began == restoreNow boundary | restore | Strict `>`: no shift, no digest re-derive | boundary value | digest byte-identical | probe A3 | medium |
| INV-R28-A4 | shifted job digest | re-derive | Witness replays over shifted stamps | value mutation | digest differs from writer, verify → null | probe A4 | high |
| INV-R28-B1 | workerCycles / negative clock | restore | Shift is pure arithmetic, deterministic under any finite clock | negative restoreNow | stamps exact | probe B1 | low |
| INV-R28-B2 | `cooldownUntil` | exact-boundary clamp | `==` keeps, `+1` clamps | boundary ±1ms | serializeRuntime | probe B2 | medium |
| INV-R28-B3 | `nextCycleAt` | exact-boundary clamp | `==` keeps, `+1` clamps | boundary ±1ms | getSaveState | probe B3 | medium |
| INV-R28-V1 | validateGameSaveShape | internal defect | Fail-closed: never throws, refuses with fixed verdict | throwing getter | `{ok:false, path:'', 'validator gặp lỗi nội bộ'}` | probe V1 | high |
| INV-R28-V2 | honest wire save | validate | Regression: legit payload not shadowed | none | ok:true, zero issues | probe V2 | highest |
| INV-R28-C1 | capped collections | exactly 1024 | Boundary: cap fires only above it | count=1024 | no cap issue at path | probe C1 | medium |
| INV-R28-C2 | `learnedSkillIds` | arm ordering | Distinct messages: shape arm vs cap arm | `{}` vs 1025 vs non-string element | message discrimination | probe C2 | low |
| INV-R28-C3 | sanitizeRestoreAuthority | `|x|`=2^52, sign, kind, null | Whitelist + abs-bound + deny primitive | boundary values | deny `{live-replacement, now}` or verbatim | probe C3 | medium |
| INV-R28-D1 | `player.lastSavedAt` | negative value | Domain asymmetry documented | -1e12 | no issue at marker path | probe D1 | low |
| INV-R28-D2 | restoreClock end-to-end | negative marker | `min(marker, now)` = marker; shift deterministic | wire-level | restored stamps | probe D2 | low |

## Findings

### QA-2026-10-05-R28-001: `restoreJobs` shifted arm still throws on a defined-but-malformed reservation — the r27-INT-Low normalize misses its own sibling arm

- **Severity: Low** — Status: **Confirmed** (probes A1, A1b, A2)
- Invariant: Recoverability — "the normalize arm must never throw on an ungated payload" (the fix's own comment, `AlchemySystem.ts:407`).
- Mechanism: inside `restoreJobs`'s map (`:386-402`), a job whose `startedAtMs > restoreNowMs` takes the shift arm, which evaluates `alchemyJobReservationDigest(shifted, job.reservation)` at `:399` **before** the normalize arm at `:409` runs. The digest folds `reservation.specialIngredients.map(...)` (`:171`) unguarded, and `reservation` itself is only excluded when `=== undefined` (`:389`). So:
  - `reservation: null` → `null.woodId` → TypeError (probe A1)
  - `reservation: { …, specialIngredients: {} }` → `({}).map` → TypeError (probe A1b)
  - `reservation: 5 | 'x' | []` → same fold throws
  The **same payload on a non-post-dated job** takes the return clause and normalizes to `{specialIngredients: []}` silently (probe A2) — identical malformed class, two different outcomes depending solely on the stamp's position.
- Reachability: ungated callers only. Every production path gates: admission pins a well-formed reservation (verify refuses the malformed shapes) AND `startedAtMs <= lastSavedAt`; skewed-marker saves that reach the shift arm still carry gate-valid reservations. The one intended ungated consumer the fix targeted (`restoreBackup`-style tooling, tests) hits the crash exactly on the input class it claimed to tolerate. If ever reached through `restoreGameSession`, the outer try/catch (`SaveSystem.ts:292-322`) converts it to `{status:'rejected'}` → the recovery surface, not a crash — degrade is classified, so the practical blast radius is a thrown exception in ungated tooling, contradicting the fix's contract.
- Expected: guard the digest arm the same way (`Array.isArray(reservation.specialIngredients)` before the fold, or skip re-derive when the reservation isn't shape-valid).
- Actual: TypeError on the shifted arm only.
- Test file: describe block "(A)".

### QA-2026-10-05-R28-002: over-cap `player.talentLevels` still pays two unconditional `Object.entries` walks downstream of the cap arm

- **Severity: Nit** — Status: **Confirmed** (code read; no probe — performance-only)
- Mechanism: the cap arm at `:790` refuses >1024 keys and skips the per-entry validation walk, but `Object.entries(player.talentLevels)` runs twice more unconditionally under `isObject` — `:853-858` (CPS headroom build) and `:1037-1043` (`pendingTalentEntitlement` sanitize). A 1025-entry map pays its full enumeration tax anyway; the verdict is identical (refuse) either way. Sibling maps (`nodeLevels`, `nodeFreePurchaseRecord`, `nodeOneShotGrants`, `perfectClearSeconds`, `skillCastCounts`, `baseStats`) have no later O(N) walks — only O(1) index lookups (`:1197`, `:2085`, `:3030-3035`). The cap's stated purpose (bounding gate cost on crafted maps) is partially defeated on this one channel.
- Reachability: crafted save only; no verdict or grant impact.

### QA-2026-10-05-R28-003: `player.lastSavedAt` and the began-time stamps admit negatives — sibling deadline stamps require non-negative

- **Severity: Nit** — Status: **Confirmed** (probes D1, D2, B1)
- Mechanism: `lastSavedAt` uses `isBoundedTimestamp` (`:2410` — finite && `|x| < 2^52`, no `>= 0` arm), as do `appliedAtMs`/`expiresAtMs` (`:1568-1571`), `lastCheckedMs` (`:2499`), and the workerCycle/alchemy began-pairs (`:3461-3462`, `:3696-3697`). The deadline-channel stamps all use `isNonNegativeBoundedTimestamp` (`lastDailyResetAtMs` `:3343`, `lastCollectedAt` `:3378`, `decompose.nextCycleAt` `:4558`, `tribulation.cooldownUntil` `:4579`).
  Consequence verified end-to-end (probe D2): a negative marker → `restoreClockMs = min(-1e12, now) = -1e12` → the began-pair shift is deterministic and floorless (probe B1) but **unreachable for gated payloads** (began-times are pinned `<= lastSavedAt`, which is already deep-past) → every stamp stays deep-past → completes are already due → offline window `[marker, settleNow]` is giant but each settle channel caps at its authored budget (production/decompose 10h, autofarm 24h, cultivation equivalent). Deny-equivalent to a `lastSavedAt = 0` craft — the negative domain adds no reachable behavior the marker's low arm didn't already admit.
- Reachability: crafted save only; no new grant class over the pre-existing crafted-low-marker surface. Recorded for adjudication on domain symmetry (either admit negatives everywhere with documented reason, or pin the marker non-negative).

### QA-2026-10-05-R28-004: sibling restore seams still throw on structurally-malformed ungated input (pre-existing class)

- **Severity: Nit** — Status: **Confirmed** (code read — same class as R28-001, noted for the ledger)
- `ProductionSystem.restoreStates` throws on `state = null` (`state.siteId` read at `:137`), `workerCycles: {}`/non-array (`({}).map` at `:147`), `cycle = null` (`cycle.startedAtMs` at `:156`), or a non-iterable `states`. `DecomposeSystem.restore` throws on `state = null`; `restore({nextCycleAt: undefined})` produces `NaN` → parked timer (deny). `TribulationDirector.restoreRuntime` is already defensive via `?.` (primitive slice → no-op). `restoreJobs` throws on non-iterable `jobs`, `job = null`, plus the A-finding arm. All production callers gate through `validateGameSaveShape` + `restoreGameSession`'s try/catch → `'rejected'`; the throws only reach ungated callers. Recorded so the class is visible when the next seam gets the normalize treatment.

## Rejected candidates (verified, not findings)

- **`useAppLifecycle` hardcoded `'remote'` scope on the commit/firstSave refuse arms** (`:568`, `:691`) vs `App.vue`'s `remoteAuthority ? 'remote' : 'local'` (`:594`): **not a defect.** `remoteResettable` (`SaveIncompatibleScreen.vue:32`) is `remoteAuthoritative && scope==='remote'` — under local capability the scope label never changes behavior (both branches resolve to `deleteSave()` on the local envelope); under remote-authoritative the arms' justification comments are consistent with `'remote'`. The commit arm is additionally inside `if (remoteAuthoritative)` (`:518`) and unreachable locally.
- **Began-pair shift grant direction:** the shift only ever moves stamps *downward* to `restoreClock`; a shifted pair pays exactly one authored cycle — never more than honest. Instant-settle inside the authorized window is deny-equivalent to the crafted-low-marker surface (channel-capped).
- **`restoreClockMs` on NaN/missing/`Infinity` `lastSavedAt`:** `Number.isFinite` arm → `Date.now()`; `settleNowMs`/`offlineSinceMs` go `NaN` on the `??` (nullish-only) fallback and every `<= NaN` compare denies — consistent deny on poisoned input (ungated anyway).
- **`restoreRuntime` on a primitive slice:** `slice?.cooldownUntil`/`?.committedOutcome` — `5?.x` evaluates `undefined` → skips safely (the one already-defensive seam).
- **`settleNowMs` / `offlineSinceMs` clamps under skewed authority:** both clamp at `Date.now()` (`:445-475`); dues in `(now, untilMs]` defer to live ticks — no mint (the r24-INT-01 self-brick rationale is documented in-code).
- **`validateHiddenPerfectionPersistedState`** covers non-array `hiddenBreakthroughRealmIds` via `validateRealmIdList` (`HiddenPerfection.ts:145-149`) — the `:1860` cap arm only sees real arrays; shape-before-cap ordering is correct.
- **Duplicate `learnedSkillIds`:** consumed per-element only by `applyOneShotClawback` → `skillSystem.unlearn(skillId)` — idempotent membership, duplicates inert (`GameManagerProgressionOps.ts:450`). No dedup needed.
- **`saveIssue.report` `path:''` verdict shape:** six call sites all narrow on `ok` before reading `normalizedSave`; refuse shape carries `discardedEquipmentCount: 0` — verified each site.
- **Duplicate `siteId` entries in `productionSites[]`:** last-wins at `states.set`; the second entry still passes validation independently and post-dated cycles would shift — no mint (deny-direction, pre-existing).

## Fixpoint status

The four re-anchor seams behave exactly as specified (span-exact shift, strict `>` boundary, clamp bounds at `restoreNow + authored span`, authority excluded from the bound); the validator is verifiably fail-closed and shadows no legit payload; the reservation verify ordering holds and its digest replays over shifted stamps; every capped collection refuses above 1024 with the cap issue at the collection path. One Low — the `restoreJobs` normalize fix left its own sibling arm (the digest re-derive) throwing on the same input class — plus three Nits documented for adjudication. No Critical/High/Medium findings.
