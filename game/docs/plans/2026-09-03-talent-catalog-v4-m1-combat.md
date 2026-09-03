# Talent Catalog v4 — M1 Combat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay catalog talent v3 bằng 11 talent chiến đấu v4 (5 công + 5 thủ + Bất Tử Th thể nâng cấp) chạy trên buff/trigger engine có sẵn, kèm 2 engine extension (E1 convert-on-max, E2 passive condition+convert).

**Architecture:** Talent vẫn là `TalentDefinition`; mỗi talent combat cấp passive hidden trong PassiveSystem tích tầng, E1/E2 mở rộng BuffPool + PassiveSystem để tích → ngưỡng → bùng nổ → reset. Không runner mới, không đụng damage pipeline.

**Tech Stack:** Vue 3 + TypeScript + Pinia + Phaser, Vitest.

**Spec:** `game/docs/specs/2026-09-03-talent-catalog-v4-design.md` (§3 kiến trúc, §4.1 catalog combat, §5 ngân sách, §8 test, §10 milestone M1). M2 (tu luyện) và M3 (sản xuất) là plan riêng.

## Global Constraints

- Chạy mọi lệnh từ `game/` (workdir). Test runner: `npx.cmd vitest run <files>`.
- KHÔNG dùng `any`. KHÔNG thêm dependency. KHÔNG đổi architecture.
- Id talent: pinyin VN không dấu snake_case (N2b); mechanic field English (N1).
- Mọi mô tả talent: template 3 phần (câu hình ảnh / cơ chế bằng số / chi phí đối trọng) — spec §9.
- Stack trong trận KHÔNG save (reset mỗi trận tại `PassiveSystem.resetStacks()`).
- Phàm Cốt giữ verbatim (description + effects + w1) — test hiện có khóa.
- Convention save no-migration: M1 KHÔNG bump save version (không field mới — 11 talent combat chỉ đổi data + runtime trong trận).
- Sau mỗi task: chạy `npx.cmd vitest run <file test liên quan>`; cuối plan: type-check + build.
- Commit message theo style repo: `feat(talent): ...`, `test(talent): ...`, `refactor(buff): ...`.
- KHÔNG push/merge — user quyết định.

---

### Task 1: BuffPool — E1 convert-on-max

**Files:**
- Modify: `game/src/core/buff/BuffSystem.ts:101-147` (hàm `handleExisting` — khối convert hiện có trong case 'stack')
- Test: `game/src/core/buff/BuffSystem.test.ts` (thêm describe mới)

**Interfaces:**
- Consumes: `BuffDefinition.convertsToId` (đã có — hiện chỉ fire khi `nextStacks >= maxStacks` trong case 'stack', đã đúng); `BuffPool.removeAllById/add` (đã có).
- Produces: hành vi mở rộng — khi buff `stackMode: 'stack'` CÓ `convertsToId` và `maxStacks` chạm ngưỡng, buff cũ bị remove và buff convert được apply (đây CHÍNH LÀ hành vi hiện có — verify + khóa bằng test, vì spec E1 mô tả "convert khi chạm maxStacks" và code `BuffSystem.ts:117-126` đã làm đúng). Không API mới.

- [ ] **Step 1: Viết test khóa hành vi convert-on-max hiện có**

Trong `BuffSystem.test.ts`, thêm (theo style fixture của file — đọc các test hiện có để copy cách tạo `CombatEntity` stub):

