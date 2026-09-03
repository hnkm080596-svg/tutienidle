# Pháp Tu Thuần Hệ — 20 Skill B–E, 5 Ultimate, Node Chuỗi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến 25 skill placeholder thành chuỗi Thuần hệ Pháp Tu chơi được: 20 skill B–E đúng tên/cơ chế/số liệu, 5 Ultimate hiệu ứng đặc trưng, node Lập Đạo Thuần + unlock + biến thể C/D + chuyên sâu Thế — kèm 8 mở rộng engine (E-1..E-8).

**Architecture:** Engine-first: các task đầu xây mở rộng `SkillEffect`/`SkillEffectSystem`/`NodeEffect`/`TheResourceSystem` (mỗi cái TDD, backward-compatible), task giữa thay data skill + buff mới, task cuối dựng node tree + wire chain/ult qua GameManager glue. Data skill chỉ có nghĩa sau khi engine hiểu field mới.

**Tech Stack:** TypeScript, Vitest, Vue (tooltip), existing SkillEffectSystem/NodeSystem/UltimateSystem/ChainStateSystem.

**Spec:** `game/docs/newPhapTuDesignSpec.md` (con) + `docs/superpowers/specs/2026-08-30-phap-tu-dao-sac-design.md` (cha).

**Worktree:** `E:/tutienidle/.claude/worktrees/phap-tu-thuan-he` (branch `worktree-phap-tu-thuan-he`).

## Global Constraints

- Không thêm `SkillEffectType` mới, không thêm execution policy mới, không thêm `SkillResourceType` (spec §6).
- Naming N2b: id skill = tên hiển thị bỏ dấu snake_case, KHÔNG hậu tố `_b/_c/_d/_e`.
- `resourceType: 'none'` mọi skill; `execution: { kind: 'cast_time', castTime }`; mọi effect `damage` phải có `manaScalingRatio: 0.001` + `attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }]` (test `Skills.costInvariant.test.ts` khóa).
- Ngân sách damage: A 1.0 · B 1.1 · C 1.3 (0 nếu self-buff) · D 1.5 · E 2.4; nhịp cd/cast: B 2/1.0, C 3/1.2, D 4/1.4, E 6/1.8.
- Unlock: `unlocked: false`, không `requiredRealmId` trên skill (gate ở node prereq + REALM_SLOT_TABLE).
- Engine mở rộng phải backward-compatible: field optional, default = hành vi cũ; mọi test hiện hữu không đổi assertion.
- KHÔNG xóa keystone Trúc Cơ cũ + engine `hoaThe/kimThe/...` (Notes N4 — chờ user quyết, ngoài phạm vi).
- KHÔNG xóa file nào (Iron Rule). Placeholder skill cũ bị THAY bằng entry mới trong cùng file (không phải xóa file).
- Dev phase: không save migration.
- Verify mỗi task: focused vitest + type-check; cuối plan: full suite + build + e2e boot-fresh + QA quick.

## File Structure

