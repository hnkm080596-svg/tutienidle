# Kế hoạch: Luồng thi triển kỹ năng, Power nguyên tố và hiển thị DoT

## 1. Mục tiêu

Thay đổi hệ thống theo một bộ quy tắc thống nhất cho mọi kỹ năng chủ động, mọi nguyên tố và mọi hiệu ứng DoT; không vá riêng `hoa_cau_thuat` hay `doc_chuong`.

Quyết định sản phẩm:

1. Mỗi CombatEntity chỉ thi triển một kỹ năng tại một thời điểm.
2. Tài nguyên được trừ khi bắt đầu niệm.
3. Cooldown chỉ bắt đầu khi lần niệm hoàn tất.
4. Scheduler xoay vòng công bằng theo thứ tự slot, bỏ qua kỹ năng chưa sẵn sàng.
5. Sát thương kỹ năng nguyên tố và DoT đều có ATK trong công thức nền.
6. Mỗi hành có một node Power đầu nhánh có level, dùng Cảm Ngộ để nâng.
7. Damage text của DoT được gom và hiển thị đúng 3 lần/giây, ở lớp/vị trí thấp hơn direct hit.

## 2. Những vấn đề hiện tại cần loại bỏ

- Scheduler luôn bắt đầu từ slot 0 và dừng ở skill ready đầu tiên, khiến slot sau có thể không bao giờ được dùng.
- Cooldown được commit ngay khi bắt đầu niệm; với cooldown ngắn hơn cast time, skill slot đầu đã ready ngay lúc cast xong và tiếp tục chiếm lượt.
- Elemental hit và DoT chỉ đọc `firePower`, `woodPower`... trong khi Power nền gần bằng 0; ATK và phần lớn tiến trình trang bị không đóng góp cho Pháp Tu.
- Node hiện là mua một lần, chỉ lưu bằng `purchasedNodeIds`; chưa có level/cost theo level.
- DoT gây damage theo fixed-step nhưng renderer làm tròn từng tick, tạo `-0` và quá nhiều damage text.

## 3. Công thức Skill Power dùng chung

### 3.1. Công thức component

Mọi component damage giữ tỷ lệ data-driven hiện có, nhưng nguồn damage nền đổi thành:

```text
Physical component  = ATK × physicalRatio
Element component   = (ATK + ElementPower[element]) × elementRatio
Primordial component = (ATK + PrimordialPower) × primordialRatio
```

Sau khi cộng các component mới áp các tầng hiện có:

```text
component mitigation/penetration
→ hệ số effect của skill
→ scaling thuộc tính
→ Skill Damage
→ crit/block/endurance/ward/final damage
```

Ví dụ skill `20% Physical + 80% Fire`:

```text
ATK × 0.20 + (ATK + Fire Power) × 0.80
```

Tổng ATK vẫn chỉ đóng góp 100% khi tổng component ratio bằng 1; không bị cộng hai lần.

### 3.2. Công thức DoT

Khi ailment được áp, snapshot DPS từ cùng nguồn Skill Power:

```text
DoT DPS = (ATK + ElementPower[element])
          × dpsRatio
          × Ailment Potency
          × các modifier riêng của ailment/path
          × mitigation DoT hiện có
```

- Vẫn snapshot tại thời điểm áp ailment.
- Stack, refresh, duration, resistance và reaction giữ nguyên ngữ nghĩa.
- Physical DoT dùng ATK; DoT nguyên tố dùng `ATK + Power hệ`.
- Tách hàm tính Skill Power dùng chung để direct hit và DoT không thể lệch công thức về sau.

## 4. State machine thi triển và cooldown

### 4.1. Bắt đầu cast

Chỉ bắt đầu khi entity sống, không bị khống chế, không đang cast, target hợp lệ, đủ tài nguyên và skill không cooldown.

Khi bắt đầu:

- Trừ mana/tài nguyên ngay một lần.
- Ghi `castingSkillId`, `castingSlotIndex`, `castTargetId`, thời gian cast.
- Không set `remainingCooldownBySlot` ở bước này.
- Phát `cast_start` như hiện tại.

`castingSlotIndex` phải được snapshot trực tiếp, không tra ngược loadout lúc hoàn tất; như vậy đổi loadout hoặc dữ liệu slot không làm thất lạc cooldown của lần cast đang chạy.

### 4.2. Hoàn tất cast

Khi cast time về 0:

1. Phát `cast_complete`.
2. Kiểm tra lại target/range theo policy hiện có.
3. Nếu hợp lệ, resolve toàn bộ effect đúng một lần.
4. Bắt đầu cooldown đầy đủ cho đúng slot đã snapshot.
5. Cập nhật con trỏ scheduler sang slot kế tiếp.
6. Xóa cast state.

Nếu target chết hoặc không còn hợp lệ, cast bị fizzle nhưng mana vẫn đã tiêu và cooldown đầy đủ vẫn bắt đầu. Đây vẫn là một lần niệm đã hoàn tất, đồng thời tránh vòng lặp cast lỗi liên tục.

Với skill tức thời (`castTime = 0`), begin và complete xảy ra trong cùng fixed-step; cooldown bắt đầu ngay sau khi effect resolve.

### 4.3. Khống chế và gián đoạn

- Giữ hành vi hiện tại: Choáng/Đóng Băng tạm dừng đồng hồ cast, không hủy cast.
- Không cho skill thứ hai bắt đầu khi `castingSkillId` còn tồn tại.
- Nếu sau này có cơ chế hủy cast thật, nó phải có policy cooldown riêng; không trộn vào thay đổi lần này.

## 5. Scheduler xoay vòng theo slot

Battle giữ một con trỏ runtime `nextSkillSlotIndex`, khởi tạo về slot thấp nhất khi bắt đầu trận.

Mỗi lần được phép chọn skill:

1. Lấy các loadout entry theo thứ tự slot.
2. Bắt đầu duyệt từ `nextSkillSlotIndex`, đi đến cuối rồi vòng về đầu.
3. Bỏ qua entry thiếu execution policy, đang cooldown, thiếu tài nguyên hoặc không có target hợp lệ.
4. Bắt đầu tối đa một skill.
5. Chỉ sau khi bắt đầu thành công mới dời con trỏ tới slot vật lý kế tiếp.

Ví dụ slot `[Hỏa Cầu, Độc Chưởng]`:

```text
Hỏa Cầu → Độc Chưởng → Hỏa Cầu → Độc Chưởng
```

Nếu Độc Chưởng chưa ready, scheduler được phép bỏ qua và dùng skill ready tiếp theo. Con trỏ không tự reset về slot 0 mỗi fixed-step.

Không cast song song. Các cơ chế summon, channel phụ hoặc proc tự động trong tương lai phải đi qua event/passive riêng, không giả làm một active cast thứ hai.

## 6. Node Power nguyên tố có level

### 6.1. Hạ tầng node level dùng chung

Mở rộng `ProgressionNode` theo hướng data-driven:

```ts
maxLevel?: number // mặc định 1
upgradeCost?: {
  base: number
  perLevel: number
}
```

Player lưu một nguồn sự thật duy nhất:

```ts
nodeLevels: Record<string, number>
```

Quy ước:

- Level 0: chưa lĩnh ngộ.
- Level >= 1: đã lĩnh ngộ và thỏa prerequisite.
- `maxLevel` mặc định là 1, nên toàn bộ node cũ giữ hành vi mua một lần.
- `node`, `nodeCount` và `excludesNode` kiểm tra qua level thay vì một danh sách boolean riêng.
- Development build không cần migration save cũ; cập nhật save schema trực tiếp.

Không tiếp tục cộng modifier bằng cách push lặp vào `player.modifiers`. Modifier từ node phải được suy ra từ `nodeLevels` và node registry, với level đóng vai trò stack. Điều này tránh modifier trùng ID, cộng hai lần khi load và xung đột với modifier trang bị.

Effect mở khóa skill/element chỉ chạy ở chuyển tiếp `0 → 1`. Effect tăng chỉ số chạy theo level hiện tại.

### 6.2. Một node Power sớm cho mỗi hành

Chuyển node cường độ đầu nhánh của từng hành thành node có level:

- Hỏa: Fire Power.
- Mộc: Wood Power.
- Thủy: Water Power.
- Kim: Metal Power.
- Thổ: Earth Power.
- Phong/Lôi dùng cùng khuôn khi nhánh đó được mở.

Giá trị cân bằng ban đầu để playtest:

```text
maxLevel: 10
+2 flat Element Power mỗi level
cost level kế: 1 + floor(currentLevel / 3) Cảm Ngộ
```

Dãy cost dự kiến cho level 1→10: `1, 1, 1, 2, 2, 2, 3, 3, 3, 4`.