```typescript
describe('E1 — convert-on-max (spec talent v4 §3.3)', () => {
  it('buff stack chạm maxStacks → remove buff cũ, apply convertsToId (stack reset về 1)', () => {
    // Fixture: buff 'tinh_tang' maxStacks 3, convertsToId 'bung_no', cả hai
    // đã được add vào registry (nếu test hiện có dùng BuffRegistry stub, copy
    // pattern đó; BuffSystem.apply(definition, source, target, registry)).
    // apply 'tinh_tang' 3 lần → pool KHÔNG còn 'tinh_tang',
    // CÓ 'bung_no' với stacks = 1.
  })

  it('buff không có convertsToId → chạm maxStacks vẫn giữ nguyên (không convert)', () => {
    // apply 5 lần buff maxStacks 3 → stacks vẫn = 3, id không đổi.
  })

  it('convert theo THỜI GIAN liên tục (convertsAfterContinuousSeconds) không hồi quy', () => {
    // Nếu file test hiện có đã có test Làm Chậm/Hàn Khí convert theo thời gian,
    // KHÔNG viết lại — chỉ chạy và xác nhận pass ở Step 2. Nếu chưa có,
    // viết: buff có convertsAfterContinuousSeconds đủ điều kiện → convert
    // sau đúng số giây update().
  })
})
```

*(Lưu ý executor: mở `BuffSystem.test.ts` trước khi viết — copy đúng fixture pattern (entity stub, pool, registry) từ các describe hiện có. Các comment tiếng Việt trong code block là mô tả THỰC TẬP — thay bằng assertion thật.)*

- [ ] **Step 2: Chạy test xác nhận hiện trạng**

Run: `npx.cmd vitest run src/core/buff/BuffSystem.test.ts`
Expected: convert-on-max PASS ngay (code `BuffSystem.ts:117-126` đã implement) — nếu FAIL thì here là bug thật: sửa `handleExisting` để khối convert fire đúng (giữ nguyên điều kiện `nextStacks >= existing.maxStacks`).

- [ ] **Step 3: Commit**

```bash
git add src/core/buff/BuffSystem.test.ts
git commit -m "test(buff): khoa hanh vi E1 convert-on-max cho talent v4"
```

---

### Task 2: PassiveSystem — E2 condition + convert-at-threshold

**Files:**
- Modify: `game/src/core/skill/PassiveSystem.ts` (thêm field condition + convert + guard maxStacks đã có qua `addStack`)
- Modify: `game/src/core/skill/SkillTypes.ts:39-43` (mở `PassiveTrigger` không đổi — chỉ thêm type điều kiện)
- Test: `game/src/core/skill/PassiveSystem` — kiểm tra file test tồn tại; nếu chưa có, create `game/src/core/skill/PassiveSystem.talentv4.test.ts`

**Interfaces:**
- Consumes: `StatModifier.maxStacks` + `addStack` (`StatCalculator.ts:286`); event map `EVENT_TO_TRIGGER` (đã có).
- Produces (later tasks + GameManager consume):
  ```typescript
  // Trên Skill (optional fields — data khai báo, runtime đọc):
  passiveCondition?: { kind: 'hpBelow'; percent: number }  // chỉ tích stack khi HP source < percent
  passiveConvertsTo?: { buffId: string }                     // khi stack chạm maxStacks: apply buffId lên SOURCE qua deps, reset stack về 0
  ```
  PassiveSystem constructor thêm 2 optional deps cuối (pattern CombatSystem):
  ```typescript
  constructor(
    eventBus: EventBus,
    skillManager: SkillManager,
    skillSystem: SkillSystem,
    private readonly buffApplier?: (buffId: string, sourceId: string) => void,
    private readonly hpReader?: (sourceId: string) => number | undefined, // trả currentHp/maxHp ratio
  )
  ```
  Mọi call site hiện có compile không đổi (optional). `resetStacks()` KHÔNG đổi.

- [ ] **Step 1: Viết failing test**

`PassiveSystem.talentv4.test.ts` — stub `EventBus`/`SkillManager`/`SkillSystem` theo pattern `CombatSystem.surviveLethal.test.ts` (emit event qua bus thật hoặc mock — đọc `SkillTriggerRunner.test.ts` để copy EventBus stub):

```typescript
// Test 1: passiveCondition hpBelow 0.35 — event 'damage_taken' khi HP 0.5
// → KHÔNG tích stack; HP 0.2 → tích.
// Test 2: passiveConvertsTo — modifier maxStacks 3, tích 3 lần →
// buffApplier được gọi đúng 1 lần với buffId, stack modifier reset về 0.
// Test 3: KHÔNG có passiveConvertsTo → chạm maxStacks stack giữ nguyên
// (không gọi buffApplier) — hành vi cũ.
// Test 4: tick 'per_second' + condition — giây trôi qua nhưng HP cao
// → không tích.
```

