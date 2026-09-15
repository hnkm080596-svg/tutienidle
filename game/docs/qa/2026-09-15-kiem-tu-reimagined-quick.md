# QA Review: kiem-tu-reimagined branch (Tasks 1–13)

- Date: 2026-09-15
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths: the full `feat/kiem-tu-reimagined` branch — `6db3c147..5b91ccf7` (12 commits, ~198 files) plus uncommitted `game/src/core/kiem-tu/invariants.test.ts`. Task-owned set = every path in that range; the worktree's only other state is the QA report itself.

## Scope and Risk Map

`changed-risk-map.mjs` on the 199 task-owned paths returns `deepAuditCandidate: true` for `save-and-cloud`, `time-and-offline`, and "cross-system change: 6 domains", with a large `unmappedPaths` list.

Escalation decision — **not escalated to deep audit**, risk confidently bounded:

- `time-and-offline` flagged by filename matching only. `git diff 6db3c147..HEAD` shows **zero** production change under `src/core/idle/`, `OfflineProgressSystem`, `GameClock`, auto-farm production code, or timestamp plumbing. The one matched production file, `services/save/saveVersion.ts`, is a 61→62 constant bump — and dev-phase convention rejects v61 outright (`SaveSystem` classification), so there is no migration surface to audit.
- `save-and-cloud`: the persisted delta is one new optional field `PlayerData.kiemTu` flowing through `buildGameSave`'s whole-state `detachSaveValue` spread. Restore replacement semantics reset it when absent — covered by existing save tests plus `GameManager.kiemTuState.test.ts` restore cases. No cloud/revision/writer code touched.
- Economy/progression and combat risk is bounded by the task-owned invariant suite (24 tests covering all 15 spec invariant categories) plus per-task test layers (~120 new/changed tests across the branch) and the focused checks below.
- Vue/Pinia/Phaser ownership: the bridge is a read-only snapshot consumer; the orb picker submits through the existing `submitTurnChoice` pipeline; no new scene lifecycle or EventBus handler was introduced.
- `unmappedPaths` are docs, test files, and the kiem-tu composables — all inspected directly; none carry unroutable risk.

