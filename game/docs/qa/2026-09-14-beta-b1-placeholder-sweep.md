# B1 — Placeholder / Test-Only Sweep (Normal Flow Phàm Nhân → Trúc Cơ)

Date: 2026-09-14 · Scope: beta-readiness plan Wave B, task B1 · Verdict: **PASS WITH GAPS** (1 finding needs scope decision)

## Method

Static sweep of `src/data/**` for placeholder/TODO/test-only markers, drop/production source reachability, command-wheel → panel wiring, stage/quest catalogs, and node-tree render paths.

## Verified clean / intentionally unreachable

| Item | Evidence |
|---|---|
| Kim Đan+ material entries (`golden_core_wood_*` … `tribulation_*`) | Registry placeholders for building cost validity only. Unreachable in beta scope: `TERRITORY_THANH_VAN.realmIds = [mortal, qi_refining, foundation_establishment]` caps all production rewards at tier ≤3, and `BuildingSystem` hard-gates `level N → realm tier N` (`getRealmTier(realmId) < level+1 → false`). |
| `phap_tu` combat art placeholder | Documented ratcheted debt (R6, `placeholderArtEntityKeys()`); user decision — non-blocking. |
| `talisman_slot` wheel entry | `NEVER_AVAILABLE` — never renders a button. |
| `phap_bao` for paths without artifact definition | Honest gate text "đang chờ thiết kế", not a dead button. |
| `phap_tu_lap_dao_da_phap` (Đa Pháp trap keystone) | Exists only as `excludesNode` target (asserted by `PhapTuNodes.dao.test.ts`). **Unreachable via UI** — no tree view renders `branchTag: 'da_phap'`; no auto-purchase exists. The 0-cost trap (buying it would lock all Thuần branches forever) cannot trigger in normal play. |
| `TurnReactionPathSkills` placeholder skill | Engine-blocked from resolving (TurnBattleSystem chặn) — intentional. |
| `enemySpawnDebug`, `debug.playerBodyAnchors`, `devResetBranch` | `import.meta.env.DEV` / localStorage-gated dev tooling — absent from production builds. |
| Stages | 30 real stages: mortal ×10, qi_refining ×10, foundation ×10. No test IDs, no hidden flags. Full beta arc covered. |
| Quests | 11 real quests (progression + dailies). No test entries. |
| Tribulations | `qi_refining` + `foundation_establishment` chapters + mind-question data — real content for both beta breakthroughs. |
| Command wheel | Every rendered entry targets an existing left-panel mode or standalone panel; ring-3 building entries all map to real `functionType`s (`stage_select`, `pill_room`, `equipment_hall`, `worker_lodge`, `exploration`). |

## Finding — Thuần node tree invisible (needs scope decision)

`PHAP_TU_NODES` distributes 106 nodes across branchTags: `fire/wood/water/metal/earth` (12/12/12/12/11), `lap_dao` (1), `da_phap` (1), `thuan_<element>` (9 each = 45).

`NodeTreePanel` renders `allNodes.filter(node => node.branchTag === props.branchTag)` and the only caller (`SkillPathPanel`) always passes an `ElementType` — so **47 nodes can never render**:

- `phap_tu_lap_dao` — the shared Lập Đạo gate (cost 0, FOUNDATION realm prereq). No auto-purchase exists (`GameManagerRealmAdvanceOps` only auto-buys `hoa_linh_ngo`/`kiem_tran_luong_nghi`).
- `lap_dao_thuan_<el>` keystones — prereq `phap_tu_lap_dao`, so even if the gate were auto-granted, the keystones themselves don't render.
- 3 Thế nodes per element (`tu_the`/`truong_the`/`the_man`) — Trúc Cơ-designed progression (skillModifiers on the element's basic skill A, prereqs chain from the keystone only, no realm gate beyond FOUNDATION).
- Special/ultimate unlocks + variants — realm-gated Kim Đan+/Độ Kiếp anyway (beyond beta content either way).

Effect: the entire Thuần-hệ chain merged 2026-09-03 (`3abec260`, roadmap §2571) is dead content in normal play — including the in-beta-reachable Thế momentum layer. No UI path selects a `thuan_*`/`lap_dao`/`da_phap` branch.

### Options

- **A — Wire it (small):** element view renders `branchTag ∈ {el, 'thuan_'+el, 'lap_dao'}`; gate auto-grants on Trúc Cơ breakthrough for phap_tu path (consistent with existing starter-node auto-purchase) or renders in each element view. Đa Pháp stays unrendered (still works as excludesNode target).
- **B — Formally park Thuần (docs-only):** document as post-beta alongside Đa Pháp; content stays inert. The engine-side Thế system (`TheResourceSystem`) simply never activates.

## Coverage gaps noted

- No e2e asserts the node tree renders purchasable Trúc Cơ nodes (the invisibility shipped undetected).
- Live-browser audible-audio check still pending (đợt-1 report).
