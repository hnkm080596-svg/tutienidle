# Mainline Quest Chain (Nhiệm Vụ Chính Tuyến) — Design Draft

2026-10-03 · read-only design for Minh · scope: Phàm Nhân → Trúc Cơ vertical slice (beta)

User intent: *"nhiệm vụ chính tuyến đầu tiên rồi. Chính tuyến sẽ là chuỗi làm quen + giới thiệu chức năng + tăng cảnh giới"* — starter quests auto-admit on character creation.

---

## 0. What exists today (survey summary)

- `Quest` (`core/quest/Quest.ts`): `id`, `name`, `description`, `condition` (`collect | kill`), `reward` (`reward` → `spiritStone/cultivation/skillInsight` + `itemDrops`), `cadence` (`once | daily`), `requiredRealmId?`. **Only two condition kinds exist.** `daily` is scope-hidden in beta (`isBetaQuestEnabled` returns false).
- Admission (`QuestSystem.reconcileActiveQuests`): the ONE lifecycle command; activates every unlocked, not-yet-completed quest. Idempotent; no retroactive credit (counting starts at activation). Inverse pass deactivates quests whose gate closed.
- Admission triggers today: save restore (`GameManagerSaveRestore` → `reconcileQuestLifecycle`, last step) and realm transition (`markQuestRealmTransition` → next tick). **Nothing reconciles at fresh character creation** — a brand-new character sees an empty quest panel until the next boot's restore or a realm advance.
- Claim (`GameManagerQuestOps.claimQuest` → `QuestSystem.claim`): grants reward, debits collect turn-in, `markClaimed` + `markCompletedOnce` (once-cadence). No post-claim reconcile today.
- Save slice `quests`: `QuestManagerState { active[], completedOnceIds[], lastDailyResetAtMs }`. `saveShapeValidation` enforces per-entry shape and **rejects duplicated active questIds** (`F-QUEST-DUP`).
- Beta quest policy (`isBetaQuestEnabled`, `betaScope.ts`): daily off; explicit `enemyId` kill quests must target the 12-id beta roster; generic kills and collects always pass.
- Data guards: `quests.betaRoster.qa.test.ts` pins that every explicit kill target is spawnable on a beta stage and inventories `kill_wild_wolf_10`, `kill_foundation_stone_fungus_15`, `kill_foundation_floor_10_boss_1`, `kill_foundation_flood_dragon_whelp_10`; `quests.test.ts` pins the 5-quest foundation set and the daily-removal.
- Stage content: one zone `thanh_van`, 3 chapters × 10 floors. Act I (mortal): boar/tiger/wolf bands + `mortal_ferocious_giant_crocodile` boss. Act II (qi): `wild_wolf`/`flame_fox`/`giant_earthworm` + `ferocious_flood_serpent` boss. Act III (foundation): `foundation_lava_hound`/`foundation_sand_scorpion`/`foundation_mud_golem` + `foundation_ferocious_flood_dragon_whelp`.
- Realm gates: mortal→qi = `commitFiveElementInitiation` (mortal `realmLevel ≥ 12`, spell_pathway + element + `five_elements_art` committed atomically); qi→foundation = tribulation requiring `realmLevel ≥ 12` **and** `completedStageIds` contains `qi_refining_abyssal_pool` (`BreakthroughGate`).
- Production (Sản Xuất): 3 auto-restarting sites at creation — `thanh_van_lam` (wood), `thanh_van_quang` (ore), `thanh_van_dong_thien` (herbs); output realm clamps to player realm; `manualWorkforce` is scope-hidden (workers auto).
- Panels: `QuestPanel.vue` (standalone panel `'quest'`, command-wheel slot `quest`) groups rows by `cadence` only; `completedStageIds` exists on `PlayerData` as a stage-clear witness.

---

## 1. Chain spec — ~15 quests

Idiom: `main_NN_<slug>` (English action prefix + VN content slug, matching `collect_tu_linh_thao_1` / `kill_wild_wolf_10` naming). All `cadence: 'once'`. All ids reference real data: enemies from `BETA_ENEMY_ROSTER`/stage rosters, materials from the profession catalog (`<realm>_<kind>_<age>` grammar), pills from `PillFamilies`.

