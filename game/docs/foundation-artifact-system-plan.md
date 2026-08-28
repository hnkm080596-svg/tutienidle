# Kế hoạch hệ thống Bản Mệnh Pháp Bảo — theo hiện trạng dự án

## 1. Trạng thái và phạm vi

- Phiên bản: `v2.0-rework`.
- Mốc đối chiếu code: `2026-08-27`.
- Phạm vi hiện tại: Trúc Cơ tầng 1–18.
- Tên kỹ thuật: `artifact`; tên hiển thị luôn là **Bản Mệnh Pháp Bảo**.
- Pháp bảo đầu tiên: **Ngũ Hành Châu** của Pháp Tu.
- Pháp bảo Kiếm Tu và Thể Tu thiết kế sau. Hạ tầng mở rộng theo `CultivationPathId`, không tạo nội dung placeholder.

Tài liệu này thay thế toàn bộ draft cũ về ba pháp bảo có thể chọn, chế tạo và trang bị. Mỗi nhân vật chỉ có đúng một bản mệnh pháp bảo đã được thiết kế sẵn theo con đường tu luyện.

## 2. Hiện trạng dự án ảnh hưởng thiết kế

### 2.1. Progression

- `PlayerData.cultivationPath` hiện là `'phap_tu' | 'kiem_tu'`; nghề được chọn vĩnh viễn khi từ Phàm Nhân vào Luyện Khí.
- Nội dung đang cân bằng tới `foundation_establishment`, 18 tầng. Kim Đan trở lên chỉ là dữ liệu giữ chỗ.
- Trần sức mạnh đọc từ `player.realmId` + `player.realmLevel`; so sánh thứ tự bằng realm index, không so string.
- Tâm Pháp/Kỹ Năng đã có cảm ngộ riêng từ combat. Pháp bảo cần progression riêng, không mượn level của hai hệ đó.
- Dự án là development build; không cần migration cho draft artifact chưa từng phát hành.

### 2.2. Combat, loot và UI

- Combat đã dùng `BattleSystem` + `CombatActionDefinition` theo pipeline `windup → impact → resolve`. `MissileSystem` cũ đã bị thay thế; “subgun” chỉ là vai trò gameplay.
- Buff/ward đi qua battle buff; slow/root/stun/freeze đi qua `AilmentSystem`.
- `BattleLootSystem.processDefeatedEnemies()` là authority cấp reward ngay khi từng quái chết. `Enemy` đã có `realmId`, `isElite`, `isBoss`.
- Material rơi thẳng vào `MaterialBag`, notification và `BattleRewardSummary`.
- Trang lớn như Kỹ Năng/Tâm Pháp dùng `StandalonePanel`; combat HUD đã tách theo nghề.
- Equipment đã có quality tên “Pháp Bảo”, vì vậy không gọi tắt panel mới là “Pháp Bảo” ở nơi dễ gây nhầm.

## 3. Trụ cột thiết kế

1. **Một nhân vật, một bản mệnh:** quyết định bởi nghề; không roll, nhặt, craft, equip hay đổi sang pháp bảo nghề khác.
2. **Subgun tự vận hành:** timer/action riêng; không chiếm skill slot, không ngắt basic attack, cast hoặc teleport AI.
3. **Ba hướng chuyên môn:** chọn một trong `Công`, `Thủ`, `Khống`. Cả ba còn action subgun nền nhưng phân bổ ngân sách khác nhau.
4. **Lớn lên bằng chiến đấu:** có EXP riêng, nhận khi quái bị hạ trong combat thật.
5. **Không vượt chủ nhân:** cảnh giới/tầng pháp bảo luôn ≤ nhân vật.
6. **Nâng phẩm bằng loot:** quái Trúc Cơ trở lên có tỷ lệ rơi Đoán Bảo Thạch.
7. **Data-driven theo nghề:** luật chung nằm trong artifact core; cơ chế Ngũ Hành Châu nằm trong definition riêng.

