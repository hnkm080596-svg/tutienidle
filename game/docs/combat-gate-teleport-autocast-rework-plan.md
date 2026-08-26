# Kế hoạch rework Combat 10×16 — Cổng chắn, Teleport AI và Skill Auto-cast

> Trạng thái: yêu cầu sản phẩm đã chốt, chưa triển khai.
>
> Phạm vi: combat Stage trên grid 10×16 và renderer 2.5D hiện tại.
>
> Development build: không yêu cầu tương thích save cũ hoặc viết save migration.

## 1. Mục tiêu

Rework combat hiện tại từ mô hình “Player là cổng đứng yên, có basic attack
riêng và tầm đánh gần như toàn sân” thành mô hình:

- Player vẫn là cổng phòng thủ phủ toàn bộ 10 hàng.
- Avatar Player có vị trí chiến đấu thật tại một hàng cụ thể.
- Player giữ nguyên cột, teleport giữa các hàng để đưa mục tiêu vào tầm đánh.
- Tầm đánh là bán kính Chebyshev quanh avatar.
- Mọi đòn đánh chủ động của Player đều đến từ skill auto-cast được trang bị.
- Mỗi skill tự khai cơ chế timing phù hợp với ý định thiết kế.
- Người chơi chọn chiến lược AI trực tiếp trong Combat Scene; lựa chọn tự lưu.
- Player và quái đều đi qua spawn telegraph/materialize.
- Giữ nguyên renderer 2.5D hình thang và core grid 10×16.

## 2. Contract sản phẩm đã chốt

### 2.1. Hệ tọa độ

Code dùng chỉ số zero-based:

- Grid có row `0..9` và column `0..15`.
- Player bắt đầu tại `(row: 4, column: 1)`.
- Cổng phòng thủ nằm tại column `1` và phủ toàn bộ hàng.
- Quái thường spawn với row ngẫu nhiên `0..9`, column ngẫu nhiên `7..15`.
- Boss luôn spawn tại row `4`, column ngẫu nhiên `7..15`.
- Nhiều quái được phép spawn trùng hoàn toàn một ô.

### 2.2. Hai vai trò độc lập của Player

Player có hai biểu diễn gameplay dùng chung một HP pool:

1. **Cổng phòng thủ**
   - Phủ toàn bộ 10 hàng tại column `1`.
   - Quái tấn công cổng không xét row hiện tại của avatar.
   - Quái không được vượt qua cổng.
   - Damage vào cổng là damage vào Player.

2. **Avatar tấn công**
   - Có tọa độ thật; column luôn là `1`.
   - Row có thể thay đổi tức thời bằng teleport.
   - Targeting, cast và damage do Player gây ra dùng tọa độ avatar.
   - Sprite lớn gấp đôi kích thước hiện tại.

Không được hợp nhất hai khái niệm thành một quy tắc khoảng cách duy nhất:
enemy-to-gate và player-to-enemy có semantics khác nhau.

### 2.3. Khoảng cách tấn công của Player

Khoảng cách dùng Chebyshev:

```ts
distance = Math.max(
  Math.abs(target.row - player.row),
  Math.abs(targetColumn - playerColumn),
)
```

Mục tiêu chỉ nằm trong tầm khi:

```ts
distance <= player.stats.attackRange
```

Hệ quả:

- Range `1` đánh được cả tám ô kề, bao gồm đường chéo.
- Teleport về cùng row với mục tiêu chỉ loại bỏ chênh lệch hàng; mục tiêu vẫn
  phải đủ gần theo cột.
- AOE của skill không được dùng để mở rộng tầm thi triển.

### 2.4. Tầm đánh mặc định và Pháp Tu

- Base `attackRange` của Player đổi từ `9` thành `1`.
- Tâm pháp `Đại Ngũ Hành Chân Quyết` cộng cố định `+2 attackRange`.
- Pháp Tu trang bị tâm pháp này có range nền thực tế là `3`.
- Bonus không phụ thuộc tier tâm pháp.
- Các path khác chưa nhận bonus range riêng trong đợt này.

### 2.5. Teleport