- [ ] **Step 2: Chạy test xác nhận FAIL**

Run: `npx.cmd vitest run src/core/skill/PassiveSystem.talentv4.test.ts`
Expected: FAIL — TS error field `passiveCondition` không tồn tại.

- [ ] **Step 3: Implement E2**

`Skill.ts` — thêm 2 optional fields sau `passiveTrigger` (vùng type `Skill`, cùng khu `passiveModifiers`):

```typescript
// Talent v4 (spec 2026-09-03 §3.3 E2) — passive chỉ tích stack khi điều
// kiện này đúng (đọc HP của SOURCE qua PassiveSystem's hpReader).
passiveCondition?: { kind: 'hpBelow'; percent: number }

// Talent v4 — khi modifier chạm maxStacks: apply buff này lên SOURCE qua
// buffApplier rồi reset stack về 0 (nhịp tích → ngưỡng → bùng → reset).
passiveConvertsTo?: { buffId: string }
```

`PassiveSystem.ts` — trong `handleEvent`, trước vòng `addStack`, thêm guard condition (đọc HP qua `hpReader`, trả về true khi không có condition); sau `addStack`, thêm nhánh convert:

```typescript
// pseudo — giữ style code thật:
const hpRatio = this.hpReader?.(skillOwnerEntityId) // PassiveSystem cần biết
// entity id của player — dùng PLAYER_ID export sẵn.
// if (effective.passiveCondition && (hpRatio ?? 1) >= condition.percent) continue
// sau addStack: if (modifier.stacks >= (modifier.maxStacks ?? Infinity)
//   && effective.passiveConvertsTo) { this.buffApplier?.(...); modifier.stacks = 0 }
```

*Chuẩn wired: PassiveSystem hiện không biết HP — hpReader do GameManager cung cấp lúc construct (closure đọc active battle entity player). Thêm param optional cuối constructor.*

- [ ] **Step 4: Chạy test PASS**

Run: `npx.cmd vitest run src/core/skill/PassiveSystem.talentv4.test.ts`
Expected: 4 test PASS.

- [ ] **Step 5: Chạy regression PassiveSystem + SkillSystem**

Run: `npx.cmd vitest run src/core/skill/`
Expected: toàn pass — đặc biệt `SkillSystem.*`, `SkillTriggerRunner`.

- [ ] **Step 6: Commit**

```bash
git add src/core/skill/Skill.ts src/core/skill/PassiveSystem.ts src/core/skill/PassiveSystem.talentv4.test.ts
git commit -m "feat(passive): E2 passiveCondition + passiveConvertsTo cho talent v4"
```

---

### Task 3: Talent v4 combat data — catalog + buffs + wiring

**Files:**
- Modify: `game/src/data/talent/Talents.ts` (thay CHARACTER_CREATION_TALENTS bằng 11 talent combat + Phàm Cốt giữ; 12 cũ → RETIRED comment list; retire PARKED cũ trừ 2 kept)
- Modify: `game/src/data/buff/buffs.ts` (thêm 8 BuffDefinition: kiem_vuc, sat_na, thach_nham, tu_sinh_ngo, mo_tac, that_phong_haste, trong_kich_burst, hat_thu — naming N2b)
- Modify: `game/src/core/talent/Talent.ts` (TalentEffect union: thêm kind combat mới, giữ kind cũ không xóa — Phàm Cốt cần `cultivation_speed`)
- Modify: `game/src/core/talent/TalentEffects.ts` (getter mới + **siết collectTalentEffects chỉ nhận id ĐẦU TIÊN** — spec §3.2)
- Modify: `game/src/core/game/GameManager.ts` (wire passive hidden skill của talent vào PassiveSystem + BuffRegistry khi startBattle; grant hidden skill lúc tạo nhân vật/lúc load nếu talent thuộc match)
- Test: `game/src/data/talent/Talents.test.ts` (viết lại theo v4), `game/src/core/talent/TalentEffects.test.ts` (sửa + thêm), `game/src/core/talent/TalentsV4Wiring.test.ts` (create)

