# Combat Build — ResolvedCombatBuild (P2)

> **Trạng thái:** Live. Canonical build composition — một resolver duy
> nhất dựng player-side combat build mỗi lần vào battle.

## Vị trí trong chuỗi authority

`resolveCombatBuild` (`core/game/CombatBuild.ts`) là **composition site
duy nhất** cho phía người chơi của battle entry. Nó *compose* — không
sở hữu rule của từng channel:

| Thành phần build | Owner (rule vẫn nằm ở đây) |
|---|---|
| `stats` + `modifierChannels` | `Player.resolvePlayerStatAssembly` + `GameManagerPersistentEffectOps.getBattleBaseChannels` |
| `kit` (basic/special/ult/emblem/domains/dynamic basic) | `CultivationPathRuntime` (ops resolve qua seam override-aware) |
| `formation` | `resolvePartyFormation` (FormationPlacement) |
| `companions` | `COMPANIONS` + `CompanionCombat` + `CompanionProgression` |
| `entryBuffs` | declarations do build phát; apply qua `TurnBattleSystem.applyBuildBuffs` |
| `survive` | talent ids + `runtime.buildSurviveSources` (bind) |
| `liveModifiers` | provider bind sẵn — partition live, refresh mỗi tick |

Guard: `tests/architecture/buildCompositionBoundary.test.ts` cấm
`GameManagerTurnBattleOps` import/gọi lại các seam composition
(`resolvePartyFormation`, `COMPANIONS`, `playerToCombatEntity`, ...).

## Hợp đồng chính

- **Pure/deterministic:** không `Math.random`, `Date.now`, Phaser, store
  read. Node registry snapshot tại resolve; input session-scoped (rng,
  buff registry, participant ref) đi qua bound factories trên build.
- **maxThe một lần ghi:** minted = `specialUltimate?.maxThe ??
  resolveMaxThe(source)`; raw override = `specialUltimate?.maxThe ??
  override.maxThe` (không gọi `resolveMaxThe` trên raw path).
- **Entry buff order:** formation × allies → aura × living allies →
  kit clones (player rồi companions). `gracefulSkip` chỉ cho formation
  id (save-derived); kit-clone/aura id hỏng vẫn throw.
- **Companion:** thiếu definition hoặc thiếu formation slot → skip;
  entity mint mới + toạ độ formation; `priority = index + 100`.

## Seam giữ lại (không phải build state)

- **Raw-entity path** (`startBattle(playerEntity)`, devtools/test):
  entity override giữ stats/skillLevels/maxThe riêng; kit/formation/
  companion vẫn resolve từ `getActivePlayer()` khi có.
- **Revive re-grant:** `grantsElementalReactionAura` đánh giá lại lúc
  revive — runtime-owned, không đọc snapshot build.
- **Passive carry / loot receiver / `playerDataForTurnBattle`:**
  seam ops giữ nguyên, gate `request.player`.
- **Ambient/menu stats:** `resolveAmbientPlayerStats`, store
  `finalStats` — cùng assembly nhưng không qua build.
- **Enemy/wave assembly:** nằm ngoài phạm vi build (chỉ player-side).

## Live vs static partition (ARCH-002)

Static channels fold vào `entity.stats` một lần lúc mint. Live partition
(`live_battle`: persistent buffs + scaled passives + timed/socket) không
bao giờ vào `modifierChannels` — đi qua `build.liveModifiers(entity)`,
gate literal `entity.id === 'player'` + đọc `getActivePlayer()` live mỗi
refresh.

Channel map đầy đủ:
[docs/architecture/2026-09-21-build-composition-inventory.md](../architecture/2026-09-21-build-composition-inventory.md)
