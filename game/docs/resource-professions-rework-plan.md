# Kế hoạch rework Khai Thác và Tứ Nghệ

## 1. Mục tiêu và phạm vi

Rework tạo một vòng kinh tế thống nhất:

`Khai Thác theo cảnh giới` → `nguyên liệu thô theo độ hiếm` → `xử lý tại công trình` → `Đan / Khí / Phù / Trận` → `sức mạnh nhân vật và trang bị`.

Phạm vi gồm:

- Ba tuyến khai thác Linh Thảo, Linh Mộc và Linh Khoáng.
- Ba vật liệu mỗi tuyến, ở mỗi đại cảnh giới, với tỷ lệ thu hoạch phân tầng rõ ràng.
- Lò Luyện và luồng tiêu thụ thành phẩm khoáng trong toàn bộ thao tác Luyện Khí.
- Thang Đan Dược Cửu Phẩm → Nhất Phẩm → Tiên Phẩm, khóa sử dụng đúng cảnh giới.
- Bốn nhóm tác dụng Đan tạm thời: tăng ngẫu nhiên một Main Stat, hồi HP/MP theo giây, tăng Tu Vi, tăng Cảm Ngộ.
- Phù và Trận trở thành hai loại modifier-item gắn trên equipment slot, mỗi item cấp đúng hai modifier.
- UI, save migration, cân bằng, validator dữ liệu và test hồi quy liên quan.

Không đổi hệ thống rơi trang bị, Affix Prefix/Suffix hay combat skill ngoài phần cần thiết để modifier theo thời gian và modifier trên slot hoạt động đúng.

## 2. Hiện trạng đã kiểm tra

### 2.1. Khai thác và nguyên liệu

- `Exploration` hiện không có `requiredRealmId` hoặc snapshot cảnh giới. Ba khu vực chỉ trả lần lượt một nguyên liệu chính: `herb-seed`, `iron-ore`, `thanh-linh-moc`.
- Reward roll độc lập theo `chance`, nhưng `tier` chỉ dùng để hiển thị; chưa có quy tắc bắt buộc ba độ hiếm hoặc kiểm tra thứ tự tỷ lệ.
- Nếu người chơi đột phá trong khi một lượt khai thác đang chạy, state hiện không ghi cảnh giới lúc bắt đầu. Nếu reward được resolve động theo cảnh giới lúc thu, người chơi có thể khai thác cảnh giới thấp rồi nhận nguyên liệu cảnh giới cao.
- `Material` dùng `years` cho Linh Thảo/Linh Mộc, chưa có `realmId`, `rarity`, `processingStage` hoặc `family` đủ rõ để tạo chuỗi kinh tế theo cảnh giới.
- Linh Thảo Viên chỉ nhận một loại hạt và trả một loại thảo. Thiên Công Phường và Lò Luyện mỗi nơi chỉ có một processing recipe cố định.

### 2.2. Đan dược

- `Pham` hiện chỉ có năm bậc Hoàng/Huyền/Địa/Thiên/Tiên và đang dùng chung với nhiều hệ vật phẩm. Nó không biểu diễn được chuỗi mười bậc theo mười đại cảnh giới hiện có.
- Recipe chỉ có gate tối thiểu `requiredRealmId`; dùng đan không kiểm tra phẩm/cảnh giới tương ứng.
- Permanent pill hiện cộng các combat stat như `attack`, `maxHp`; chưa cộng trực tiếp một trong năm Main Stat `strength/dexterity/intelligence/attunement/vitality`.
- Chưa có effect Cảm Ngộ. Tu Vi đã có đường cộng qua `addCultivation()`.
- Buff từ pill nằm trong pool persistent của `GameManager`, giảm thời gian bằng game delta và không được lưu trong save.
- Combat snapshot `player.finalStats` lúc bắt đầu, sau đó tự tính lại từ `CombatEntity.baseStats` và buff trong trận. Vì vậy buff uống trước trận có thể bị đóng băng trong snapshot sau khi buff persistent hết hạn; đây là blocker cho hồi HP/MP theo thời gian thực.

### 2.3. Luyện khí

