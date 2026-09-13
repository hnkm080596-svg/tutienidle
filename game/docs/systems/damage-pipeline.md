# Damage Pipeline — resolve hit

**Trạng thái:** Live.

Owner: `core/combat/CombatSystem.ts` + calculator rời `core/combat/{Accuracy,Armor,Resistance,Endurance,ElementDamageCalculator,RealmPressure}.ts`. Action layer: `core/battle/ActionImpactSystem.ts`.

## Thứ tự resolve 1 hit (`resolveAttack`)

```text
raw damage (từ ActionDamageInfo / skill effect)
→ getHitChance (accuracy vs evasion — miss thì dừng)
→ block roll (blockChance → blockEffectiveness)
→ crit roll (criticalRate − criticalAvoidance → ×criticalDamage)
→ Armor (physical) hoặc Resistance (element) hoặc bỏ qua (primordial/true)
→ Realm Pressure (chênh đại cảnh giới)
→ Endurance (threshold/percent kiểu Last Epoch)
→ finalDamageMultiplier (finalDamagePercent − finalDamageReductionPercent)
→ floor "tối thiểu 1" (mọi đòn trúng ≥ 1)
→ Ward hấp thụ trước
→ Mana Shield (% phần còn lại → currentMp 1:1, tràn ngược HP nếu cạn mana)
→ HP
```

Sau khi áp: `timeSinceLastHitTaken = 0` (gate hồi ward), event `critical`/`block`/`hit`/`damage` phát qua EventBus.

## Từng trục

- **Accuracy/Evasion** (`Accuracy.ts`): rating đấu nhau `accuracy/(accuracy+evasion)`, sàn 5% — không bao giờ chắc chắn trượt; cả 2 = 0 thì trúng.
- **Armor** (`Armor.ts`): đường cong Last Epoch `armor/(armor+K)`, `K = 50 × (1 + realmIndex×0.8)` theo realm **bên chịu đòn**; trần 75%. Physical only — Hỗn Nguyên (`primordialPower`) bỏ qua hoàn toàn.
- **Resistance** (`Resistance.ts`): % tuyến tính `(resistance − penetration)/100`, trần `[−1, 0.75]` (âm = nhận thêm, tối đa ×2). Mỗi hành 1 resistance riêng.
- **Endurance** (`Endurance.ts`): damage ≤ threshold → `×(1−percent)`; damage > threshold → `−threshold×percent` (đòn lớn chỉ trừ cố định).
- **Realm Pressure** (`RealmPressure.ts`): xem [realms.md](./realms.md).
- **Ward**: pool riêng `currentWard`/`wardMax`, hồi `wardRegenPerSecond` sau khi `timeSinceLastHitTaken` đủ lâu. Ward vỡ hẳn kích `wardBreakDamagePercent` (phản % wardMax vào nguồn — "Khiên Nổ" Thổ Tu).
- **Mana Shield**: `manaShieldPercent` — % damage còn lại sau Ward đổi sang MP 1:1.

## Post-hit

- **Leech** — `leechPercent` × toàn bộ finalDamage (kể cả phần ward hấp thụ) hồi HP nguồn.
- **Thorns** — `thornsPercent` × finalDamage trừ thẳng HP nguồn qua `applyModifiedDirectDamage` (không roll dodge/crit/thorns ngược — chống vòng phản vô hạn).
- **Kill check** — `killIfDead` cho cả target lẫn source (thorns có thể giết ngược).

## DoT — `applyDotDamage`

Điểm áp chung cho mọi tick damage-over-time (ailment trên entity, vùng lava…): `dotResistancePercent` giảm thẳng % (trần ±), `poisonRecoveryPercent` hồi HP nguồn theo damage thật đã trừ (gốc 'wood'), Kim Thế (`currentKimThe` × `kimTheDotResistancePenetrationPercentPerStack`) xuyên DoT-res riêng cho element metal. Không ảnh hưởng duration/stack/tick rate.

## ActionImpactSystem

`core/battle/ActionImpactSystem.ts` — pipeline impact thống nhất thay model missile cũ:

- Basic attack: schedule với windup → snapshot anchor cell (on_impact) → resolve từng hit.
- Player skill: mở batch → mỗi `fireHit()` resolve ngay → `endBatch()` phát đúng 1 `action_impact` neo tại ô mục tiêu chính.
- Hỗ trợ AOE shape (`AoeShape.ts`, `isCellInShape`), knockback, tỷ lệ sát thương mục tiêu phụ; danh sách đã trúng ngăn damage lặp.
- Event chỉ mang dữ liệu grid — gameplay không phụ thuộc VFX/Phaser.

## Liên quan

- [combat-overview.md](./combat-overview.md) — engine turn xung quanh.
- [stats.md](./stats.md) — mọi stat trong pipeline.
- [buffs.md](./buffs.md) — ailment/DoT nguồn.