- Player chỉ teleport theo row; column luôn giữ `1`.
- Teleport là tức thời về gameplay và renderer.
- Teleport có internal cooldown (ICD) đúng `1 giây`.
- Trong ICD, Player vẫn có thể cast/đánh mục tiêu đang trong tầm nhưng không
  được đổi row lần nữa.
- Teleport chỉ thực hiện nếu đổi sang row của mục tiêu sẽ giúp mục tiêu nằm
  trong attack range.
- Phải phát event vị trí trước/sau để gắn VFX sau này.
- Đợt này không tự thiết kế VFX teleport; renderer chỉ cung cấp hook/TODO.

### 2.6. Skill và cast

- Loại bỏ hoàn toàn khái niệm basic attack riêng.
- Tất cả damage chủ động của Player đến từ active skill auto-cast.
- Chỉ một skill được ở trạng thái niệm tại một thời điểm.
- Skill tức thời vẫn được scheduler xét theo timer của chính nó.
- Tầm thi triển thực tế luôn là `attackRange` của entity.
- Skill không có targeting range riêng.
- Shape/AOE chỉ được tính sau khi primary target hợp lệ đã được chọn.

### 2.7. AI target strategy

Bảng AI nằm trực tiếp ở góc trái battlefield trong Combat Scene.

| ID | Nhãn UI | Quy tắc chính |
|---|---|---|
| `nearest` | Gần nhất | Chebyshev distance nhỏ nhất |
| `boss_first` | Ưu tiên Boss | Boss trước, sau đó khoảng cách |
| `elite_first` | Ưu tiên Elite | Boss → Elite → thường, sau đó khoảng cách |
| `lowest_hp` | HP thấp nhất | Current HP thấp nhất |
| `highest_hp` | HP cao nhất | Current HP cao nhất |

Tie-break bắt buộc deterministic:

1. Quy tắc chính của strategy.
2. Chebyshev distance tại vị trí avatar hiện tại.
3. Row tăng dần.
4. Column tăng dần.
5. Entity ID theo thứ tự chuỗi.

Mặc định là `nearest`. Lựa chọn áp dụng ngay, tự lưu khi thay đổi và được khôi
phục khi load. Save không có field hoặc có giá trị sai dùng `nearest`.

## 3. Ngoài phạm vi

Không triển khai trong đợt này:

- Cho Player di chuyển theo column.
- Cho quái đổi row để đuổi avatar.
- Collision hoặc giới hạn số entity trên một ô.
- Offset sprite khi nhiều quái trùng ô.
- VFX teleport hoàn chỉnh.
- Bonus range cho Kiếm Tu hoặc path tương lai.
- Điều khiển skill thủ công.
- Thay đổi công thức damage, crit, armor, resistance, ward hoặc mana shield.
- Thay đổi projection 2.5D hay kích thước grid.
- Save migration cho save development cũ.

## 4. Thay đổi domain model

### 4.1. BattleGrid

File: `src/core/battle/BattleGrid.ts`.

Thêm helper thuần:

```ts
export function getChebyshevDistance(
  from: GridPosition,
  to: GridPosition,
): number
```

Thêm helper chuẩn hóa vị trí entity:

```ts
export function entityGridPosition(
  entity: Pick<CombatEntity, 'x' | 'row'>,
): GridPosition
```

Mọi logic Player targeting dùng cùng helper, tránh tự làm tròn column hoặc tự
tính khoảng cách khác nhau.

### 4.2. BattleLane

File: `src/core/battle/BattleLane.ts`.

```ts
export const HERO_COLUMN = 1
export const HERO_LANE_INDEX: LaneIndex = 4
```

Giữ khái niệm cổng phủ mọi hàng. Xóa comment mô tả Player ở column `0`.
Không dùng row avatar để quyết định enemy có thể đánh cổng hay không.

### 4.3. Battle state

File: `src/core/battle/Battle.ts`.

Thay `playerAttackTimer` bằng state scheduler/teleport:

```ts
export interface PlayerTeleportState {
  remainingSeconds: number
}

export interface PendingPlayerSpawn {
  position: GridPosition
  remainingSeconds: number
  totalSeconds: number
  presetId: PlayerSpawnVfxPresetId
}
```