- Lò Luyện chỉ hỗ trợ `iron-ore → black-iron`, với `Building.processingRecipeId` đơn và một `lastCollectedAt` chung.
- `black-iron` đang cùng lúc trả chi phí Tẩy Luyện và Tinh Luyện; nhiều khoáng khác có nguồn rơi rời rạc hoặc không có nguồn khai thác ổn định.
- `forgeCost` có trong type và logic nhưng chưa được cấu hình trong `BASE_COSTS`, nên thao tác Rèn hiện không có sink nguyên liệu thực tế.
- Cường Hóa dùng Bụi Cốt; Nâng Phẩm/Nâng Cảnh Giới dùng Yêu Đan; Thêm/Nâng Affix dùng hai loại đá riêng. Luồng khoáng tinh luyện chưa bao phủ các tác vụ của Luyện Khí.

### 2.4. Phù và Trận

- Phù hiện tăng `bonusAffixSlots` và roll Affix lên item; nó không mang hai modifier riêng.
- Trận chỉ gắn trên slot Vũ Khí, mang trigger và modifier tích stack. Nó không phải socket chung cho các equipment slot.
- `EquipmentSlotState` lưu danh sách Phù đã dùng nhưng không lưu effect của từng Phù. Trận lưu modifier runtime trực tiếp trong save.
- Modifier Trận được gộp ở `GameManager.getAggregatedModifiers()`, trong khi combat dùng snapshot; stack tăng trong trận không bảo đảm cập nhật vào stats của `CombatEntity` đang đánh.

## 3. Quyết định thiết kế nền tảng

### 3.1. Thang phẩm nghề theo cảnh giới

Tạo type riêng `ProfessionGrade`, không tái sử dụng `Pham` năm bậc của Equipment. Mapping cố định:

| Cảnh giới | Phẩm nghề |
| --- | --- |
| Phàm Nhân | Cửu Phẩm |
| Luyện Khí | Bát Phẩm |
| Trúc Cơ | Thất Phẩm |
| Kim Đan | Lục Phẩm |
| Nguyên Anh | Ngũ Phẩm |
| Hóa Thần | Tứ Phẩm |
| Luyện Hư | Tam Phẩm |
| Hợp Thể | Nhị Phẩm |
| Đại Thừa | Nhất Phẩm |
| Độ Kiếp | Tiên Phẩm |

Một bảng duy nhất `PROFESSION_GRADE_BY_REALM` là nguồn sự thật cho Đan, Phù, Trận, recipe, UI và validator. Không suy phẩm từ index rải rác tại call site.

### 3.2. Ba độ hiếm nguyên liệu

Dùng ba bậc `common | uncommon | rare`. Mỗi tổ hợp `(realmId, resourceKind)` bắt buộc có đúng ba material, mỗi rarity đúng một material.

Tỷ lệ khởi điểm, liệt kê từ thấp đến cao:

| Độ hiếm | Chance mỗi lượt | Số lượng khi trúng | Vai trò |
| --- | ---: | ---: | --- |
| Rare | 8% | 1 | Công thức phẩm chất cao, nâng phẩm/nâng cảnh giới |
| Uncommon | 35% | 1–2 | Tinh luyện, reroll và công thức trung cấp |
| Common | 100% | 3–6 | Sink số lượng lớn, sản xuất nền |

Ba reward roll độc lập: mỗi lượt luôn có Common và có thể nhận thêm Uncommon/Rare. Các số trên là baseline để playtest, không hard-code trong system; toàn bộ nằm trong balance data. Validator bắt buộc `rare.chance < uncommon.chance < common.chance` và expected yield cũng tăng theo cùng thứ tự ngược độ hiếm.

### 3.3. Snapshot cảnh giới khi bắt đầu khai thác

`ActiveExploration` phải lưu `realmIdAtStart` và `rewardTableId` (hoặc version của table). Collect luôn dùng snapshot này, không dùng cảnh giới hiện tại. Khi đột phá, lượt đang chạy vẫn trả vật liệu cũ; lượt bắt đầu sau đột phá dùng table mới.

Điều này vừa chống exploit vừa làm save/offline deterministic về mặt tier. RNG vẫn chỉ roll lúc collect như hiện tại; nếu cần tái lập tuyệt đối sau crash, bổ sung seed theo `activeExploration.id` trong phase cân bằng sau, không bắt buộc cho MVP.

## 4. Mô hình dữ liệu đề xuất

### 4.1. Material

Mở rộng `Material` bằng metadata có người tiêu thụ thật:

```ts
type ResourceKind = 'herb' | 'wood' | 'ore'
type MaterialRarity = 'common' | 'uncommon' | 'rare'
type ProcessingStage = 'raw' | 'processed'

interface ProfessionMaterialMeta {
  resourceKind: ResourceKind
  realmId: string
  rarity: MaterialRarity
  processingStage: ProcessingStage
}
```