**Interfaces:**
- Consumes: E1 (Task 1), E2 (Task 2), `BuffRegistry.get`, PassiveSystem deps.
- Produces:
  ```typescript
  // TalentEffect kinds mới (Talent.ts) — mỗi kind có getter (TalentEffects.ts):
  | { kind: 'combat_passive'; passiveSkillId: string }  // talent cấp 1 hidden passive skill (id data/skill/talent_passives)
  // + getters:
  getTalentCombatPassiveSkillId(selectedTalentIds): string | undefined
  hasTalent(selectedTalentIds, talentId): boolean  // helper dùng chung
  ```
  Hidden passive skills định nghĩa ở `game/src/data/skill/TalentPassives.ts` (create) — mỗi skill: `{ id: 'talent_passive_kiem_quang', type: 'passive', passiveTrigger: 'critical', passiveModifiers: [{...maxStacks: 10}], passiveConvertsTo: { buffId: 'kiem_vuc' }, unlocked: true, equipped: false }` — shape `Skill` chuẩn.

- [ ] **Step 1: Viết failing catalog test v4**

Viết lại `Talents.test.ts` (đọc file hiện có trước — giữ describe Phàm Cốt verbatim + roll tests, đổi invariants):

```typescript
// Test 1: pool roll = 12 talent (11 combat + Phàm Cốt) — M1 chưa có
//   tu luyện/sản xuất (M2/M3 thêm sau).
// Test 2: id duy nhất, weight dương, effects thật, description có đủ 3 phần
//   (chứa ít nhất 1 số + từ chi phí — spot check 'tăng' + 'giảm'/'tốn'/'mất').
// Test 3: 13 id retired (tien_thien_dao_the...) → getTalentDefinition
//   trả undefined?? KHÔNG — spec §4.4 giữ save cũ an toàn: TALETNS_BY_ID
//   vẫn chứa retired (display) nhưng roll không bao giờ ra. Test: retired
//   KHÔNG thuộc CHARACTER_CREATION_TALENTS nhưng getTalentDefinition vẫn
//   resolve được.
// Test 4: mọi passiveConvertsTo.buffId / combat_passive passiveSkillId
//   tham chiếu tồn tại (BuffRegistry/TalentPassives) — invariant spec §8.
```

- [ ] **Step 2: Chạy FAIL**

Run: `npx.cmd vitest run src/data/talent/Talents.test.ts`
Expected: FAIL (pool còn 12 cũ).

- [ ] **Step 3: Viết data — TalentPassives.ts + buffs + Talents.ts v4 + kinds**

1. `data/skill/TalentPassives.ts` — 11 hidden passive skill (mỗi cái 1 talent; mô tả cơ chế ở description talent, skill description ngắn 1 dòng). Buff chain (E1): `kiem_mach → kiem_vuc`, `vo_anh_tang → sat_na`, `thach_giap_tang → thach_nham`; direct buff: `tu_sinh_ngo` (Bất Tử Thể).
2. `data/buff/buffs.ts` — thêm 8 BuffDefinition theo spec §4.1 (id N2b, số liệu spec, description 1 câu — buff name hiện lên buff bar).
3. `core/talent/Talent.ts` — thêm union member `combat_passive` + giữ mọi kind cũ.
4. `core/talent/TalentEffects.ts` — thêm `getTalentCombatPassiveSkillId` + `hasTalent`; **siết collectTalentEffects**: `const [first] = selectedTalentIds ?? []; if (first) {...}` — chỉ đọc id đầu (spec §3.2 hệ quả 2, comment rõ lý do).
5. `data/talent/Talents.ts` — 11 talent mới theo bảng §4.1 (id/weight đúng spec; description 3 phần; Bất Tử Thể giữ id `bat_tu_the` + kind survive_lethal cũ + THÊM combat_passive `talent_passive_bat_tu_the` — multi-effect là hợp lệ); Phàm Cốt giữ verbatim; 13 id cũ chuyển vào mảng `RETIRED_V4_TALENTS` (chỉ để display resolve, weight 0, comment); xóa `PARKED_TALENTS` cũ (bat_khuat/duoc_duyen/dao_phap_tu_nhien/vo_cau_dao_the → RETIRED_V4; tran_tam/phu_van thêm vào PARKED mới — spec §4.2, w0, không roll).