Battle bổ sung:

```ts
playerTeleport: PlayerTeleportState
pendingPlayerSpawn?: PendingPlayerSpawn
```

Không để Player trong `pendingEnemySpawns`. Player spawn có contract riêng để
không giả danh enemy, không phát `enemy_spawned` và renderer phân biệt preset.

### 4.4. CombatEntity

File: `src/core/combat/CombatEntity.ts`.

Giữ đúng một cast channel:

- `castingSkillId`;
- `castTimeRemaining`;
- `castTimeTotal`.

Không thêm cast song song. Cadence Attack Speed theo từng slot là runtime:

```ts
skillCadenceRemainingBySlot: Record<number, number>
```

State này không persist.

## 5. Spawn pipeline

### 5.1. Enemy placement

File: `src/core/battle/EnemySpawnPlacement.ts`.

Resolver mới không nhận `playerColumn`, `occupiedCells` hoặc `reservedCells`:

```ts
export interface EnemySpawnPlacementInput {
  isBoss: boolean
  random: () => number
}
```

Thuật toán:

```ts
const row = isBoss ? 4 : randomIntInclusive(0, 9)
const column = randomIntInclusive(7, 15)
return { row, column }
```

Quái thường dùng RNG độc lập cho row và column; Boss chỉ roll column.
Resolver không trả `null` vì overlap hợp lệ và luôn có miền spawn.

### 5.2. Enemy telegraph

`BattleSystem.queueEnemySpawn()`:

- luôn schedule thành công khi entity hợp lệ;
- không quét occupied/reserved cells;
- lưu vị trí đã roll đúng một lần;
- giữ thời lượng normal `0.75s`, elite `1.0s`, boss `1.4s`.

`StageWaveSystem` không retry vì hết chỗ. Xóa comment/test “sân đầy thì hoãn”.

### 5.3. Player spawn

Khi `BattleSystem.start()`:

1. Đặt Player logic tại `(4,1)`.
2. Tạo `pendingPlayerSpawn`.
3. Chưa công bố Player là materialized.
4. Queue quái đầu tiên.
5. Emit `battle_start`.
6. Emit snapshot chứa hai telegraph.

Snapshot positions bổ sung:

```ts
playerSpawn?: {
  row: LaneIndex
  column: number
  progress: number
  presetId: PlayerSpawnVfxPresetId
}
playerMaterialized: boolean
```

Trong countdown:

- tick Player spawn và enemy spawn;
- không chạy movement/attack/cast;
- chỉ chuyển sang `fighting` khi countdown bằng 0, Player đã materialize và
  quái đầu tiên đã materialize.

Nếu animation dài hơn countdown, battle tiếp tục chờ spawn hoàn tất.

### 5.4. Targetability

Trước materialize:

- Player không được enemy target, không nhận damage và không cast.
- Enemy chưa materialize giữ nguyên hành vi không targetable.

Không dùng `alive = false` cho pending spawn vì “chưa xuất hiện” khác “đã chết”.

## 6. Khoảng cách và targeting

### 6.1. Tách hai semantics

Thêm hai hàm rõ nghĩa:

```ts
export function canPlayerReachTarget(
  player: CombatEntity,
  target: CombatEntity,
): boolean

export function canEnemyReachGate(
  enemy: CombatEntity,
  gateColumn: number,
): boolean
```

`canPlayerReachTarget` dùng Chebyshev và `player.stats.attackRange`.

`canEnemyReachGate`:

- không xét row;
- distance là `abs(enemy.x - gateColumn)`;
- so với `enemy.stats.attackRange`;
- yêu cầu entity đã materialize.

### 6.2. Primary target

File: `src/core/battle/ActionTargetingSystem.ts`.

Đối với Player:

- candidate là toàn bộ enemy sống/materialized;
- AI strategy sắp xếp candidate;
- cast chỉ hợp lệ nếu target trong range;
- nếu không có target trong range, teleport planner xét target sẽ vào range
  sau khi đổi row.

Đối với enemy:

- candidate duy nhất là Player/cổng;
- dùng `canEnemyReachGate()`;
- không dùng Chebyshev tới avatar row.

