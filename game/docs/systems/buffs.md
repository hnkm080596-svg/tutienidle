# Buff / Debuff / Ailment

**Trạng thái:** Live — `core/buff2` là canonical buff authority duy nhất (Buff System Reimagined M4–M5, spec `docs/specs/2026-09-17-buff-system-reimagined-spec.md`). Legacy `core/buff/` package đã xoá hoàn toàn.

Core: `core/buff2/` — `BuffSystem.ts` (authority), `BuffStore.ts` (battle-scoped instance store), `BuffQuery.ts` (`BuffReadPort` read surface), `BuffRegistry.ts` (sealed definition catalog + validation), `BuffModifierEngine.ts`, `ApplicationResolver.ts`, `BuffPeriodicResolver.ts`, `BuffPersistence.ts` (persistent pool ngoài trận), `BuffNames.ts` (display helper). Data: `data/buff/` (`BuffRegistry.ts` + `buffs.ts`, `LegacyBuffs.ts`, `TheTuBuffs.ts`, `ThuanHeBuffs.ts`, `BossBuffs.ts`, `KiemPhoBuffs.ts`, `TalentBuffs.ts`, `ZoneDotBuffs.ts`).

## Model

`BuffDefinition` (immutable, registry deep-freezes khi load):

| field | vai trò |
|---|---|
| `id`, `name`, `description` | định danh + display |
| `kind` | `'buff' | 'debuff' | 'ailment' | 'marker'` |
| `polarity` | `'buff' | 'debuff'` — feed `StatModifier.sourceType` |
| `element` | tag nguyên tố (canonical ấn khi bind trong `ElementalStateRegistry`) |
| `hidden` | skip presentation |
| `instanceScope` | `'per_source'` (mỗi source 1 instance) | `'per_target'` (1 instance duy nhất, ownership theo `sourceOwnership`) |
| `stacking` | `{maxStacks, onReapplyStacks: add\|replace\|keep, onReapplyDuration: refresh\|keep\|extend, replaceInstanceOnReapply?}` — stacks và duration là 2 trục độc lập |
| `lifetime` | `{clock: holder_turns\|source_turns\|rounds\|seconds\|permanent, duration?, scaling: fixed\|ailment_scaled, removeOnSourceDeath?}` |
| `application` | `{resistance: 'none'\|'ailment'}` — target ailment resist có gate roll không |
| `periodic` | damage/heal recipes (`damageProfile`, `coefficient`, `scaling: dynamic\|snapshot`, `timing`, `stackScaling`, `canCrit/canMiss/hitCount`, `tags`) |
| `statModifiers` | `{stat, percent\|flat, domain?}` — projected qua `getStatModifiers` |
| `controls` | `[{type: 'stun'\|'freeze'\|'root'}]` |
| `capabilities` | generic grants `{id, type, payload}` — payload thuộc owner module (proc/marker/the_economy/gauge_delta/dot_recovery), validator đăng ký riêng |
| `forbiddenActionTags` | Cấm Công channel — `hasForbiddenTags` feed `ActionValidator` |
| `dispellable` | cleanse() gate |
| `clearsCcOnApply`, `convertsToId`, `convertsAfterContinuousTurns`, `convertsAtStackCap` | legacy-parity lifecycle |

`BuffInstance` runtime: `instanceId` (`buff.${battleId}.${n}`), `stacks`, `remaining`, `continuousTurns/Seconds`, `modifiers[]`, `snapshots` (per-periodic apply-time capture).

## Authority & mutation lanes

Trong trận: **mọi mutation đi qua `CombatScheduler`** — ops `apply_buff`, `consume_buff_stacks`, `set_buff_stacks`, `refresh/extend/set_buff_duration`, `add/remove_buff_modifier`, `cleanse_buff`, `remove_buff`. `BuffSystem` không tự mutate ngoài op context; lifecycle chạy qua `createLifecycleSink` boundaries (`onHolderTurnStart/End`, `onSourceTurnStart/End`, `onRoundEnd`, `onTimePassed`, `onEntityDeath`, `onBattleEnd`).

Ngoài trận: `BuffPersistence` (`GameManager.persistentBuffs`) — pool riêng cho persistent buffs (`kiep_thuong`, trận pháp buffs, pill), tick `onTimePassed(seconds)`, không scheduler. **`player.persistentTimedEffects` là hệ khác** (deadline `expiresAtMs` cho pills/Tu Linh Trận) — không phải buff pool, không đụng.

