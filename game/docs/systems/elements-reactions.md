# Ngũ Hành & Phản ứng nguyên tố

**Trạng thái:** Live.

Types: `core/element/ElementType.ts` (5 hành). Quan hệ sinh/khắc: `core/element/WuxingRelations.ts` (`SINH_CYCLE`/`KHAC_OVERCOMES`/`relationOf`). Authority trong combat: `core/reaction/` (canonical engine — mục Engine bên dưới), production-wired trong `GameManagerTurnBattleOps.ts`. Loadout: `core/element/ElementSlot.ts` + `player.equippedElements`.

## ElementType — chỉ 5 hành

`wood | fire | earth | metal | water`. **Phong/Lôi đã bỏ toàn hệ** (spec Đạo Sắc §5) — không mở lại. `primordialPower` (Hỗn Nguyên) là damage type true riêng, không phải element trong vòng này.

## Element Loadout (Pháp Tu)

- `player.unlockedElements` — hành đã mở qua node tree ([node-tree.md](./node-tree.md)); unlock mãi mãi, unequip không mất.
- `player.equippedElements` — hành mang vào combat, giới hạn `getElementSlotCount(realmId)`:
  - Phàm Nhân: 0 slot (chưa chọn path).
  - Luyện Khí: 2 slot; mỗi 2 đại cảnh giới kế +1; trần `MAX_ELEMENT_SLOTS = 5`.
- `canEquipElement`/`equipElement`/`unequipElement` — domain gate; UI ở loadout section của panel.

## Canonical ấn (seals)

5 ailment nguyên tố **là** canonical reaction seals — def trong `data/buff/LegacyBuffs.ts`, bind một-semantic-per-element trong `ElementalStateRegistry`. Locked: duration 3 holder turns, maxStacks 5 add/refresh, `per_source`, ailment resistance.

| id | Tên | Element |
|---|---|---|
| `hoa_an` | Hỏa Ấn | fire |
| `doc_can` | Độc Căn | wood |
| `liet_thuong` | Liệt Thương | metal |
| `han_tuc` | Hàn Tức | water |
| `tran_an` | Trấn Ấn | earth |

4/5 seals mang 1 periodic DoT (`<id>.dot`, `legacy_dot` profile, element riêng); `tran_an` không có periodic — pure stacking setup state. Apply của def đã bind emit `elemental_application_committed` TRƯỚC generic buff events, kèm `reactionEligibility` (`'eligible'` mặc định; `'suppressed'` cho recursion/conversion lanes) — event này feed reaction engine. Legacy ailment ids (`bong`/`trung_doc`/`chay_mau`/`te_cong`/`thach_hoa`) đã destructive-migrate sang seals; các product cũ (`doc_the`/`ngung_lo`/`khai_son`/`hoai_tu`/`dung_nham`/`huyet_doc`) bị xoá cùng migration.

## Phản ứng (`CANONICAL_REACTIONS`)

10 cặp canonical trong `data/reaction/ReactionDefinitions.ts` — 5 **sinh** (consume HẾT parent stacks; child giữ + được convert) + 5 **khắc** (consume cả hai). Payoff là pure data (`payoff.steps`: `add_child_stacks`, `add_child_modifier`, `push_gauge`, `extend_child_duration`, `reaction_damage`, `apply_status`, `heal_from_damage`); `StackExpr` đọc snapshot P (parent) / A (attacker) / D (defender) pre-consume. `reaction_damage` bắt buộc damageProfile thuộc reaction channel (`'reaction'` hoặc `'reaction_*'`, phải tồn tại trong catalog) — `ReactionRegistry` seal từ chối mọi profile khác (không được lọt qua DoT channel).