### 6.3. ActionTargeting

File: `src/core/battle/CombatAction.ts`.

```ts
export interface ActionTargeting {
  shape: ActionTargetingShape
  laneRadius?: number
  columnRadius?: number
  maxTargets?: number
  selection?: TargetSelectionMode
}
```

Xóa `rangeColumns`, `DEFAULT_SKILL_RANGE_COLUMNS` và fallback “range toàn grid”.
`targetingForSkill()` chỉ chuẩn hóa shape/AOE.

### 6.4. AOE

Thứ tự bắt buộc:

1. AI chọn primary.
2. Kiểm tra Player attack range.
3. Bắt đầu/hoàn tất cast.
4. Snapshot anchor cell.
5. Tính AOE.
6. Resolve affected targets.

Secondary target được phép nằm ngoài attack range của Player sau khi primary
target hợp lệ; đó là damage lan từ điểm va chạm, không phải cast trực tiếp.

## 7. Teleport AI

### 7.1. Strategy model

Tạo `src/core/battle/CombatAiStrategy.ts`:

```ts
export type CombatAiStrategy =
  | 'nearest'
  | 'boss_first'
  | 'elite_first'
  | 'lowest_hp'
  | 'highest_hp'

export const DEFAULT_COMBAT_AI_STRATEGY: CombatAiStrategy = 'nearest'
```

Module chứa comparator thuần và validator dùng chung cho core, UI và save.

### 7.2. Hai bước chọn target

1. `selectAttackableTarget()`:
   - chỉ enemy trong Chebyshev range hiện tại;
   - sắp theo strategy.

2. `selectTeleportTarget()`:
   - chỉ chạy khi không có attackable target;
   - giả lập Player ở row của từng enemy;
   - chỉ giữ enemy sẽ vào range sau teleport;
   - sắp theo cùng strategy.

Không teleport nếu Player đã có target hợp lệ ở row hiện tại.

### 7.3. Thực thi teleport

Trong `BattleSystem.update()`:

1. Giảm `playerTeleport.remainingSeconds`.
2. Trước skill scheduler, tìm target trong range.
3. Nếu không có target và ICD bằng 0:
   - chọn teleport target;
   - lưu `from`;
   - gán `player.row = target.row`;
   - giữ `player.x = 1`;
   - set ICD `1`;
   - emit positions ngay;
   - emit `player_teleported`.
4. Scheduler target lại từ vị trí mới.

```ts
export interface PlayerTeleportedEvent {
  type: 'player_teleported'
  sourceId: string
  from: GridPosition
  to: GridPosition
}
```

## 8. Skill execution policy

### 8.1. Data contract

File: `src/core/skill/Skill.ts`.

```ts
export type SkillExecutionPolicy =
  | {
      kind: 'attack_speed'
      attackSpeedMultiplier?: number
    }
  | {
      kind: 'cooldown'
    }
  | {
      kind: 'cast_time'
      castTime: number
    }
  | {
      kind: 'attack_speed_cast'
      castTime: number
      attackSpeedMultiplier?: number
    }
```

Active skill bắt buộc có `execution`. Xóa `isBasicAttack` và mọi special-case.

### 8.2. Ý nghĩa timing

#### `attack_speed`

```ts
interval =
  getAttackIntervalSeconds(entity.stats.attackSpeed * attackSpeedMultiplier)
```

- Không internal cooldown.
- Không chịu CDR.
- Không cast time.
- Mỗi slot có cadence timer riêng.
- Áp dụng ban đầu cho `tram` và `ngu_kiem_thuat`.

#### `cooldown`

- Resolve tức thời.
- Timer từ `skill.cooldown`.
- Chịu CDR.
- Không chịu Attack Speed/Cast Speed.

#### `cast_time`

- Chỉ một skill niệm tại một thời điểm.
- Resource và cooldown khóa khi bắt đầu.
- Cast time chịu Cast Speed.
- Cooldown chịu CDR.
- Completion target/range validate lại.

#### `attack_speed_cast`

- Chỉ một skill niệm tại một thời điểm.
- Cast time chịu Cast Speed.
- Cadence tái kích hoạt theo Attack Speed.
- Không chịu CDR.