- Giữ `category`, `element`, `sourceType` cho UI và những consumer hiện có.
- Ngừng dùng `years` làm driver công thức mới. Có thể giữ optional trong một save version để tooltip legacy không vỡ, sau đó xóa khi không còn reference.
- ID theo quy ước ổn định: `<realm>_<kind>_<rarity>_<raw|processed>`. Tên hiển thị nằm trong catalog, không parse từ ID.
- Dùng catalog theo cảnh giới để sinh/đăng ký material và reward table; thêm validator để lỗi authoring fail ngay khi boot/test.

### 4.2. Exploration

`Exploration` chỉ mô tả tuyến (`herb/wood/ore`) và timing; reward không còn khai thủ công một mảng không có realm.

```ts
interface Exploration {
  // fields hiện có
  resourceKind: ResourceKind
  requiredRealmId?: string
}

interface ActiveExploration {
  // fields hiện có
  realmIdAtStart: string
  rewardTableId: string
}
```

`ExplorationRewardCatalog.resolve(resourceKind, realmId)` trả đúng ba entry. `startExploration()` xác thực table tồn tại rồi snapshot; `collect()` nhận table từ snapshot.

### 4.3. Processing

Không mở rộng `Building.processingRecipeId` thành một array đơn giản vì `lastCollectedAt` chung sẽ cho phép đổi recipe và dùng thời gian đã tích trước đó. Thay bằng job state riêng:

```ts
interface ActiveProcessingJob {
  jobId: string
  buildingInstanceId: string
  recipeId: string
  startedAt: number
  claimedCycles: number
}
```

- Một Lò Luyện level đầu có một job slot; nâng level có thể mở thêm slot theo data.
- Chọn recipe bắt đầu một job mới và trừ nguyên liệu theo từng cycle khi claim, theo hành vi hiện tại.
- Đổi/cancel recipe không được mang thời gian tích lũy sang recipe khác.
- Mỗi raw ore có đúng một processed output cùng realm/rarity; validator kiểm tra quan hệ 1:1.
- Offline cap áp dụng theo từng job và vẫn giữ phần thời gian dư hợp lệ.

Thiên Công Phường dùng cùng hạ tầng job cho Linh Mộc → Phù Chỉ/Mực Phù theo ba rarity. Linh Thảo Viên mở chọn hạt theo realm/rarity và mỗi plot snapshot seed/output lúc gieo, tránh việc đổi catalog sau đột phá làm cây đang trồng biến tier.

### 4.4. Recipe nghề

Thêm metadata rõ ràng:

```ts
interface Recipe {
  // fields hiện có
  professionGrade: ProfessionGrade
  realmId: string
  primaryMaterialId: string
}
```

- `primaryMaterialId` phải nằm trong `materials` và là nguyên liệu gốc quyết định cảnh giới/phẩm.
- Với Đan, primary bắt buộc là Linh Thảo processed cùng cảnh giới với recipe.
- Với Phù, primary là sản phẩm Linh Mộc processed.
- Với Trận, primary là khoáng processed.
- `requiredRealmId` tối thiểu hiện tại được thay bởi `realmId` chính xác cho nghề. UI có thể xem recipe cũ, nhưng mặc định chỉ hiện nhóm cảnh giới hiện tại.
- Craft chỉ cho recipe có `recipe.realmId <= player.realmId`; sử dụng/socket tuân theo rule riêng. Với game không có trade, nên mặc định khóa craft recipe thấp hơn ở UI để tránh tạo thành phẩm không còn dùng được, nhưng core vẫn trả reason cụ thể thay vì dựa vào UI.

## 5. Rework Đan Dược

### 5.1. Data contract

```ts
type PillEffect =
  | { type: 'random_main_stat'; value: 1 }
  | { type: 'regen'; hpPerSecond: number; mpPerSecond: number; durationSeconds: number }
  | { type: 'cultivation'; value: number }
  | { type: 'skill_insight'; value: number }

interface Pill {
  // id/name/icon/description
  grade: ProfessionGrade
  realmId: string
  effects: PillEffect[]
}
```

Quy ước MVP: “Cảm Ngộ” là `player.skillInsight`, đồng thời tăng `totalSkillInsightGained`. Không cộng vào insight của Tâm Pháp vì đó là progression riêng gắn với Tâm Pháp đang equip. Nếu thiết kế muốn Cảm Ngộ Tâm Pháp, thêm effect riêng sau; không dùng một effect mơ hồ cho hai currency.