- [ ] **Step 4: Chạy catalog test PASS**

Run: `npx.cmd vitest run src/data/talent/Talents.test.ts`
Expected: pass.

- [ ] **Step 5: Failing wiring test**

`TalentsV4Wiring.test.ts`:

```typescript
// Test 1: player có talent 'kiem_quang' → getTalentCombatPassiveSkillId
//   trả 'talent_passive_kiem_quang'; talent khác → undefined.
// Test 2: collectTalentEffects siết đa talent — ['kiem_quang', 'tai_phong']
//   (save edit) → chỉ effect của kiem_quang được trả (id đầu).
// Test 3: mỗi 11 talent combat passive skill có đúng passiveTrigger +
//   passiveModifiers ≥ 1 + passiveConvertsTo (trúng talent cần bùng) —
//   trừ Phá Giáp/Tật Phong/Trọng Kích/Thứ Phạt pattern khác (so spec §4.1).
```

- [ ] **Step 6: Chạy FAIL rồi implement getters + fix**

Run: `npx.cmd vitest run src/core/talent/TalentsV4Wiring.test.ts` → FAIL → implement ở `TalentEffects.ts` (siết collectTalentEffects + 2 getter) → PASS.

- [ ] **Step 7: Regression toàn talent + skill data**

Run: `npx.cmd vitest run src/core/talent src/data/talent src/data/skill src/data/buff`
Expected: pass — CHÚ Ý test cũ tham chiếu id retire (`TalentEffects.test.ts` cũ test tu_bao/nghich_thien...) → sửa các test đó sang id v4 (đừng xóa describe — đổi data test sang talent mới tương ứng).

- [ ] **Step 8: Commit**

```bash
git add src/data/talent/Talents.ts src/data/skill/TalentPassives.ts src/data/buff/buffs.ts src/core/talent/Talent.ts src/core/talent/TalentEffects.ts src/core/talent/TalentEffects.test.ts src/core/talent/TalentsV4Wiring.test.ts src/data/talent/Talents.test.ts
git commit -m "feat(talent): catalog v4 combat — 11 talent + hidden passives + E1/E2 data"
```

---

### Task 4: Grant + reset wiring trong GameManager

**Files:**
- Modify: `game/src/core/game/GameManager.ts` (grant hidden passive khi player có talent combat_passive; xóa grant khi không; wire hpReader/buffApplier vào PassiveSystem construct; apply Tử Sinh Ngộ trong killIfDead path của SurviveLethalGuard consumer)
- Modify: `game/src/core/combat/CombatSystem.ts:456-485` (block Bất Tử Th thể: sau `tryConsumeUse()` thành công, thêm cleanse debuff + apply `tu_sinh_ngo` — qua `buffSystemFor`… đọc xem CombatSystem có BuffSystem access tại điểm đó không; nếu không, emit event để BattleSystem listener áp buff — CHỌN cách ít đụng chạm nhất, ghi comment)
- Test: `game/src/core/combat/CombatSystem.surviveLethal.test.ts` (mở rộng), `game/src/core/game/GameManager.talentv4.test.ts` (create nếu chưa có pattern — đọc `GameManager.realmAdvanceUnequip.test.ts` để copy setup)

