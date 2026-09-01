# QA Review: task-14 locale consistency (VendorPanel/SpiritSpringPanel/SettingsPanel formatNumber)

- Date: 2026-08-31
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths:
  - `game/src/components/panels/VendorPanel.vue`
  - `game/src/components/panels/SpiritSpringPanel.vue`
  - `game/src/components/panels/SettingsPanel.vue` (one line inside handleSave)

## Scope and Risk Map

Change is display-only template interpolation in 3 Vue panels: 7 sites `toLocaleString('vi-VN')` → `formatNumber` in VendorPanel, 2/3 sites in SpiritSpringPanel (1 deliberate exception), 1 `toLocaleTimeString()` → `toLocaleTimeString('vi-VN')` in SettingsPanel. No handlers, no domain mutation, no lifecycle, no persistence touched.

Mapper output (`changed-risk-map.mjs`): domains `economy-and-progression`, `ui-input-lifecycle`; one-hop consumers: UI affordability/unlock state, keyboard/pointer/focus/overlay behavior, observable domain-state feedback, save and offline progression; `deepAuditCandidate: true` (reason: "cross-system change: 2 domains").

**Escalation decision (mapper is advisory):** no mandatory deep-escalation condition holds. Code inspection bounds the risk: all edits are pure read-side formatting expressions — same computeds (`haPhamOwned`, `row.owned`, `storedAmount`, …) feed the same `:disabled` affordability logic unchanged; no transition, side effect, persistence, clock, or ownership boundary is touched. Cross-system breadth is 2 mapper domains but zero changed transitions. Excluded from review inputs: all unrelated dirty files from Tasks 1-13 (git status shows ~30 modified files owned by other tasks; only SettingsPanel overlaps, where the diff is one added line on top of Task 2-3 async rework left intact).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-locale-1 | Vue panels + NumberFormatter | Replace vi-VN grouping with formatNumber in render expressions | Conservation: rendered number equals the underlying computed value (no silent rounding that changes meaning for integers) | Value mutation (0, huge 2.36M prices, fractional rate 5.5) | Template renders; type-check; panel tests | Unit/type | High |
| INV-locale-2 | SpiritSpringPanel ratePerMinute (BuildingSystem) | formatNumber(Math.round) applied to genuinely fractional rate 5.5 | Conservation: display must not misrepresent a real decimal (5.5 → "6" would be ~9% error) | Value mutation | Template render decision | Static + existing domain tests | High |
| INV-locale-3 | VendorPanel affordability (`:disabled` on owned computeds) | Display swap must not alter affordability inputs | Synchronization: display and gate read same computed | Stale state / repeat | `:disabled="haPhamOwned < RATIO"` untouched — diff shows no script-side logic change | Diff inspection | Medium |
| INV-locale-4 | SettingsPanel handleSave (Task 2-3 async rework) | Add `'vi-VN'` arg to toLocaleTimeString | Atomicity/consistency of prior tasks' uncommitted work preserved | Repeat/reorder | Diff shows exactly one added line; async result-check rework intact | Diff inspection | Medium |
| INV-locale-5 | formatNumber contract for large values (unitPrice) | K/M suffix on prices up to 120×3^9 ≈ 2.36M hạ | Boundedness/consistency with app price standard (BuildingConstructionGate, ArtifactGradeSection already use formatNumber for costs) | Value mutation (huge tier) | Static evidence of existing pattern; NumberFormatter.test.ts | Unit (existing) | Low |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm.cmd run type-check` (vue-tsc --build) | PASS, no errors | Catches template/script type breaks in the 3 SFCs |
| `npm.cmd test -- src/components/panels` | PASS 6 files, 15/15 tests | Existing panel suite incl. SettingsPanel tests still green after the one-line change |
| Grep 3 files for `toLocaleString\|toLocaleTimeString` | Only 2 intentional sites remain (SpiritSpringPanel:97 rate decimal exception, SettingsPanel:51 time locale) | Confirms no missed grouping site |
| Grep all `*.vue,*.ts` under `game/src` for `toLocaleString('vi-VN'` | 1 match = the documented SpiritSpringPanel exception | App-wide M9 residual is exactly the one deliberate site |
| Diff review (git diff) | VendorPanel/SpiritSpringPanel contain only task changes; SettingsPanel diff = Tasks 2-3 async rework + exactly one added `'vi-VN'` line | No unrelated user work touched |
| Read VendorBalance.ts:88-145 | All unit prices are integer base × integer 3^(tier-1) → integers (max ~2.36M); formatNumber's ≥10,000 K/M path applies, sub-10k integers render exactly | No fractional-price data loss from Math.round |
| Read BuildingSystem.ts:46-76, 262-322 + BuildingSystem.test.ts:111 | Rate is genuinely fractional (mortal target 5.5; level scaling 1+(level-1)×0.2 over maxLevelMultiplier yields non-integer rates at non-max levels) | Justifies the documented exception (INV-locale-2) |
| NumberFormatter.test.ts exists at `core/format/NumberFormatter.test.ts` | Contract covered by existing unit tests; not re-run (outside panel scope, unchanged file) | Low-severity hypothesis closed by existing coverage |

## Findings

### QA-2026-08-31-1: No component test asserts the rendered number format of VendorPanel/SpiritSpringPanel
- Severity: Low
- Status: Coverage gap
- Invariant: Synchronization (rendered output vs domain value for the new formatNumber path)
- Preconditions: Panel mounted with known bag amounts.
- Reproduction: N/A — no component test file exists for these two panels.
- Expected: A mount test asserting e.g. "12,345" grouping appears for a 5-digit owned value.
- Actual: Rendering correctness is evidenced only by type-check + the pattern being identical to 5 other panels that already use formatNumber.
- Evidence: `glob core/format` + `src/components/panels` show no VendorPanel/SpiritSpringPanel test files.
- Test file: none
- Owner subsystem: UI panels
- Blast radius: Cosmetic-only display strings; no state impact. Not worth a QA-authored test because the formatting function itself is unit-tested and the template usage is the established app pattern; flagged as residual gap instead.

### QA-2026-08-31-2: SpiritSpringPanel rate keeps vi-VN decimal locale (deliberate M9 exception)
- Severity: Low
- Status: Confirmed as intended behavior, not a defect (per task brief's sanctioned option)
- Invariant: Conservation (display fidelity of a fractional rate: 5.5 must not render as "6")
- Preconditions: mortal realm spring at any level.
- Reproduction: `getRatePerMinute` returns 5.5 (asserted `toBeCloseTo(5.5)` in BuildingSystem.test.ts:111).
- Expected: "+5,5 thạch/phút" (vi-VN decimal comma) retained.
- Actual: Template keeps `toLocaleString('vi-VN', { maximumFractionDigits: 1 })` with an in-template comment; report documents the trade-off.
- Evidence: BuildingSystem.ts:47 `mortal: 5.5`; NumberFormatter.ts:43 Math.round would display "6".
- Test file: none needed (no defect)
- Owner subsystem: SpiritSpringPanel display
- Blast radius: One display line; one residual vi-VN decimal site in the app.

No `Confirmed` defect. No new tests authored: no failing oracle exists to reproduce, and adding passing tests for unchanged formatting behavior is outside QA's reproduction-test purpose.

## New or Changed QA Tests

None — no defect with a failing oracle; display fidelity of the exception site is enforced by existing domain tests (BuildingSystem.test.ts rate assertions) and the brief's documented decision.

## Gaps and Residual Risk

- QA-2026-08-31-1: no mount-level render assertions for the two panels (Low, cosmetic-only; formatNumber itself is unit-tested and the pattern matches 5 existing panels). Does not block: no state or economy transition depends on the changed strings.
- QA-2026-08-31-2: one deliberate vi-VN decimal site remains (rate line). Bounded: single line, documented in code + task report; closing it fully would require a NumberFormatter decimal variant, which the brief forbids this task.
- Both are non-material to the limited verdict.

## Pre-existing Failures

None observed in the executed commands (`type-check`, panel test run both clean).