### 8.3. Quy tắc migrate skill data hiện tại

Đây là baseline bảo toàn hành vi hiện có, không phải quy tắc suy luận runtime
theo path và không khóa thiết kế skill tương lai:

| Data hiện tại | Execution policy ban đầu |
|---|---|
| `isBasicAttack: true` | `attack_speed` |
| Active skill có `castTime > 0` | `cast_time` với cast time hiện có |
| Active skill còn lại | `cooldown` với cooldown hiện có |

Áp dụng bắt buộc:

- `tram` → `attack_speed`.
- `ngu_kiem_thuat` → `attack_speed`.

Các skill Pháp Tu đang có cast time tiếp tục dùng `cast_time`; cooldown và cast
time lấy từ data hiện tại để không tự thay balance. Các active skill còn lại
giữ cadence cooldown hiện tại qua policy `cooldown`.

`attack_speed_cast` chưa tự động gán cho skill nào. Chỉ author policy này khi
thiết kế cụ thể của skill nói rõ vừa có động tác niệm vừa có nhịp tái dùng phụ
thuộc Attack Speed. Không được suy luận chỉ từ việc skill thuộc Kiếm Tu hay
Pháp Tu.

Sau migration, runtime chỉ đọc `execution`; không tiếp tục fallback từ
`isBasicAttack`, `castTime` hay path. Vì vậy migration phải cập nhật toàn bộ
active skill trong `data/skill/Skills.ts` trước khi xóa compatibility code.

### 8.4. Scheduler thống nhất

Thay `updatePlayerAttack()` và `updateAutoCast()`:

```text
update skill timers
→ update current cast
→ acquire target in range
→ nếu không có, thử teleport
→ acquire lại target
→ duyệt loadout theo slot
→ chọn skill đầu tiên ready + đủ resource + target hợp lệ
→ bắt đầu cast hoặc resolve tức thời
```

Invariant:

- Không có skill chạy ngoài scheduler.
- Không có fallback physical attack.
- Mỗi fixed-step bắt đầu tối đa một skill.
- Chỉ một channeled cast tồn tại.
- Instant skill khác có thể bắt đầu ở fixed-step kế tiếp nếu ready.

### 8.5. Commit resource/timer

Chỉ commit sau khi đạt đủ:

- learned/unlocked/equipped;
- realm requirement;
- không `unreleased`;
- timer ready;
- đủ resource;
- primary target tồn tại và trong attack range.

Với cast-time, commit khi bắt đầu niệm. Nếu target chết/ra khỏi tầm trước
completion, cast fizzle và không hoàn resource/cooldown.

### 8.6. Loadout

Xóa:

- `getBasicAttackSkill()`;
- basic mutual exclusion;
- equip không slot dựa trên `isBasicAttack`.

Phàm Nhân:

- Trảm được học và gán vào slot mặc định.
- Không giữ “equipped nhưng không có slot” nếu scheduler đọc loadout.

Kiếm Tu:

- Kit vẫn gán slot `0/1/2`.
- Ngự Kiếm Thuật ở slot `0`, policy `attack_speed`.

Pháp Tu:

- Giữ nhiều skill trong loadout.
- Chỉ một skill niệm cùng lúc.
- Cooldown/cast time độc lập theo skill/slot.

## 9. Tâm pháp Pháp Tu

Files:

- `src/core/technique/Technique.ts`;
- `src/data/technique/Techniques.ts`;
- nơi tổng hợp technique modifiers trong `GameManager.ts`.

Thêm:

```ts
export interface Technique {
  combatModifiers?: StatModifier[]
}
```

`dai_ngu_hanh_chan_quyet`:

```ts
combatModifiers: [{
  id: 'technique:dai_ngu_hanh_chan_quyet:attack_range',
  sourceId: 'dai_ngu_hanh_chan_quyet',
  sourceType: 'technique',
  stat: 'attackRange',
  flat: 2,
}]
```

Modifier chỉ có hiệu lực khi equipped. Không đưa bonus vào `tierEffects`.

## 10. AI setting và save

### 10.1. Authority

AI strategy là lựa chọn gameplay lâu dài nên nằm trong `PlayerData`:

