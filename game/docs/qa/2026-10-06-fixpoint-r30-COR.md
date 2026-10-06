# QA Review — fixpoint r30 COR (r29 adjudication audit)

- **Commit audited**: `33ade943f6118a56039ca51f3bf9504863a9636f` on `codex/hoa-cau-fireball-vfx`
- **Auditor role**: COR — correctness & regression (blind)
- **Probe**: `game/src/services/save/auditR30Cor.probe.test.ts` — 107 tests, all green (`npx vitest run --pool=threads`, node env)
- **Verdict**: **PASS WITH EVIDENCE** — 0 Critical / 0 High / 0 Medium / 3 Low / 3 Nit

---

## Scope / Risk Map

| r29 claim | Attack surface | Result |
|---|---|---|
| Finite-clock doctrine (`!isFinite \|\| abs >= 2^53` → deny) on restoreJobs / restoreStates / decompose tick+restore+settleOffline / quest marker / tribulation cooldownUntil | clockOk truth table at NaN, ±Infinity, ±2^53, ±1e300 | **Verified exact** — verbatim (parked) restore on every deny clock |
| Shift only under sane clock, span preserved, digest re-derived | admit clocks −(2^53−1), currentMs; top boundary 2^53−1 | **Verified** — re-grounds at restoreNowMs within double precision (see Nit-3); completesAtMs − startedAtMs exact; digest re-derived and `verifyAlchemyJobReservation` replays |
| `startJob` invalid_clock before all cost/burn | reason string, zero burn, precedence over `scope_hidden`, admit boundary | **Verified** — `{ok:false, reason:'invalid_clock'}` first; zero material/spirit burn; dormant recipe under NaN still returns `invalid_clock` (precedence pinned); at `-(2^53−1)` the job mints and is deeply due — ungated-caller note only |
| Lifecycle tick gated `entryStage==='game' && canMutate()` | truth table over all 5 stages × canMutate; autosave parity | **Verified** — only `game` ticks; canMutate=false blocks at game; `persistProgress` skipped under intro/auth/character/error, fires under game |
| App.vue refuse arm `return result` skips toast/latch | order vs observeSaveResult; local-mode authority substrate | **Verified** — observeSaveResult is a no-op under local authority (no reconnect dep): `authorityState` stays `ready`, `canMutate()` true — the entryStage gate (`fail()` → 'error') is load-bearing. Under remote the same refuse lands `recovery` terminal (`canMutate()` false) AND `bootFlow.fail()` — double-covered |
| requireArray/optionalArray return `[]` after cap issue | 1024 vs 1025 boundary; zero per-index issues | **Verified** — `player.selectedTalentIds` 1024 admits, 1025 refuses with the cap issue and zero `...[$i]` issues; `alchemyJobs` root path `.alchemyJobs` same |
| Coverage walks cap-gated | `nodeLevels` 1025 refuses, proxy census | **Verified** — root cap refuses, cap-gated walks read zero element keys |
| Equipment protection cap = 10, union pool, sole writer | 10 admits / 11 refuses / 6+5 union mix / produced-bag parity | **Verified** — validator refuses the 11th `locked\|\|favorite` entry; a real `EquipmentBag` capped at `EQUIPMENT_PROTECTION_CAP` produces a clean save |
| `useBootFlow` stage derivation + `fail()` | all route→stage pairs, pendingGameRoute promote/demote, retry bound | **Verified** — 'error' retry mounts at most 10 times, stops on first 'ok'; demotion waits for the route flip (keeps 'game' while pending 'error' is only closing/loading) |

## Invariant Ledger

| # | Invariant | Status |
|---|---|---|
| 1 | Deny clock (`!isFinite \|\| \|x\| >= 2^53`) restores ms-stamps verbatim — nothing re-anchored, nothing minted | Holds (probes A–E) |
| 2 | Sane clock + post-dated pair shifts with span exact and reservation witness re-derived | Holds (A, B) |
| 3 | invalid_clock originates before every cost/burn/scope arm | Holds (F) |
| 4 | Sim ticks and autosave only under entryStage 'game' with a mutable authority | Holds (G, H) |
| 5 | Refused collections pay no element walk | **Partially holds** — bound arrays skip, but two raw-field sibling walks still iterate (Low-1, Low-2) |
| 6 | A produced bag/save can never exceed the caps the validator enforces | Holds (J parity test) |
| 7 | Authority stamps reaching settle cursors are always finite/bounded | Holds — `sanitizeRestoreAuthority` (:158) precedes `restoreAuthorityNowMs` (:349); NaN/Infinity authority degrades to zero-accrual live-replacement |

## Findings

### Low-1 — `player.selectedTalentIds` over-cap still pays the coverage element walk

- **Severity**: Low — **Status**: Confirmed
- **Invariant**: #5 (refused collection pays no element walk)
- **Mechanism**: `requireArray` binds `selectedTalentIds` to `[]` at saveShapeValidation.ts:689 after pushing the cap issue, but `validateSkillCoreCoverage` reads `player.selectedTalentIds` raw at :3151-3153 and iterates it, calling `getTalentDefinition(talentId)` per element.
- **Evidence**: probe K1 — a 1025-element proxied array records element `get`/`has` reads while the cap issue fires and `shape.ok === false`.
- **Reachability/impact**: refused payloads only (an honest save is ≤ authored roster ≪ 1024). Consequence is wasted definition lookups on a payload already refused — no outcome divergence. Getter side-effects on a hostile Proxy are observable but the validator only reads (deny verdict unaffected).
- **Owner note**: same residual shape as r28-COR-Nit's record-walk note; fix would thread the bound `selectedTalentIds` into the coverage walk instead of re-reading the field.