### 5.2. Khóa sử dụng

`PillSystem.canUse()` trả result có reason thay vì boolean:

- `wrong_realm`: `pill.realmId !== player.realmId`.
- `all_main_stats_capped`: pill Main Stat nhưng cả năm stat đã chạm cap cảnh giới.
- `cultivation_capped`: pill Tu Vi không thể cộng thêm (tùy quyết định UX; khuyến nghị không tiêu pill nếu gain thực bằng 0).
- `ok`.

Chỉ remove khỏi `PillBag` sau khi toàn bộ validation và apply thành công. UI hiển thị “Chỉ dùng tại [Cảnh giới]” và reason khi disable.

### 5.3. +1 Main Stat ngẫu nhiên

- Candidate là năm `MAIN_STAT_KEYS` chưa chạm trần của cảnh giới hiện tại.
- Roll đều trên candidate hợp lệ; stat đã cap bị loại trước khi roll.
- Cộng trực tiếp vào `player.baseStats[stat]`, vì đây là một điểm thuộc tính thật, không phải modifier combat giả lập.
- Không cộng `attributePoints`, không tăng hai lần và không dùng bucket `pill-permanent:*` cũ.
- RNG được inject hoặc truyền callback để unit test deterministic.

### 5.4. Buff hồi HP/MP theo thời gian thực

Tạo timed effect có deadline tuyệt đối:

```ts
interface PersistentTimedEffect {
  id: string
  sourceItemId: string
  appliedAtMs: number
  expiresAtMs: number
  modifiers: StatModifier[]
}
```

Đan hồi phục tạo hai modifier `hpRegenPerSecond` và `manaRegenPerSecond`. `expiresAtMs` là authority; `remainingTime` chỉ là giá trị UI suy ra. Vì là thời gian thực, đóng game/offline vẫn làm thời hạn trôi qua; load save bỏ effect đã hết hạn.

Phải thống nhất modifier runtime trước khi thêm pill:

1. Tách stat snapshot tĩnh (base, equipment, talent, realm, skill snapshot theo policy hiện có) khỏi modifier sống theo thời gian.
2. `BattleSystem.updateStatsFromModifiers()` nhận thêm modifier persistent đang active và modifier socket sống từ `GameManager`, hoặc snapshot các timed effect với cùng `expiresAtMs` vào battle rồi tự expire. Chọn một authority duy nhất; khuyến nghị provider từ `GameManager` để menu/combat không có hai bản sao lệch nhau.
3. Không đưa timed modifier vào `CombatEntity.baseStats`, tránh buff hết hạn nhưng stat vẫn bị đóng băng đến hết trận.
4. Tick regen hiện có trong `BattleSystem.updateRegen()` sẽ tự dùng hai stat mới sau khi stats được recompute.
5. Save `persistentTimedEffects`; khi load tính theo `Date.now()`, không dùng game delta để kéo dài buff lúc pause/offline.

Stack policy MVP: uống lại cùng loại refresh deadline và lấy giá trị mạnh hơn nếu khác phẩm; không cộng dồn HP/MP/s. Hai loại pill khác ID nhưng cùng `effectGroup: 'pill_regen'` cũng dùng chung group để tránh stack ngoài ý muốn.

### 5.5. Tu Vi và Cảm Ngộ

- Tu Vi luôn đi qua `addCultivation()` để giữ cap tầng hiện tại.
- Giá trị không dùng số tuyệt đối giống nhau ở mọi realm. Balance theo tỷ lệ `getRequiredCultivation(realmId, realmLevel)` tại lúc uống, với cap cấu hình theo phẩm; baseline đề xuất 2–5% yêu cầu tầng hiện tại.
- Cảm Ngộ cộng `skillInsight` và `totalSkillInsightGained` trong cùng transaction. Giá trị scale theo phẩm bằng bảng data, không suy từ Tu Vi.

### 5.6. Công thức dựa trên Linh Thảo

Mỗi recipe có một `primary herb` cùng realm. Độ hiếm của primary herb đặt budget:

- Common: pill hồi HP/MP, tiêu thụ thường xuyên.
- Uncommon: pill Tu Vi.
- Rare: pill Cảm Ngộ và pill +1 Main Stat; pill Main Stat cần thêm catalyst hiếm để giữ cân bằng.