```ts
combatAiStrategy: CombatAiStrategy
```

UI không là nguồn sự thật.

### 10.2. Save/restore

Files:

- `src/services/save/SaveSystem.ts`;
- `src/services/save/SaveSystem.test.ts`.

Save snapshot ghi `combatAiStrategy`. Restore validate:

```ts
player.combatAiStrategy =
  isCombatAiStrategy(save.player.combatAiStrategy)
    ? save.player.combatAiStrategy
    : DEFAULT_COMBAT_AI_STRATEGY
```

Không viết migration; fallback đủ cho development save.

### 10.3. API thay đổi

```ts
setCombatAiStrategy(
  player: PlayerData,
  strategy: CombatAiStrategy,
): boolean
```

UI gọi API có validate và kích hoạt save scheduling hiện có ngay khi đổi.

## 11. Combat UI

### 11.1. Component AI

Tạo `src/components/game/combat/CombatAiPanel.vue`:

- nằm góc trái vùng battlefield;
- dưới top/status bar, không che CombatTopBar;
- chỉ panel nhận pointer events;
- không chặn toàn battlefield;
- hiển thị strategy đang chọn;
- đổi option áp dụng và tự lưu ngay.

Không đặt trong Home/LeftPanel.

### 11.2. Overlay

Gắn vào `CombatSceneOverlay.vue` như lớp overlay riêng. Panel không thay đổi
combat insets và không làm co battlefield.

### 11.3. HUD skill

Files:

- `MortalCombatHud.vue`;
- `KiemTuCombatHud.vue`;
- `PhapTuCombatHud.vue`;
- `CombatSkillSlot.vue`;
- `useBasicAttackCadence.ts`;
- `CombatSkillPresentation.ts`.

Thay đổi:

- Xóa `useBasicAttackCadence`.
- Mortal HUD đọc Trảm từ scheduler.
- Kiếm Tu HUD đọc Ngự Kiếm từ scheduler.
- Presentation dùng state thống nhất:
  - `ready`;
  - `cadence`;
  - `cooldown`;
  - `casting`;
  - `blocked_resource`;
  - `out_of_range`.
- Không hard-code “basic” theo path.

## 12. Renderer 2.5D

### 12.1. Player scale

File: `src/game/scenes/CombatScene.ts`.

```ts
const PLAYER_DISPLAY_SCALE_MULTIPLIER = 2
```

Kích thước:

```text
source aspect ratio
× base character size
× 2
× perspective depth scale
```

Không nhân đôi enemy/VFX footprint.

### 12.2. Player spawn

- `playerMaterialized === false`: không hiện Player sprite.
- `playerSpawn`: vẽ telegraph tại projected cell `(4,1)`.
- Materialize: kết thúc telegraph rồi hiện sprite.
- Resize dựng lại đúng projected position.
- Scene restart clear Player spawn VFX cũ.

### 12.3. Teleport

Khi nhận `player_teleported`:

- hủy interpolation Player;
- snap sprite tới projected position mới;
- cập nhật depth/scale/label/cast bar/status icon ngay;
- gọi hook placeholder VFX;
- không tween qua hàng trung gian.

### 12.4. Overlap

Cho phép nhiều enemy sprite có cùng screen coordinate. Không tự thêm offset,
không đổi gameplay cell và không đẩy sprite sang ô khác. Mọi VFX/dedupe khóa
theo entity/action ID, không khóa theo cell.

## 13. Enemy movement và attack

Enemy giữ row spawn trong suốt trận.

Movement:

- tiến về gate column `1`;
- dừng khi `canEnemyReachGate()` đúng;
- ranged giữ khoảng cách theo logic hiện có nhưng đo tới gate;
- không đi qua column `1`.

```ts
enemy.x = Math.max(HERO_COLUMN, nextX)
```

Enemy attack khi:

- Player và enemy đã materialize;
- cả hai còn sống;
- enemy đủ tầm tới gate theo column;
- enemy không Stun/Frozen;
- attack/cast timer ready.

Row avatar không làm enemy mất target cổng.

## 14. Trình tự fixed-step mới

