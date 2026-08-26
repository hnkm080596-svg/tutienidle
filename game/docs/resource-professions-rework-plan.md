# Kế hoạch rework Khám Phá, Sản Xuất, Khí Đường và Đan Phòng

## 1. Mục tiêu

Thiết kế mới rút gọn vòng kinh tế thành:

`Địa Giới -> Lâm / Quáng / Động Thiên -> nguyên liệu vào Bag -> Khí Đường / Đan Phòng`

Không còn chuỗi nguyên liệu thô rồi đưa qua công trình trung gian để xử lý. Mỗi
Địa Giới chỉ có đúng ba nguồn sản xuất:

| Nguồn | Sản phẩm | Consumer chính |
|---|---|---|
| Lâm | Ba loại gỗ ứng với ba cảnh giới của Địa Giới | Xây/nâng công trình, Đan Phòng làm nhiên liệu |
| Quáng | Ba loại quáng thạch ứng với ba cảnh giới của Địa Giới | Khí Đường |
| Động Thiên | Kỳ trân dị thảo dành riêng cho từng đan phương | Đan Phòng |

Mục tiêu là một hệ idle dễ đọc: chọn nguồn, bắt đầu cycle, chờ hoàn thành và
nhận thẳng vật liệu. Chiều sâu đến từ cảnh giới, cấp nguồn sản xuất, trọng số
phần thưởng và các sink Khí/Đan; không đến từ nhiều lớp processing job.

## 2. Các quyết định loại bỏ

- Loại bỏ Linh Thảo Viên/Dược Viên khỏi vòng sản xuất.
- Loại bỏ Lò Luyện và bước `raw ore -> processed ore`.
- Loại bỏ Thiên Công Phường nếu công trình này chỉ còn vai trò xử lý gỗ hoặc tạo
  nguyên liệu trung gian cho Phù.
- Loại bỏ seed, plot, gieo/trồng/thu hoạch và processing recipe trung gian.
- Loại bỏ storage riêng của nguồn sản xuất; sản phẩm hoàn thành đi thẳng vào
  `MaterialBag`.
- Không tiếp tục author cặp material `<raw|processed>` cho Gỗ/Quáng/Linh Thảo.
- Phù và Trận không tham gia vòng kinh tế hiện tại. Chúng bị khóa theo roadmap
  [future-talisman-formation-system-plan.md](./future-talisman-formation-system-plan.md).

Save legacy chỉ được migrate sau khi catalog vật liệu mới được chốt. Không xóa
item/building cũ một cách âm thầm.

## 3. Cấu trúc Địa Giới

### 3.1. Scope hiện tại: Địa Giới Thanh Vân

Phase hiện tại chỉ triển khai **một Địa Giới duy nhất là Thanh Vân**, quản lý đúng
ba cảnh giới:

1. Phàm Nhân
2. Luyện Khí
3. Trúc Cơ

Không author Địa Giới Kim Đan trở lên trong plan này. Contract vẫn dùng catalog
để sau này mở rộng mà không sửa engine. Cảnh giới Phàm Nhân, Luyện Khí và Trúc
Cơ trong Thanh Vân lần lượt gọi là local tier `low`, `middle`, `high`.

```ts
interface TerritoryDefinition {
  id: string
  name: string
  realmIds: readonly [RealmId, RealmId, RealmId]
  productionSiteIds: {
    forest: string
    mine: string
    grotto: string
  }
}
```

Mỗi `TerritoryDefinition` bắt buộc có đúng một Lâm, một Quáng và một Động Thiên.
Validator phải từ chối Địa Giới thiếu nguồn hoặc có nguồn trùng loại.

### 3.2. Quy tắc mở khóa

- Địa Giới mở khi người chơi đạt cảnh giới thấp nhất trong nhóm hoặc qua điều
  kiện progression riêng đã định nghĩa trong data.
- Người chơi chỉ sản xuất tại Địa Giới đã mở.
- Khi người chơi vượt cảnh giới cao nhất của Địa Giới, trọng số phần thưởng tại
  Địa Giới cũ được clamp ở profile `high`; nguồn cũ không tự biến thành nguyên
  liệu của Địa Giới mới.