| File | Vai trò sau plan |
|---|---|
| `core/skill/SkillEffect.ts` | +`spreadsAilmentId`/`spreadStackPercent`/`spreadRefreshesPrimary` (E-1), +`stacksPerAffectedTarget` (E-2), +`hitCount` (E-4), `grantsSwordZone`→`grantsZone`+`zoneElement` (E-5, giữ alias), `add_stack`/`remove_buff` fields `polarity?`/`count?` (E-3) |
| `core/skill/SkillEffectSystem.ts` | xử lý E-1/E-2/E-3/E-4/E-5 thật (thay no-op `add_stack`/`remove_buff`) |
| `core/progression/ProgressionNode.ts` | +`selectsSpecialization?: { skillId; specializationId }` (E-8) |
| `core/game/GameManager.ts` | `purchaseNode` handle `selectsSpecialization` → `SkillSystem.selectSpecialization` (E-8); glue chain/ult (Task 12) |
| `core/skill/SkillRuntimeStats.ts` | +`theGainPerLinkBonus`, `theMaxBonus` (E-7) |
| `core/battle/TheResourceSystem.ts` | `gainTheOnChainLink(player, isFinisher)` đọc bonus từ skill A; `consumeTheForUlt`/`canUsePhapTuUltimate` theo `MAX_THE + theMaxBonus` (E-7) |
| `core/battle/UltimateSystem.ts` | `PHAP_TU_ULTIMATE_PROFILES` + `triggerPhapTuUltimate` chạy effects skill ult qua ctx (E-6) |
| `data/skill/Skills.ts` | 20 skill B–E mới + 5 ult mới (thay placeholder), `CHAIN_SKILL_IDS` mới |
| `data/buff/buffs.ts` | 8 buff mới (§7); `bong` → stack theo N1 (đã duyệt) |
| `data/progression/PhapTuNodes.ts` | nhánh Thuần 17 node/hành (§5) |
| Tests | `Skills.chain.test.ts`, `Skills.costInvariant.test.ts`, `UltimateSystem.phapTu.test.ts`, `PhapTuNodes.dao.test.ts` (mới), `SkillEffectSystem.thuanHe.test.ts` (mới), `TheResourceSystem.test.ts` (mới) |

---

### Task 1: E-3 — `add_stack` / `remove_buff` cho active skill

**Files:**
- Modify: `game/src/core/skill/SkillEffect.ts` (thêm `polarity?: 'buff' | 'debuff'`, `count?: number` vào interface — các field đã có cho loại effect này từ PassiveSystem path, verify trước)
- Modify: `game/src/core/skill/SkillEffectSystem.ts:322-326` (thay no-op bằng xử lý thật)
- Test: `game/src/core/skill/SkillEffectSystem.thuanHe.test.ts` (mới)

**Interfaces:**
- Consumes: `BuffSystem.getAllById/getStacks/remove/removeAllById`, `BuffPool` qua `ctx.targetBuffs`/`ctx.sourceBuffs`.
- Produces: effect `{ type: 'add_stack', buffId, stacks?, refresh? }` — tăng N stack trên buff đang chạy (không tạo mới nếu chưa có); `{ type: 'remove_buff', buffId?, polarity?, count?, scope: 'target'|'source' }` — gỡ tối đa `count` instance (mặc định 1; `polarity` gỡ nhiều nhất `count` theo thứ tự pool).

- [x] **Step 1: Đọc kỹ** `SkillEffect.ts` quanh `add_stack`/`remove_buff` + `PassiveSystem` xử lý hiện tại để tái dùng shape field (không đổi type union nếu đã có).
- [x] **Step 2: Failing tests** (SkillEffectSystem.thuanHe.test.ts):
  - `add_stack` trên target có `trung_doc` 2 tầng → 4 tầng (stacks +2); chưa có buff → không tạo mới (no-op).
  - `remove_buff` scope source, polarity 'debuff', count 8 → gỡ tối đa 8 debuff trên source; count lớn hơn số có → gỡ hết, không crash.
  - `remove_buff` có `buffId` cụ thể → chỉ gỡ id đó.
- [x] **Step 3:** `npx vitest run src/core/skill/SkillEffectSystem.thuanHe.test.ts` → FAIL.
- [x] **Step 4: Implement** case `add_stack`/`remove_buff` trong `SkillEffectSystem.apply()` (scope target/source theo effect.scope mặc định 'target').
- [x] **Step 5:** PASS + regression `npx vitest run src/core/skill src/core/battle/BattleSystem.passive.test.ts` (PassiveSystem path không đổi).
- [x] **Step 6: Commit** `feat(skill): add_stack/remove_buff active-skill effects (thuan-he E-3)` — `4f7477f`

---

### Task 2: E-4 — `hitCount` (N missile cố định)

**Files:**
- Modify: `game/src/core/skill/SkillEffect.ts` (+`hitCount?: number` — cạnh `hitCountByRealm`, comment loại trừ nhau)
- Modify: `game/src/core/skill/SkillEffectSystem.ts:144` (`const hitCount = effect.hitCountByRealm ? ... : 1` → ưu tiên `effect.hitCount ?? (hitCountByRealm ? realmIndex+1 : 1)`)
- Test: mở rộng `SkillEffectSystem.thuanHe.test.ts`