One-hop consumers inspected in current code: `GameManagerTurnBattleOps` (participant build, auto-repeat restart, Cửu Cung dispatch), `GameManagerProgressionOps` (mode gate, purchase flip, grant routing), `GameManagerRealmAdvanceOps` (path choice, merge hook), `NodeSystem` (prereq eval, mode filter), `TurnBattleSystem` (`resolveDeclaredHit`, `applyExtraImpact`, `applyDeclaredBuff`), `kiemBarBridge`, `useTurnCombatManual`, `SaveSystem`/save types.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-KT-1 | `player.kiemTu` / `KiemTuState` | provider construction per mode | Separation: hien never reads kiemY/kiemDao*, ngu never reads preset | Cross-system chain | provider closure over mode-specific fields | unit (`invariants.test.ts`) | High — shared object across both specs |
| INV-KT-2 | preset / `KiemPhoSystem` | init + edit + cursor advance | Boundedness: preset 1–9, orb-unlock per realm, cursor stays in range | Value mutation | rejected edits, wrapped cursor | unit | High |
| INV-KT-3 | cast log / `KiemPhoSystem` | recordCastAndMatch per cast | Determinism + exactly-once: one combo fire/cast, no chain, log ≤ 5 | Repeat | combo emission count, log length | unit | High |
| INV-KT-4 | combo table / `KiemPhoCombos` | data authoring | No sequence is a proper suffix of another | Static | suffix-free guard test | unit | Medium — matcher correctness depends on it |
| INV-KT-5 | hit resolution / `TurnBattleSystem` | combo turn | Additive: orb hit still lands, both damages recorded | Cross-system chain | two damage events on combo turn | integration | High |
| INV-KT-6 | realm gating / `KiemPhoOrbs`+matcher | realmIndex edges | Boundedness: combo length 3/4/5 tiers, orb unlocks obey table | Value mutation | match/no-match at boundaries | unit | High |
| INV-KT-7 | discovery / data↔presentation | fs scan | No `KIEM_PHO_COMBOS` import under presentation/components; unique presetId per combo | Static | grep guard + uniqueness assertion | unit | Medium — hardcore-discovery contract |
| INV-KT-8 | conversion / `GameManagerProgressionOps` | `kiem_tu_an` purchase | Exactly-once + atomicity: reveal → gated purchase → irreversible flip → learn+equip | Repeat, reorder | purchase rejects pre-reveal/in-battle/wrong-mode; flip persists; second purchase impossible | integration | Critical — crosses progression→combat→persistence |
| INV-KT-9 | cascade / `NguKiemDaoProvider` | multi-instance cast | Boundedness: guaranteed hit unconditional; rolls only when unlocked; break-on-death consumes no RNG; RNG calls = live instances | Value mutation | injected-rng call count, per-instance opts | unit | High |
| INV-KT-10 | economy / `NguKiemDao` | gain/forge/merge | Conservation + exactly-once: gain no-op at cap & outside ngu; conversion only in gain hook; merge snapshots count then resets to 1, kiemY untouched | Reorder, repeat | post-merge count=1, base×(1+0.3n), kiemY unchanged | unit + integration | Critical — currency across combat→persistence |
| INV-KT-11 | `kiemDaoBase` / `NguKiemDao` | repeated merges | Monotonicity: base never decreases; count ≥ 1 in ngu | Repeat | base sequence across merges | unit | High |
| INV-KT-12 | retired ids / whole tree | fs scan | Recoverability: no `kiem_tran_*`/`bat_kiem_*`/`TRAN_SEQUENCE`/`sword_intent` in fresh-save content paths | Static | dead-id scan | unit | Medium |
| INV-KT-13 | manual vs auto / provider+engine | same orb via both channels | Determinism: identical resolution | Repeat | equal damage/events for equal inputs | unit + integration | High |
| INV-KT-14 | `currentThe` / kiem-tu files | fs scan | Isolation: zero `currentThe` reads under `src/core/kiem-tu` | Static | grep guard | unit | Medium |
| INV-KT-15 | precursor lock / `GameManager*` | path choice → equip/cast | A table-driven gate rejects `tram`/`linh_bao`/`huy_quyen` once `cultivationPath` set; `ngu_kiem` unaffected | Stale state | equip rejection ×3; already-equipped precursor stripped at choice; `authoredBasicSkillId` returns undefined post-path | integration | High — three defense layers verified (unequip at choice, equip gate, basic resolver) |

Focused checks beyond the suite (learned-defect weighted):