## 4. Sở hữu và thức tỉnh

Khi đột phá thành công từ Luyện Khí sang Trúc Cơ:

- Đọc `player.cultivationPath` và tạo đúng artifact tương ứng nếu có definition.
- Pháp Tu nhận **Ngũ Hành Châu**, Trúc Cơ tầng 1, EXP 0, **Phàm phẩm**.
- Mở panel Bản Mệnh Pháp Bảo và nhắc chọn Công/Thủ/Khống.
- Trước khi chọn hướng, pháp bảo vẫn dùng action nền nhưng không có milestone hướng.

Kiếm Tu chưa có thiết kế trong phase này:

- Không nhận Ngũ Hành Châu, không tạo artifact giả.
- UI hiển thị “Bản mệnh pháp bảo của Kiếm Tu đang chờ thiết kế”, không crash hoặc để panel trống.

Pháp bảo không có slot trong `EquipmentPaperdoll`, không nằm trong bag, không thể tháo, bán, phân giải, rơi mất hoặc sở hữu bản trùng. Nó không dùng quality/rarity/affix/forge của `EquipmentSystem`.

## 5. Hai trục trưởng thành

| Trục | Nguồn tăng | Vai trò |
|---|---|---|
| Cảnh giới + tầng | EXP chiến đấu | Tăng chỉ số nền, mở milestone |
| Phẩm | Đoán Bảo Thạch | Nhân tiềm năng của hướng active |

Không dùng Linh Thạch, Linh Bảo Tàn Phiến, Tinh Luyện Cốt hoặc tài nguyên equipment trong MVP.

### 5.1. Cảnh giới/tầng và trần chủ nhân

UI hiển thị `Ngũ Hành Châu — Trúc Cơ tầng 7`, không hiển thị global level kiểu 37.

- Thức tỉnh ở Trúc Cơ tầng 1.
- Đủ EXP thì tự tăng tầng, không tốn material.
- Không thể tăng nếu tầng kế cao hơn người chơi.
- Ở trần chủ nhân, EXP được đầy tới đúng requirement kế tiếp rồi dừng; không bank nhiều tầng.
- Khi người chơi tăng tầng, artifact có thanh đầy lập tức tăng đúng một tầng rồi EXP về 0.
- Scope hiện tại dừng ở Trúc Cơ tầng 18; chưa thiết kế đột phá artifact lên Kim Đan.
- Chỉ nhận EXP sau khi thức tỉnh, không hồi tố combat Luyện Khí.

### 5.2. Nguồn EXP

EXP cấp khi reward của một quái chết được xử lý thành công:

- Không yêu cầu pháp bảo kết liễu hoặc đã gây damage; nhánh Thủ không bị thiệt.
- Không nhận từ idle/offline cultivation, production, pill hoặc thao tác UI.
- Dùng chung `BattleEnemy.rewardGranted` để chống cấp lặp.
- Độ Kiếp chỉ cấp nếu reward thật đi qua `BattleLootSystem`; không tạo đường thưởng thứ hai.

Thêm hàm balance thuần:

```ts
getArtifactExperienceReward(enemy: Enemy): number
```

MVP suy ra từ `enemy.rewards.techniqueInsight`, không thêm field thủ công cho toàn bộ enemy data:

```text
base = max(1, floor(techniqueInsight × 0,25))
normal = base
elite = base × 2
boss = base × 5

required(level) = round(20 × level^1,35)
```

> Balance 2026-08-28: hệ số EXP giảm từ `0,5` xuống `0,25` để kéo dài thời
> gian luyện pháp bảo. Với pool quái Trúc Cơ hiện tái dùng encounter Luyện
> Khí (techniqueInsight cao), hệ số `0,5` khiến artifact gần như luôn dính
> trần nhân vật; `0,25` nhân đôi số kill cần để max, buộc người chơi phải
> chủ động farm mới theo kịp trần.