- [x] **Step 1: Failing test:** effect damage `hitCount: 8` → `ctx.fireHit` gọi 8 lần, mỗi lần roll crit độc lập (mock random).
- [x] **Step 2:** FAIL → implement → PASS.
- [x] **Step 3: Regression:** `hitCountByRealm` tests cũ không đổi.
- [x] **Step 4: Commit** `feat(skill): fixed hitCount effect (thuan-he E-4)` — `02a16fb`

---

### Task 3: E-5 — `grantsZone` tổng quát (element)

**Files:**
- Modify: `game/src/core/skill/SkillEffect.ts` (+`grantsZone?: boolean`, +`zoneElement?: ElementType`; `grantsSwordZone` giữ nguyên cho Kiếm Tu — resolver map `grantsSwordZone || grantsZone`)
- Modify: `game/src/core/skill/SkillEffectSystem.ts:169-179` (spawn zone với element từ `zoneElement ?? 'metal'`)
- Modify: `game/src/core/battle/BattleSystem.ts` (`spawnSwordZone` ctx builder — nhận element override)
- Test: `SkillEffectSystem.thuanHe.test.ts` + `BattleSystem.swordZone.test.ts` (mở rộng)

- [x] **Step 1: Failing test:** skill `grantsZone: true, zoneElement: 'fire'` → zone spawn element fire, damageRatio/tick giữ công thức cũ.
- [x] **Step 2:** FAIL → implement → PASS; Kiếm Tu `grantsSwordZone` không đổi behavior (metal).
- [x] **Step 3: Commit** `feat(skill): generalized grantsZone with element (thuan-he E-5)` — `9200d49`

---

### Task 4: E-1 — `spreadsAilmentId` (lan độc Mộc D)

**Files:**
- Modify: `game/src/core/skill/SkillEffect.ts` (+`spreadsAilmentId?: string`, +`spreadStackPercent?: number` default 1, +`spreadRefreshesPrimary?: boolean`)
- Modify: `game/src/core/skill/SkillEffectSystem.ts` case `damage` — sau resolve, nếu effect có `spreadsAilmentId`: đọc `ctx.targetBuffs.getAllById(id)` của primary → tổng stacks → áp lên MỌI enemy trong `affectedTargets` (trừ primary) qua `ctx.targetBuffs.apply(registry.get(id), source, each, registry)` với stacks = ceil(total × percent); `spreadRefreshesPrimary` → refresh duration primary.
- Test: `SkillEffectSystem.thuanHe.test.ts`

- [x] **Step 1: Failing tests:**
  - Primary có `trung_doc` 3 stacks, 2 enemy phụ → mỗi phụ nhận 3 stacks (percent 1); primary không đổi.
  - `spreadStackPercent: 0.5` → ceil(3×0.5)=2.
  - Primary không có ailment → không spread, không crash.
- [x] **Step 2:** FAIL → implement → PASS.
- [x] **Step 3: Commit** `feat(skill): spreadsAilmentId copies stacks to affected targets (thuan-he E-1)` — `a5fe4b6`

---

### Task 5: E-2 — `stacksPerAffectedTarget` (Thành Lũy Thổ)

**Files:**
- Modify: `game/src/core/skill/SkillEffect.ts` (+`stacksPerAffectedTarget?: boolean` trên effect `buff`)
- Modify: `game/src/core/skill/SkillEffectSystem.ts` case `buff` — flag này + scope source: stacks = số `affectedTargets` còn sống (cap maxStacks buff)
- Test: `SkillEffectSystem.thuanHe.test.ts`

- [x] **Step 1: Failing test:** buff `thanh_luy` với 3 target trúng → stacks 3; 0 target → không buff.
- [x] **Step 2:** FAIL → implement → PASS.
- [x] **Step 3: Commit** `feat(skill): stacksPerAffectedTarget for self-buff from hit count (thuan-he E-2)` — `df08d1e`

