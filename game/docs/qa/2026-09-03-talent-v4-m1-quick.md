# QA Review: Talent Catalog v4 M1 — Combat (branch worktree-talent-v4-m1)

- Date: 2026-09-03
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/core/buff/BuffSystem.test.ts` (E1 tests)
  - `game/src/core/skill/{Skill,SkillSystem,PassiveSystem}.ts` + `PassiveSystem.talentv4.test.ts` (E2)
  - `game/src/core/talent/{Talent,TalentEffects}.ts` + `TalentsV4Wiring.test.ts`
  - `game/src/data/talent/Talents.ts` + `Talents.test.ts` (catalog v4)
  - `game/src/data/skill/TalentPassives.ts` (mới — 12 hidden passive)
  - `game/src/data/buff/buffs.ts` (+5 buff E1 + named export TU_SINH_NGO_BUFF) + `buffs.test.ts`
  - `game/src/core/combat/CombatSystem.ts` + `CombatSystem.surviveLethal.test.ts` (v4 survive block)
  - `game/src/core/game/GameManager.ts` + `GameManager.talentv4.test.ts` (wiring)
  - `game/src/core/game/BattleLootSystem.{realmReward,talentHooks}.test.ts` (retired-id data update)
  - `game/src/core/battle/BattleSystem.ts` (+getPlayerBuffs public wrapper)
  - `game/src/stores/player.{cultivationSpeed,ngoDao}.test.ts`, `game/src/core/realm/BodyRefinementSystem.test.ts` (retired-id data update)
  - `game/docs/game-guide.md`, `game/docs/roadmap.md`

## Scope and Risk Map

`changed-risk-map.mjs` (git diff master..HEAD): domains `combat-and-tribulation`, `economy-and-progression`, `pinia-phaser-sync`, `time-and-offline`; `deepAuditCandidate: true` (critical state boundary time-and-offline + 4 domains).

**Escalation decision: không escalate.** Lý do bằng code inspection:
- Domain `time-and-offline` + `save-and-cloud` bị map DO file test stores/ (`player.cultivationSpeed/ngoDao.test.ts`) nằm trong `src/stores/` — nhưng diff chỉ đổi **data kỳ vọng test** (id retired), zero production change ở stores/save/offline. Không field save mới (M1 chủ ý không bump save version — mọi state talent combat là runtime trong trận, reset mỗi trận theo `PassiveSystem.resetStacks()`).
- Domain `pinia-phaser-sync`: không đụng Pinia store production, không Phaser scene.
- `economy-and-progression`: chỉ test data của BattleLootSystem/BodyRefinement — production loot path không đổi (multiplier retired về 1, đúng spec §4.4).
- `unmappedPaths` (3 file test mới): cùng task-owned, đã được review trực tiếp — chúng chính là evidence tests của report này.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-1 | SkillManager (talent passives) | Đổi `selectedTalentIds` liên tục qua save edit + `syncTalentCombatPassive` | Exactly-once/Boundedness: đúng 1 bộ passive mỗi lúc (can_than = 2), không nhân đôi không leak | Repeat | `skillManager.getAll()` filter talent_passive_* | Unit | Cao (progression lock/duplication nếu sai) |
| INV-2 | battle.playerBuffs + PassiveSystem buffApplier | 10 crit events trong trận thật → passiveConvertsTo → E1 convert | Cross-system/Synchronization: buff bùng nổ nằm trong pool ĐÚNG player của trận; ngoài trận no-op không crash | Cross-system chain | `battle.playerBuffs.getFromSource('kiem_vuc','player')` stacks=1 | Integration | Cao |
| INV-3 | Trận 1 → trận 2 | startBattleWithPlayer lần 2 sau khi đã kích Kiếm Vực | Idempotency/Recoverability: pool mới sạch, stack modifier reset 0 | Repeat/Reorder | pool trận 2 không có kiem_vuc; modifier.stacks=0 | Integration | Cao |
| INV-4 | SkillManager ↔ SaveSystem | Grant passive runtime, soi payload save | Conservation: talent passive là runtime-only, không chiếm loadout slot, không lọt persistence ngoài kỹ | Interruption (reload) | passive count=1, không loadoutSlot | Unit/Integration | Trung bình |
| INV-5 | battle.playerBuffs vs buffSystem ngoài trận (GameManager) | Bất Tử Thể cleanse chạy khi player mang Kiếp Thương persistent | Conservation/Synchronization: cleanse chỉ tẩy pool TRẬN; debuff persistent ngoài trận (Kiếp Thương/pill) không bị xóa nhầm | Cross-system chain | Code inspection: `applyPersistentBuff` áp `this.buffSystem` (pool riêng), session effects chỉ cầm `battle.playerBuffs` | Static + runtime | Cao — đã bounded bằng code: 2 pool tách bậc, không giao thoa |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx.cmd vitest run` (full suite, worktree) | **345 files / 2338 tests PASS** | Toàn bộ suite sau M1 |
| `npm.cmd run type-check` | PASS (sau fix 1 type hẹp trong test file) | vue-tsc build sạch |
| `npm.cmd run build` | `✓ built in 25.70s`, dist/index.html tồn tại | Production build |
| `npx.cmd vitest run src/core/game/GameManager.talentv4.qa.test.ts` | 4/4 PASS (INV-1,2,3,4) | QA evidence test mới |
| Code inspection INV-5 (GameManager.ts:2571-2600) | `applyPersistentBuff` áp pool ngoài trận riêng — không giao thoa pool trận | Bounded tĩnh, không cần repro test |

## Findings

Không có finding `Confirmed`/`Suspected` nào. Không có reproduction test fail.

## New or Changed QA Tests

- `game/src/core/game/GameManager.talentv4.qa.test.ts` — 4 invariant test (đổi passive đúng 1 lần, buff vào pool đúng trận + E1 bùng thật qua 10 crit, trận mới sạch + reset, runtime-only không persistence). Mỗi test chứng minh đúng invariant nó tên trong ledger.

## Gaps and Residual Risk

- **Coverage gap (nhẹ, chủ ý)**: decay 3s của Thứ Phạt (Hận Thứ) và reset Tật Phong khi bị trúng đòn được khai báo trong mô tả talent + data nhưng chưa có consumer runtime (BattleSystem chưa lắng nghe reset/decay — passive tích nhưng chưa decay). M1 chấp nhận: đây là data-first theo plan Task 3 (nhịp đầy đủ sẽ được verify ở playtest M1/M2). Ghi nhận để M2 hoặc playtest kế tiếp xử lý — không phải defect vì không có kịch bản fail có thể chứng minh (behavior chưa được spec runtime).
- **Không có e2e spec mới**: character-creation → roll v4 → chọn talent combat → vào trận có passive. E2E suite hiện có 9/9 pass (chạy trong full suite ở master; worktree không có playwright browser đã cài). Đánh dấu là gap nhỏ — unit + integration wiring test đã phủ đường grant/revoke/battle.

## Pre-existing Failures

Không có — full suite xanh cả ở master lẫn worktree.