Đây là số để simulation. Mục tiêu: người chơi chủ động farm combat giữ artifact cách trần nhân vật không quá 2–3 tầng, nhưng không mặc định luôn ngang trần.

### 5.3. Phẩm pháp bảo

Dùng type riêng, không tái sử dụng `EquipmentQuality`:

```ts
type ArtifactGrade = 'pham' | 'linh' | 'dia' | 'thien' | 'tien'
```

| Phẩm | Hệ số hiệu quả tổng | Đá để lên phẩm kế |
|---|---:|---:|
| Phàm phẩm | ×1,00 | 10 |
| Linh phẩm | ×1,12 | 25 |
| Địa phẩm | ×1,26 | 60 |
| Thiên phẩm | ×1,42 | 150 |
| Tiên phẩm | ×1,60 | — |

Trong content Trúc Cơ, Linh phẩm là mốc tự nhiên; Địa phẩm là mục tiêu farm cuối cảnh giới. Thiên/Tiên chỉ giữ trong schema cho tương lai.

Nâng phẩm chỉ làm ngoài combat, transaction kiểm tra-trừ-cập nhật, không thất bại, không giảm phẩm và không phá hủy pháp bảo. Hệ số phẩm nhân damage/buff/control magnitude; duration hard CC dùng cap riêng, không nhân thẳng ×1,60.

## 6. Đoán Bảo Thạch

- Tên: **Đoán Bảo Thạch**.
- ID: `doan_bao_thach`.
- `MaterialCategory`: `other` trong MVP.
- Nguồn hiển thị: “Quái Trúc Cơ trở lên”.

Chỉ roll khi:

```text
getRealmIndex(enemy.realmId) >= getRealmIndex('foundation_establishment')
```

| Loại quái | Tỷ lệ khởi điểm | Số lượng |
|---|---:|---:|
| Thường | 2% | 1 |
| Tinh Anh | 8% | 1 |
| Boss | 25% | 1–2 |

Mỗi quái chỉ dùng dòng cao nhất; Boss không roll thêm bảng Elite/Thường. Tỷ lệ nằm trong `ArtifactDropBalance.ts` và được gọi tập trung từ `BattleLootSystem`, không rải vào enemy definitions.

Khi rơi phải cộng `MaterialBag`, `BattleRewardSummary`, reward particle và loot notification theo luồng material hiện hữu. RNG cần injectable cho test. Dùng `enemy.realmId` làm authority, không dùng stage realm vì enemy có thể xuất hiện ngoài Stage.

## 7. Ba hướng Công / Thủ / Khống

### 7.1. Luật chọn

```ts
type ArtifactPath = 'attack' | 'defense' | 'control'
```

- Chỉ một hướng active.
- Chọn lần đầu miễn phí; trong development build được đổi miễn phí ngoài combat để test.
- Không đổi trong countdown, combat hoặc tribulation.
- Đổi hướng giữ EXP, cảnh giới/tầng và phẩm; chỉ áp dụng từ trận kế.
- Không cộng bonus từ hướng inactive.
- Sau balance mới quyết định phí respec; MVP không dùng Đoán Bảo Thạch cho việc này để đá có một chức năng rõ ràng.

| Hướng | Damage | Phòng thủ/buff | Khống chế |
|---|---:|---:|---:|
| Công | 75% | 10% | 15% |
| Thủ | 30% | 60% | 10% |
| Khống | 35% | 10% | 55% |

Đây là ngân sách thiết kế tương đối, không phải modifier đưa thẳng vào code.

### 7.2. Mốc trưởng thành chung

| Tầng artifact | Mở khóa |
|---:|---|
| 1 | Subgun nền |
| 3 | Nhận diện hướng |
| 6 | Cơ chế chính |
| 12 | Nâng cấp cơ chế chính |
| 18 | Chân hình |

MVP dùng milestone table, không dựng node tree thứ hai.