---

### Task 6: E-7 — Thế bonus nodes + buff Thế Mãn

**Files:**
- Modify: `game/src/core/skill/SkillRuntimeStats.ts` (+`theGainPerLinkBonus: number`, +`theMaxBonus: number`, default 0)
- Modify: `game/src/core/battle/TheResourceSystem.ts` — `gainTheOnChainLink(player, isFinisher, skillAStats?)`: gain = (10|20) + theGainPerLinkBonus, cap `MAX_THE + theMaxBonus`; `consumeTheForUlt(player, maxOverride?)`; `isTheFull(player, maxOverride?)` helper mới
- Modify: `game/src/core/battle/UltimateSystem.ts` `canUsePhapTuUltimate` — dùng max có bonus
- Modify: `game/src/core/battle/BattleSystem.ts` — chỗ gọi `gainTheOnChainLink` (advanceChainAndGainThe ~2444) truyền runtime stats skill A (`getSkillRuntimeStat(player, 'theGainPerLinkBonus')` — đọc từ `player.skillStats`)
- Test: `game/src/core/battle/TheResourceSystem.test.ts` (mới)

- [x] **Step 1: Failing tests:** bonus +5/link → link 15, finisher 25; maxBonus +20 → cap 120, ult chỉ nổ khi ≥120; không bonus → y hệt hiện tại.
- [x] **Step 2:** FAIL → implement → PASS.
- [x] **Step 3: Thế Mãn hook:** buff `the_man_<el>` (duration Infinity, engine áp/gỡ) — implement trong `advanceChainAndGainThe` + `consumeTheForUlt`: khi `currentThe >= max` và chưa có buff → `apply` buff `the_man_<el>` (source=target=player); khi ult reset → `remove`. Element suy từ `chainDefinition`/ult id — truyền vào qua tham số `element` mới của 2 hàm (BattleSystem glue ở Task 12).
- [x] **Step 4:** test áp/gỡ the_man; PASS.
- [x] **Step 5: Commit** `feat(the): node-driven gain/max bonuses + The-Man buff (thuan-he E-7)` — `9923860`

---

### Task 7: E-8 — Node `selectsSpecialization`

**Files:**
- Modify: `game/src/core/progression/ProgressionNode.ts` `NodeEffect` (+`selectsSpecialization?: { skillId: string; specializationId: string }`)
- Modify: `game/src/core/game/GameManager.ts` `purchaseNode` — sau purchase, nếu effect có `selectsSpecialization` → `skillSystem.selectSpecialization(skillId, specializationId)`
- Test: `game/src/core/progression/NodeSystem.test.ts` (mở rộng) + GameManager test

- [x] **Step 1: Failing test:** mua node biến thể → skill.selectedSpecializationId đổi; mua node excludes → không cho mua cả 2.
- [x] **Step 2:** FAIL → implement → PASS.
- [x] **Step 3: Commit** `feat(nodes): selectsSpecialization node effect wires SkillSystem (thuan-he E-8)` — `6b89296`

---

### Task 8: E-6 — Ultimate profiles per-element

**Files:**
- Modify: `game/src/core/battle/UltimateSystem.ts` — `PHAP_TU_ULTIMATE_PROFILES: Record<ElementType, 'all' | 'single_boss_priority'>`; `triggerPhapTuUltimate(battle, element, nuke)` → thay vì nuke đồng nhất: resolve **effects của skill ult** qua `skillEffectSystem` (cần ctx — nhận thêm deps hoặc callback `runUltimateEffects` từ GameManager glue); profile `single_boss_priority` chọn boss/HP cao nhất, không splash.
- Modify: `game/src/core/game/GameManager.ts` — chỗ gọi trigger ult (auto + manual) build ctx đủ (buffRegistry, reactionManager như skill thường).
- Test: `UltimateSystem.phapTu.test.ts` (mở rộng — id mới ở Task 10 sẽ cập nhật Task 10)