- RR7 cardinality: `applyKiemTuRealmTransition` is invoked only from the tribulation-victory major-realm write and the mortal→qi_refining contract path — never from minor `BreakthroughOutcomeService` nor per-tick update. Merge is exactly-once per transition.
- QA-2026-09-13-001 signature parity: `useTurnCombatManual.chooseDynamicBasic` submits the real production `{kind:'dynamic_basic', defId}` shape gated on `isAwaitingManualTurnChoice()`; no shadow channel exists.
- Battle-state leak: `resetForBattle()` is invoked for every `dynamicBasic` participant at auto-repeat restart (`GameManagerTurnBattleOps` ~L1084) — cursor/log cannot leak across cycles.
- QA-2026-09-13-002 symmetric guards: `kiemDaoBelowCap` prereq eval uses the same `kiemDaoCap()` domain helper as `gainKiemY`/`grantKiemDao` — one cap rule, all read sites.
- Mode dispatch: participant provider selection reads live `player.kiemTu.mode` at battle build; `ngu` also attaches `TU_KIEM_Y_EMBLEM`/`KIEM_DAO_CASCADE_EMBLEM` display lanes.
- `applyExtraImpact`: per-target instance loop with `alive` break, `perInstanceOptions(i, entity)` per hit, `appliesBuff` routed through `applyDeclaredBuff` (self/target + stacks).
- `setKiemPhoPreset`: rejects non-hien, rejects during battle, validates length + realm unlock, copies the array (no caller aliasing).
- `van_kiem_quyet`: removed from Elite/Boss `signatureDrops`; QA never-lootable test present; conversion learn+equip path covered.

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | PASS | clean at `5b91ccf7` + invariant suite |
| `npm run build` | PASS | production build clean |
| `npx vitest run` (full) | 4404 pass / 4 expected-fail / **1 fail** | `GameManager.autoFarmOffline` "cycleSeconds 0.5s bounded" timed out at 5 s under parallel load |
| `npx vitest run src/core/game/GameManager.autoFarmOffline.test.ts` (isolated rerun) | PASS in 925 ms | first run = Flaky (load-starved timing-sensitive test), not task-caused — no production offline code in this diff |
| `npx vitest run src/core/kiem-tu` invariant suite | 24/24 PASS | covers INV-KT-1…15 above |
| Dead-id fs sweep (`kiem_tran_*`, `bat_kiem_*`, `TRAN_SEQUENCE`, `sword_intent`, `currentSwordIntent`…) | clean | remaining hits are negative-assertion tests, save-version history comments, removal-note comments |
| Code inspection of all cross-system seams listed in ledger | no defect | evidence in focused-check list above |
| Browser drive (hien preset cycling, combo fire, ngu cast, merge) | **PASS (post-merge, main checkout)** | Driven on `master` @ merge commit via `npx playwright cli` + dev server: (a) QuanKhiPanel spec card "Chuyên tu Kiếm Tu: Kiếm Phổ" + preset editor strip/palette — append/remove chips write live through `setKiemPhoPreset` (`preset` observed mutating to `[orb_dam ×3]`); palette shows 3 unlocked orbs at golden_core (Đâm/Chém/Bổ) with Hất/Quét disabled+locked. (b) hien battle: orb picker owns the basic slot (3 `__slot-button--orb` buttons "Dùng Đâm/Chém/Bổ"); `action_impact` events carried `presetId: kiem_combo_tam_thich` ×5 — combo payload reaches presentation as its own event (K11). (c) `kiem_tu_an` purchased through the real op (`tram` Lv3 gate, mode hien→ngu); ngu battle: basic slot = single "Dùng Ngự Kiếm Thuật" manual option, special/ultimate render emblem defs (Tụ Kiếm Ý / Kiếm Đạo Liên Toát); `kiemBarReader` → `{label: "Kiếm Ý · 3 kiếm", current: 484, max: 16899}` (forgeCost(golden_core)=16899 exact; +34 Kiếm Ý banked live from casts). Both battles ended in real victory panels; 0 console errors. Breakthrough-merge presentation not driven (needs major realm advance; domain covered by unit tests). |

## Findings

No `Confirmed`, `Suspected`, or `Coverage gap` findings against the audited task.

## New or Changed QA Tests

- `game/src/core/kiem-tu/invariants.test.ts` (uncommitted at report time — lands in the Task-13 commit): 24 tests asserting the 15 spec invariant categories, including fs-scan guards (INV-7/12/14) following the `deadReferences.test.ts` pattern.

## Gaps and Residual Risk

- ~~Browser/runtime presentation not driven (P14 worktree exception)~~ — **resolved post-merge on main checkout** (see Verification Evidence row above). Only residual: breakthrough-merge animation not driven live; its domain transition is unit-covered.
- The 37-combo table is scaffold content (presetIds, tier multipliers, appliesBuff stacks) — full effect authoring is a declared spec non-goal; matcher/modifier contract is what this review covered.
- `GameManager.autoFarmOffline` timeout under load is recorded as Flaky/pre-existing-class evidence; it does not weaken the verdict because the task diff contains no offline/time production change.

## Pre-existing Failures

- `GameManager.autoFarmOffline.test.ts` > "cycleSeconds cực nhỏ (0.5s) → vẫn bounded" — `Flaky`: timed out at 5 s inside the parallel full-suite run; passed in isolation (925 ms). Environment starvation, not a task-owned regression.