Secondary material quyết định effect family, không được nâng grade cao hơn primary. Yêu Đan cùng cảnh giới vẫn là catalyst nghề Đan; Linh Thạch là sink chung. Validator từ chối recipe trộn primary realm thấp với output grade cao.

## 6. Luồng Quặng → Lò Luyện → Luyện Khí

Mỗi cảnh giới có ba raw ore và ba processed material tương ứng:

| Raw rarity | Thành phẩm Lò Luyện | Sink chính |
| --- | --- | --- |
| Common | Thỏi/Linh Thiết nền | Cường Hóa, Rèn; chi phí số lượng lớn |
| Uncommon | Tinh Kim/Tinh Sa | Tẩy Luyện, Tinh Luyện implicit |
| Rare | Hợp Kim/Tinh Hoa Khoáng | Nâng Phẩm, Nâng Cảnh Giới, phần khoáng của thao tác Affix |

Phân phối chi phí đề xuất:

| Tác vụ Luyện Khí | Nguyên liệu bắt buộc | Vai trò kinh tế |
| --- | --- | --- |
| Cường Hóa slot | Common processed + Linh Thạch | Sink đều, scale theo enhance level |
| Rèn item | Common + Uncommon processed | Sink dài hạn theo forge points; bổ sung `forgeCost` đang thiếu |
| Tẩy Luyện Affix | Uncommon processed | Sink lặp lại cho reroll affix value |
| Tinh Luyện implicit | Uncommon processed + ít Common | Sink lặp lại cho reroll main stat |
| Nâng Phẩm | Rare processed + Yêu Tài cùng realm | Gate chất lượng item |
| Nâng Cảnh Giới | Cả ba processed cùng realm đích + Linh Thạch | Sink chuyển tier, không dùng khoáng cảnh giới cũ |
| Thêm Affix | Rare processed + Phù Văn Thạch | Giữ nguồn monster nhưng nối vào economy khoáng |
| Nâng Tier Affix | Rare processed + Cường Hoa Thạch | Giữ nguồn boss và tạo sink late-game |

Cost không nằm chung trên một `Equipment` template giống hệt mọi cảnh giới. Tạo `EquipmentOperationCostCatalog` resolve theo `(operation, targetRealmId, currentLevel/forgeBand)`; `EquipmentSystem` chỉ thực thi cost đã resolve. UI và core cùng gọi một resolver để không lệch giá hiển thị/thực trừ.

Khi nâng cảnh giới item, nguyên liệu lấy theo cảnh giới đích. Khi reroll/rèn/cường hóa item, lấy theo cảnh giới hiện tại của item. Validator bảo đảm cả tám operation đều có cost cho mọi cảnh giới nằm trong product scope.

## 7. Phù và Trận: hai modifier gắn trên slot

### 7.1. Phân biệt vai trò

- Phù: hai modifier tĩnh thiên về phòng thủ/tiện ích/tài nguyên (HP, MP, regen, accuracy, resistance, speed...).
- Trận: hai modifier tĩnh thiên về tấn công/ngũ hành/cơ chế combat (attack, element power, crit, ailment potency...).
- MVP bỏ trigger/stack khỏi Trận. Nếu sau này cần trận có trigger, đó là archetype riêng và vẫn phải đi qua modifier runtime authority; không nhét trigger vào schema socket tĩnh.

Mỗi template khai đúng tuple hai phần tử để compiler và validator cùng enforce:

```ts
type TwoModifiers = readonly [StatModifier, StatModifier]

interface SlotModifierItem {
  id: string
  realmId: string
  grade: ProfessionGrade
  allowedSlots: readonly EquipmentSlot[]
  modifiers: TwoModifiers
}
```

### 7.2. State trên equipment slot

```ts
interface SocketedModifierItem {
  itemId: string
  realmId: string
  modifiers: TwoModifiers
}

interface EquipmentSlotState {
  // state hiện có
  socketedTalisman?: SocketedModifierItem
  socketedFormation?: SocketedModifierItem
}
```