- [x] **Step 1: Failing tests:** Kim Phạt → chỉ 1 target (boss ưu tiên), không tràn overkill; 4 ult kia → all_lanes.
- [x] **Step 2:** FAIL → implement → PASS.
- [x] **Step 3: Commit** `feat(ult): per-element phap tu ultimate profiles + effect-driven resolution (thuan-he E-6)` — `0d4bff1`

---

### Task 9: Buff mới + `bong` stack (N1 đã duyệt)

**Files:**
- Modify: `game/src/data/buff/buffs.ts` — thêm 8 buff §7 (`thanh_tuyen`, `bang_giap`, `hoi_luu`, `cau_mang_can`, `kim_giap`, `dia_tru`, `thanh_luy`, `the_man_fire/water/wood/metal/earth`); `bong`: `stackMode: 'stack'`, `maxStacks: 5`, `dpsRatio: 0.15`; `ngung_lo`/`khai_son` giữ nguyên (chỉ gỡ khỏi placeholder skill — Task 10).
- Test: `game/src/data/buff/buffs.test.ts` (mở rộng: count mới, bong stack shape)

- [x] **Step 1: Failing test:** bong stack 5 max, dpsRatio 0.15; 8 buff id mới tồn tại, đúng polarity/duration/effects.
- [x] **Step 2:** FAIL → implement → PASS.
- [x] **Step 3: Regression:** `BuffSystem.test.ts` (DoT tests dùng bong — cập nhật expectation dps nếu có), `BattleSystem.hoaThe.test.ts`.
- [x] **Step 4: Commit** `feat(buffs): thuan-he chain buffs + bong stackable (N1)` — `60ace5e` (+ fix `9ac033b` dia_tru biến thể)

---

### Task 10: Skills — 20 B–E + 5 ult mới (thay placeholder)

**Files:**
- Modify: `game/src/data/skill/Skills.ts` — xóa 25 placeholder (`chuc_dung_b`...`thien_ngo_b`...5 ult cũ), thêm 25 skill mới theo §2/§3 (tên/id/cơ chế/số liệu ĐÚNG TABLE trong spec — copy từ spec, không tự chế); cập nhật `CHAIN_SKILL_IDS`.
- Modify: `game/src/core/battle/UltimateSystem.ts` `PHAP_TU_ULTIMATE_IDS` (id mới).
- Test: `Skills.chain.test.ts` (id mới), `Skills.costInvariant.test.ts` (tự quét — phải PASS vì mọi skill mới có scaling), `UltimateSystem.phapTu.test.ts`.

- [x] **Step 1: Cập nhật test trước (red):** `Skills.chain.test.ts` trỏ id mới + assert id N2b (không `_b/_c`), damage effect nào cũng có `manaScalingRatio` + `attributeScaling`; ult có `buildTag: 'ult'`.
- [x] **Step 2:** FAIL.
- [x] **Step 3: Implement data** — 5 chuỗi × 4 skill + 5 ult theo spec §2/§3 tables (Hỏa: nam_minh_liet_hoa/tam_muoi_chan_hoa/chuc_dung_dan_no/hoa_ha_cuu_thien; Thủy: bat_dau_tran_thuy/thanh_tuyen_duong_linh/hoi_luu_thon_no/bac_hai_cuong_lan; Mộc: xuan_sanh_doc_duc/cau_mang_can_tri/van_moc_lan_doc/doc_vien_bao_can; Kim: thu_giap_kim_than/kim_lang_toan_phong/kim_chung_cong_huong/kim_luan_tran_ap; Thổ: hau_tho_tran_ach/dia_tru_thua_thien/con_lon_chan_dia/cuu_tru_dia_lao; Ult: tat_phuong_giang_the/bat_thu_can_quet/kien_moc_thong_thien/kim_phat_thu_sat/hau_tho_thanh_luy).
- [x] **Step 4:** PASS focused + `npx vitest run src/data/skill src/core/skill`.
- [x] **Step 5: Commit** `feat(skills): 20 thuan-he chain skills + 5 ultimates replace placeholders` — `b7fd4ab` (+ fix leech `9c094e3`)

