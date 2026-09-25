# Cây công pháp / Node Tree

**Trạng thái:** Live — cách chính để mở skill và chỉ số cho cả 2 path.

Core: `core/progression/ProgressionNode.ts`, `NodeSystem.ts`, `NodeRegistry.ts`. Data: `data/progression/PhapTuNodes.ts`, `KiemTuNodes.ts`. UI: `components/panels/SkillPathPanel.vue` (standalone `skill`) → `NodeTreePanel.vue` + `NodeInspector.vue` + `SkillConnections.vue`.

## Mô hình node

`ProgressionNode`: `id`, `type` (`minor` | `major`; major còn gọi keystone/root), `insightCost`, `prerequisites`, `effect`, `maxLevel`, `upgradeCost`, `branchTag` (vd `kiem_pho`, `ngu_kiem`).

**State nguồn sự thật: `player.nodeLevels`** — `nodeLevels[nodeId]` = 0 nghĩa là chưa lĩnh ngộ; ≥1 là đã mua. `player.purchasedNodeIds` giữ tương thích hiển thị. Modifier **không** push vĩnh viễn vào `player.modifiers` nữa — suy ra lúc recompute qua `aggregateNodeStatModifiers()`/`aggregateNodeSkillModifiers()` → restore không bị cộng đôi.

## Mua & nâng cấp

- Tiền tệ: **Cảm ngộ Kỹ năng** (`player.skillInsight`, rớt từ combat).
- `GameManager.purchaseNode()` kiểm tra: node tồn tại → prerequisite → level < max → đủ insight → trừ insight → `nodeLevels[id]++` → áp effect.
- Nâng cấp: `getNextLevelCost` = `upgradeCost.base + floor(level / upgradeCost.perLevel)` (node không khai `upgradeCost` thì mọi lần mua/nâng tốn `insightCost`).

## Prerequisite (AND — mọi phần tử phải thoả)

| kind | Nghĩa |
|---|---|
| `realm` | đại cảnh giới ≥ `realmId` |
| `element` | hành đã unlock (`player.unlockedElements`) |
| `node` | node `nodeId` đã mua (level ≥ 1) |
| `nodeCount` | ≥ `countRequired` node trong `nodeIds` đã mua (any-N-of-M) |
| `excludesNode` | node `nodeId` **chưa** mua — XOR giữa 2 major (vd Dẫn Hỏa / Tụ Hỏa) |
| `skillCastCount` | skill đạt `level` và/hoặc `count` cast (`skillCastCounts`) — vd gate theo số lần trảm |

## Effect (`NodeEffect`)

- `statModifiers` — StatModifier chuẩn vào pipeline nhân vật.
- `skillModifiers` — ghi thẳng field trên instance `Skill` (`SkillResourceStatKey`, flat/percent/perLevel*), không qua modifier nhân vật.
- `unlocksElement` — mở hành Ngũ Hành (thêm vào `unlockedElements`).
- `unlocksSkillIds` — cấp cả bộ skill của hành/route (3 active + passive).
- on-hit / trigger fields cho Kiếm Thế, Kiếm Ý (xem [cultivation-paths.md](./cultivation-paths.md)).

## Cây Pháp Tu

`PhapTuNodes.ts` build theo `ElementBranchSpec`: mỗi hành có root (unlock hành + bộ skill), node `power` (cộng `${element}Power`), growth/minor theo chuỗi, 2 keystone XOR (`keystoneReaction` vs `keystonePure`), rồi specialization 5 cấp treo dưới keystone. Keystones reaction-path unlock thêm `reaction_path_unlock_*`.

## Cây Kiếm Tu

`KiemTuNodes.ts` (sau khi route Kiếm Trận/Bạt Kiếm retire): nhánh `kiem_pho` — 5 orb branches của way `sword_pathway` (Kiếm Phổ), mỗi branch ~5 node + 1 capstone; subtree `ngu_kiem` — cascade + các node cung (Khảm/Khôn/Chấn/Tốn/Càn/Đoài...) của way `hidden_sword_pathway` (Ngự Kiếm Đạo), gate realm + `kiemYGrant`. Data cây Thể Tu (`TheTuNodes.ts`/`TheTuAnNodes.ts`) đã có mặt nhưng path chưa mở trên master — xem `roadmap.md` mục path-beta wave.

## Animation mua node

`SkillPathPanel.vue` phát `unlockTrigger`; `NodeTreePanel` đo tâm node (`getBoundingClientRect` + `ResizeObserver`); `SkillConnections.vue` vẽ SVG 3 trạng thái `locked`/`active`/`unlocking` với dash-offset chạy parent→child, node pulse khi tới. Thuần presentation — outcome đã xong ở `purchaseNode`.

## Liên quan

- [cultivation-paths.md](./cultivation-paths.md) — nội dung từng path.
- [skills.md](./skills.md) — skill được unlock.
- [elements-reactions.md](./elements-reactions.md) — hành và reaction path.