## 8. Ngũ Hành Châu — Pháp Tu

### 8.1. Identity và action nền

Năm linh châu xoay quanh Pháp Tu, tự tích tụ rồi phóng vào mục tiêu:

- Chỉ dùng Ngũ Hành đã unlock và equip trong combat snapshot.
- Nhiều hành thì xoay ổn định `Mộc → Hỏa → Thổ → Kim → Thủy` trong tập đang equip.
- Không có hành hợp lệ thì dùng damage/VFX trung tính; không tự mở hành hoặc tạo phản ứng.
- Mỗi phát dùng Power, resistance và penetration của đúng hành.
- Không tự chọn hành mạnh nhất mỗi tick, tránh buff làm đổi đạn khó hiểu.
- Có source metadata artifact riêng; không giả làm basic attack/skill.

| Thuộc tính | Khởi điểm simulation |
|---|---:|
| Chu kỳ | 3,0 giây |
| Windup | 0,25 giây |
| Target | Theo Combat AI strategy, fallback gần nhất hợp lệ |
| Tầm | `player.stats.attackRange` snapshot |
| Damage | 45% Power của hành mỗi phát |
| Crit/dodge | Pipeline combat hiện hữu |

Artifact không kích hoạt lại chính nó. On-hit/reaction nào được phép phải khai rõ trong definition.

### 8.2. Công — Ngũ Hành Liên Châu

- Tầng 1: action nền.
- Tầng 3, `Tụ Linh`: +15% artifact damage.
- Tầng 6, `Liên Châu`: thêm một hit bằng 55% hit chính, dùng hành kế trong vòng xoay.
- Tầng 12, `Ngũ Hành Cộng Minh`: hai hành khác nhau trúng cùng mục tiêu giảm 10% chu kỳ kế; tối đa một lần/activation.
- Tầng 18, `Vạn Tượng Quy Nhất`: activation thứ năm phóng các hành đang equip vào primary target; tổng damage có cap theo số hành.

Chu kỳ không thấp hơn 1,5 giây. Mục tiêu cuối Trúc Cơ/Địa phẩm: artifact chiếm 18–25% tổng DPS build chuẩn, không vượt skill chính.

### 8.3. Thủ — Ngũ Hành Hộ Thể

- Tầng 1: action nền với damage ×0,70.
- Tầng 3, `Châu Quang Hộ Thể`: cấp ward theo Power của hành vừa bắn, cap theo max HP.
- Tầng 6, `Ngũ Khí Tuần Hoàn`: mỗi activation cấp buff ngắn tăng `finalDamageReductionPercent`; refresh duration, không stack magnitude.
- Tầng 12, `Sinh Sinh Bất Tức`: ward do artifact vỡ sẽ hồi một phần sau internal cooldown; không hồi HP trực tiếp.
- Tầng 18, `Ngũ Hành Hộ Giới`: activation thứ năm tạo hộ giới ngắn tăng ailment resistance và critical avoidance.

Buff phải đi qua `Battle.playerBuffs`, không sửa stats vĩnh viễn; không mang ward/buff sang trận sau và không cho 100% uptime với lớp giảm damage mạnh nhất.

### 8.4. Khống — Ngũ Hành Trấn Linh

- Tầng 1: action nền với damage ×0,80.
- Tầng 3, `Trệ Khí`: hit áp `lam_cham` ngắn qua `AilmentSystem`.
- Tầng 6, `Ngũ Hành Phược`: ba hit artifact lên cùng mục tiêu trong cửa sổ thời gian áp `troi_chan`; counter là runtime artifact.
- Tầng 12, `Trấn Mạch`: target đang root nhận debuff attack speed ngắn.
- Tầng 18, `Ngũ Châu Trấn Vực`: activation thứ năm tác động vùng nhỏ, áp slow; root chỉ xét primary target.

Boss có duration multiplier/cap và per-target ICD để không root-lock. Không dùng stun/freeze trong bộ nền; reapply tuân thủ rule của `AilmentSystem`.