- Mỗi nguồn có level riêng và giữ level khi người chơi đột phá.

## 4. Production cycle

### 4.1. State tối thiểu

Lâm, Quáng và Động Thiên dùng cùng một engine production:

```ts
type ProductionSiteKind = 'forest' | 'mine' | 'grotto'

interface ProductionCycle {
  cycleId: string
  siteId: string
  collectionRealmId: RealmId
  siteLevelAtStart: number
  rewardTableVersion: number
  rollSeed: number
  startedAtMs: number
  completesAtMs: number
}

interface ProductionSiteState {
  siteId: string
  level: number
  autoRestart: boolean
  activeCycle?: ProductionCycle
}
```

Khi bắt đầu cycle:

1. Snapshot cảnh giới đang thu thập (`collectionRealmId`) và level nguồn.
2. Snapshot version bảng reward và một RNG seed cho cycle.
3. Tính deadline chỉ từ cảnh giới đang thu thập và level nguồn.
4. Không roll trước loại, phẩm, niên đại hoặc số lượng reward.

Khi cycle hoàn thành, hệ thống mới dùng `rollSeed` và bảng đã snapshot để roll
toàn bộ reward. Mọi kết quả có cùng một thời lượng nếu chúng đến từ cùng
`collectionRealmId` và cùng site level. Quáng phẩm cao hay Linh Thảo nhiều năm
không làm cycle dài hơn.

### 4.2. Thời gian cơ sở theo cảnh giới đang thu thập

Baseline tăng gấp ba ở mỗi cảnh giới:

```text
Phàm Nhân: 100 giây
Luyện Khí: 300 giây
Trúc Cơ: 900 giây
Kim Đan: 2.700 giây
Nguyên Anh: 8.100 giây
Hóa Thần: 24.300 giây
...
```

Nguồn sự thật là một bảng balance theo `collectionRealmId`; không hard-code chuỗi
`100 * 3^realmIndex` tại call site để sau này có thể tune từng cảnh giới.

Level nguồn tạo speed multiplier:

```ts
cycleSeconds = ceil(baseSecondsByCollectionRealm / speedMultiplierBySiteLevel)
```

Baseline đề xuất để simulation ban đầu:

| Level | Speed multiplier | Thời gian so với level 1 |
|---:|---:|---:|
| 1 | 1.00 | 100% |
| 2 | 1.15 | 87% |
| 3 | 1.35 | 74% |
| 4 | 1.60 | 62.5% |
| 5 | 2.00 | 50% |

Các multiplier là balance data, chưa phải con số cuối. Nâng level khi cycle đang
chạy chỉ có hiệu lực từ cycle tiếp theo.

### 4.3. Hoàn thành, gửi Bag và Auto

- Khi `now >= completesAtMs`, reward được cộng thẳng vào `MaterialBag`.
- Ngay tại bước settle, roll realm material, phẩm/niên đại và số lượng bằng seed
  đã lưu; trước thời điểm này save chưa chứa kết quả reward.
- Claim không phải thao tác của người chơi và không có nút “Thu hoạch”.
- Transaction phải idempotent: reload/tick lặp không được cấp reward hai lần.
- Nếu `autoRestart = true`, hệ thống bắt đầu cycle mới ngay sau khi settle cycle
  trước và roll reward mới theo cảnh giới hiện tại tại thời điểm bắt đầu mới.
- Nếu Auto tắt, nguồn chuyển về `idle` sau khi gửi reward vào Bag.
- Offline progression settle tuần tự tất cả cycle hoàn thành trong offline cap.
  Mỗi auto-cycle phải có seed riêng rồi roll reward riêng; không lấy một reward rồi nhân
  với số cycle.
- Nếu Bag có giới hạn và đầy, reward đi vào pending delivery có giới hạn; không
  được xóa vật liệu hoặc tiếp tục auto vô hạn khi pending đã đầy.

## 5. Trọng số cảnh giới phần thưởng

### 5.1. Lâm và Quáng