Periodic model: lifecycle boundary emit `periodic_requests_committed` (damage/heal requests) → DamageSystem/HealAdapter sở hữu formula. `scaling:'dynamic'` đọc live state; `scaling:'snapshot'` forward snapshot apply-time (`snapshotFields` ⊆ profile schema). `PeriodicOperationSettled` finalize `uses`-marked modifiers trong cùng settlement tree.

Modifiers: `{id, channel, operation, value, reapply, priority, lifetime}` — channels `potency`, `periodic_damage`, `next_periodic_damage`, `duration`, `application_chance`; lifetimes `buff_lifetime`/`uses`/`holder_turns`/`source_turns`/`rounds`/`battle`/`explicit`. Re-apply `replace`/`stack`/`max`/`min` — không compound.

Application: multiplicative chance — `baseChance × (1 + elementApplicationPercent) × (1 − min(cap, ailmentResistPercent))`, đúng 1 `rollChance` per apply. `ailmentResistPercent` **cap 75%**.

Elemental: def bind canonical trong `ElementalStateRegistry` → apply emit `elemental_application_committed` TRƯỚC generic buff events, kèm `reactionEligibility` (`'eligible'` mặc định; `'suppressed'` cho recursion/conversion lanes). Reaction engine **live**: `ReactionDispatcher` registered trên scheduler (`GameManagerTurnBattleOps`), capability `elemental_reaction_enabled` granted party-wide qua aura `van_phap_than_hoa` ([elements-reactions.md](./elements-reactions.md)).

## Ailment

Ailment = `kind:'ailment'` trong cùng buff2 — không có AilmentSystem riêng, không `AilmentChance` module (roll nằm trong `ApplicationResolver`):

| id | Tên | Element | Ghi chú |
|---|---|---|---|
| `hoa_an` | Hỏa Ấn | fire | canonical seal — periodic DoT |
| `doc_can` | Độc Căn | wood | canonical seal — DoT |
| `liet_thuong` | Liệt Thương | metal | canonical seal — DoT |
| `han_tuc` | Hàn Tức | water | canonical seal — DoT |
| `tran_an` | Trấn Ấn | earth | canonical seal — pure stacking setup, không DoT |
| `kiep_thuong` | Kiếp Thương | — | persistent debuff 60s (BuffPersistence) |

5 seals trên là canonical reaction seals (duration 3 holder turns, maxStacks 5, `per_source`, ailment resistance — [elements-reactions.md](./elements-reactions.md)). Legacy ids `bong`/`trung_doc`/`chay_mau`/`te_cong`/`thach_hoa` đã destructive-migrate sang seals; `hoai_tu` và các reaction-product cũ (`doc_the`/`ngung_lo`/`khai_son`/`dung_nham`/`huyet_doc`) bị xoá cùng migration. Non-canonical ailments/controls còn lại trong `LegacyBuffs.ts`: `troi_chan`, `choang`, `dong_bang`, `lam_cham`, `han_khi`, `cuong_bao`, `suy_nhuoc`, `uy_ap`, `giap_ran`, `van_kiem_vu`.

Capability homes (thay legacy effect union): `on_hit_proc`/`reactive_trigger`/`reactive_proc`/`reactive_economy`/`the_economy` → `core/proc/`; `marker`/`the_tu` → TheTu module; `gauge_delta` → `GaugeDeltaHandler`; `dot_recovery` → `DotRecovery`.

## dot_recovery capability

Capability type `dot_recovery` vẫn tồn tại trong contracts (`DotRecoveryCapabilities` sở hữu payload; `CombatSystem`/`DotRecovery` resolve heal khi DoT tick) nhưng **không còn production carrier** — carrier duy nhất (`trung_doc`) bị xoá trong seal migration.

## Nguồn áp

Skill (`appliesBuff`/`appliesAilment(s)` qua scheduler ops), formation/entry buffs (`applyEntryBuffs` sau khi mint runtime), talent, boss `bossTrigger` (canonical registry id), pill/persistent (`applyPersistentBuff` → `BuffPersistence`).

## Liên quan

- [damage-pipeline.md](./damage-pipeline.md) — periodic damage requests (`legacy_dot` profile).
- [elements-reactions.md](./elements-reactions.md) — reaction engine (live: dispatcher + capability grant).
- [skills.md](./skills.md) — `ailmentChance`, `consumesAilmentId` (scheduler consume op).