## 9. Công thức sức mạnh

Không thêm `artifactAttack` vào `Stats` trong MVP:

```text
basePower = player.stats[elementPower]
raw = basePower × actionCoefficient
scaled = raw × levelMultiplier × gradeMultiplier × pathMultiplier

levelMultiplier = 1 + 0,025 × (artifactLevel - 1)
```

- Tầng 1: ×1,00; tầng 6: ×1,125; tầng 12: ×1,275; tầng 18: ×1,425.
- Damage tiếp tục qua calculator của element tương ứng.
- Không cộng `skillDamagePercent`; artifact không phải skill.
- Buff/CC dùng formula trong milestone definition, không suy từ damage formula.

## 10. Dữ liệu và save

### 10.1. Static definition

```ts
type ArtifactId = 'ngu_hanh_chau'

interface ArtifactDefinition {
  id: ArtifactId
  name: string
  cultivationPathId: CultivationPathId
  unlockRealmId: string
  baseAction: CombatActionDefinition
  paths: Record<ArtifactPath, ArtifactPathDefinition>
}

const ARTIFACT_ID_BY_CULTIVATION_PATH: Partial<Record<CultivationPathId, ArtifactId>> = {
  phap_tu: 'ngu_hanh_chau',
}
```

`Partial` có chủ ý vì Kiếm Tu chưa có artifact.

### 10.2. Player state

Không dùng array inventory vì mỗi nhân vật chỉ có một bản mệnh:

```ts
interface ArtifactProgress {
  artifactId: ArtifactId
  realmId: string
  realmLevel: number
  experience: number
  grade: ArtifactGrade
  selectedPath?: ArtifactPath
}

interface PlayerData {
  artifact?: ArtifactProgress
}
```

Normalize invariants:

- `artifactId` phải khớp nghề; sai thì bỏ và thức tỉnh lại nếu đủ gate.
- Realm/tầng không vượt player và không thấp hơn mốc unlock.
- EXP hữu hạn, không âm, không vượt requirement kế.
- Grade/path sai fallback `pham`/`undefined`.
- Trước Trúc Cơ: `artifact === undefined`.
- Pháp Tu đã Trúc Cơ nhưng thiếu state: tạo Ngũ Hành Châu mặc định khi boot/normalize.

## 11. Runtime và combat integration

```ts
interface ArtifactRuntime {
  artifactId: ArtifactId
  path?: ArtifactPath
  activationTimer: number
  activationCount: number
  elementCursor: number
  perTargetControl: Record<string, ArtifactTargetControlState>
  lastBattleDamage: number
}
```

State này nằm trong `Battle`, không persist. Tick order:

1. Update buff/ailment và pending action như hiện tại.
2. Không tick khi chưa materialize, player chết hoặc battle không `fighting`.
3. Timer artifact chạy độc lập với cast/basic attack; player bị CC không dừng artifact.
4. Khi ready, chọn target theo AI/range và tạo action đã snapshot từ level/grade/path.
5. Resolve qua pipeline combat hiện hữu và emit event cho Phaser.

Thêm origin type an toàn để attribution:

```ts
type CombatActionOrigin =
  | { kind: 'basic_attack' }
  | { kind: 'skill'; skillId: string }
  | { kind: 'artifact'; artifactId: ArtifactId }
  | { kind: 'enemy'; enemyId: string }
```

Không dùng nhiều boolean rời hoặc `any`. `ActionImpactEvent` mang origin để Phaser chọn VFX và summary ghi đúng artifact damage.

## 12. UI riêng

### 12.1. Panel

Thêm `'artifact'` vào `StandalonePanel`, cùng tầng với Kỹ Năng/Tâm Pháp. Thêm shortcut **Bản Mệnh Pháp Bảo** vào command wheel khi đạt Trúc Cơ; nghề chưa có definition hiển thị disabled + tooltip.