**Interfaces:**
- Consumes: Task 3 (`getTalentCombatPassiveSkillId`, `TalentPassives`, buff `tu_sinh_ngo`), Task 2 (PassiveSystem deps optional).
- Produces: khi `startBattleWithPlayer`: PassiveSystem nhận passive skill của talent; PassiveSystem được construct 1 lần với `hpReader`/`buffApplier` closure (đọc `this.battle` player entity HP; apply buff qua `getBuffSystem(getBuffsFor(battle, player))`).

- [ ] **Step 1: Failing test — Bất Tử Th thể v4 (survive + cleanse + buff)**

Mở rộng `CombatSystem.surviveLethal.test.ts` theo fixture hiện có:

```typescript
// Session có guard bat_tu_the, target có sẵn 1 debuff (vd 'trung_doc').
// Đòn chết → guard giữ 1 HP → assert: debuff bị remove (pool sạch
// trung_doc), buff 'tu_sinh_ngo' active trên player với remainingTime
// ≈ 10 (duration), và vẫn KHÔNG kích hoạt trong tribulation (test hiện
// có giữ nguyên).
```

- [ ] **Step 2: FAIL → implement CombatSystem block**

Tại block survive (sau `entity.currentHp = 1`, trước emit `talent_survive_lethal`): cleanse mọi debuff polarity của entity qua pool của nó + apply `tu_sinh_ngo`. CombatSystem đã có `buffRegistry` optional (constructor param) — nếu instance hiện tại của test không có, test fixture phải cấp (copy pattern các test BattleSystem có registry).

- [ ] **Step 3: PASS + regression combat**

Run: `npx.cmd vitest run src/core/combat/CombatSystem.surviveLethal.test.ts src/core/combat/`
Expected: pass.

- [ ] **Step 4: Failing test — GameManager grant/revoke**

`GameManager.talentv4.test.ts`:

```typescript
// Test 1: player.selectedTalentIds = ['kiem_quang'] → sau khởi tạo + vào
//   trận, SkillManager có 'talent_passive_kiem_quang' và PassiveSystem
//   sẽ tích stack khi event 'critical' fire (emit thử 1 event).
// Test 2: player KHÔNG có talent combat → SkillManager KHÔNG có passive
//   ẩn nào (đảm bảo không leak giữa player).
// Test 3: trận mới (startBattle 2 lần) → stack reset (resetStacks đã có —
//   assert stack modifier = 0 sau begin lần 2).
```

- [ ] **Step 5: FAIL → implement GameManager wiring**

- Grant: lúc load/restore + `onCharacterCreated` (App.vue đã ghi `selectedTalentIds` trước bootGame — grant chạy sau khi store sẵn): `skillManager` add/remove passive theo `getTalentCombatPassiveSkillId(player.selectedTalentIds)`. Idempotent — remove trước add.
- PassiveSystem construct: truyền 2 closure deps. Tìm call site `new PassiveSystem(` — chỉ 1 nơi (GameManager constructor).
- hpReader: đọc battle player entity (battle null → undefined → condition pass-through — an toàn ngoài trận).

- [ ] **Step 6: PASS + regression game**

Run: `npx.cmd vitest run src/core/game/GameManager.talentv4.test.ts src/core/game/`
Expected: pass (GameManager suite lớn — nếu quá lâu, chạy tối thiểu GameManager.*.test.ts liên quan talent/passive/battle).

- [ ] **Step 7: Commit**

```bash
git add src/core/game/GameManager.ts src/core/combat/CombatSystem.ts src/core/combat/CombatSystem.surviveLethal.test.ts src/core/game/GameManager.talentv4.test.ts
git commit -m "feat(talent): wire combat passives v4 — grant/revoke + bat_tu_the v4 survive cleanse buff"
```

---

### Task 5: Kiểm tra spec compliance — mid-battle cạnh tranh + tài liệu

**Files:**
- Modify: `game/docs/game-guide.md` (mục thiên phú — viết lại theo 11 talent, mô tả 3 phần + ví dụ tình huống thật spec §9)
- Modify: `game/docs/roadmap.md` (mục Phase 1 thiên phú — ghi catalog v4 M1)
- Test: rà toàn bộ `src/data/skill/TalentPassives.ts` vs spec §4.1 một lần cuối (self-review)