```text
1. Tick Player/enemy spawn
2. Nếu countdown: emit snapshot và return
3. Boss phases/enrage
4. Recompute modifiers
5. Ailment/DoT/Lava/Regen
6. Tick skill cooldown/cadence/cast timers
7. Tick teleport ICD
8. Enemy movement tới gate
9. Emit positions sau movement
10. Resolve cast đang niệm
11. Acquire target theo AI
12. Nếu cần, teleport và acquire lại
13. Start tối đa một Player skill
14. Enemy attacks
15. Resolve pending action impacts
16. Status VFX diff
17. Check defeat
18. Emit final positions
19. Grant loot
20. Stage wave/summon/victory
```

Thứ tự bảo đảm:

- Player vừa teleport có thể bắt đầu skill cùng fixed-step.
- Teleport position/event phát trước attack/cast.
- Enemy vừa materialize có thể được target trong tick đó.
- Entity pending spawn không tham gia combat.

## 15. Code cũ phải loại bỏ

- `Skill.isBasicAttack`.
- `Battle.playerAttackTimer`.
- `BattleSystem.updatePlayerAttack()`.
- `SkillManager.getBasicAttackSkill()`.
- Basic mutual exclusion trong SkillSystem.
- `useBasicAttackCadence`.
- `rangeColumns` trong `ActionTargeting`.
- `DEFAULT_SKILL_RANGE_COLUMNS`.
- Spawn occupancy/reservation gate.
- Giả định Player ở column `0`.
- Player offense dùng gate phủ mọi row.

Sau triển khai dùng `rg` kiểm tra không còn reference/comment stale.

## 16. Kế hoạch test

### 16.1. Grid và range

- Chebyshev cùng ô = 0.
- Ngang, dọc, chéo một ô đều = 1.
- Chéo hai ô = 2.
- World `x` được làm tròn nhất quán.
- Base Player range = 1.
- Pháp Tu range = 3.
- Không cast primary ngoài range.
- AOE secondary được lan ngoài range sau primary hợp lệ.

### 16.2. Gate

- Player bắt đầu `(4,1)`.
- Enemy row 0 và row 9 đều đánh gate khi đủ khoảng cách cột.
- Avatar teleport không đổi enemy-to-gate range.
- Enemy không vượt column 1.
- Enemy ngoài range không tiêu attack timer.

### 16.3. Spawn

- Normal roll row `0..9`, column `7..15`.
- Boss luôn row 4.
- Hai enemy có thể cùng vị trí.
- Queue không fail do overlap.
- Player/enemy chưa materialize không targetable.
- Countdown chờ cả hai phía.
- Renderer không hiện Player sớm.

### 16.4. Teleport

- Không teleport khi có target trong range.
- Teleport về row target khi giúp target vào range.
- Không teleport nếu target vẫn quá xa theo column.
- Column Player luôn 1.
- ICD đúng 1 giây.
- Không teleport lần hai trong ICD.
- Vẫn cast được trong ICD.
- Strategy được tôn trọng.
- Event có đúng from/to và phát trước attack/cast.

### 16.5. AI

- Kiểm tra đủ năm strategy.
- Tie-break deterministic theo distance/row/column/id.
- Missing/invalid save dùng `nearest`.
- UI đổi strategy cập nhật runtime và save.

### 16.6. Skill timing

- Trảm không có internal cooldown.
- Trảm cadence theo Attack Speed.
- CDR không ảnh hưởng Trảm.
- Cooldown skill chịu CDR.
- Cast time chịu Cast Speed.
- Chỉ một skill niệm tại một thời điểm.
- Skill thứ hai không niệm khi channel bận.
- Resource/cooldown commit khi bắt đầu niệm.
- Target ra khỏi range làm cast fizzle.
- Không fallback attack khi mọi skill unavailable.
- Mỗi fixed-step bắt đầu tối đa một skill.

### 16.7. Technique/save/UI/renderer

- Đại Ngũ Hành equipped cộng đúng +2 range, unequipped không cộng.
- Bonus không scale theo tier và không double-apply.
- Save/load AI strategy đúng.
- AI panel chỉ hiện trong Combat Scene, không đổi insets.
- Player x2 đúng ở cùng depth; enemy không đổi.
- Player spawn đúng projected cell.
- Teleport snap tức thời, không smoothing.
- Label/cast bar/status icon theo row mới ngay.
- Nhiều enemy cùng ô không crash.