Khi cycle hoàn thành, hệ thống roll đúng một trong ba realm tier của Thanh Vân.
Profile trọng số lấy từ `collectionRealmId` đã snapshot khi bắt đầu cycle.

| Cảnh giới đang thu thập | Gỗ/Quáng Phàm | Gỗ/Quáng Luyện Khí | Gỗ/Quáng Trúc Cơ |
|---|---:|---:|---:|
| Low, ví dụ Phàm Nhân | 60 | 20 | 10 |
| Middle, ví dụ Luyện Khí | 40 | 40 | 20 |
| High, ví dụ Trúc Cơ | 20 | 40 | 40 |

`60/20/10` được định nghĩa là **trọng số**, không phải phần trăm, vì tổng bằng
90. Resolver chuẩn hóa tổng trước khi roll; xác suất thực tương ứng là
`66,67% / 22,22% / 11,11%`. Hai hàng còn lại đã có tổng 100.

Không có no-drop. Một cycle hoàn thành luôn trả đúng một reward entry, trừ khi
save/data bị lỗi và transaction bị từ chối toàn bộ.

Level nguồn chỉ giảm thời gian, không tăng trọng số tier hoặc phẩm trong MVP.
Nhờ vậy level và cảnh giới có vai trò độc lập, dễ cân bằng expected yield/hour.

### 5.2. Catalog Lâm

Mỗi Lâm có đúng ba loại gỗ, mỗi loại gắn với một realm tier trong Địa Giới:

```ts
interface ForestRewardDefinition {
  materialId: string
  realmId: RealmId
  amount: number
}
```

Gỗ đi thẳng vào Bag và chỉ có hai nhóm sink chính:

- Xây hoặc nâng cấp building.
- Làm nhiên liệu đốt lửa trong công thức Đan Phòng.

Không biến Gỗ thành Phù Chỉ, Mực Phù hoặc processed wood trong scope hiện tại.

### 5.3. Catalog Quáng

Mỗi Quáng có đúng ba loại quáng thạch, mỗi loại gắn với một realm tier trong
Địa Giới. Quáng đi thẳng vào Bag và được tiêu thụ tại Khí Đường; không cần qua
Lò Luyện.

Sau khi roll loại Quáng theo realm, hệ thống roll thêm phẩm của quáng. Phẩm dùng
cùng ngôn ngữ Hoàng/Huyền/Địa/Thiên/Tiên nhưng là metadata của material, không
làm thay đổi `collectionRealmId` hoặc thời gian cycle:

```ts
type OreQuality = 'none'|'decade' | 'century' | 'millennium' | 'myriad_year'

interface MineRewardDefinition {
  materialId: string
  realmId: RealmId
  quality: OreQuality
  amount: number
}
```

Phẩm càng cao phải có trọng số càng thấp. Bảng weight cụ thể nằm trong balance
data của Thanh Vân và cần được chốt bằng simulation; engine chỉ enforce thứ tự về xác suất, không tự gán con số.

Phẩm quáng ảnh hưởng trực tiếp tới Tẩy Luyện:

- Phẩm cao tăng trọng số roll được nhiều dòng substat hơn, trong giới hạn quality
  của equipment.
- Phẩm cao tăng trọng số tier/chất lượng ban đầu của từng dòng substat.
- Phẩm quáng không bảo đảm tuyệt đối số dòng hoặc tier cao; kết quả vẫn là
  weighted roll.
- Tẩy Luyện dùng nhiều quáng thì recipe phải chốt một `effectiveOreQuality` rõ
  ràng; MVP khuyến nghị chỉ nhận một stack cùng material/phẩm để tránh trộn phẩm
  và exploit tính trung bình.

## 6. Động Thiên và Linh Thảo

### 6.1. Hai bước roll

Động Thiên dùng cùng trọng số realm tier như Lâm/Quáng, sau đó roll thêm:

1. `herbId`: loại linh thảo trong pool của realm đã roll.
2. `age`: niên đại của linh thảo.

Mỗi đan phương có đúng một `primaryHerbId` riêng. Không dùng một Linh Thảo chung
cho toàn bộ đan dược. Một loại thảo có thể có bốn biến thể niên đại nhưng vẫn
cùng identity/công dụng đan phương.