Panel có bốn vùng:

1. Artwork/icon, tên, nghề sở hữu, identity.
2. Cảnh giới/tầng, trần theo player, EXP hiện tại/yêu cầu, trạng thái chạm trần.
3. Phẩm, bonus, số Đoán Bảo Thạch, chi phí và nút Nâng Phẩm.
4. Ba card Công/Thủ/Khống, role, milestone 1/3/6/12/18, active state và nút chọn/đổi.

Thông tin bắt buộc: coefficient/chu kỳ sau modifier, hành kế tiếp và luật xoay vòng, buff/CC active, milestone kế, nguồn Đoán Bảo Thạch, cảnh báo thay đổi áp dụng từ trận sau. Không hiển thị DPS ước tính nếu chưa dùng chung calculator với core.

### 12.2. Combat HUD và reward

Trong `PhapTuCombatHud`, thêm slot riêng `ArtifactCombatSlot`, không giả làm `CombatSkillSlot`:

- Icon Ngũ Hành Châu, vòng cooldown, icon hướng.
- Hành của phát kế.
- Counter activation thứ năm hoặc stack khống chế trên target hiện tại.

HUD chỉ đọc runtime, không cho đổi hướng/nâng phẩm. Victory/Defeat summary thêm **Kinh nghiệm Pháp Bảo +N**; Đoán Bảo Thạch dùng item row hiện hữu. Tăng tầng giữa trận chỉ đẩy notification, không mở modal.

## 13. Cấu trúc file dự kiến

```text
src/core/artifact/
  Artifact.ts
  ArtifactProgression.ts
  ArtifactRuntime.ts
  ArtifactSystem.ts
  ArtifactDropBalance.ts

src/data/artifact/
  Artifacts.ts
  NguHanhChau.ts

src/components/panels/
  ArtifactPanel.vue

src/components/panels/artifact/
  ArtifactOverview.vue
  ArtifactExperienceBar.vue
  ArtifactGradeSection.vue
  ArtifactPathCards.vue

src/components/game/combat/hud/
  ArtifactCombatSlot.vue
```

Điểm tích hợp: `Player.ts`, save/player restore, `GameManager`, `Battle.ts`, `BattleSystem.ts`, `CombatAction.ts`, `BattleEvents.ts`, `BattleLootSystem.ts`, `BattleRewardSummary.ts`, `ui.ts`, `GameRoot.vue`, command wheel và `PhapTuCombatHud.vue`.

## 14. Thứ tự triển khai

### Phase 1 — Domain/progression

1. Type, registry, definition Ngũ Hành Châu.
2. `PlayerData.artifact`, normalize và thức tỉnh.
3. EXP requirement, cap theo player, chọn/đổi hướng.
4. Unit test invariant progression.

### Phase 2 — Đá và nâng phẩm

1. Đăng ký `doan_bao_thach`.
2. Bảng drop tập trung theo realm + normal/elite/boss.
3. Loot notification/summary và transaction nâng phẩm.
4. Test RNG, realm gate, double reward, thiếu/đủ đá.

### Phase 3 — Combat subgun

1. Snapshot/runtime trong Battle.
2. Activation timer trong fixed-step.
3. Origin `artifact`, attribution và action nền.
4. Vòng xoay Ngũ Hành; lần lượt triển khai Công, Thủ, Khống.
5. Test milestone và death/materialize/CC/targeting.

### Phase 4 — UI/presentation

1. Standalone panel + command wheel.
2. Overview, EXP/cap, grade/stone, path cards.
3. HUD slot + reward summary.
4. VFX từ `ActionImpactEvent`; component test và responsive.

### Phase 5 — Balance

1. Simulation EXP/drop/DPS/survivability/control uptime.
2. Playtest boss, wave đông, auto-repeat dài.
3. Chốt coefficient, EXP curve, stone drop và grade cost.

## 15. Test nghiệm thu

