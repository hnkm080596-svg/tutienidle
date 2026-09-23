# Adversarial QA — M-F-RESPEC player node respec (quick)

- Date: 2026-09-23
- Scope (task-owned): `src/core/progression/NodeSystem.ts`, `src/core/game/GameManagerProgressionOps.ts`, `src/composables/useProgressionActions.ts`, `src/components/panels/skill-path/NodeTreePanel.vue`, `src/locales/{en,vi}.json`, `src/core/progression/NodeSystem.test.ts`, `src/core/game/GameManagerProgressionOps.respec.test.ts`
- Mapper domains: economy-and-progression, ui-input-lifecycle. One-hop consumers inspected: UI affordability/unlock state, keyboard/pointer/overlay behavior, observable domain-state feedback, save/offline progression.
- deepAuditCandidate=true triggered on 2-domain breadth only; risk is confidently bounded (below) — no deep escalation.
- Unmapped paths routed by inspection: ops layer → economy (transaction authority, same layer as devResetBranch/switchRoute); composable → ui-input-lifecycle (action wiring); locales → no domain (data); respec.test.ts → test artifact.

## Invariant ledger

1. Refund == sum of actually-paid Insight for revoked levels (paidForNodeLevels − nodeFreePurchaseRecord); never exceeds, never double-counts.
2. Idempotent: respec(respec(s)) ≡ respec(s); repeat call returns 0 with zero mutations.
3. Save-safe: writes only canonical persisted fields (nodeLevels, purchasedNodeIds, nodeFreePurchaseRecord, skillInsight); a JSON serialize→restore finds no refund residue.
4. Commit markers (Phap Tu element roots) are never revoked and never cascade-swept — a committed element can never be stranded un-rebuyable.
5. Combat guard: rejected during an in-progress turn battle with no mutation (same invariant as switchRoute).
6. Cascade: orphaned descendants revoked AND refunded; granted cores (M-QI-05) revoke only through grantsSkillCoreIds ties; non-grant cores and skill-axis investment untouched.
7. Preview ≡ commit: the confirm dialog's refund/count is produced by the real transaction on a detached clone.
8. Preview mutates nothing.

## Attack operators applied

- Re-entry/double-confirm: pendingRespec cleared before commit; modal unmounts — impossible.
- Repeat respec, respec-then-respec scopes: covered by idempotency tests (domain) + ops branch/whole-tree cases.
- Duplicate purchasedNodeIds entries / level-0 targets: revokeNodeOwnership is null-safe and idempotent; whole-tree targets include unowned nodes harmlessly.
- Free-purchase (Van Dao) accounting: nodeFreePurchaseRecord nets out and is deleted — covered.
- Combat race while dialog open: ops-layer null guard is authoritative; UI disable is advisory only — silent no-op on confirm is a degraded UX edge (Low), not a state defect.
- Reactive-proxy inputs: structuredClone fails on Pinia proxies — found and fixed pre-QA (JSON round-trip; regression test added; live drive confirmed preview renders).
- Persisted-state resurrection: all written fields are wholesale-replaced JSON scalars/maps — restore cannot resurrect deleted keys (R10 repeat-application machinery already covered by the save boundary suite; respec adds no persisted timer/counter slice).
- Scoped respec aimed at a preserved/unregistered root: no-op, returns 0 — covered.
- Scoped respec aimed at a core node id (API-only path, UI never passes rootId): revokes the core but refunds only upgrade levels (spentStart=1 treats level 1 as granted) — consistent with core semantics; UI unreachable (Low).

## Focused checks run

- 46 vitest cases across NodeSystem + GameManagerProgressionOps.respec (whole-tree refund math, idempotency, JSON-restore repeat, free-purchase netting, granted-core cascade, un-granted core survival, combat guard null + zero-mutation, element-root preservation with real PHAP_TU_NODES, branch-vs-whole-tree equivalence at root, preview≡commit non-mutation, reactive-proxy preview).
- P14 runtime: seeded body-pathway save (realmId qi_refining, 10 Cảm Ngộ, owned minor_the_can_cot:2 + minor_the_the_chat:1) — live drive: button enabled → confirm modal showed "Lấy lại 3 Cảm Ngộ — 2 node về 0" → confirm → points display 13 Cảm Ngộ, button disabled, modal closed. Preview≡commit parity verified in the real UI.

## Findings

| # | Severity | Finding | Evidence | Disposition |
|---|----------|---------|----------|-------------|
| 1 | Low | Scoped respec on a core id refunds upgrades but not level 1 | API-only surface; UI never passes rootId; matches granted-core accounting semantics | Deferred — document in summary |
| 2 | Low | Confirm during a battle that started while the dialog is open silently no-ops | Ops guard is authoritative; button disables on battle state; no corrupted outcome possible | Deferred — no user-visible failure mode |
| 3 | Nit | `hasOwnedNodes` only counts nodes in the rendered view; owned nodes hidden by way-filter can't enable the button | Requires owning nodes in a hidden way — unreachable in current flows | Deferred |

## Verdict

**PASS WITH EVIDENCE** — all mission-listed vectors covered by deterministic tests plus live runtime drive; no confirmed defects; three Low/Nit findings deferred with reasons. P5 sequential review still required.