```ts
type HerbAge = 'none'|'decade' | 'century' | 'millennium' | 'myriad_year'

interface GrottoHerbDefinition {
  materialId: string
  realmId: RealmId
  pillRecipeId: string
  age: HerbAge
}
```

### 6.2. Niên đại và tỷ lệ thành đan

| Niên đại | Tên hiển thị | Tỷ lệ thành đan cơ sở |
|---|---|---:|
|không có tiền tố niên dại  | 10%|
| `decade` | Thập Niên | 30% |
| `century` | Bách Niên | 50% |
| `millennium` | Thiên Niên | 75% |
| `myriad_year` | Vạn Niên | 100% |

Đây là tỷ lệ cơ sở từ nguyên liệu trước bonus Đan Phòng. Niên đại là trục chất
lượng tương đương hướng tăng Hoàng -> Tiên của item, nhưng không tái sử dụng enum
`EquipmentQuality`; hai hệ có số bậc và ý nghĩa khác nhau.

Trọng số niên đại phải giảm dần khi chất lượng tăng. Baseline đề xuất:

| Niên đại | Trọng số |
|---|---:|
|không có tiền tố niên dại  | 35|
| Thập Niên | 25 |
| Bách Niên | 12.5 |
| Thiên Niên | 7.5 |
| Vạn Niên | 1 |

Đây là balance data cần simulation trước khi chốt. `collectionRealmId` quyết
định profile trọng số realm tier; niên đại được roll độc lập trong tier đã chọn
và chỉ được xác định khi cycle hoàn thành.

## 7. Khí Đường

Khí Đường chỉ còn bốn chức năng:

1. Cường Hóa slot.
2. Tẩy Luyện substat.
3. Tinh Luyện giá trị substat.
4. Hóa Luyện trang bị thành Tinh Hoa.

Các chức năng Rèn item, nâng phẩm, nâng cảnh giới item hoặc socket Phù/Trận trong
plan cũ không thuộc contract mới, trừ khi được đặc tả lại trong roadmap riêng.

### 7.1. Cường Hóa slot

- Cường Hóa gắn với equipment slot, không gắn với item instance.
- Giữ cơ chế/cấp hiện tại nếu không mâu thuẫn với economy mới.
- Cost được chuyển sang Quáng cùng cảnh giới mục tiêu và Linh Thạch.
- Đổi item trong slot không làm mất cấp Cường Hóa.

### 7.2. Điểm Rèn

- Tẩy Luyện và Tinh Luyện đều tiêu hao Điểm Rèn.
- Điểm Rèn là capacity/currency riêng của từng trang bị.
- Nguồn nhận, cap, tốc độ hồi và cost cụ thể phải được chốt bằng simulation trước
  phase triển khai. Không hard-code một nguồn tạm vào combat drop.
- Validation Điểm Rèn, Linh Thạch và material phải diễn ra trước; chỉ trừ toàn bộ
  sau khi operation thành công.

### 7.3. Tẩy Luyện — roll bộ substat

Tẩy Luyện thay đổi identity của substat trên item theo pool/tier hợp lệ; không
đổi main stat, quality, realm hoặc cấp Cường Hóa slot.

Chi phí bắt buộc:

- Điểm Rèn.
- Quáng thạch cùng cảnh giới với item.
- Linh Thạch.

Số dòng tối đa vẫn bị giới hạn bởi quality của item. Trong giới hạn đó, phẩm
Quáng quyết định bảng weighted roll cho:

1. Số dòng substat nhận được.
2. Tier/chất lượng ban đầu của từng dòng.

Ví dụ Quáng Hoàng thiên về ít dòng và tier thấp; Quáng Tiên có cơ hội cao hơn
để đạt số dòng tối đa và tier ban đầu cao, nhưng không bảo đảm kết quả hoàn hảo.
Hai bảng weight phải nằm trong data và được preview trên UI. MVP Tẩy Luyện không
khóa dòng; cơ chế khóa dòng thuộc Tinh Luyện bên dưới.

### 7.4. Tinh Luyện — nuôi giá trị substat