- Mỗi trong sáu equipment slot có tối đa một Phù và một Trận.
- Modifier chỉ active nếu slot đang có equipment được trang bị.
- Socket yêu cầu item cùng cảnh giới với equipment slot/item đang gắn và slot nằm trong `allowedSlots`.
- Socket tiêu item trong bag. Unsocket trả đúng một item về bag; thay trực tiếp phải là transaction “trả món cũ rồi tiêu món mới” sau khi validate đầy đủ.
- Phù không còn mở `bonusAffixSlots`; hệ Affix trở lại hoàn toàn thuộc Luyện Khí.
- `appliedTalismanIds` và `SocketedFormation.trigger/stacks` trở thành legacy state cần migrate.
- `getSlotModifiers()` là nguồn duy nhất tổng hợp 2+2 modifier trên các slot active. Equipment modifier tĩnh và modifier socket được phân biệt bằng `sourceType`/`sourceId` ổn định để tooltip và debug truy nguồn.

### 7.3. Recipe

- Phù: processed wood cùng realm + Yêu Huyết cùng realm + Linh Thạch.
- Trận: processed ore cùng realm, ưu tiên phối hai rarity/thuộc tính + Yêu Cốt cùng realm + Linh Thạch.
- Grade output bắt buộc khớp realm mapping. Có thể xem recipe các realm khác nhưng chỉ socket cùng realm equipment.

## 8. UI/UX cần đổi

### Khai Thác

- Mỗi card hiển thị cảnh giới reward đã snapshot, ba output, chance, khoảng số lượng và expected/hour.
- Khi người chơi đã đột phá nhưng job cũ còn chạy, badge ghi rõ “Đang khai thác cấp [cũ]”.
- Start bị disable nếu thiếu reward table hoặc chưa đạt required realm, kèm reason.

### Linh Thảo Viên, Thiên Công Phường, Lò Luyện

- Chọn seed/processing recipe theo ba rarity và cảnh giới.
- Hiển thị input, output, cycle time, số cycle có thể chạy, storage và offline cap.
- Mỗi job có progress riêng; cancel/đổi recipe thông báo rõ phần thời gian không chuyển tiếp.

### Đan Phòng

- Nhóm recipe theo cảnh giới/phẩm nghề, không dùng nhóm “Cơ Bản” mơ hồ.
- Tooltip hiển thị exact realm, primary herb rarity, tác dụng, duration real-time và stack policy.
- Nút uống disable với reason; pill Main Stat hiển thị danh sách năm stat có thể roll và báo khi tất cả đã cap.
- HUD/menu hiển thị buff regen còn lại bằng deadline thực; combat HUD hiển thị cùng một effect, không tạo timer thứ hai.

### Trang bị, Phù, Trận

- Paperdoll hiển thị hai mini-slot Phù/Trận trên từng equipment slot.
- Tooltip socket liệt kê đúng hai modifier và cảnh giới yêu cầu.
- Flow chọn Phù/Trận → chọn equipment slot, không chọn một instance trong bag làm proxy rồi ghi state sang slot như hiện tại.
- Có thao tác Gỡ và Thay rõ ràng; preview chênh lệch modifier trước khi xác nhận thay.

## 9. Save migration

Bump save version sau khi schema ổn định và viết migration trực tiếp từ version hiện tại thay vì làm save người chơi mất tương thích.

### Material và inventory

- Giữ registry alias cho ID cũ trong một version.
- Map raw `herb-seed/iron-ore/thanh-linh-moc` sang Common raw của cảnh giới phù hợp với content cũ.
- Map `black-iron` sang Common processed Luyện Khí; các khoáng cũ khác map theo rarity được chốt trong balance sheet.
- Material đặc thù như Yêu Tài, breakthrough token, Bụi Cốt, đá Affix không tự động đổi nếu vẫn còn consumer.

### Pill

- Pill cũ được map sang recipe/output mới cùng effect gần nhất hoặc đổi thành token hoàn nguyên nguyên liệu. Không âm thầm đổi một pill permanent combat stat thành +1 Main Stat vì giá trị gameplay khác bản chất.
- Modifier `pill-permanent:*` cũ trong `player.modifiers` phải được giữ dưới dạng legacy modifier hoặc hoàn nguyên có kiểm soát; không xóa điểm người chơi đã nhận.

### Phù/Trận slot cũ

- Mỗi slot có nhiều `appliedTalismanIds`: hoàn trả toàn bộ số Phù tương ứng về bag, reset `bonusAffixSlots` do Phù; không xóa các Affix đã roll trên equipment hiện có.
- `socketedFormation` cũ trên weapon: hoàn trả Formation về bag để người chơi tự socket theo hệ mới. Không cố chuyển stacks runtime thành modifier tĩnh.
- Migration phải idempotent và có fixture version cũ; chạy hai lần không nhân đôi hoàn trả.