Lý do dùng flat Power ở node đầu: phần trăm của một Power nền rất nhỏ gần như không có tác dụng. Các node phần trăm hoặc multiplier phù hợp hơn ở tầng sau, khi build đã có Power từ node và trang bị.

UI node cần hiển thị:

- `Cấp hiện tại / cấp tối đa`.
- Power nhận mỗi cấp và tổng Power đang nhận.
- Chi phí cấp kế tiếp.
- Nút `Lĩnh Ngộ` ở level 0, đổi thành `Nâng Cấp` từ level 1.
- Trạng thái `Tối đa` khi đạt maxLevel.

### 6.3. Rework toàn bộ Skill Tree Pháp Tu

Đợt thay đổi này đồng thời rework gameplay graph của Skill Tree Pháp Tu. Không chỉ chuyển riêng năm node Power sang có level rồi giữ nguyên các minor khác ở trạng thái mua một lần.

Mục tiêu của cây mới:

- Mỗi hành có cùng một bộ khung dễ học nhưng giữ mechanic riêng.
- Người chơi có trục tăng trưởng dài bằng Cảm Ngộ, thay vì mua hết các minor chỉ sau vài điểm.
- Skill level và node level có vai trò khác nhau, không cộng hai hệ thống trùng nghĩa.
- Major node thay đổi cách chơi; minor node tăng dần sức mạnh hoặc độ ổn định.
- Reaction build và Pure build tiếp tục loại trừ nhau ở Trúc Cơ.
- Mọi effect phải data-driven; combat không `if (nodeId === ...)` theo từng node cụ thể.

### 6.4. Bộ khung chung cho mỗi hành

Mỗi nhánh Hỏa/Mộc/Thủy/Kim/Thổ dùng cấu trúc sau:

```text
Root Lĩnh Ngộ (1 cấp)
├── Power nền (10 cấp)
├── Nhịp thi triển/tài nguyên (5 cấp)
├── Cơ chế đặc trưng của hành (5 cấp)
└── Trúc Cơ: chọn 1 trong 2 Major (mỗi Major 1 cấp)
    ├── Nhánh Reaction: 2–3 minor, mỗi node 5 cấp
    └── Nhánh Pure:     2–3 minor, mỗi node 5 cấp
```

Quy ước loại node:

- `root`: maxLevel 1, mở element và/hoặc active skill.
- `growth`: maxLevel 5 hoặc 10, tăng chỉ số tuyến tính theo level.
- `keystone`: maxLevel 1, thay đổi behavior/tag của skill, có thể loại trừ keystone đối diện.
- `specialization`: maxLevel 5, chỉ có hiệu lực sau keystone cha.

Mở rộng `NodeType` thành semantic rõ hơn hoặc thêm field `role`; không tiếp tục suy luận behavior chỉ từ tên `minor/major`. Presentation vẫn có thể quy `root/keystone` thành node lớn và `growth/specialization` thành node nhỏ.

### 6.5. Phân vai Skill Level và Node Level

Skill vẫn có level riêng và nâng bằng Cảm Ngộ trong `SkillDetailView`:

- Skill level tăng phần hiệu lực nền của chính skill theo curve hiện có: direct multiplier, DoT ratio hoặc giá trị effect phù hợp.
- Node Power tăng `Element Power` của nhân vật cho mọi skill/ailment cùng hành.
- Node nhịp tăng Cast Speed, giảm mana hoặc điều chỉnh cadence theo giới hạn data.
- Node mechanic tăng application, duration, potency, stack hoặc tài nguyên riêng của hành.
- Keystone thay đổi behavior, không dùng để cộng một lượng damage phần trăm nhỏ.

Không để cùng một khoản đầu tư vừa tăng skill base damage qua skill level vừa tăng lại đúng hệ số đó qua một node có tên khác. Tooltip phải nói rõ bonus thuộc `skill`, `element` hay `ailment`.

### 6.6. Chuyển đổi các node hiện có

Giữ identity và tên gọi tốt của cây hiện tại, nhưng đổi vai trò/cấp độ theo khuôn chung:

| Nhánh | Root 1 cấp | Power 10 cấp | Growth đặc trưng 5 cấp | Hai Keystone Trúc Cơ |
|---|---|---|---|---|
| Hỏa | Hỏa Cầu Thuật | Hỏa Linh | Xích Viêm, Tật Hỏa | Dẫn Hỏa / Tụ Hỏa |
| Mộc | Độc Chưởng | Độc Nguyên | Độc Tức, Độc Thực | Độc Dẫn / Mộc Thế |
| Thủy | Thủy Tiễn Thuật | Thủy Linh | Thủy Tốc, Thủy Dẫn | Dẫn Lưu / Tụ Thủy |
| Kim | Điểm Kim Thuật | Kim Khí | Huyết Ấn, Điểm Huyệt | Huyết Dẫn / Kim Thế |
| Thổ | Thổ Cầu Thuật | Thổ Nguyên | Thổ Tốc, Chấn Lực | Định Thổ / Thổ Thế |

Các minor sau Keystone hiện có được giữ đúng nhánh cha và chuyển thành specialization 5 cấp. Trước khi author số liệu, cần rà từng modifier để chọn một trong ba kiểu tăng:

```text
flatPerLevel
percentPerLevel
behaviorThreshold (mở thêm behavior ở một level xác định)
```

Không nhân lặp trực tiếp một effect boolean qua năm level. Với behavior boolean, level 1 mở behavior; level 2–5 tăng tham số liên quan bằng field số.

### 6.7. Cost và economy Cảm Ngộ

Mọi cost phải nằm trong data node, không hard-code theo element hoặc ID.

Baseline playtest:

- Root Hỏa miễn phí như hiện tại; root bốn hành còn lại giữ chi phí mở hành theo balance hiện hành.
- Power node 10 cấp dùng dãy `1,1,1,2,2,2,3,3,3,4`.
- Growth/specialization 5 cấp dùng dãy khởi điểm `1,1,2,2,3`.
- Keystone mua một lần, baseline 2 Cảm Ngộ.
- UI luôn hiển thị cost cấp kế tiếp, không hiển thị tổng cost như giá của một lần mua.

Trước khi chốt số, chạy simulation Cảm Ngộ nhận được từ Luyện Khí và Trúc Cơ. Mục tiêu là người chơi phải lựa chọn hướng đầu tư, không thể max toàn bộ năm hành trong một lượt tiến trình bình thường.

### 6.8. Hiệu lực node phải được suy ra, không mutate vĩnh viễn

Hiện tại `purchaseNode()` có cả đường push `StatModifier` vào Player và đường sửa trực tiếp field trên Skill instance. Cách này không phù hợp với node nhiều cấp vì dễ cộng lặp, khó hoàn điểm và khó kiểm chứng sau load.

Rework dùng pipeline thuần:

1. `nodeLevels` là state đã đầu tư.
2. Node registry là data định nghĩa effect mỗi cấp.
3. Một aggregator suy ra toàn bộ character modifier và skill runtime modifier từ `(registry, nodeLevels)`.
4. Battle snapshot đọc kết quả aggregator; không đọc lịch sử các lần bấm nâng.
5. Tăng/giảm/reset level rồi recompute luôn cho cùng một kết quả xác định.

Effect mở skill/element vẫn là transaction một lần tại level 1, nhưng effect số không được ghi cộng dồn vào Skill template.

### 6.9. Phối hợp với Skill Constellation

Gameplay graph mới là nguồn quyết định prerequisite. Presentation tiếp tục theo kế hoạch [Skill Constellation dạng chữ Hán](../docs/skill-constellation-glyph-plan.md): năm hành tạo thành `火 木 水 金 土`, nhưng phải author lại layout sau khi danh sách node/cạnh của rework được chốt.

Thứ tự bắt buộc:

1. Chốt danh sách node, role, maxLevel, prerequisite và exclusion.
2. Chốt effect/cost data và test graph.
3. Ánh xạ mỗi node vào đúng một constellation point.
4. Vẽ glyph stroke riêng với prerequisite edge như hai lớp độc lập.
5. Thực hiện visual QA sau khi node có badge level thật.

Constellation node cần thể hiện thêm:

- Badge `current/max` cho node nhiều cấp.
- Progress ring theo tỷ lệ level.
- Purchased một phần khác với Maxed.
- Halo purchasable khi đủ cost cấp kế.
- Keystone excluded có ký hiệu riêng, không chỉ giảm opacity.

Test layout phải thất bại nếu rework thêm/bớt node mà chưa cập nhật glyph mapping. Không giữ layout 10–11 node hiện tại như một contract gameplay bất biến.

### 6.10. Reset và hoàn điểm trong development

Trong thời gian cân bằng rework, cung cấp hành động debug/development reset một nhánh và hoàn đúng lượng Cảm Ngộ đã tiêu, suy ra từ lịch sử level/cost data. Không xây economy respec production trong scope này.