Tinh Luyện giữ nguyên identity của mọi substat và roll lại giá trị từng dòng
không khóa trong khoảng biến thiên `-20% .. +20%` so với giá trị hiện tại.
Kết quả vẫn phải clamp trong min/max hợp lệ của affix/tier.

Chi phí bắt buộc:

- Điểm Rèn.
- Tinh Hoa cùng tier/cảnh giới với item.
- Linh Thạch.

Cho phép chọn khóa substat. Một dòng bị khóa giữ nguyên identity và value, đồng
thời được tính gấp đôi trong cost. Với `N` dòng và `L` dòng khóa:

```ts
essenceCostUnits = N + L
spiritStoneCost = baseSpiritStonePerLine * (N + L)
```

Ví dụ item có bốn dòng:

| Dòng khóa | Tinh Hoa | Hệ số Linh Thạch |
|---:|---:|---:|
| 0 | 4 | 4x đơn giá mỗi dòng |
| 1 | 5 | 5x đơn giá mỗi dòng |
| 2 | 6 | 6x đơn giá mỗi dòng |
| 3 | 7 | 7x đơn giá mỗi dòng |
| 4 | Không cho phép | Không cho phép |

Không cho khóa toàn bộ vì operation sẽ không có dòng nào thay đổi. UI phải
preview cost sau khi chọn khóa và yêu cầu xác nhận vì kết quả có thể giảm chỉ số.

### 7.5. Hóa Luyện — phân giải trang bị

Hóa Luyện là thao tác destructive:

- Không cho Hóa Luyện item đang trang bị, item đang khóa hoặc item đặc biệt chưa
  có conversion rule.
- UI hiển thị khoảng Tinh Hoa nhận được và yêu cầu xác nhận.
- Thành công xóa đúng item instance rồi cộng Tinh Hoa trong cùng transaction.
- Không tiêu hao Điểm Rèn.

Hóa Luyện bắt buộc có bộ lọc trước khi chọn item, hỗ trợ tối thiểu:

- Equipment slot/type.
- Cảnh giới/tier trang bị.
- Quality Hoàng/Huyền/Địa/Thiên/Tiên.
- Trạng thái `đang trang bị`, `đã khóa`, `được đánh dấu yêu thích`.
- Có/không có substat và số dòng substat.
- Khoảng cấp item nếu hệ cấp item vẫn được giữ.

Mặc định loại khỏi danh sách item đang trang bị, đã khóa và yêu thích. Cho phép
chọn nhiều item sau khi filter, nhưng trước khi Hóa Luyện hàng loạt phải hiển thị
tổng số item, tổng khoảng Tinh Hoa theo từng tier và confirm lần cuối. Transaction
batch là all-or-nothing; không được xóa một phần item nếu cộng reward thất bại.

Tier Tinh Hoa lấy từ tier/cảnh giới trang bị, ví dụ `Phàm Khí Tinh Hoa`,
`Bảo Khí Tinh Hoa`. Số lượng lấy theo quality:

| Quality | Số Tinh Hoa |
|---|---:|
| Hoàng | 1–3 |
| Huyền | 2–4 |
| Địa | 3–5 |
| Thiên | 4–6 |
| Tiên | 5–7 |

Ví dụ Hoàng phẩm Phàm Khí trả 1–3 Phàm Khí Tinh Hoa; Tiên phẩm Bảo Khí trả
5–7 Bảo Khí Tinh Hoa. Mapping realm trang bị -> tên tier Tinh Hoa phải nằm trong
catalog riêng và được chốt trước khi author material.

## 8. Đan Phòng

### 8.1. Giữ đan phương, thay nguyên liệu

Giữ danh sách đan phương và tác dụng đã chốt từ thiết kế trước. Thay toàn bộ cost
nguyên liệu bằng ba nhóm:

1. Linh Thảo riêng của đan phương, có niên đại.
2. Gỗ làm nhiên liệu đốt lửa.
3. Linh Thạch.

```ts
interface AlchemyRecipe {
  id: string
  pillId: string
  primaryHerbId: string
  herbAmount: number
  fuelWoodRealmId: RealmId
  fuelWoodAmount: number
  spiritStoneCost: number
  baseDurationSeconds: number
}
```

