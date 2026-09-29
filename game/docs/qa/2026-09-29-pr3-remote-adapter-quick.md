# Quick QA — PR3 remote-authoritative adapter (B1-B)

Date: 2026-09-29 · Mode: quick · Scope: `beta-final/pr3-remote-adapter` diff (41 files)

## Routing

`changed-risk-map.mjs` → domains `save-and-cloud` + `ui-input-lifecycle`, `deepAuditCandidate: true`
("critical state boundary: save-and-cloud", "cross-system change: 2 domains").
Unmapped task-owned paths manually routed: `useAppLifecycle.ts` (boot/save domain), `services/backend/` +
`services/session/` (composition + RPC contract domain), `DevMode.ts` + locales + `env.d.ts`/`.env.example`
(dev-gating + config surfaces — inspection only).

**Escalation decision — deep audit not triggered despite `deepAuditCandidate: true`:** the changed
remote-authoritative transitions are sealed behind `VITE_BACKEND_MODE=supabase`, which resolves
`admission:'blocked'` on every release build by construction (`backendMode.ts` fatal matrix:
release+absent-mode, release+mock, missing-credentials all fail closed). The only reachable production
behavior today is the unchanged mock/local path, whose old invariants are pinned by the preserved
local-mode tests. The unsealed remote path's live-backend runtime risk belongs to PR4-6 by the plan's
own contract ("unsealed infra is testable, not launchable"). What remained attackable in quick scope —
client-side state chains, composition guards, boot transaction semantics — is covered below; a genuine
defect was found and repaired.

## Invariant ledger

| ID | State/owner | Hypothesis | Invariant | Verdict |
| --- | --- | --- | --- | --- |
| INV-PR3-1 | grant path / `useAppLifecycle` | remote `CHARACTER_UNINITIALIZED` retried after a failed first save re-runs grants via `bootGame(false)` (back-to-auth → `onAuthenticated`) | Exactly-once / Conservation | **Confirmed** → fixed |
| INV-PR3-2 | conflict / `SupabaseCloudSaveService` + coordinator | `remote-authoritative` conflict re-syncs or retries a write | Terminal, exactly one attempt | Rejected — test pins `remoteWriteAttempts=1`, `remoteRow.payload` unchanged |
| INV-PR3-3 | boot order / `useAppLifecycle` | ticks run before revision-1 ack | Monotonicity (rev 1 precedes tick) | Rejected — `tickCountBeforeFirstRemoteAck===0`, save precedes `clock.start` |
| INV-PR3-4 | `SupabaseCharacterCreationService` | malformed `CREATED` payload orphans the committed row | Recoverability | Rejected — rollId retained, next attempt → `CHARACTER_EXISTS` → reload → `CHARACTER_UNINITIALIZED` rebuild; self-recovering |
| INV-PR3-5 | fatal bundle / `backendBundle` | fatal composition reports `mode:'mock'` and admits mock-only debug hooks | Truthful mode label | Confirmed (Nit) → fixed |
| INV-PR3-6 | cache mirror / adapter | corrupt/unaccepted remote payload reaches localStorage | Recoverability (preserve, never mirror) | Rejected — `cacheAcked` only on ACCEPTED bytes; corrupt raw stays out of cache |
| INV-PR3-7 | terminal conflict + autosave | every 15s autosave fires a doomed write after terminal conflict | Synchronization | Coverage gap (Low) — toast deduped via `saveFailureNotified`; pause-on-authority-failure is PR4's state-machine scope |
| INV-PR3-8 | composition / `backendMode` | release build silently instantiates mock | Fail-closed release admission | Rejected — full matrix pinned (release+absent/mock/no-creds → fatal) |

## Confirmed finding → repair

**F-PR3-1 (Medium): remote `uninitialized` retry double-grants the starter transaction.**

Chain: `create_character` commits → boot grants apply → revision-0 write fails (`unavailable`/`conflict`) →
`boot.fail` → error screen → back-to-auth → `onAuthenticated` → `bootGame(false)` → load returns
`CHARACTER_UNINITIALIZED` again (row still has no save) → grant path re-entered with
`createNewCharacter:false`, which the `newCharacterGrantsApplied` guard never consulted →
`initializeCharacter` re-runs on the already-granted managers → duplicate `teleport_array`/
`gathering_outpost` building instances and doubled starter materials (15+15 wood, 6+6 ore) → a second
save commits the doubled snapshot to the authoritative row. Local mode could never reach this:
`empty && !createNewCharacter` exits at `requireCharacter` before the grant branch.

Evidence: failing reproduction added under the QA allowlist —
`src/composables/useAppLifecycle.test.ts` › "CHARACTER_UNINITIALIZED retried after a failed first save
triggers the dirty-transaction reload instead of re-granting" (failed `expected 'entered' to be 'skipped'`
pre-fix; passes post-fix). Evidence kind: EXECUTED_UNIT.

Fix (production, post-QA): `useAppLifecycle.ts` checks `newCharacterGrantsApplied` at EVERY grant-path
entry — remote `uninitialized` included — and resolves a repeat to `hardReset()` + `skipped`, the same
dirty-transaction recovery the `createNewCharacter` early guard already used.

Sibling hunt: the grant branch is the only non-idempotent re-entrant surface in the boot flow
(`onRestoreOk` is idempotent — `skillManager.has` guards; the pre-load `createNewCharacter` early guard
remains needed because `coordinator.load()` itself has side effects). No other consumer reaches it.

## Coverage gaps / deferred

- Live-backend runtime evidence (two-tab CAS, lost-ACK replay, heartbeat expiry) is unsealed by design —
  PR4 journal/reconcile + PR5 online admission own it; recorded as COVERAGE_GAP, not a defect.
- Terminal-conflict autosave keeps issuing doomed writes every 15s (INV-PR3-7) — harmless server-side,
  one deduped toast client-side; the "pause on observed authority failure" state machine is PR4 scope.

## Verdict

PASS WITH EVIDENCE (per-operation label, not a run verdict): one Medium confirmed and repaired with a
failing-then-passing reproduction; all other hypotheses rejected with evidence or recorded as gaps.
QA-pass writes stayed inside the allowlist (`useAppLifecycle.test.ts` repro, this report).