### Timed effect

- Save cũ không có timed effect: mặc định mảng rỗng.
- Save mới loại effect có `expiresAtMs <= Date.now()` ngay khi load.

## 10. Trình tự triển khai

### Phase 0 — Chốt balance contract

1. Chốt ba tên/độ hiếm cho từng tuyến và naming pattern theo realm.
2. Chốt “Cảm Ngộ = skillInsight” hoặc mở thêm loại Cảm Ngộ Tâm Pháp.
3. Chốt tỷ lệ 8/35/100 và số lượng baseline bằng spreadsheet economy.
4. Chốt việc Phù/Trận được socket mọi slot hay có `allowedSlots` giới hạn; kế hoạch mặc định hỗ trợ mọi slot qua data.

Deliverable: bảng catalog hoàn chỉnh cho product scope. Dù type hỗ trợ cả mười realm, chỉ author data/reward/recipe đến cảnh giới có gameplay thật (hiện là Trúc Cơ) nếu chưa có content cao hơn; validator nhận một `SUPPORTED_PROFESSION_REALMS` rõ ràng, không tạo item placeholder không thể kiếm.

### Phase 1 — Contracts và validator

1. Tạo `ProfessionGrade`, mapping realm, material metadata và catalog interfaces.
2. Tạo validator cho đủ ba rarity, thứ tự chance, quan hệ raw→processed, primary material và grade/realm recipe.
3. Viết unit test cho mapping đủ mười realm và catalog trong product scope.
4. Chưa đổi UI hoặc save ở phase này.

### Phase 2 — Khai thác và nông/xưởng

1. Thêm resource kind, reward resolver và snapshot realm vào active exploration.
2. Chuyển ba tuyến sang catalog ba reward.
3. Mở Linh Thảo Viên cho ba seed/output; mỗi plot snapshot output.
4. Chuyển Thiên Công Phường sang processing job nhiều recipe.
5. Cập nhật UI expected/hour và state job cũ sau đột phá.

### Phase 3 — Lò Luyện và economy Luyện Khí

1. Thêm ba raw ore/processed output cho từng realm trong scope.
2. Thay processing cố định bằng job state, chống time-bank exploit.
3. Tạo `EquipmentOperationCostCatalog`; wire cả tám operation.
4. Bổ sung `forgeCost` thật và chuyển các cost hard-code/template hiện tại sang resolver.
5. Cập nhật Equipment Hall để preview đúng cost realm/level.

### Phase 4 — Modifier runtime authority

1. Phân loại modifier tĩnh và modifier sống.
2. Đảm bảo combat recompute nhận timed persistent modifier và socket modifier mà không double-apply snapshot.
3. Dùng deadline tuyệt đối cho timed effect, thêm save/load và expiry offline.
4. Thêm test xuyên biên menu→combat→hết hạn trong combat. Chỉ tiếp tục sang Pill/Socket sau khi phase này ổn định.

### Phase 5 — Đan Dược

1. Đổi Pill/Recipe sang grade/realm mới và bốn effect MVP.
2. Implement exact-realm gate, reason result và atomic consumption.
3. Implement Main Stat random trên candidate chưa cap với RNG testable.
4. Implement regen timed effect, cultivation và skill insight.
5. Cập nhật Đan Phòng, bag tooltip, buff timer và notification.

### Phase 6 — Phù và Trận slot modifiers

1. Đổi template thành tuple đúng hai modifier và `allowedSlots`.
2. Đổi `EquipmentSlotState` thành hai socket độc lập.
3. Bỏ hành vi Phù mở Affix và Trận trigger/stack khỏi đường runtime mới.
4. Implement socket/unsocket/replace atomic và tổng hợp modifier khi slot có equipment.
5. Cập nhật Paperdoll, bag-selection flow và tooltip.

### Phase 7 — Migration, cleanup và cân bằng

1. Viết migration save cùng fixture và báo cáo conversion.
2. Xóa alias/dead fields chỉ sau khi migration test xanh.
3. Chạy economy simulation cho yield/hour → processing/hour → sink/hour.
4. Playtest ở Phàm Nhân, Luyện Khí, Trúc Cơ; chỉnh data, không chỉnh công thức system nếu không cần.
5. Cập nhật game guide/item reference.

## 11. Test plan

### Unit tests

