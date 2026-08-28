import type { PlayerData } from '../player/Player'
import type { MaterialBag } from '../material/MaterialBag'
import type { PillBag } from '../pill/PillBag'
import type { FoundationType } from './FoundationType'

/**
 * ⚠️ PARKED (2026-08-27) — hệ Căn Cơ ẨN 4-tier cũ KHÔNG CÒN được gọi từ
 * luồng đột phá thật (xem useTribulation.ts's
 * triggerFoundationBreakthroughAction(), giờ dùng thẳng foundationType
 * cố định 'human'). Thiết kế hiện tại chốt: mốc 12 tầng là Nhân Đạo —
 * tu vi luôn chỉ là mốc thấp nhất, bỏ ra càng nhiều ở các gate khác
 * thì cấp đột phá/passive nhận lại càng tốt. Các cấp đột phá ẩn khác
 * (ví dụ 4 mức Kiến Cơ cho Luyện Khí → Trúc Cơ) sẽ được thiết kế sau;
 * giữ signature ổn định để quay lại, tạm trả baseline 'human'.
 *
 * HOOK TƯƠNG LAI — gate Đại Đạo Trúc Cơ (talent-direction-choice-plan.md
 * §4/§11, tác giả thiết kế điều kiện sau): thiên phú 'pham_cot' là một
 * gate — id stable contract, đọc qua `player.selectedTalentIds` chứa
 * `'pham_cot'`. Trận kiếp Đại Đạo sẽ là lôi kiếp khắc nghiệt hơn theo
 * foundationType, KHÔNG spawn quái kiếp.
 */
export function resolveFoundation(
  player: PlayerData,
  materialBag: MaterialBag,
  pillBag: PillBag,
  currentRealmCap: number | undefined,
): FoundationType {
  void player
  void materialBag
  void pillBag
  void currentRealmCap

  return 'human'
}