### Low-2 — `player.persistentTimedEffects` over-cap still pays the liveTltPercent element walk

- **Severity**: Low — **Status**: Confirmed
- **Invariant**: #5
- **Mechanism**: same class — `requireArray` binds `persistentTimedEffects` at :1562, but the cultivation-speed allowance walk at :887-893 reads `player.persistentTimedEffects` raw and runs `.filter(...).map(...)` over every element.
- **Evidence**: probe K2 — proxied 1025-element array records element reads under a refused shape.
- **Reachability/impact**: identical to Low-1 — refused payloads only; pure reads, verdict unchanged.

### Low-3 — `applyTimedEffect` non-stackable arms lack the stackable arm's 2^52 clamp (self-brick wedge)

- **Severity**: Low — **Status**: Confirmed
- **Invariant**: every persisted ms-stamp stays inside the admitted timestamp domain
- **Mechanism**: `GameManagerPersistentEffectOps.applyTimedEffect` clamps the *stackable* merge at `2^52 - 1` (:328-331) but (a) the verbatim push of a fresh effect keeps a caller-supplied `expiresAtMs` untouched and (b) the non-stackable merge takes `max(existing, incoming)` verbatim. A caller-crafted `expiresAtMs = 1e16` persists into `player.persistentTimedEffects`; the next `buildGameSave` then fails `isBoundedTimestamp` validation — the writer's own payload is refused and escalates to the corrupted-save arm.
- **Evidence**: probe K3 — produced save containing the crafted effect fails `validateGameSaveShape` with a `persistentTimedEffects...expiresAtMs` issue; the stackable contrast arm clamps to ≤ 2^52−1.
- **Reachability**: caller-side only — production callers pass authored `now + duration`, and the save-injection path is refused by the same validator (the poison cannot enter via restore). This is a defense-in-depth asymmetry, not a reachable exploit. Deny direction holds throughout.
- **Owner note**: one clamp line on the two non-stackable arms would close the asymmetry.

### Nit-1 — equipment cap counters increment before the legacy-marker discard

- **Severity**: Nit — **Status**: Confirmed
- `unprotectedCount`/`protectedCount` at :3920-3929 increment before the `'realmId' in entry || 'rarity' in entry` discard `continue` at :3935-3938, so a legacy entry `{realmId, locked:true}` counts toward the protection cap although restore would discard it. Over-refuse direction only; a produced bag never mints legacy markers, so the payload class is dev-schema-mixed handcrafted saves. Same pattern as the pre-existing `unprotectedCount` — consistent, deny-safe.

### Nit-2 — no validator pin on `buildings[].lastCollectedAt`

- **Severity**: Nit — **Status**: Confirmed (deliberate design, recorded)
- Accrual is bounded by the stored-amount CAP (`getStoredAmount` clamps elapsed at :322-352) and restore clamps `> now → now` (BuildingManager.ts:50); a crafted far-past stamp is capped, a future stamp is re-grounded. Bounded both directions — noted so future auditors don't re-derive it.

### Nit-3 — shift grounding at extreme admit clocks rounds ±1–2ms

- **Severity**: Nit — **Status**: Confirmed (inherent)
- At `restoreNowMs = −(2^53−1)` the shift delta exceeds 2^53 and doubles round to even: the re-grounded `startedAtMs` lands 1ms off `restoreNowMs` (probe A/B `<= 4ms` tolerance). Span and digest consistency are exact; grounding at the authority boundary is correct to double precision. At `+(2^53−1)` no honest stamp can post-date the clock, so the arm is unreachable-but-correct (verbatim). No action needed.

## Rejected candidates (checked, not findings)

- **Remote coded refuse → `enterTerminal('recovery')` instead of `pause()`**: covered — `canMutate()` goes false (terminal) and the App.vue arm calls `bootFlow.fail()` → entryStage 'error'. Both layers gate the sim. Probes G/H pin the substrate.
- **`authorityNowMs` non-finite → `settleNowMs = NaN`**: unreachable — `sanitizeRestoreAuthority` (:158) degrades corrupt authority to zero-accrual live-replacement before `restoreAuthorityNowMs` (:349).
- **`observeSaveResult` order vs refuse arm**: `observeSaveResult` runs before DATA_REFUSE_CODES at :566 < :592; under local it early-returns (probe H), under remote it terminally parks before `fail()` — ordering is correct.

## Gaps

- Bad-clock restore arms are reachable only via direct calls — production restore paths always pass finite clocks (`restoreClockMs` derivation :363-366). The deny-arm probes are defense-in-depth pins, not live-path coverage.
- `hiddenGrottoChannels` verbatim-copy semantics were inspected but not probed (shallow copy; no stamp arithmetic).

## Pre-existing failures

None observed. Full file green: 107/107.