**Interfaces:** Không code mới — documentation + final verification.

- [ ] **Step 1: game-guide mục thiên phú**

Viết lại: nguyên tắc ngân sách (mọi talent ~20-30% cuối Trúc Cơ, khác hình dạng), 3 nhóm, bảng 11 talent combat M1 (id + mô tả + ví dụ 1 tình huống mỗi talent — vd Kiếm Quang: "bạn vừa crit 10 phát liên tiếp — mỗi phát +1% chí mạng, phát thứ 10 mở Kiếm Vực 8s: mọi đòn kế đều chí mạng").

- [ ] **Step 2: roadmap sync**

Mục 7.x (todolist) thêm dòng: Talent Catalog v4 — M1 combat done (thay dòng v3 "đã giải quyết"); ghi M2/M3 pending + link spec.

- [ ] **Step 3: Toàn bộ test suite + type-check + build**

Run: `npx.cmd vitest run` (full suite — 2130+ tests)
Run: `npm.cmd run type-check`
Run: `npm.cmd run build`
Expected: tất cả xanh. Fix mọi regression do v4 gây ra (spec §8: sửa lỗi do implementation, không phải do test cũ đã lỗi thời — nhưng test cũ tham chiếu retired id THAY data, không xóa test).

- [ ] **Step 4: Adversarial QA quick mode**

Load skill `tutienidle-adversarial-qa` (quick mode) — chạy theo SKILL.md, viết report `game/docs/qa/2026-09-03-talent-v4-m1-quick.md`. Verdict phải `PASS WITH EVIDENCE` mới hoàn thành task; dưới đó → quay lại sửa (chỉ sửa production code khi QA tìm ra defect thật, có reproduction).

- [ ] **Step 5: Commit docs**

```bash
git add game/docs/game-guide.md game/docs/roadmap.md game/docs/qa/2026-09-03-talent-v4-m1-quick.md
git commit -m "docs(talent): game-guide + roadmap + QA report cho catalog v4 M1"
```

---

## Self-Review (đã chạy sau khi viết plan)

1. **Spec coverage**: §3.3 E1→Task 1, E2→Task 2; §4.1 toàn 11 talent → Task 3 (data) + Task 4 (wiring + Bất Tử Th thể v4); §3.2 siết đa talent → Task 3 (collectTalentEffects); §8 test → từng task + Task 5 full suite + QA; §9 docs → Task 5; §5 ngân sách — mô tả hóa trong data + guide (số liệu first-pass đã ghi trong spec). Phá Giáp carry-stack + Tật Phong bị-hit-reset + Thứ Phạt decay là **runtime trong trận** — KHÔNG cần save field (chỉ carry của Phá Giáp là cross-battle → spec gán cho M2 vì liên quan save bump; M1 chỉ làm phần trong trận, carry để M2 — GHI RÕ trong Task 3 data: passive của pha_giap KHÔNG khai carry ở M1, mô tả talent ghi "giữ 50% tầng (chắp cánh M2)".) — *đã cập nhật spec §4.1 hàng pha_giap tương ứng.*
2. **Placeholder scan**: code block Task 1/2 là mô tả fixture theo pattern file thật (executor đọc file trước khi viết) — không TBD/TODO; mọi task có bước run-test cụ thể.
3. **Type consistency**: `combat_passive` kind + `getTalentCombatPassiveSkillId` + `hasTalent` dùng nhất quán Task 3→4; `passiveCondition`/`passiveConvertsTo` trên Skill nhất quán Task 2→3; buff id `kiem_vuc/sat_na/thach_nham/tu_sinh_ngo` khớp giữa data + test.

## Execution Handoff

Plan saved to `game/docs/plans/2026-09-03-talent-catalog-v4-m1-combat.md`. Hai lựa chọn:

1. **Subagent-Driven (recommended)** — mỗi task một subagent fresh, tôi review giữa các task
2. **Inline** — tôi tự execute theo executing-plans trong session này

Chọn cách nào?