Rewards are deliberately conservative first-pass (mortal kills pay 1–2 SS each; existing once-quests pay 20–800 SS, 4000 cultivation, 120–200 skillInsight).

### Phase I — Phàm Nhân (teaches combat + Sản Xuất)

| # | id | Tên / Mô tả | Condition | Reward | Unlock gate | Teaches |
|---|----|-------------|-----------|--------|-------------|---------|
| 1 | `main_01_da_san_dau_tien` | **Săn Mồi Đầu Tiên** — "Vào Thanh Vân Động 1, đánh bại 3 Dã Trư." | kill `mortal_wild_boar` ×3 | SS 10 | — (auto at creation) | stage_select + first combat |
| 2 | `main_02_lam_chi_san` | **Lâm Chi Sản** — "Mở Sản Xuất, để Thanh Vân Lâm tự khai thác — nộp 3 Thập Niên Linh Mộc Phàm Nhân." | collect `mortal_wood_decade` ×3 | SS 10 | main_01 | Khai Vật Đường / auto-worker production |
| 3 | `main_03_ho_khieu_lam_trung` | **Hổ Khiếu Lâm Trung** — "Man Hổ chiếm giữ Động 4–6 — đánh bại 5 con." | kill `mortal_savage_tiger` ×5 | SS 15 + Tu Vi 50 | main_02 | push mid floors |
| 4 | `main_04_quang_chi_nguyen` | **Quáng Chi Nguyên** — "Huyền Thiết Quảng chảy về Khí Đường — nộp 3 Thập Niên Linh Khoáng Phàm Nhân." | collect `mortal_ore_decade` ×3 | SS 15 | main_03 | Quáng production; ore → equipment loop |
| 5 | `main_05_thuy_lang_dam` | **Thủy Lang Ẩm Đàm** — "Đoạn hang ngập nước là địa bàn Thủy Lang — diệt 5 con." | kill `mortal_water_wolf` ×5 | SS 20 + Tu Vi 80 | main_04 | floors 7–9 |
| 6 | `main_06_vuong_gia_da_de` | **Vương Giả Đá Đề** — "Hung Cự Ngạc ngự trị đáy Động 10 — diệt 5 con, dọn đường tới Luyện Khí." | kill `mortal_ferocious_giant_crocodile` ×5 | SS 40 + Tu Vi 120 | main_05 | Act-I boss / chapter clear |

### Phase II — Luyện Khí (teaches Quán Khí + skill tree + alchemy + Khí Đường)

