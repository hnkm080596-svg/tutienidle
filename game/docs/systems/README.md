# Tài liệu hệ thống — Tiên Hiệp Idle

Bộ tài liệu này mô tả **từng chức năng/hệ thống đang chạy trong code hiện tại**, mỗi file một hệ thống. Nguồn sự thật là `src/` — khi tài liệu và code khác nhau, code thắng (và tài liệu cần được cập nhật).

Nhãn trạng thái dùng xuyên suốt:

- **Live** — đang wired vào runtime người chơi.
- **Primitive** — core/data đã implement + test, chưa chắc đã có UI/người chơi chạm tới.
- **Placeholder** — data/type tồn tại nhưng chưa có nội dung/gate thật.
- **Parked/Future** — spec có, code chưa hoặc không còn wired.
- **Legacy** — code cũ còn sót, không phải authority hiện tại.

## Mục lục

### Kiến trúc & vòng đời

- [architecture.md](./architecture.md) — phân lớp, luật authority, sơ đồ module
- [game-loop.md](./game-loop.md) — boot, tick loop, autosave, offline progress
- [idle-and-autofarm.md](./idle-and-autofarm.md) — GameClock, offline progress, auto-farm
- [save-load.md](./save-load.md) — GameSave shape, versioning, restore order, cloud save

### Tu luyện & tiến trình

- [cultivation.md](./cultivation.md) — tu vi, đột phá tiểu cảnh giới, điểm thuộc tính
- [realms.md](./realms.md) — đại cảnh giới, realm passive, realm pressure
- [body-refinement.md](./body-refinement.md) — Luyện Thể 6 tầng (Phàm Nhân)
- [meridians.md](./meridians.md) — Kỳ Kinh Bát Mạch (Luyện Khí)
- [tribulation.md](./tribulation.md) — Độ Kiếp (đột phá đại cảnh giới), Kiến Cơ grades
- [talents.md](./talents.md) — Thiên Phú (roll 9 chọn 1)
- [cultivation-paths.md](./cultivation-paths.md) — Pháp Tu / Kiếm Tu, route, Kiếm Ý
- [techniques.md](./techniques.md) — Tâm Pháp
- [node-tree.md](./node-tree.md) — cây công pháp / skill nodes

### Chiến đấu

- [combat-overview.md](./combat-overview.md) — turn battle engine, phase, wave, ATB
- [damage-pipeline.md](./damage-pipeline.md) — resolveHit, armor/resistance/ward/endurance, crit
- [stats.md](./stats.md) — StatType, StatModifier, StatCalculator
- [skills.md](./skills.md) — skill system, cast count, execution policy
- [buffs.md](./buffs.md) — BuffSystem, ailment, stack, DoT
- [elements-reactions.md](./elements-reactions.md) — Ngũ Hành, phản ứng
- [enemies-stages.md](./enemies-stages.md) — enemy data, stage/zone, boss phase, quái ẩn
- [drops-loot.md](./drops-loot.md) — drop table, loot, reward, notification
- [rewards.md](./rewards.md) — RewardSystem, realm reward scale, roll primitive, battle summary

### Trang bị & vật phẩm

- [equipment.md](./equipment.md) — instance, quality/rarity, affix, 6 slot, Khí Đường
- [talisman-formation-sockets.md](./talisman-formation-sockets.md) — Phù/Trận socket trên slot (parked)
- [inventory.md](./inventory.md) — túi đồ, stack limit, Linh Thạch
- [pills.md](./pills.md) — đan dược, effect, dùng đan

### Kinh tế & sản xuất

- [production.md](./production.md) — 3 nguồn Lâm/Quáng/Động Thiên, worker
- [decompose.md](./decompose.md) — Phân Giải linh khoáng
- [buildings.md](./buildings.md) — 5 công trình
- [vendor.md](./vendor.md) — Ký Bảo Các (Hóa Bán)
- [alchemy.md](./alchemy.md) — Đan Phòng luyện đan
- [profession-grades.md](./profession-grades.md) — thang phẩm nghề Cửu→Tiên

### Hệ thống phụ

- [artifact.md](./artifact.md) — Bản Mệnh Pháp Bảo (Ngũ Hành Châu)
- [companions.md](./companions.md) — đồng đội gacha + Trận Pháp
- [quests.md](./quests.md) — nhiệm vụ once/daily
- [world-map.md](./world-map.md) — hex map primitive (scaffolded)

### Presentation

- [presentation.md](./presentation.md) — GamePresentationCoordinator, Phaser scene, combat UI
- [ui-and-i18n.md](./ui-and-i18n.md) — panel/overlay, store, i18n vi/en, format