- Mười realm map một-một sang Cửu…Tiên, không trùng/missing.
- Mỗi `(realm, resourceKind)` trong scope có đúng Common/Uncommon/Rare; chance và expected yield đúng thứ tự.
- Exploration collect dùng realm lúc start, kể cả đột phá trước collect và load save giữa chừng.
- Processing không tạo output thiếu input, không vượt storage/offline cap, không chuyển time bank khi đổi recipe.
- Mỗi raw ore chỉ refine thành đúng processed material cùng realm/rarity.
- Tám operation Luyện Khí resolve đúng tier material; UI-facing resolver và execution dùng cùng result.
- Pill sai realm không bị consume; đúng realm apply đúng effect.
- Main Stat roll chỉ trong năm key, bỏ stat đã cap, không consume nếu cả năm cap.
- Tu Vi không vượt cap tầng; Cảm Ngộ tăng cả current và lifetime counter.
- Regen có hiệu lực ngoài/trong combat theo cùng deadline, hết giữa combat thì HP/MP/s trở về baseline, load offline không kéo dài buff.
- Mỗi Phù/Trận có đúng hai modifier; socket sai slot/realm fail không mất item; unsocket trả item; empty equipment slot không cấp modifier.
- Socket modifier và timed modifier không bị double-apply lúc start battle.
- Migration hoàn trả legacy Phù/Trận đúng số lượng và idempotent.

### Integration/UI tests

- Start/collect cả ba tuyến, quan sát ba output và expected/hour.
- Gieo/thu ba seed; chạy/đổi/cancel processing jobs.
- Craft/uống từng nhóm pill và xem reason sai realm/cap.
- Uống regen trước trận, vào trận, quan sát HP/MP tick rồi dừng đúng hạn.
- Socket/Gỡ/Thay Phù và Trận trên cả sáu slot; modifier thay đổi đúng khi equip/unequip equipment.
- Save/reload ở giữa exploration, processing, timed buff và sau migration.

### Verification bắt buộc mỗi phase

- Test mới của phase và toàn bộ Vitest liên quan.
- `npm.cmd run type-check`.
- `npm.cmd run build`.
- E2E combat cho phase modifier/Pill/Socket.

## 12. Tiêu chí hoàn thành

- Mỗi tuyến khai thác ở mỗi realm được hỗ trợ trả đúng ba vật liệu, tỷ lệ và expected yield hiển thị khớp logic thật.
- Không thể nâng tier reward bằng cách đột phá sau khi bắt đầu job.
- Mọi quặng dùng cho nghề phải đi qua Lò Luyện trước khi trở thành input Luyện Khí; cả tám thao tác có sink hợp lý và không còn `forgeCost` rỗng.
- Đan có đúng thang Cửu→Tiên theo realm, không dùng chéo cảnh giới và không mất item khi effect không thể áp dụng.
- Buff regen chạy bằng thời gian thực, có save/load, hoạt động và hết hạn đúng cả trong combat.
- Main Stat pill cộng đúng +1 vào một stat hợp lệ; Tu Vi/Cảm Ngộ đi đúng currency và counter.
- Phù và Trận mỗi món cấp đúng hai modifier trên slot, có socket/unsocket rõ ràng, không còn phụ thuộc proxy equipment instance hoặc stack Trận legacy.
- Save hiện tại được migrate không mất equipment/Affix/permanent progression.
- Validator, unit/integration tests, type-check và build đều xanh.

## 13. Rủi ro và giới hạn cần giữ

- Repo hiện chỉ cân bằng progression thật đến Trúc Cơ. Không author hàng loạt recipe/item “giữ chỗ” cho Kim Đan trở lên trước khi có content và nguồn Yêu Tài tương ứng; chỉ xây contract hỗ trợ đủ mười realm.
- Thay modifier authority là phần rủi ro cao nhất vì ảnh hưởng buff, skill passive, Formation và combat snapshot. Tách thành phase riêng và khóa bằng test trước khi rework data.
- Economy có nhiều sink xây/nâng building đang dùng khoáng cũ. Migration cost data phải kiểm kê cả building cost, không chỉ EquipmentSystem, nếu không người chơi có thể bị chặn xây công trình.
- Không dùng `Math.random()` trực tiếp trong domain mới cần test; bọc RNG để test và simulation tái lập được.
- Không gộp `ProfessionGrade` mới với Equipment Quality/Rarity. “Phẩm nghề theo cảnh giới” và “độ hiếm trang bị” là hai trục khác nhau.