Linh Thảo phải đúng `primaryHerbId`; không cho thay thảo khác chỉ vì cùng realm
hoặc cùng niên đại. Gỗ phải đạt ít nhất realm yêu cầu của recipe; dùng gỗ cao hơn
không tự tăng tỷ lệ thành đan trong MVP.

### 8.2. Thời gian luyện

Thời gian phụ thuộc đan phương/realm và level Đan Phòng:

```ts
alchemySeconds = ceil(recipe.baseDurationSeconds / alchemySpeedMultiplier[level])
```

Snapshot recipe, nguyên liệu, niên đại và level phòng lúc bắt đầu. Nâng Đan Phòng
giữa job chỉ tác động job kế tiếp. Nguyên liệu bị reserve/trừ atomically lúc bắt
đầu để không dùng một stack cho nhiều job.

### 8.3. Tỷ lệ thành đan và bonus sản lượng

```ts
totalSuccessPercent = herbAgeBasePercent + alchemyRoomSuccessBonus[level]
guaranteedPills = floor(totalSuccessPercent / 100)
extraPillChance = totalSuccessPercent % 100
```

Khi job hoàn thành:

- Luôn nhận `guaranteedPills`.
- Roll một lần theo `extraPillChance` để nhận thêm một viên.
- Nếu tổng dưới 100%, không có viên guaranteed và tỷ lệ đó quyết định nhận một
  viên hay thất bại.

Ví dụ:

- Thập Niên 30% + Đan Phòng 20% = 50% nhận một viên.
- Vạn Niên 100% + Đan Phòng 20% = chắc chắn một viên, 20% nhận viên thứ hai.
- Tổng 225% = chắc chắn hai viên, 25% nhận viên thứ ba.

Bonus thành công và speed của Đan Phòng là hai bảng riêng. Level cao không được
vừa giảm duration vừa tăng chance bằng một multiplier mơ hồ.

## 9. UI/UX

### 9.1. Màn hình Khám Phá/Sản Xuất

Mỗi Địa Giới hiển thị đúng ba card: Lâm, Quáng, Động Thiên. Mỗi card có:

- Level và hiệu ứng speed hiện tại/level kế.
- Trạng thái `idle | producing | completed/pending`.
- Đồng hồ cycle và thời điểm hoàn thành.
- Ba realm tier có thể nhận cùng trọng số đã chuẩn hóa.
- Với Quáng: trọng số phẩm và tác động dự kiến lên số dòng/tier khi Tẩy Luyện.
- Với Động Thiên: pool thảo và trọng số niên đại.
- Toggle Auto.
- Nút Start chỉ xuất hiện khi idle; không có nút Claim.

Khi cycle hoàn thành, notification ghi rõ vật liệu và số lượng đã gửi vào Bag.

### 9.2. Khí Đường

- Bốn tab đúng theo contract: Cường Hóa, Tẩy Luyện, Tinh Luyện, Hóa Luyện.
- Tẩy/Tinh hiển thị Điểm Rèn hiện có và toàn bộ cost trước xác nhận.
- Tinh Luyện cho tick khóa từng dòng, cập nhật cost tức thời và cảnh báo khoảng
  `-20% .. +20%`.
- Hóa Luyện có preview tier/range Tinh Hoa và confirm destructive.
- Hóa Luyện có filter type/realm/quality/lock/favorite/substat, hỗ trợ chọn nhiều
  và preview tổng reward theo từng tier trước batch confirm.

### 9.3. Đan Phòng

- Giữ nhóm đan phương hiện hành.
- Cho chọn niên đại của đúng Linh Thảo nếu Bag có nhiều biến thể.
- Preview thời gian, tỷ lệ tổng, số viên guaranteed và chance viên cộng thêm.
- Không dùng cụm “tỷ lệ thành công >100%”; UI diễn đạt `Chắc chắn N viên, X% thêm
  1 viên` để người chơi hiểu đúng.

## 10. Migration

Migration chỉ bắt đầu sau khi catalog mới và mapping economy được duyệt:

1. Bump save version.
2. Map Gỗ/Quáng raw và processed cũ về material trực tiếp mới theo realm; công
   thức quy đổi phải được ghi thành bảng, không parse tên ID.
3. Map Linh Thảo cũ sang đúng `primaryHerbId` và niên đại thấp nhất hợp lệ, hoặc
   hoàn nguyên thành currency nếu không xác định được đan phương.
4. Gỡ Dược Viên, Lò Luyện và Thiên Công Phường khỏi building manager sau khi
   hoàn trả cost xây/nâng theo bảng cố định.
5. Settle/cancel processing job legacy một lần, hoàn trả input chưa tiêu thụ.
6. Tạo state level 1 cho ba nguồn sản xuất của Địa Giới đã mở.
7. Migration phải idempotent và có fixture cho save đang chạy job/offline.

Không migrate Phù/Trận trong phase này; roadmap của chúng quản lý legacy riêng.

### 10.1. Đưa Phù/Trận legacy vào dĩ vãng

Hệ Phù/Trận gắn Equipment hiện tại phải được khai tử có kiểm soát, không chỉ ẩn
panel rồi để runtime cũ tiếp tục ảnh hưởng stats:

1. Đóng mọi nguồn tạo mới: recipe, loot, reward, tutorial và debug grant.
2. Khóa Phù Viện/Trận Đài cùng navigation/function gate ở runtime.
3. Gỡ toàn bộ modifier, trigger, stack, `bonusAffixSlots` và socket aggregation
   legacy khỏi đường tính stat/combat mới.
4. Đưa ID template cũ vào `LegacyItemCatalog` chỉ đọc để load được save cũ; không
   đăng ký chúng như content có thể sử dụng.
5. Unsocket/thu hồi state legacy bằng migration idempotent. Không xóa affix đã
   tồn tại trên equipment chỉ vì affix từng được mở bằng Phù.
6. Quy đổi item Phù/Trận cũ trong Bag và socket thành một currency hoàn nguyên
   hoặc Linh Thạch theo bảng compensation được duyệt sau; ghi conversion report
   cho người chơi.
7. Xóa UI bag section, action và code path legacy sau khi fixture migration của
   mọi save version liên quan đã xanh.
8. Giữ tombstone ID ít nhất một save version để save cũ không crash vì registry
   lookup; chỉ xóa vật lý khi telemetry/test xác nhận không còn consumer.

Phù Ultimate Kim Đan và Trận aura Nguyên Anh trong roadmap hậu kỳ là hai hệ thống
mới. Không tái sử dụng schema/socket/trigger legacy ngoài ID mapping migration.

## 11. Trình tự triển khai

### Phase 0 — catalog và balance contract

1. Chốt duy nhất Địa Giới Thanh Vân với Phàm Nhân/Luyện Khí/Trúc Cơ; chưa author
   Địa Giới tiếp theo.
2. Chốt tên ba Gỗ, ba Quáng cho Thanh Vân.
3. Chốt mapping một Linh Thảo riêng cho từng đan phương.
4. Chốt bảng cycle realm, speed level, age weight và output amount.
5. Chốt nguồn/cap/regen Điểm Rèn và mapping tier Tinh Hoa.

### Phase 1 — production engine

1. Tạo Territory/ProductionSite catalog và validator.
2. Implement snapshot reward, deadline, auto-restart và delivery idempotent.
3. Implement offline settlement có cap.
4. Làm UI ba nguồn/Địa Giới và notification Bag.

### Phase 2 — loại bỏ trung gian và migration

1. Bỏ runtime Dược Viên/Lò Luyện/Thiên Công Phường khỏi đường mới.
2. Bỏ raw->processed consumer mới.
3. Implement migration material, building và active job.
4. Chạy economy simulation trước/sau migration.
5. Thực hiện quy trình khai tử Phù/Trận legacy: đóng nguồn, gỡ runtime modifier,
   tombstone ID và chuẩn bị compensation report.

### Phase 3 — Khí Đường

1. Chốt lại bốn operation public.
2. Implement Tinh Hoa/Hóa Luyện transaction.
3. Implement Điểm Rèn và cost Tẩy/Tinh.
4. Implement khóa dòng, công thức `N + L` và roll `-20% .. +20%`.