| # | id | Tên / Mô tả | Condition | Reward | Unlock gate | Teaches |
|---|----|-------------|-----------|--------|-------------|---------|
| 7 | `main_07_ngu_hanh_nhap_mon` | **Ngũ Hành Nhập Môn** — "Đạt Phàm Nhân tầng 12 rồi làm lễ Quán Khí chọn một hành. Sau khi nhập môn, săn 5 Dã Lang nơi Quật 1–3." | `requiredRealmId: 'qi_refining'` + kill `wild_wolf` ×5 | SS 30 + Tu Vi 150 + Cảm Ngộ 5 | main_06 | initiation ritual (realm up), technique `five_elements_art`, Act-II start |
| 8 | `main_08_viem_ho_coc` | **Viêm Hồ Xích Cốc** — "Quật 4–6 rực lửa, Viêm Hồ chặn đường — diệt 5 con." | kill `flame_fox` ×5 | SS 40 + Cảm Ngộ 10 | main_07 | mid Act-II (alternates combat/economy) |
| 9 | `collect_tu_linh_thao_1` *(fold-in, keep id)* | **Dự Trữ Tụ Linh Thảo** *(rename: **Động Thiên Dị Thảo**)* — "Động Thiên nuôi linh thảo chủ dược — nộp 5 Tụ Linh Thảo." | collect `tu_linh_thao_qi_refining_decade` ×5 | SS 20 (existing) | main_08 | Động Thiên herb production → alchemy lead-in |
| 10 | `main_10_dan_lo_so_khai` | **Đan Lò Sơ Khai** — "Vào Đan Phòng, luyện chế thành công một viên đan dược bất kỳ." | *flag `alchemy.crafted` (Phase-2 kind — see §4)*; v1 fallback: collect `tu_linh_thao_qi_refining_decade` ×8 | SS 30 + itemDrop pill `tu_linh_dan_qi_refining` ×1 | main_09 | alchemy (Đan Phòng) |
| 11 | `collect_qi_refining_ore_decade_1` *(fold-in, keep id)* | **Thu Thập Thập Niên Linh Khoáng** — "Nộp 3 Thập Niên Linh Khoáng." | collect `qi_refining_ore_decade` ×3 | SS 30 (existing) | main_10 | ore → Khí Đường Cường Hóa |
| 12 | `main_12_trun_don_khoang` | **Trùn Đồn Khoáng** — "Trùn Đất khổng lồ ngầm Quật 7–9 — diệt 5 con." | kill `giant_earthworm` ×5 | SS 45 + Tu Vi 200 | main_11 | late Act-II |
| 13 | `main_13_giao_xa_uyen_dam` | **Giao Xà Uyên Đàm** — "Hung Giao Xà trấn Quật 10 — diệt 5 con. Đây là điều kiện độ kiếp Trúc Cơ." | kill `ferocious_flood_serpent` ×5 | SS 60 + Cảm Ngộ 10 | main_12 | chapter-clear requirement (`qi_refining_abyssal_pool`) |

### Phase III — Trúc Cơ (đột phá + hậu sơn)

| # | id | Tên / Mô tả | Condition | Reward | Unlock gate | Teaches |
|---|----|-------------|-----------|--------|-------------|---------|
| 14 | `main_14_do_kiep_truc_co` | **Độ Kiếp Trúc Cơ** — "Tầng 12 + vượt Quật 10 mở lôi kiếp — độ kiếp thành công, bước chân đầu vào hậu sơn: diệt 5 Dực Hỏa Khuyển." | `requiredRealmId: 'foundation_establishment'` + kill `foundation_lava_hound` ×5 | SS 100 + Tu Vi 500 | main_13 | tribulation → realm up → Act-III start |
| 15 | `main_15_giao_sung_chung_cuc` | **Giao Sủng Chung Cực** — "Hung Giao Sủng cuồng nộ đáy hàn thạch đàm — diệt 5 con, khép lại chính tuyến beta." | kill `foundation_ferocious_flood_dragon_whelp` ×5 | SS 200 + Cảm Ngộ 30 | main_14 | chain finale (Act-III boss) |

### Phase-2 optional inserts (require the `flag` condition kind — §4)

| Slot | id | Tên | Flag | Teaches |
|------|----|-----|------|---------|
| after 6 | `main_06b_giap_than` | **Giáp Thân** — "Mặc món trang bị đầu tiên rơi từ quái thú." | `equipment.equipped` | Khí Đường equip (`base_kiem` drops in Act I) |
| after 7 | `main_07b_linh_ngo` | **Linh Ngộ Chi Điểm** — "Mở Kỹ Năng, mua 1 node đầu tiên trên cây cảm ngộ." | `node.purchased` | skill tree / insight spend |
| alt-13 | `main_13b_quat_muoi` | **Thanh Quật Thập** — "Dọn sạch Quật 10 Huyền Đàm Uyên." | `stage.cleared.qi_refining_abyssal_pool` | precise zone-clear (better than boss-kill proxy — see §5 note) |
| inside 14 | `main_14a_loi_kiep` | **Lôi Kiếp Giáng Lâm** — "Khởi động độ kiếp Trúc Cơ một lần (thành bại không tính)." | `tribulation.attempted` | tribulation as its own beat, not only post-success gate |

---

## 2. Auto-admission design

**Owner: `QuestSystem` lifecycle seam — same one already used (`reconcileActiveQuests`). No new admission authority.** Every member of the chain activates through the existing command; the chain only adds a new clause to eligibility.

