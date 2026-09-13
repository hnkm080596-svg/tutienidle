# Thiên Phú (Talent)

**Trạng thái:** Live.

Data: `data/talent/Talents.ts` (catalog v4). Effects: `core/talent/TalentEffects.ts`. Combat passives: `data/skill/TalentPassives.ts`. Roll UI: `services/character/CharacterCreationService.ts`.

## Luật

- Roll **9 thẻ**, chọn **đúng 1**, giữ cả đời — `player.selectedTalentIds[0]` là talent sống.
- `collectTalentEffects()` chỉ đọc **id ĐẦU** của `selectedTalentIds` — save edit chứa nhiều id không cộng dồn (hành vi có chủ đích, test khóa).
- Talent là "ngoại lệ của luật chơi", ngân sách sức mạnh ~+20–30% công suất cuối Trúc Cơ — không có talent cộng chỉ số thuần; mọi lợi thế kèm chi phí đối trọng.

## Nhóm chiến đấu (11 talent — ship M1)

Mỗi talent cấp 1 hidden passive skill (`talent_passive_*`) mà `GameManager` grant khi vào game qua `getTalentCombatPassiveSkillId()`:

| Talent | Chỉ số nuôi | Nhịp tích→bùng |
|---|---|---|
| Kiếm Quang | chí mạng | +1% crit/crit (10 tầng) → Kiếm Vực 8s mọi đòn crit |
| Phá Giáp | xuyên giáp | +2% xuyên/hit trúng (5 tầng/trận) |
| Tật Phong | tốc đánh | +2% tốc/kill không trần trong trận — trúng 1 đòn mất sạch |
| Trọng Kích | crit damage | +2% crit dmg/crit (3 tầng) → +30% sát thương cuối 8s |
| Hấp Linh | hút máu | hút ×2.5 hiệu lực — chỉ khi HP < 50% |
| Thạch Giáp | phòng thủ | +2% def/chặn đòn (10 tầng) → Thạch Nham 5s (−50% dmg nhận) |
| Vô Ảnh | né | +2% né/né (5 tầng) → Sát Na 6s (+30% crit, +20% tốc đánh) |
| Cẩn Thận | endurance | <35% HP: −10% dmg nhận; trên ngưỡng: +5% dmg nhận |
| Hộ Thể | Hộ Thuẫn | khiên vỡ nổ AoE 30% dung lượng đã mất + khiên hồi nhanh 5s |
| Thứ Phạt | gai | bị đánh +30% gai, phản +1 tầng Hận Thứ (5 tầng), 3s không bị đánh lụi |
| Bất Tử Thể | sinh tồn | 1 lần/trận đòn chí mạng không chết (giữ 1 HP), tẩy debuff + Tử Sinh Ngộ 10s. **Không áp trong Độ Kiếp** |

## Nhóm khác

- **Phàm Cốt** (easter egg, hiếm): `cultivation_speed −75%` cả đời — gate ẩn của Đại Đạo Trúc Cơ; thắng kiếp Đại Đạo chuyển thành **Phàm Nhân Chi Cốt** (+75% tốc tu vĩnh viễn). Xem [tribulation.md](./tribulation.md).
- **Ngộ Đạo**: `insight_per_cultivation` — 1 Cảm ngộ Tâm Pháp mỗi 2000 tu vi tích.
- **Trận Tâm / Phù Văn / Tiên Thiên Đạo Thể / Nghịch Thiên / Đại Trí Nhược Ngu / Phản Phác / Huyết Chiến** — effect đang rỗng (`effects: []`), là slot nội dung milestone sau.

## Tiêu thụ

Mọi consumer đọc qua getter tập trung trong `TalentEffects.ts` (ví dụ `getHealOnKillMaxHpPercent`, `getInsightGainMultiplier`, `getSpiritStoneGainMultiplier`, `getBodyRefinementProgressMultiplier`, `getCultivationSpeedMultiplier`) — không tự lặp vòng đọc effect. `SurviveLethalGuard` (`core/talent/SurviveLethalGuard.ts`) là primitive cho Bất Tử Thể.

## Liên quan

- [skills.md](./skills.md) — passive skill grant/revoke.
- [stats.md](./stats.md) — `sourceType: 'talent'`.