### Phase 4 — Đan Phòng

1. Đổi recipe input sang thảo riêng + gỗ + Linh Thạch.
2. Implement niên đại và success/output formula.
3. Implement time/bonus theo level phòng.
4. Cập nhật preview và job settlement.

### Phase 5 — cân bằng và cleanup

1. Simulation expected material/hour cho mọi realm/profile/level.
2. Simulation sink/source Quáng, Tinh Hoa, Gỗ và Linh Thảo.
3. Playtest Auto/offline và xác nhận không time-bank exploit.
4. Xóa schema/alias legacy chỉ sau khi migration test xanh.

## 12. Test plan

### Production

- Mỗi Địa Giới có đúng một Lâm, Quáng, Động Thiên và đúng ba realm.
- Weight `60/20/10` normalize đúng; các bảng không có weight âm/tổng 0.
- Cycle snapshot reward/realm/level; đột phá hoặc nâng level giữa cycle không đổi
  deadline/profile reward.
- Hai reward khác phẩm/niên đại từ cùng collection realm và site level có thời
  gian cycle bằng nhau; chỉ collection realm hoặc site level mới đổi deadline.
- Hoàn thành gửi Bag đúng một lần; Auto tạo cycle mới, Auto tắt về idle.
- Offline settle từng cycle riêng, tuân cap và không nhân một roll.

### Khí Đường

- Tẩy Luyện đổi substat identity hợp lệ và trừ Điểm Rèn/Quáng/Linh Thạch atomic.
- Quáng phẩm cao dùng đúng bảng weight số dòng và tier ban đầu; vẫn tuân cap
  quality của equipment.
- Tinh Luyện giữ identity, giữ dòng khóa và clamp kết quả trong range.
- Cost bốn dòng khóa 0/1/2/3 lần lượt là 4/5/6/7 Tinh Hoa.
- Không cho khóa toàn bộ; validation fail không trừ gì.
- Hóa Luyện Hoàng/Tiên trả đúng range 1–3/5–7 và đúng tier Tinh Hoa.
- Không thể Hóa Luyện item đang equip/locked; retry không nhân Tinh Hoa.
- Filter Hóa Luyện kết hợp đúng nhiều điều kiện; batch preview và transaction
  all-or-nothing.

### Đan Phòng

- Mỗi recipe chỉ nhận đúng Linh Thảo riêng.
- Thập/Bách/Thiên/Vạn Niên cấp đúng baseline 30/50/75/100.
- 50% có thể thất bại hoặc ra một viên; 120% luôn một viên và có 20% viên hai;
  225% luôn hai viên và có 25% viên ba.
- Nâng phòng giữa job không đổi snapshot; job sau dùng level mới.
- Input reserve atomic và output không được cấp hai lần qua reload.

### Verification bắt buộc mỗi phase

- Vitest liên quan và simulation balance của phase.
- `npm.cmd run type-check`.
- `npm.cmd run build`.
- E2E cho Auto/offline delivery, Khí Đường destructive flow và Đan Phòng output.

## 13. Các điểm cần chốt trước khi code

Các nội dung sau chưa đủ dữ liệu để tự ý hard-code:

1. Tên và ranh giới Địa Giới sau Thanh Vân (không thuộc scope triển khai này).
2. Output amount mỗi cycle cho từng Gỗ/Quáng/Linh Thảo.
3. Bảng speed multiplier cuối cùng của level nguồn và Đan Phòng.
4. Trọng số niên đại và phẩm Quáng cuối cùng; `55/28/12/5` của Linh Thảo hiện
   chỉ là baseline simulation.
5. Nguồn nhận, cap, hồi phục và cost Điểm Rèn.
6. Mapping cảnh giới trang bị sang Phàm Khí/Bảo Khí/các tier Tinh Hoa tiếp theo.
7. Cost cụ thể của Cường Hóa, Tẩy Luyện, Tinh Luyện và công thức Đan.

Không bắt đầu author hàng loạt material/recipe trước khi bảy bảng trên được chốt.