1. **Eligibility clause (new):** `isUnlocked` gains a chain check — a quest with `unlocksAfterQuestId` is unlocked only when `manager.isCompletedOnce(unlocksAfterQuestId)`. (`isUnlocked` is private inside `QuestSystem.ts`; the change is one parameter + one line.)
2. **Trigger — quest 1 at creation:** `initializeCharacter()` (services/character) ends with `gameManager.setActivePlayer(player)`; append `gameManager.tickOps.reconcileQuestLifecycle()` there. It is the single funnel for local creation, Supabase creation, and `CHARACTER_UNINITIALIZED` reconstruction — the head quest (`main_01`, no gates) activates on the first frame. The call is idempotent and runs after `setActivePlayer`, so `getActivePlayer()` inside reconcile resolves.
3. **Trigger — quest N+1 on claim:** in `GameManagerQuestOps.claimQuest`, after `claimed === true`, call `questSystem.reconcileActiveQuests(registry, manager, player)` (player already in scope). The claim writes `completedOnceIds` first, so the successor admits in the same user gesture — the panel refresh (`bumpState`) already runs. Cost: one registry scan per claim, trivial.
4. **Existing seams keep working:** boot/restore reconcile and the realm-transition flag cover realm-gated chain members (`main_07`, `main_14`) — the initiation/tribulation realm write already calls `markQuestRealmTransition`, so the next quest activates on the tick after a realm-up even without a claim.
5. **Why not GameManager/creation-service-owned sequencing:** a "watch for next chain id" pointer would duplicate `completedOnceIds` (already the durable witness) and add a second admission authority (violates the AR-09 single-lifecycle-seam rule).
6. **'once' + dedup safety:** chain members are all `once`; the gate reads `completedOnceIds`, which is written exactly once at claim. `ensureActive` dedups on `getProgress` first-match, so the validator's `F-QUEST-DUP` invariant can't fire — admission of each id happens at most once per save. Progress counting still starts at activation (no retroactive credit) — a designed property: the player can't bank progress on a quest they haven't been handed.
7. **Edge — carried saves:** a pre-chain save with `completedOnceIds` populated reconciles into whatever chain position its completions imply; unstarted chain quests whose predecessors are complete activate at next reconcile. A save past the chain's era (foundation quests done) simply finds the chain already completable head-to-tail — acceptable for a beta-wipe roadmap; if a mid-progress chain save must exist, keep the fold-in ids (`collect_tu_linh_thao_1`, `collect_qi_refining_ore_decade_1`, `kill_wild_wolf_10` if folded) so progress survives.

---

## 3. Data-model delta (minimal-change preferred)

Two additive optional fields on `Quest` — no save-shape change, no registry change:

```ts
export interface Quest {
  // ... existing fields ...
  /** Chain admission gate: unlocked only after this quest is in completedOnceIds. */
  unlocksAfterQuestId?: string
  /** UI grouping/marker; 'mainline' renders under the Chính Tuyến group. */
  chainId?: 'mainline'
}
```