## 17. Thứ tự triển khai

### Phase 1 — Contract và pure functions

1. Chebyshev helper.
2. Gate/player constants.
3. AI strategy type/comparator.
4. Skill execution policy.
5. Unit test pure functions.

### Phase 2 — Spawn

1. Enemy overlap placement.
2. Pending Player spawn.
3. Battle event/snapshot schema.
4. Countdown/materialization gates.
5. Spawn tests.

### Phase 3 — Range và teleport

1. Tách Player offensive range/enemy gate range.
2. Target selector mới.
3. Teleport planner/ICD/event.
4. Movement clamp tại gate.
5. Range/teleport/gate tests.

### Phase 4 — Unified skill scheduler

1. Migrate skill data sang execution policy.
2. Xóa basic pipeline.
3. Timer theo slot/skill.
4. Single cast channel.
5. Range revalidation.
6. Skill timing tests.

### Phase 5 — Technique và persistence

1. Base range 1.
2. Pháp Tu +2.
3. PlayerData AI setting.
4. Save/restore fallback.
5. Tests.

### Phase 6 — UI và renderer

1. Combat AI panel.
2. HUD không còn basic cadence.
3. Player x2.
4. Player spawn.
5. Teleport snap + VFX hook.
6. Renderer/UI tests.

### Phase 7 — Cleanup và verification

1. Xóa file/composable cũ.
2. Xóa comment/test stale.
3. Chạy toàn bộ Vitest.
4. Chạy `npm.cmd run type-check`.
5. Chạy `npm.cmd run build`.
6. Chạy combat Playwright E2E.
7. Visual QA các viewport được hỗ trợ.

## 18. Tiêu chí nghiệm thu

- Player spawn tại `(4,1)` thay vì xuất hiện sẵn.
- Player sprite x2 nhưng projection 2.5D đúng.
- Quái spawn cột `7..15`, Boss row `4`, overlap hợp lệ.
- Cổng phủ mọi row và chặn enemy tại column `1`.
- Player offense dùng Chebyshev từ avatar.
- Base range 1; Pháp Tu range 3.
- Teleport row tức thời, ICD 1 giây.
- AI strategy chọn ở góc trái Combat Scene và tự lưu.
- Skill không có targeting range riêng.
- Không cast/gây damage trực tiếp vào primary ngoài entity range.
- AOE chỉ lan từ primary hợp lệ.
- Không còn basic attack pipeline.
- Trảm/Ngự Kiếm dùng Attack Speed; skill khác theo authored policy.
- Chỉ một skill niệm tại một thời điểm.
- Player/quái pending spawn hoàn toàn không targetable.
- Damage/reward pipeline ngoài phạm vi không thay đổi.
- Tất cả test, type-check, build và E2E pass.

## 19. Rủi ro cần kiểm soát

1. **Trộn hai semantics của Player**
   - Giữ helper enemy-to-gate và player-to-enemy riêng.

2. **AOE vô tình thành cast range**
   - Range gate xảy ra trước `areaFor()/collectAffected()`.

3. **Timer double-apply**
   - Attack Speed cadence và CDR cooldown là hai clock độc lập.

4. **Cast mất target**
   - Completion validate lại nhưng không hoàn resource.

5. **Teleport bị smoothing**
   - Renderer xóa interpolation trước khi snap.

6. **Save/UI có hai nguồn sự thật**
   - PlayerData là authority; UI chỉ gọi API.

7. **Player spawn render hai lần**
   - Pending telegraph và materialized sprite loại trừ nhau.

8. **Overlap làm VFX dedupe nhầm**
   - Dedupe theo entity/action ID, không theo cell.

9. **Pháp Tu bonus range cộng hai lần**
   - Technique modifier chỉ qua một aggregation path.

10. **Comment/test cũ giữ giả định tower đứng yên/basic**
    - Tìm kiếm toàn repository là bước bắt buộc trước nghiệm thu.
