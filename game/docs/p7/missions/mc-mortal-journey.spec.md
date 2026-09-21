# M-C — MortalChapterJourney Suite — Spec

Status: v2 — external review findings resolved: ritual/tribulation independence case required, Leg D pinned to real `restoreGameSession` on fresh manager+owner with pinned clock and persisted-field parity (transient `tribulationState` excluded), manager-backed post-restore continuation, probe parity redefined as semantic regression parity.
Date: 2026-09-22
Depends on: master `28279570` (post-M9)
Locked inputs: Mortal Chapter decision **D5** — a committed `MortalChapterJourney` regression suite: happy path + boundary/adversarial + save/restore checkpoint, production seams only. `M0LoopProbe.test.ts` is explicitly temporary and retires once the suite covers its trace.

---

## 1. Context and intent

The `EarlyGameSession` harness (P6-M1) already drives one persistent `GameManager`+player through real production seams with deterministic combat/loot RNG. Its existing test file proves pieces of the journey but is not organized as the canonical Mortal Chapter journey, has no save/restore checkpoint leg, and leaves `M0LoopProbe` alive as a duplicate ad-hoc trace. D5 wants the journey suite to be the *regression contract* for the Mortal chapter: if a future change breaks the intended progression chain, this suite fails first.

This is a **test-only mission** — no production behavior changes. If the journey reveals a production defect, it is recorded and fixed under its own scope, not smuggled in.

## 2. Current state — evidence map

| Concern | Today | File |
|---|---|---|
| Session harness | `EarlyGameSession` — seeded battle RNG, seeded loot RNG, manual combat clock, full production catalogs, `runStage`/`runTribulation`/`performRitual`/`investRefinement`/`equipAll`/`allocateAttribute`/`purchaseNode` seams, normalized `snapshot()` | `core/simulation/earlygame/EarlyGameSession.ts` |
| Declarative loop | `CANONICAL_EARLY_LOOP` + `runLoop` — closed-union steps on production seams only, `LoopReport.failedAt` | `core/simulation/earlygame/EarlyGameLoop.ts` |
| Existing coverage | bootstrap profile, cultivate tick, dong_1 defeat→grind→victory→dong_2, tribulation→ritual→qi_refining+node buy, determinism, session persistence | `core/simulation/earlygame/EarlyGameSession.test.ts` |
| Balance wall | canonical loop characterized to fail at `mortal_dong_5` post-P7-M3 (intentional power loss, compensation deferred to balance phase) — full-floor happy path CANNOT pass today | `EarlyGameSession.test.ts` L117-141 |
| Ad-hoc probe | `M0LoopProbe.test.ts` — self-declared TEMPORARY, traces creation→dong_1→cultivation→tribulation→ritual→qr floor 1→node buy through raw seams | `core/simulation/M0LoopProbe.test.ts` |
| Boundary coverage (scattered) | early-tribulation reject, invalid path/way pair, atomicity, stage realm-gate, attribute cap | `GameManager.dotPha.test.ts`, `GameManager.phapTuAnPath.test.ts`, `theTuRitual.test.ts`, `kiem-tu/invariants.test.ts` |
| Save/restore seam | `buildGameSave(player, gm)` → `GameSave`; `gameManager.saveOps.restoreFromSave(save)` / `restoreGameSession` — used by `SaveRoundTrip.test.ts` | `services/save/SaveSystem.ts`, `core/game/GameManagerSaveRestore.ts` |

Reachability facts the suite relies on (verified in current tests): Quan Khi (`runTribulation`) and the Initiation Ritual (`performRitual` → `chooseCultivationPath`) **both open at `mortal:12` and are independent** — the ritual gates on realm+level+valid pair+no active technique and does NOT read any tribulation outcome; `mortal_dong_1`/`mortal_dong_2` are winnable after honest grind + attribute spend; `mortal_dong_5` is the characterized wall. The 30 floors form ONE linear zone chain (`Zones.ts`) — `qi_refining_forest` sits behind `mortal_dong_10` and is unreachable under the current wall.

## 3. Target design

### 3.1 `MortalChapterJourney.test.ts` (new committed suite)

Lives next to the harness: `core/simulation/earlygame/MortalChapterJourney.test.ts`. Organized as journey **legs** (named describes), each exercising the production seams a real player uses:

**Leg A — happy path (combat economy):** creation (pinned profile) → `mortal_dong_1` defeat → grind+allocate → victory → `mortal_dong_2` victory. Asserts the combat-income loop (insight, drops, equip via `equipAll`).

**Leg B — happy path (cultivation spine):** cultivate→breakthrough to `mortal:12` → `runTribulation('qi_refining')` victory → `performRitual(path, way)` → asserts `realmId`/`cultivationPath`/`cultivationWay`/`realmLevel` post-state. **Independence case (required):** a second fresh session cultivates to `mortal:12` with NO tribulation run, asserts `getCommittedOutcome()` is empty, then `performRitual` succeeds — if a future change makes the ritual secretly depend on a Quan Khi victory, this leg fails visibly.