Reset phải:

- Chỉ dùng ngoài combat.
- Không hoàn root miễn phí thành điểm âm/dương sai lệch.
- Gỡ level specialization khi gỡ Keystone cha.
- Recompute modifier thay vì cố trừ ngược modifier đã cộng trước đó.
- Không cho trạng thái node con còn level khi prerequisite cha về 0.

## 7. Hiển thị DoT đúng 3 lần/giây

### 7.1. Gameplay không đổi tick rate

DoT vẫn trừ HP theo fixed-step để duration, kill timing, leech và reaction chính xác. Chỉ giảm tần suất trình diễn damage text.

### 7.2. Bộ gom ở renderer

CombatScene tạo accumulator theo khóa tối thiểu:

```text
targetId + dotType + sourceId
```

- Nhận mọi damage event có reason `dot`.
- Cộng dồn giá trị trong cửa sổ `1 / 3 giây`.
- Mỗi 333,33 ms flush đúng một damage text cho mỗi khóa.
- Xóa accumulator khi target chết, battle kết thúc hoặc scene shutdown.
- Direct hit vẫn hiện ngay và không đi qua accumulator.

Damage text DoT dùng anchor thấp hơn direct hit, ví dụ vùng thân dưới/chân, và depth thấp hơn text direct hit để hai loại không đè nhau. Nếu body-anchor mapping đã có, dùng anchor semantic `lower_body`; nếu chưa có thì dùng offset riêng từ entity anchor, không hard-code world position.

Định dạng số:

- Tổng bucket >= 1: làm tròn theo formatter hiện có.
- Tổng bucket > 0 và < 1: hiện một chữ số thập phân.
- Tuyệt đối không hiển thị `-0`.

Event damage DoT cần mang `dotType/effectId`; nếu contract hiện tại chưa chuyển đủ thông tin tới renderer thì mở rộng event dùng chung, không suy luận loại DoT từ màu hay tên VFX.

## 8. Thứ tự triển khai

### Phase A — Công thức damage dùng chung

1. Tạo helper tính base power cho physical/element/primordial component.
2. Chuyển elemental direct hit sang `ATK + Element Power`.
3. Chuyển snapshot DoT sang cùng helper/ngữ nghĩa.
4. Kiểm tra mixed component không double-count ATK.

### Phase B — Cast transaction và cooldown

1. Tách `consumeResource()` khỏi `startCooldown()`.
2. Snapshot slot khi bắt đầu cast.
3. Chuyển commit cooldown sang completion/fizzle.
4. Chuẩn hóa instant skill qua cùng transaction.

### Phase C — Scheduler round-robin

1. Thêm cursor runtime vào battle/player combat state.
2. Duyệt loadout dạng vòng tròn.
3. Chỉ advance sau một begin-cast thành công.
4. Reset cursor khi bắt đầu/kết thúc trận.

### Phase D — Skill Tree và node level tổng quát

1. Thêm schema `maxLevel`, cost theo level và `nodeLevels`.
2. Chuyển prerequisite/purchase API sang level.
3. Tách modifier node khỏi modifier trang bị và suy ra theo level.
4. Phân loại root/growth/keystone/specialization và re-author cả năm nhánh theo cùng bộ khung.
5. Chuyển node Power đầu nhánh sang level 1–10; các minor growth/specialization sang level 1–5.
6. Rà lại effect boolean, threshold và skill runtime modifier để không nhân lặp sai.
7. Cập nhật Node Inspector/Node Tree và save schema.
8. Chạy simulation economy Cảm Ngộ trước khi chốt cost.

### Phase E — Constellation theo graph mới

1. Chốt tọa độ `火 木 水 金 土` sau khi gameplay graph ổn định.
2. Ánh xạ mọi node đúng một lần và validate stroke/prerequisite.
3. Hiển thị level badge/progress ring/Maxed/Excluded.
4. Kiểm tra keyboard, responsive và reduced motion theo plan Constellation.

### Phase F — DoT presentation

1. Bổ sung metadata cho damage event nếu thiếu.
2. Thêm accumulator 333,33 ms trong CombatScene.
3. Đặt anchor/depth thấp hơn direct hit.
4. Xử lý số nhỏ và lifecycle cleanup.

## 9. Kiểm thử bắt buộc

### Damage