- `unlocksAfterQuestId` is the whole ordering mechanism — chain order is derived by walking predecessors (no `order` integer to keep in sync; a rename only updates one neighbor).
- `chainId` is deliberately a string-literal union (`'mainline'`) rather than boolean — future chains (`'hau_son'`, event chains) reuse the same slot without a schema bump. (Optionally rename to `chain?: 'mainline'`; both are one line — pick whichever reads better next to `requiredRealmId`.)
- Registry untouched — `QuestRegistry.register` already rejects duplicate ids.
- Data-guards to add in `quests.test.ts`: every `unlocksAfterQuestId` resolves to a registered id; no cycles (walk terminates); chain members are `cadence: 'once'`; at most one chain member has no `unlocksAfterQuestId` (the head).
- Save shape: **unchanged** — `completedOnceIds` is the chain witness; `active` list stays consistent because admission still only flows through `ensureActive`.
- Alternative considered and rejected: a separate `MAINLINE_QUESTS` registry + `nextQuestId` pointer on `QuestManagerState`. It adds a second catalog to keep in sync, a new persisted field (save-version bump + validation), and duplicates what `completedOnceIds` already proves — heavier for zero behavioral gain.
- **Phase-2 delta (only if feature-witness quests are wanted):** new `QuestCondition` member `{ kind: 'flag'; flagId: string; amount?: number }`, a `questFlags: string[]` (or `Record<string, number>`) slice on `QuestManagerState` (+ `saveShapeValidation` dedup-string rule mirroring `completedOnceIds`), and one emission line per domain seam: `EquipmentSystem.equip` → `equipment.equipped`; `AlchemySystem` settle success → `alchemy.crafted`; node purchase op → `node.purchased`; stage-completion write (where `completedStageIds.push` happens) → `stage.cleared.<stageId>`; `TribulationDirector.start` → `tribulation.attempted`. `QuestSystem.onFlag(flagId)` increments matching active flag-quests — same pattern as `onEnemyDefeated`/`onMaterialCollected`.

---

## 4. UI surfacing

- **Panel:** existing `QuestPanel.vue` (standalone `'quest'`, command-wheel slot `quest` — the "17/quest scene" surface). Add a third section above the current `once` group:
  - group key `panels.quest.groups.mainline` → `"Chính Tuyến"` (vi) / `"Mainline"` (en).
  - rows sorted by chain order (walk `unlocksAfterQuestId` backwards from each active `chainId === 'mainline'` quest).
  - card marker: small gold chip/badge `Chính Tuyến` next to the name (reuse `.quest-panel__reward` chip styling or a new `--mainline` accent).