**Leg C — boundary/adversarial (journey narrative):** the rejects a real client could hit mid-journey, asserted as state-unchanged:
- `runTribulation('qi_refining')` below the mortal:12 gate → `refused`, no tribulation state. **Harness gap found at spec time:** the session's `runTribulation` calls `gameManager.startTribulation` directly and `TribulationDirector.start` does NOT check realmLevel — the real production gate is `realmAdvanceOps.canTriggerBreakthrough` (`realmLevel >= 12`) evaluated in `triggerBreakthroughAction` before `startTribulationPrepared`. `EarlyGameSession.runTribulation` gains the `canTriggerBreakthrough` precheck (session-seam fix so the harness mirrors the real entry contract — not a production change); below-gate calls then honestly return `refused`.
- `performRitual` below `CORE_REALM_LEVEL` (12) → `false`, realm/path/way untouched. (Verified contract: `chooseCultivationPath` gates on `realmId==='mortal' && realmLevel>=12` + valid pair + no pre-existing technique — it does NOT consume tribulation outcome; Quan Khi is parallel challenge content, not a ritual prerequisite. The suite documents this explicitly so a future gate change fails here visibly.)
- `performRitual` with an invalid path/way pairing → `false`, realm/path/way untouched.
- `performRitual` a second time after success → `false`, state untouched (idempotent reject).
- `runStage` on a realmLevel-locked floor → `locked`, `completedStageIds` unchanged.
- `allocateAttribute` past per-stat cap → `false`, pool unchanged.
- `investRefinement` with zero Tinh Hoa → 0/no-op, body chapter state unchanged.
- Post-state validity: after every rejected leg, the session still completes the happy-path leg (atomicity — a reject leaves no half-transition).

**Leg D — save/restore checkpoint:** mid-journey (post-ritual, qi_refining, nodes purchased) → `buildGameSave` → restore through the REAL `restoreGameSession(playerOwner, gameManager, save)` — a **fresh catalog-registered `GameManager`** (a second `EarlyGameSession` whose bootstrap state is overwritten by the restore) + a **fresh player owner** (fresh Pinia store) — NOT `saveOps.restoreFromSave` alone and NOT an `Object.assign` player merge. The session seam signature is pinned: `restoreCheckpoint(save, playerOwner)` — the TEST creates/passes the fresh owner; `EarlyGameSession.ts` must not import `stores/*` or Pinia, it only calls `restoreGameSession(playerOwner, this.gameManager, save)` and re-points `this.player` on success. Determinism: `Date.now()` is pinned (`vi.setSystemTime`) across `buildGameSave`+restore so the offline-progress term is exactly 0. Parity = every persisted journey field equals the checkpoint, **excluding transient `tribulationState`** — the committed tribulation outcome is intentionally not in the `GameSave` schema, so a fresh manager restores it as null (documented, not a defect). Post-restore continuation must include a **manager-backed action** (a stage run proving catalogs/combat/skills restored live), not cultivation-only — a raw tick only proves the player slice survived.

**Leg E — determinism:** two same-seed runs through legs A+B produce identical normalized snapshots (existing test moved/kept — dedupe rather than duplicate).

### 3.2 M0LoopProbe retirement

Delete `core/simulation/M0LoopProbe.test.ts` after confirming **semantic regression parity**: the probe was a diagnostic logger whose only assertion was `expect(true)` — its dump/QR1 debug trace is not a contract. Parity = every behavior the probe could reach through CANONICAL production paths has a suite equivalent: bootstrap → floor-1 loop → cultivation ladder → tribulation → ritual → node purchase → bag/insight income. Its `qi_refining_forest` trace bypassed the stage chain via direct cultivation grants and is unreachable under the canonical wall — the suite pins the real gate (`locked` behind `mortal_dong_10`) instead of reproducing the bypass.

### 3.3 Characterization vs. contract

The `mortal_dong_5` wall stays characterized (existing test documents it as an intentional post-M3 power loss awaiting the balance phase) — the journey suite does **not** assert floor-5+ victories. When the balance phase lands, the canonical loop test's TODO flips to the full happy path; this mission leaves the marker intact.

## 4. Files

| File | Why |
|---|---|
| `core/simulation/earlygame/MortalChapterJourney.test.ts` (new) | the committed journey suite |
| `core/simulation/M0LoopProbe.test.ts` (delete) | retired per D5 once parity confirmed |
| `core/simulation/earlygame/EarlyGameSession.ts` | session-seam fix: `runTribulation` gains the `canTriggerBreakthrough` precheck (mirrors `triggerBreakthroughAction`); possibly a save-checkpoint helper — session seams only, never production hooks |
| `EarlyGameSession.test.ts` | keep, or fold duplicated legs into the journey suite — no loss of coverage |

Non-goals: balance wall fixes, new production seams, RNG/fingerprint changes, tribulation/ritual gating redesign, CI wiring changes.

## 5. Invariants → tests

1. Every leg runs through production seams only (no `player.` direct grants in the journey path; creation uses `applyCreationProfile` exactly as boot does).
2. Rejected boundary actions leave all touched state identical (realm, path, way, cultivation, nodes, completedStageIds, attributePoints, body chapter).
3. Restored session snapshot equals pre-save snapshot on every PERSISTED journey field (transient `tribulationState` excluded — not serialized); post-restore manager-backed actions still work.
4. Same seed → same normalized snapshot (existing determinism contract preserved).
5. Suite must not assert content the balance wall makes unreachable; the wall characterization is preserved verbatim.

## 6. Resolved at spec time

- **Happy path floor coverage is bounded by the wall** — legs A asserts dong_1+dong_2 (proven); the qi_refining-floor-1 victory assertion lives in the canonical-loop test's TODO and stays a TODO.
- **No production edits in this mission** — any harness gap is closed inside `EarlyGameSession` as a session seam only.
- **`M0LoopProbe` deletion is part of the diff** — parity is verified in-review, not deferred.