- Pure Fire dùng đúng `ATK + Fire Power`.
- Pure Wood và các hành còn lại dùng đúng Power tương ứng.
- Mixed Physical/Element không double-count ATK.
- Kháng/Xuyên chỉ tác động component tương ứng.
- DoT snapshot cả ATK và Element Power tại lúc apply.
- Thay stat sau khi apply không sửa ngược DPS của ailment đang chạy.

### Cast/cooldown

- Mana bị trừ lúc bắt đầu cast, đúng một lần.
- Cooldown bằng 0 trong lúc đang niệm và nhận đủ giá trị khi complete.
- Fizzle vẫn tiêu mana và bắt đầu cooldown.
- Choáng tạm dừng cast; không có cast thứ hai chen vào.
- Instant skill resolve rồi mới bắt đầu cooldown.
- Đổi loadout trong lúc niệm không làm cooldown gắn nhầm slot.

### Scheduler

- Hai skill cùng mana/cast time/cooldown lần lượt được dùng `0,1,0,1`.
- Skill chưa ready bị bỏ qua, skill ready sau nó vẫn dùng được.
- Một fixed-step bắt đầu tối đa một active skill.
- Trận mới reset vòng xoay về slot đầu.
- Không còn starvation khi slot 0 luôn ready.

### Node level

- Level 0→1 mở node và effect unlock chỉ chạy một lần.
- Nâng nhiều cấp trừ đúng Cảm Ngộ theo từng cấp.
- Không vượt maxLevel và thất bại không mutate state.
- Prerequisite coi level >=1 là đã lĩnh ngộ.
- Modifier Power bằng `perLevel × currentLevel`, không nhân đôi sau recompute/load.
- Cả năm node Ngũ Hành dùng cùng schema, không có nhánh xử lý riêng theo ID.
- Root/keystone chỉ có một cấp; mọi growth/specialization đạt đúng maxLevel từ data.
- Skill level và node level tác động hai lớp khác nhau, không double-scale cùng một effect.
- Aggregator cho cùng kết quả bất kể node được nâng theo thứ tự nào.
- Reset development hoàn đúng tổng Cảm Ngộ và không để node con mồ côi.

### Skill Tree/Constellation

- Năm hành tuân theo cùng skeleton nhưng giữ mechanic riêng.
- Hai Keystone Trúc Cơ của mỗi hành loại trừ nhau ở cả core lẫn UI.
- Mọi node gameplay xuất hiện đúng một lần trong glyph tương ứng.
- Badge level, progress ring, purchasable, maxed và excluded phản ánh state thật.
- Thay đổi graph mà quên sửa layout làm test integrity thất bại.

### DoT presentation

- Nhiều fixed tick trong 333,33 ms chỉ sinh một damage text cho mỗi khóa.
- Tổng damage hiển thị bằng tổng event đã gom.
- Tần suất flush là 3 lần/giây với clock mô phỏng ổn định.
- Direct hit vẫn hiện ngay.
- Damage nhỏ không hiện `-0`.
- Accumulator được dọn khi chết/end/shutdown.

## 10. Tiêu chí hoàn thành

- Loadout hai skill Hỏa Cầu/Độc Chưởng tự động luân phiên khi cả hai đủ điều kiện.
- Không có hai active cast chạy đồng thời.
- Cooldown chỉ bắt đầu sau completion, kể cả completion bị fizzle.
- ATK đóng góp cho mọi elemental direct hit và elemental DoT theo công thức chung.
- Mỗi hành có đúng một node Power đầu nhánh nâng được 10 cấp bằng Cảm Ngộ.
- Toàn bộ minor growth/specialization trong Skill Tree dùng level data-driven; root/keystone giữ một cấp.
- Skill Tree Pháp Tu hoàn chỉnh dùng graph mới và constellation `火 木 水 金 土` tương ứng.
- DoT trừ HP chính xác theo fixed-step nhưng chỉ tạo damage text 3 lần/giây ở lớp thấp hơn.
- Toàn bộ test liên quan, `npm.cmd run type-check` và `npm.cmd run build` đều qua.

## 11. Ngoài phạm vi

- Không thêm cast song song, spell queue thủ công hay interrupt/cancel chủ động.
- Không cân bằng cuối cùng toàn bộ hệ số skill/DoT; các con số node là baseline để playtest và phải qua simulation Cảm Ngộ.
- Không xây hệ thống respec production; chỉ có reset development phục vụ cân bằng.
- Không làm save migration vì project đang ở development build.
- Không thay đổi animation hoặc asset VFX trong đợt này.
