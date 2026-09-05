# battle/legacy — real-time combat engine (RETIRED 2026-09-04)

Engine real-time auto-battler đã THAY HOÀN TOÀN bởi `../turn/` (TurnBattleSystem,
ATB turn-based) từ Slice 6 cutover. Toàn bộ folder được GIỮ NGUYÊN để:
- git history/reference (Survey cũ, số liệu đối chiếu content — vd
  BatKiemThuat.ts dẫn `BattleSystem.batKiem.test.ts` trong git history).
- PhapTuNodes.dao.test.ts vẫn import `PHAP_TU_ULTIMATE_IDS` re-export từ
  `legacy/UltimateSystem.ts` (data gốc chuyển sang `../../../data/skill/PhapTuUltimates.ts`,
  re-export compat giữ tại đây).

## Không có gì trong folder này được import vào production code
TRỪ 2 consumer thời gian chuyển tiếp:
- `core/game/GameManager.ts` — vẫn giữ 1 instance legacy/BattleSystem làm
  shim: `start()` vẫn tạo Battle object thật (nhưng KHÔNG còn gì drive nó —
  updateBattleFixedStep chỉ chạy TurnBattleSystem), `getBattle()` shim đọc
  TurnBattle, `getPlayerBuffs()`/`setArtifactRuntime()`/`setChainDefinition()`
  vẫn lưu state nội bộ vô hại (turn engine không đọc).
- `core/game/StageWaveSystem.ts` — deps typing `BattleSystem` (chỉ type import).

## Việc dọn dẹp tiếp theo (khi Slice legacy retirement thật sự cần)
- Gỡ 2 consumer trên, xoá folder, xoá `Battle.ts`'s lavaZones/swordZones
  fields + `LavaZone.ts`/`SwordZone.ts` (runtime-only shape của engine chết),
  retire `BattleSystem.test.ts`/`UltimateSystem*.test.ts`/
  `Playtest.continuousCombat.test.ts` (pin real-time behavior).
- KHÔNG xoá: `BuffSystem`/`BuffPool`/`BuffRegistry` (buff/ core/) — chúng
  SỐNG cho CombatSystem/SkillEffectSystem/ReactionManager/ArtifactSystem.