### 15.1. Ownership/save/progression

- Pháp Tu vào Trúc Cơ nhận đúng một Ngũ Hành Châu; Kiếm Tu không nhận nhầm.
- Không có equip/craft/duplicate artifact.
- Save/load giữ realm, tầng, EXP, phẩm, hướng; state sai được normalize.
- Mỗi quái chỉ cấp EXP một lần và ba hướng nhận bằng nhau.
- Artifact không vượt player; ở cap chỉ bank một thanh; player tăng tầng chỉ nhảy đúng một tầng.
- Offline cultivation không cấp artifact EXP.

### 15.2. Drop/phẩm

- Quái dưới Trúc Cơ không rơi đá.
- Normal/Elite/Boss dùng đúng một bảng tỷ lệ.
- Drop vào bag/summary/notification đúng một lần.
- Nâng phẩm thiếu đá không mutate; đủ đá trừ đúng và tăng một phẩm.
- Không vượt `tien`, không thất bại hoặc giảm phẩm.

### 15.3. Combat

- Artifact không chiếm/reset skill slot/cooldown.
- Vẫn tick khi player cast hoặc bị CC; ngừng ở countdown, pending materialize, death, victory/defeat.
- Đổi hướng chỉ ảnh hưởng trận kế.
- Không target enemy pending spawn hoặc ngoài range.
- Damage/kill/impact attribution là artifact.
- Ngũ Hành chỉ xoay qua element equip và dùng đúng Power/RES/Pen.
- Công không proc loop; Thủ không leak buff; Khống có per-target ICD và không root-lock boss.

### 15.4. UI

- Panel hiển thị đúng artifact theo nghề và đủ EXP/cap/phẩm/đá/path/milestone.
- EXP bar phân biệt đang luyện, đầy chờ chủ nhân và đạt trần content.
- Không đổi hướng hoặc nâng phẩm trong combat.
- HUD cooldown/hành/counter khớp runtime.
- Không dùng nhầm nhãn quality equipment “Pháp Bảo”.

## 16. Chỉ tiêu balance ban đầu

Simulation artifact tầng 1/6/12/18, phẩm Phàm/Linh/Địa trên boss đơn, wave đông, enemy áp sát nhanh và auto-repeat dài.

- Công: 18–25% tổng DPS build cuối Trúc Cơ, không vượt skill chính.
- Thủ: giảm 15–25% damage nhận trong trận phù hợp, đổi lại DPS thấp rõ.
- Khống: giảm áp lực wave nhưng hard CC boss không quá 20% uptime.
- Không hướng nào bắt buộc cho mọi nội dung.
- Địa phẩm đạt được bằng farm cuối Trúc Cơ hợp lý; Thiên/Tiên không là yêu cầu progression.

## 17. Ngoài phạm vi

- Pháp bảo Kiếm Tu/Thể Tu.
- Tiến hóa Kim Đan trở lên.
- Nhiều pháp bảo, artifact inventory, trade, craft hoặc drop nguyên món.
- Affix ngẫu nhiên, forge, durability, phân giải.
- Cây node hỗn hợp nhiều hướng.
- PvP/leaderboard và save migration từ draft chưa phát hành.

## 18. Điểm cần validate bằng playtest

1. EXP `0,25 × techniqueInsight` (đã giảm từ `0,5`, balance 2026-08-28) có giữ artifact gần nhưng không luôn chạm trần player.
2. Drop `2% / 8% / 25%` có đưa phần lớn người chơi tới Linh phẩm và người farm tới Địa phẩm.
3. Chu kỳ 3 giây, coefficient 45% có đủ cảm giác subgun mà không lấn skill/VFX.
4. Nhánh Thủ nên ưu tiên ward hay final damage reduction sau khi đo thực tế.
5. Duration/ICD root Boss cần chỉnh theo time-to-kill.
6. Sau development, đổi hướng nên tiếp tục miễn phí hay có chi phí.