| Cặp | Tên | Hệ quả | Quan hệ |
|---|---|---|---|
| Độc Căn → Hỏa Ấn | Dưỡng Viêm | child +⌈P/2⌉ tầng; child modifier periodic_damage 1+0.05·P | sinh |
| Hỏa Ấn → Trấn Ấn | Luyện Thổ | child +⌈P/2⌉; gauge −0.03·P max | sinh |
| Trấn Ấn → Liệt Thương | Dưỡng Kim | child +⌈P/2⌉; child modifier +4·P penetration points | sinh |
| Liệt Thương → Hàn Tức | Tụ Thủy | child +⌈P/2⌉; extend child duration ⌊P/2⌋ (max remaining 5) | sinh |
| Hàn Tức → Độc Căn | Nhuận Mộc | child +⌈P/2⌉; child modifier periodic_damage 1+0.05·P | sinh |
| Hàn Tức khắc Hỏa Ấn | Tức Viêm | reaction dmg 0.2·(A+D)+0.08·D; gauge −0.03·A | khắc |
| Hỏa Ấn khắc Liệt Thương | Dung Kim | reaction dmg 0.35·(A+D); áp `defense_break` A tầng, duration min(3, ⌈D/2⌉) | khắc |
| Liệt Thương khắc Độc Căn | Đoạn Mộc | reaction dmg 0.15·(A+D); áp `reaction_bleed` 1+⌊A/2⌋ tầng kèm potency 1+0.05·D | khắc |
| Độc Căn khắc Trấn Ấn | Xuyên Thổ | reaction dmg 0.15·(A+D); áp `defense_erosion` A tầng; heal source 0.05·D reaction damage (cap 0.25) | khắc |
| Trấn Ấn khắc Hàn Tức | Trấn Thủy | reaction dmg 0.1·(A+D); gauge −0.04·A; áp `cam_cong` khi A≥3, duration clamp(D−1, 2, 3) | khắc |

Status payoff defs (`reaction_bleed`/`defense_break`/`defense_erosion`/`cam_cong`) nằm trong `data/buff/ReactionStatusBuffs.ts`. `reactionEffectPercent` không còn consumer trong canonical engine (legacy amplifier của `TurnReactionManager` đã xoá).

## Engine (`core/reaction/`)

Pipeline live: `ReactionTriggerGate` (capability `elemental_reaction_enabled` — granted party-wide bởi aura `van_phap_than_hoa`, source là An entity ẩn lúc vào trận) → `ReactionBoard` (board ấn cùng-source qua `ElementalStateRegistry`) → `ReactionCandidate`/`ReactionBias` (fixed-point selection, tie theo `selectionTiePriority`) → `ReactionResolution` (snapshot + preconditions + consume-first ops) → `ReactionOperations` → batch qua `CombatOperationBatchRunner`. State do reaction tạo ra không recursive (`reactionEligibility: 'suppressed'`).

Production wiring (`GameManagerTurnBattleOps`): per-cycle `mintCycleScheduler` construct `ReactionRegistry` (seal `CANONICAL_REACTIONS`) + `ReactionSystem` + `ReactionDispatcher`, register immediate handler `elemental_application_committed` trên scheduler; capability đọc qua `BuffSystemCapabilityQuery`. Reaction-generated events drain sau batch trả về (synchronous settlement model).

`ReactionTrace`/`formatReactionTrace`/`compareReactionTraces` = deterministic §85 trace + spec §60 ordering cho debug/digest. `REACTION_DISPLAY_NAMES` = display names UI float trên `reaction_resolved`.

Cấm Công (`forbiddenActionTags` + `ActionValidator` trên turn selection) live trong `TurnBattleSystem`.

Legacy: `TurnReactionManager`/`canInitiateWuxingReactions`/`ELEMENT_REACTIONS` đã xoá (M-INT `d65f28aa`) — canonical engine là reaction authority duy nhất.

## Element damage

`core/combat/ElementDamageCalculator.ts` — `elementalBasePower` gom power theo hành; mỗi hành là 1 damage type độc lập đấu resistance cùng tên (không còn chu kỳ sinh/khắc trong damage). Linh Căn (attunement) cộng đều 6 hành ([stats.md](./stats.md)).

## Liên quan

- [buffs.md](./buffs.md) — seal/ailment ids, `ElementalStateRegistry`, aura `van_phap_than_hoa`.
- [skills.md](./skills.md) — `appliesAilment`, reaction path picks.
- [cultivation-paths.md](./cultivation-paths.md) — Pháp Tu multi-hành.
- `../architecture/2026-09-17-reaction-inventory.md` — M0 census của đường reaction cũ.