---

### Task 11: Node tree Thuần — 17 node × 5 hành

**Files:**
- Modify: `game/src/data/progression/PhapTuNodes.ts` — thêm theo §5: `phap_tu_lap_dao` (major, gate Trúc Cơ, cost 0), `lap_dao_thuan_<el>` ×5 (cost 2, excludesNode 4 Thuần khác + `phap_tu_lap_dao_da_phap` placeholder id), 4 node unlock B/C/D/E/hành (id `linh_ngo_<skill id>`, realm gate C=golden_core/D=soul_transformation/E=tribulation), biến thể C1/C2 + D1/D2 (`selectsSpecialization` + excludes), node ult (prereq B), `tu_the_<el>` (5), `truong_the_<el>` (5), `the_man_<el>` (1).
- **KHÔNG xóa** keystone cũ (N4).
- Test: `game/src/data/progression/PhapTuNodes.dao.test.ts` (mới)

- [x] **Step 1: Failing tests:** mỗi hành đủ 17 node; chain prereq đúng thứ tự; biến thể excludes nhau; realm gate khớp REALM_SLOT_TABLE; Thế node `skillModifiers` lên skill A; `lap_dao_thuan` excludes 4 cái kia.
- [x] **Step 2:** FAIL → implement → PASS.
- [x] **Step 3: Commit** `feat(nodes): thuan-he chain node tree (lap dao, unlock, variants, the)` — `3abec26` (+ targeting override `22c8007`)

---

### Task 12: Glue — chain definition + ult wiring + tooltip

**Files:**
- Modify: `game/src/core/game/GameManager.ts` — khi battle start cho Pháp Tu: xác định element đang chọn (giai đoạn này: **element của skill A gần nhất trong loadout** hoặc chain duy nhất đã unlock — vì `PlayerData.phapTuDao` thuộc plan cha Task 12, CHƯA có; tạm suy từ node `lap_dao_thuan_<el>` đã mua: `activePlayer.nodeLevels` có id nào → element đó); `battleSystem.setChainDefinition({ skillIds: CHAIN_SKILL_IDS[element] })`; wire `triggerPhapTuUltimate` ctx (Task 8 deps).
- Modify: `game/src/composables/useEquipmentTooltip.ts`? — KHÔNG: tooltip skill ở `skill-path/SkillDetailView.vue`/`NodeInspector.vue` — thêm dòng render hitCount/spread/zone/add_stack/remove_buff/stacksPerAffectedTarget (mỗi nhánh nhỏ, có test).
- Test: `GameManager.phapTuChain.test.ts` (mới): mua `lap_dao_thuan_fire` + B/C/D/E → start battle → chain gate hoạt động (B không cast được trước A); ult Thế đầy → nổ đúng profile.

- [x] **Step 1: Failing test** chain glue + ult glue.
- [x] **Step 2:** FAIL → implement → PASS.
- [x] **Step 3: Tooltip branches** + component tests — commit `38b5bdb` (2026-09-03 19:01, 4 file: helper + test, component + test; session song song của user — nội dung khớp Task 12b)
- [x] **Step 4: Commit** chain/ult `666bf1f` + tooltip `38b5bdb`

---

### Task 12b: Commit tooltip còn lại (✅ DONE 2026-09-03 — commit `38b5bdb` tạo từ session song song của user, nội dung đúng 4 file dự kiến; focused tests 11/11 PASS được verify lại 19:16)

**Files:**
- Commit 3 file đã có trên disk (KHÔNG viết lại):
  - Create: `game/src/core/skill/SkillMechanicDescriptions.ts` (helper core-no-i18n, đã có test `SkillMechanicDescriptions.test.ts` — 142 dòng, PASS trong full suite)
  - Create: `game/src/components/panels/skill-path/SkillDetailView.test.ts` (85 dòng, PASS)
  - Modify: `game/src/components/panels/skill-path/SkillDetailView.vue` (thêm `mechanicLines` computed + `<ul class="skill-detail__mechanics">`)

