# QA Review: task 2.2 lô 1 — i18n string extraction (ActionAvailability + AlchemyView + HomeResourceStrip + actionFeedback key pipeline)

- Date: 2026-09-03
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/core/presentation/ActionAvailability.ts`
  - `game/src/composables/useEquipmentActions.ts`
  - `game/src/stores/actionFeedback.ts`
  - `game/src/components/common/ActionFeedbackLog.vue`
  - `game/src/components/panels/AlchemyView.vue`
  - `game/src/components/game/HomeResourceStrip.vue`
  - `game/src/locales/vi.json`
  - `game/src/locales/en.json`
  - `game/src/core/presentation/ActionAvailability.test.ts`
  - `game/src/components/game/HomeResourceStrip.test.ts`
  - `game/src/stores/actionFeedback.test.ts` (new)
  - `game/src/components/common/ActionFeedbackLog.test.ts` (new)

## Scope and Risk Map

Changed systems: core presentation mapping (reason → locale key), equipment-action feedback pipeline (Pinia `actionFeedback` store + `ActionFeedbackLog.vue` renderer), 2 Vue components (AlchemyView, HomeResourceStrip), and vi/en locale JSON.

One-hop consumers (mapper + manual trace): `ActionFeedbackLog.vue` (sole renderer of feedback entries), equipment-hall tabs (`EnhanceTab`/`WashTab`/`RefineTab`/`DissolveTab`), `EquipmentPaperdoll`, `EquipmentBagSection`, `PillRoomPanel` (mounts AlchemyView), `GameRoot` (mounts HomeResourceStrip + ActionFeedbackLog), parity test `src/i18n/index.test.ts`.

Mapper `unmappedPaths`: `ActionAvailability.ts`, `vi.json`, `en.json` (extension `.json`/unrouted) — manually routed: `ActionAvailability.ts` is presentation-only (no domain state); locale JSON is content with parity enforced by `index.test.ts`. Exclusions: none (all dirty files are task-owned).

Escalation decision: mapper flagged `deepAuditCandidate: true` (cross-system: 4 domains). NOT escalating — the change is presentation-key threading only: no save shape, no economy mutation, no clock, no Phaser ownership. Feedback entries are runtime-only (`actionFeedback` store does not persist — verified in store code). Risk confidently bounded by the store + render tests below.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-I18N-1 | `actionFeedback` store (runtime-only) | `errorKey`/`successKey` push key-form entry | Synchronization: entry stores `messageKey`+`messageParams`, message empty; no raw concatenation in store | Value mutation (params variants) | `entries[0].messageKey/messageParams/message` | Unit (actionFeedback.test.ts) | Medium — sole new state shape |
| INV-I18N-2 | `actionFeedback` store | Repeat identical failure within merge window | Idempotency: key+params identity dedups with count increment, no entry spam | Repeat | `entries.length === 1`, `count === 2` | Unit | Medium — merge contract must survive identity change |
| INV-I18N-3 | `actionFeedback` store | Two failures differing only in reason param | Synchronization: different params → separate entries (no false merge) | Value mutation | `entries.length === 2` | Unit | Medium |
| INV-I18N-4 | `actionFeedback` store | Plain-string entries (dissolve rewards, warnings) | Determinism: legacy message dedup contract unchanged | Repeat | counts 2/2/1 on 3 pushes | Unit (regression) | Medium |
| INV-I18N-5 | `ActionFeedbackLog.vue` render | Key-form failure entry rendered in vi | Determinism: rendered text byte-identical to pre-migration composed string `Không thể {label}: {reason}` (learned-defect QA-2026-09-01-007) | Reorder (param nesting) | DOM text equals exact vi string | Component (ActionFeedbackLog.test.ts) | High — user-visible copy contract |
| INV-I18N-6 | `ActionFeedbackLog.vue` render | Locale switched to en after entries pushed | Stale state: key entries re-render in en; plain entries unchanged | Stale state | DOM contains `Cannot Refine: Not enough Qi Refining Essence.` + unchanged vi plain string | Component | Medium — the actual value of the migration |
| INV-I18N-7 | Locale parity | vi/en key trees after +40 keys each | Recoverability: no missing-key silent fallback | Cross-system | `index.test.ts` parity test green | Unit (existing) | High — guards every future locale edit |
| INV-I18N-8 | `HomeResourceStrip.vue` mount | Mount without i18n plugin (legacy harness) | Lifecycle: component requires `app.use(i18n)`; test harness updated | Degraded environment | Test mount passes with i18n; aria-labels equal `t()` values | Component (HomeResourceStrip.test.ts) | Low |
| INV-I18N-9 | `useEquipmentActions` call sites | `washCommit`/`refineCommit` op-id args | Determinism: all 6 `withSyncAndResult` callers pass valid OpId | Value mutation | `vue-tsc` type-check green (OpId union) | Type-check | Medium — TS caught 2 stale call sites during dev |
| INV-I18N-10 | vi.json values | 23+2+7+5 extracted strings | Synchronization: vi values byte-identical to pre-migration literals (no copy drift) | Value mutation | Byte-compare script vs `git show HEAD:` — 0 failures | Verification script | High — copy fidelity oracle |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm.cmd run test -- src/core/presentation/ActionAvailability.test.ts src/components/game/HomeResourceStrip.test.ts src/i18n/index.test.ts` | 3 files / 14 tests passed | Includes parity + key-mapping + aria assertions |
| `npm.cmd run test -- src/core/presentation src/components/panels/equipment-hall` + composables | 10 files / 42 tests + 14 files / 54 tests passed | Equipment-hall tabs cover the touched feedback producers |
| `npm.cmd run test -- src/stores/actionFeedback.test.ts src/components/common/ActionFeedbackLog.test.ts` | 2 files / 9+5 tests passed | New QA oracles INV-I18N-1…6 |
| Byte-compare: extracted vi values vs `git show HEAD:...` literals | 0 failures across 37 strings | Script used `-cne` (case/codepoint-sensitive); locale JSON round-trip byte-identical, 0 replacement chars |
| `npm.cmd run test` (full suite) | 331 files / 2152 tests passed | Full-suite regression |
| `npm.cmd run type-check` | Clean (after fixing 2 stale `'Tẩy Luyện'`/`'Tinh Luyện'` args caught by OpId union) | vue-tsc --build |
| `npm.cmd run build` | ✓ built in 4.32s, exit 0 | Production build |
| Mapper `changed-risk-map.mjs` (task-owned paths only) | 4 domains, `deepAuditCandidate: true` | Escalation waived with bounding rationale above |

## Findings

None Confirmed. Two test-authoring iterations during QA (teleport-to-body query miss; PS 5.1 BOM on a new test file) were oracle defects in new QA tests, not production defects — both fixed within the QA allowlist and re-run green.

## New or Changed QA Tests

- `game/src/stores/actionFeedback.test.ts` — proves key-form entry shape, identity dedup (repeat), no cross-merge of differing params, and unchanged legacy string-dedup contract.
- `game/src/components/common/ActionFeedbackLog.test.ts` — proves rendered vi copy is byte-identical to the pre-migration composed strings (success + failure + fallback), plain entries untouched, and en re-render after locale switch.

## Gaps and Residual Risk

- No runtime browser evidence for `GameRoot` integration (i18n is installed in `main.ts` since before this change; component-level oracles cover rendering). Coverage gap, non-material.
- `dissolve` success message still embeds data-layer material names (vi) — pre-existing, owned by deferred batch 2.7 per design doc §4.6.
- `ActionFeedbackLog` header buttons (`Nhật ký thao tác`/`Xóa`/`Mở`/`Thu gọn`) remain hardcoded vi — outside this task's file list (queued for a later 2.2 batch).

## Pre-existing Failures

None observed (full suite green before and after).