- **Optional locked-preview (design choice):** render the immediate next unmet chain quest greyed with requirement text ("Hoàn thành: <prev name>"). Cheap because the chain is linear; fits the beta `progression-locked` presentation class (locked-but-renderable). Off by default in the spec — flag to Minh.
- **Command-wheel slot `quest`:** optional dot/badge when a mainline quest is claimable (there's no badge infra on wheel slots today — phase-2 polish, not required for v1).
- **Claim-adjacent UX:** `claimQuest` already pushes a `Hoàn thành:` toast; the post-claim reconcile makes the successor appear in the same panel state — no extra wiring.

---

## 5. Conflicts with the existing `once` set — keep / rename / fold

| Existing quest | Overlap | Recommendation |
|---|---|---|
| `collect_tu_linh_thao_1` (5× herb, SS 20) | Same beat as chain #9 (Động Thiên intro) | **Fold into chain** — keep id, add `chainId`+`unlocksAfterQuestId`, rename to "Động Thiên Dị Thảo" (optional). Save progress/`completedOnceIds` survives. |
| `collect_qi_refining_ore_decade_1` (3× ore, SS 30) | Same beat as chain #11 | **Fold** — same treatment. |
| `kill_wild_wolf_10` (10× `wild_wolf`, SS 25) | Duplicates chain #7/#8 Act-II combat beats; and it activates ungated at mortal where it can't progress (qi stages are realm-gated) — confusing empty-progress row on a new character | **Fold into chain** — keep id (pinned by `quests.betaRoster.qa.test.ts` inventory assertion) or merge semantics: make it chain step 8 with amount 10 vs authored `flame_fox` beat — pick ONE Act-II kill per chain step; if renamed/deleted, the roster-QA inventory test must be updated in the same PR. |
| 5× foundation `once` quests (mud golem, floor-10 boss, 30-ore, whelp ×10, any-50) | No tutorial-beat overlap; they are a de-facto Trúc Cơ side set | **Keep as side quests.** Do NOT fold — they duplicate boss kills at higher amounts (15/10/50 vs chain's 5). Optionally tag `chainId` later as a second "Hậu Sơn" chain. |

**Precision caveat (boss-kill proxy):** floor-10 enemy pools are 100% the boss identity — `kill ferocious_flood_serpent ×5` completes on ordinary wave kills, not the actual boss variant or the stage clear. For "chapter cleared" semantics use the Phase-2 `stage.cleared.<stageId>` flag (backed by `completedStageIds`) — the kill-count version is only an approximation and is what §1 uses for v1.

**Scope-hidden neighbors:** `manualWorkforce` is off — the Sản Xuất tutorial (quest 2) teaches *auto*-worker production, not manual assignment (there is no manual surface in beta). `dailyQuest` off — no daily group renders; the panel's `daily` section already self-hides. Companion/formation/artifact/sword/body/hidden paths are all off — the chain touches none of them.

---

## 6. Open questions for Minh

1. **Reward numbers** — all amounts are conservative first-pass; wants your tuning eye (esp. cultivation vs realm-level pacing: does 500 Tu Vi at quest 14 matter relative to Trúc Cơ baseCultivationMinutes=64/tier?).
2. **Naming** — is `Chính Tuyến` the panel label and are the per-quest Vietnamese names in your voice? (`main_NN_` id scheme OK?)
3. **Chain end** — stop at Trúc Cơ floor-10 boss (this draft), or extend into the existing 5 foundation quests as a linked "Hậu Sơn" arc?
4. **Phase-2 `flag` kind** — worth the extra condition kind for equip/node/alchemy/tribulation-attempt beats, or keep v1 strictly collect+kill and let descriptions carry the feature intros? (Recommend Phase-2 — 4 beats currently have no honest condition.)
5. **Locked-preview** — show the next unmet chain quest as a greyed `progression-locked` row, or keep the panel strictly "what's active"?
6. **Fold vs keep `kill_wild_wolf_10`** — fold (one Act-II kill beat) or keep it as a parallel side quest alongside `flame_fox`/`giant_earthworm` chain steps? Its early activation at mortal is a minor UI wart either way once chain gating exists (suggest gating it behind initiation or folding).
7. **`main_15` finale** — after the chain ends, do you want a small "chain complete" grant/title, or is the boss kill + existing foundation quests enough closure for beta?

---

## Appendix — file/symbol references

- `game/src/core/quest/Quest.ts` — `Quest`, `QuestCondition`, `QuestCadence`, `QuestReward`
- `game/src/core/quest/QuestSystem.ts` — `reconcileActiveQuests`, `isUnlocked` (private), `claim`, `onEnemyDefeated`, `onMaterialCollected`
- `game/src/core/quest/QuestManager.ts` — `ensureActive`, `markCompletedOnce`, `deactivate`, `QuestManagerState`
- `game/src/core/game/GameManagerQuestOps.ts` — `claimQuest` (post-claim reconcile insertion point), `notifyMaterialGained`
- `game/src/core/game/GameManagerTickOps.ts` — `reconcileQuestLifecycle`, `markQuestRealmTransition`
- `game/src/core/game/GameManagerSaveRestore.ts` (~line 482) — restore-time reconcile (last step)
- `game/src/services/character/initializeCharacter.ts` — creation funnel (insert reconcile after `setActivePlayer`)
- `game/src/core/betaScope.ts` — `isBetaQuestEnabled`, `BETA_ENEMY_ROSTER`, `BETA_FEATURES`
- `game/src/data/quest/quests.ts` — 8 authored once-quests
- `game/src/data/stage/{Stages,ChapterStages,Zones}.ts` — act rosters, floor rules, single zone `thanh_van`
- `game/src/core/realm/BreakthroughGate.ts`, `realmSystem.ts` — `CORE_REALM_LEVEL` 12, `QI_REFINING_BREAKTHROUGH_STAGE_ID`
- `game/src/core/game/GameManagerRealmAdvanceOps.ts` — `commitFiveElementInitiation`, `commitInitiationRealmAdvance`
- `game/src/data/materials/materials.ts` — `<realm>_wood|ore_<age>`, `<herbBase>_<age>` grammars
- `game/src/core/production/ProductionCatalog.ts` — Thanh Vân sites/rewards
- `game/src/components/panels/QuestPanel.vue` + `game/src/locales/{vi,en}.json` — `panels.quest.*` keys
- `game/docs/naming-conventions.md` — N2/N4 id rules