- [x] **Step 1:** `npx vitest run src/core/skill/SkillMechanicDescriptions.test.ts src/components/panels/skill-path/SkillDetailView.test.ts` → PASS (11/11, 2026-09-03 19:16).
- [x] **Step 2: Commit** `feat(ui): skill-detail mechanic lines for thuan-he engine effects (thuan-he Task 12 tooltip)` — DONE với commit id khác: `38b5bdb` "feat(ui): skill mechanic tooltip lines..." (4 file, 369 insertions).

---

### Task 13: Final verification (REMAINING — rewritten 2026-09-03)

- [x] `npm.cmd run type-check` PASS (2026-09-03)
- [x] `npx vitest run` full PASS — 2318/2318 (baseline 2134+, không regress)
- [x] `npm.cmd run build` PASS (2026-09-03)
- [x] `npx playwright test tests/e2e/boot-fresh.spec.ts tests/e2e/create-to-combat.spec.ts` PASS (guest không có node → không chain → không vỡ)
- [x] QA quick mode (`tutienidle-adversarial-qa`) — **PASS WITH GAPS** (`game/docs/qa/2026-09-03-phap-tu-thuan-he-task12-quick.md`); không escalate deep (rủi ro bound được bằng code inspection — xem mục Scope and Risk Map trong report). Gap: thiếu nút ult thủ công trong `PhapTuCombatHud.vue` (Coverage gap Medium — chờ user quyết phạm vi, engine `tryPlayerUltimate()` đã sẵn branch Pháp Tu).
- [x] Update `game/docs/newPhapTuDesignSpec.md` trạng thái → IMPLEMENTED (§0.b bảng trạng thái, rewrite 2026-09-03)
- [x] Update `game/docs/roadmap.md` 7.4/8.5 — ghi worktree `phap-tu-thuan-he` + trạng thái Task 1–12b commit + QA verdict
- [x] Sau Task 12b commit: chạy lại focused test (tooltip) trước khi khai hoàn tất; QA verdict `PASS WITH GAPS` — theo AGENTS.md đây là non-completion state cho tới khi gap được user chấp nhận là ngoài phạm vi hoặc được xử lý. **Chờ user quyết.**

## Execution Notes

> **Rewrite note (2026-09-03, giữa chừng):** plan gốc viết khi chưa có code. Bản này được rà lại giữa chừng: Task 1–12 (chain/ult glue) đã commit; merge master `0239f3f` port E-5 vào HazardZoneSystem + E-1/E-2 ctx vào SkillEffectResolver sau Phase 7 split — chi tiết hiện trạng cuối xem `game/docs/newPhapTuDesignSpec.md` §0.b.

- Task 1-8 (engine) độc lập tương đối — có thể song song trong phase nhưng tuần tự theo số để dễ review; Task 9-10 (data) sau engine; 11 sau 10 (node unlock trỏ id mới); 12 sau 11. *(Thực tế: đúng trình tự này, trừ Task 12 tooltip tách thành 12b còn lại.)*
- Mỗi task 1 commit; KHÔNG merge master giữa chừng; user quyết merge. *(Thực tế: có 1 merge master → thuan-he `0239f3f` để port engine theo Phase 7 split — do user chấp nhận trong review round.)*
- Số liệu skill/buff/node là KHỞI ĐIỂM playtest — test khóa cấu trúc (id, shape, prereq), không khóa số tuyệt đối trừ spec đã ghi (cd/cast bảng §1.2).
- `bong` stack (N1) ảnh hưởng cảm giác Hỏa cũ — chấp nhận theo spec đã duyệt; nếu playtest phản đối, chỉ đổi `dpsRatio`/`maxStacks` (data-only).
- `phapTuDao` + refund + Đa Pháp + Thân Hòa + adjacency + UI sao 5 cánh = plan cha Task 12-16, KHÔNG thuộc plan này.
- Untracked `buffs-report.json` ở root worktree là QA artifact (18/18 pass) — KHÔNG commit, KHÔNG xóa (Iron Rule), chờ user quyết.
