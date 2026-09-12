# Perfect Clear + Enemy Tag System — Design Spec

- **Ngày:** 2026-09-11 — **BẢN 3** (thay thế bản 2 sau phản biện user; các thay đổi đánh dấu [MỚI]/[SỬA]/[XÓA])
- **Trạng thái:** CHỜ USER REVIEW bản 3
- **Việc roadmap:** 9.5 #4 (perfectClearTurnLimit) + generalize elite spawn thành tag system
- **Lịch sử:** bản 1 = stage Tinh Anh riêng (HỦY); bản 2 = tag system + builder (HỦY phần boss-as-tag); bản 3 = boss là stage property, tag chỉ là "thêm".

---

## 0. Quyết định đã chốt (bản 3)

| # | Quyết định | Nguồn |
|---|---|---|
| D1 | Hoàn Mỹ = **mọi member `players[]` còn `alive` lúc victory** + `totalTurnsElapsed < perfectClearTurnLimit`. [SỬA từ v2] Predicate áp CHỈ mode active (idle không chạy battle nên không bao giờ evaluate). Chết-then-hồi-sinh OK. Ghi 1 lần, không overwrite. | user giữ + v3 A1 |
| D2 | ~~**perfectClearTurnLimit chốt cứng: stage thường = 3, boss (floor 10) = 5.**~~ [SỬA từ v2 — bỏ placeholder 2×total/14 theo chỉ đạo A2] **[SỬA 2026-09-12 — QA hyp. (e) đo thật: 3/5 theo actor-action KHÔNG THỂ đạt ở floor 1-9 (best-case 32/69/67 action). User chốt lại: (1) đơn vị = ATB ROUND (`TurnBattle.roundsElapsed` — round đóng khi mọi actor còn sống đã hành động ≥1 lần; quái spawn giữa round gia nhập round hiện tại), (2) số = `totalEnemyCount + 10` floor 1-9 (20…28) / `15` boss. Quy tắc sống trong builder, không registry. Evidence: `docs/qa/2026-09-12-pc-tag-system-quick.md`.]** | user v3 A2; sửa 2026-09-12 |
| D3 | **Enemy Tag System**: tag = modifier data-driven kiểu Diablo 2 (stat multiply + prefix + flag), **chỉ chứa tag "thêm" — tinh_anh (+ tương lai)**. [SỬA lớn từ v2: BOSS KHÔNG PHẢI TAG] Mỗi tag 1 lần (dedupe), stack nhân liên tiếp, priority sort trước fold. | user v3 |
| D4 | **Boss là stage property, không phải tag.** Floor 10 → `createBossVariant` áp unconditional cho CẢ idle lẫn active. KHÔNG qua tag pipeline; `createBossVariant` GIỮ NGUYÊN — không migrate. | user v3 sửa lớn |
| D5 | **Idle vs Active — 2 kênh 2 mục đích** (chi tiết §2.2). Idle KHÔNG roll tag; Active roll `eliteChance 0.1` gắn tag tinh_anh. | user v3 A1 |
| D6 | [SỬA từ v2] **Idle giữ nguyên hiện trạng đã QA**: rate cá nhân hóa `cycleSeconds = perfectClearSeconds/2`, gate Perfect Clear giữ (idle chỉ mở cho stage đã PC), offline cap 24h chung GameClock (single source). | user chốt Q3 v3 |
| D7 | Stat base 46 loài giữ nguyên authored. Tag multiplier tham chiếu `applyEliteMultiplier` (không copy số — A9). Factory tier 4+ ghi note roadmap. | user giữ từ v2 |
| D8 | [MỚI] **Reward khi stack boss+tinh_anh: KHÔNG xử trong mission này** — tag tinh_anh stack chỉ nhân stat + prefix + flag; rewards theo data authored hiện có. Ghi debt roadmap: "hệ thống drop hoàn thiện". **[SỬA 2026-09-12 — nợ này ĐÃ ĐƯỢC THIẾT KẾ, xem `2026-09-12-drop-system-design.md`.** Hai điểm trong cách diễn đạt cũ của D8 nay đã sai và được sửa ở đó: (a) **tiền không nhân dồn** — luật chốt là `currency = 1 + sum(currencyBonus)`, chặn ở `MAX_CURRENCY_MULTIPLIER = 4`; phép **nhân liên tiếp của D3/§2.1 chỉ áp cho STAT**, không áp cho reward; (b) cái được nâng là **chất** (`ItemQuality`, 5 nấc `hoang→tien`), **không phải "bậc cảnh giới"**, và **chỉ trang bị mới có chất** — số nấc = `clamp(len(modifiers) − 1, 0, 2)`, nên boss đơn hoặc tinh_anh đơn đều **không** được nâng.**] | user chốt Q1 v3; sửa 2026-09-12 |
| D9 | [MỚI] Builder `defineChapterStages` giữ từ v2 (D5 cũ): 3 config chương + quy định chung 1 nơi; bossEnemyId chỉ floor 10; X cứng 3/5 theo D2. | user giữ |

## 1. Hiện trạng (evidence) — [SỬA: bổ sung bằng chứng mode/idle]

- `recordPerfectClearIfEligible` (`GameManagerTurnBattleOps.ts`): HP-loss ≤75% của `players[0]` + turns < X. 0/30 stage có X → chip Hoàn Mỹ disabled.
- `createEliteVariant`/`createBossVariant` (`Enemy.ts`): 2 hàm hardcode — stat multiplier (qua `applyEliteMultiplier`/`applyBossMultiplier`), prefix tên, rewards switch (`eliteRewards ?? rewards` / `bossRewards ?? eliteRewards ?? rewards`), set flag. `applyEliteMultiplier` CHỈ nhân stat — **không có hệ số reward nào trong hàm** (bằng chứng cho D8).
- `eliteChance: 0.1` authored trên entry elite-eligible mọi stage; roll tại `pickEnemyForSpawn:163`. Signature hiện: `pickEnemyForSpawn(stage, isFinalSpawn)` — mode plumbing qua option mới (xem §2.2).
- Auto-farm (idle): `rollAutoFarmCycleReward` (`GameManagerTurnBattleOps.ts:1564`) — gọi `pickEnemyForTurnSpawn` (wrapper `pickEnemyForSpawn`); cycle = `perfectClearSeconds/2`; cap offline `DEFAULT_MAX_OFFLINE_SECONDS = 24h` (GameClock single source); gate = `perfectClearStageIds`. **Idle hôm nay roll đủ itemDrops qua BattleLootSystem** — giữ (D6).
- Boss spawn: `isFinalSpawn && floor === 10 && bossEnemyId` → `createBossVariant`. Floor 1-9 khai `bossEnemyId` metadata giả → UI badge Boss sai 30/30 node.
- ~~`totalTurnsElapsed` (`TurnBattleSystem.ts:595`) tăng sau **mỗi 1 actor action** (kể cả lượt quái) — định nghĩa "turn" cho PC.~~ [MỚI — đóng open question Q1] **[SỬA 2026-09-12: PC đếm `roundsElapsed` (xem D2); `totalTurnsElapsed` giữ nguyên cho boss trigger / sudden death.]**
- Builder rules đo được: total = 9+floor; waves floor 1-9 = chia đều 3 phần dư phân bổ dần từ phần 2 (10→[3,3,4], 11→[3,4,4], 14→[4,5,5], 17→[5,6,6]); floor 10 waves = [total]; pool = [common w5, elite w3 eliteChance 0.1]; spawnInterval 3s.

## 2. Target behavior

### 2.1 Tag system [SỬA từ v2 — boss rút khỏi registry]

```ts
// core/enemy/EnemyTag.ts — generic contract
export interface EnemyTag {
  id: string
  namePrefix?: string
  applyStat?: (stats: Stats) => Stats      // tham chiếu applyEliteMultiplier — không copy số
  combatFlag?: 'isElite'                    // chỉ flag "thêm"; boss flag do createBossVariant set
  priority?: number                          // [MỚI B3] sort GIẢM dần trước fold; tag cùng priority giữ thứ tự khai báo
  // rewardMultiplier / item tier-up: KHÔNG có trong v1 — D8 debt
}

export function applyEnemyTags(enemy: Enemy, tagIds: readonly string[], registry: EnemyTagRegistry): Enemy
```

- Applier: dedupe → sort theo priority giảm dần (ổn định) → fold `applyStat` (stack nhân: quái thường + tinh_anh = HP ×2.5; boss + tinh_anh = ×7 ×2.5) → prefix ghép theo thứ tự tag → set flag isElite.
- **Rewards KHÔNG đổi khi apply tag trong v1** (D8): tinh_anh trên quái thường → rewards vẫn theo data authored của enemy; boss+tinh_anh → bossRewards chain của createBossVariant. Debt ghi roadmap.
- Tag data v1 (data/enemy/EnemyTags.ts): duy nhất `tinh_anh` — hiện thực đúng 100% `createEliteVariant` trừ phần rewards-switch (bỏ — D8): characterization so stat/flag/name. Tag tương lai chỉ thêm entry.
- `createEliteVariant` xóa sau migrate (consumer duy nhất là spawn + tests). **`createBossVariant` GIỮ NGUYÊN.** [SỬA từ v2]

### 2.2 Idle vs Active — spawn mode plumbing [MỚI A1]

```ts
// StageWaveSystem — 1 signature, option mới (không phát minh đường 2):
pickEnemyForSpawn(stage, isFinalSpawn, options?: { allowTags?: boolean })
// wrapper công khai pickEnemyForTurnSpawn tương tự — mặc định allowTags: true (active)

Luồng:
  template = base template của stage (pool roll như cũ)
  if (isFinalSpawn && floor === 10 && stage.bossEnemyId) {
    template = createBossVariant(bossTemplate)      // D4 — unconditional, CẢ idle lẫn active
  } else if (options?.allowTags !== false && entry.eliteChance && rollChance(entry.eliteChance)) {
    template = applyEnemyTags(template, ['tinh_anh'], ENEMY_TAGS)   // D5 — chỉ active
  }
  hidden beast thay template như cũ (base enemy khác)
```

| Kênh | Floor 1-9 | Floor 10 |
|---|---|---|
| **Active** (Enter/Repeat/Auto — combat spawn thật) | base, 10% tinh_anh | boss base, 10% **boss + tinh_anh** |
| **Idle** (`rollAutoFarmCycleReward` — pass `allowTags: false`) | quái thường base | **boss base** (không tag) |

- Active = kênh farm (lý do online: tag drop機 hội). Idle = kênh tiến trình nền, reward thấp nhất, không đứng yên khi offline. [MỚI]
- Idle rate/gate/cap giữ nguyên hiện trạng (D6) — KHÔNG đụng auto-farm tests đã QA.
- PC chỉ áp mode active (idle không battle — không evaluate). [SỬA từ v2]

### 2.3 Builder defineChapterStages [SỬA theo D2/D9]

Rules như v2 trừ: `perfectClearTurnLimit` = **3** (floor 1-9) / **5** (floor 10) — cứng, 1 comment duy nhất; bossEnemyId chỉ floor 10 (xóa metadata giả 27 node → badge UI tự đúng); waves split giữ công thức phân bổ dần (B1 wording: base = floor(total/3), dư fill từ wave cuối lên — [SỬA] đồng nhất diễn đạt với code đã fix `f40a121`; 2 cách là một). `normalizedStages` hack xóa.

### 2.4 PC condition (D1) — predicate mới

`players.length > 0 && players.every(alive) && totalTurnsElapsed < limit` trong `recordPerfectClearIfEligible`. Bỏ HP-loss. Ghi 1 lần. **Edge cases lock (B4):** (a) chưa PC → clear đạt điều kiện → ghi; (b) đã PC → clear thường → không xóa không ghi đè; (c) đã PC → PC lại → KHÔNG overwrite perfectClearSeconds; (d) chết-then-hồi-sinh → vẫn tính PC; (e) lần đầu PC → push cả `completedStageIds` lẫn `perfectClearStageIds` (2 push độc lập cùng victory block — hiện trạng giữ).

### 2.5 UI [giữ từ v2]

Badge Boss tự đúng sau builder (3 node floor 10). Ẩn `spawnIntervalSeconds` display (10.4). Chip Hoàn Mỹ tự enable khi đạt. i18n keys cho mọi string display mới (P16).

### 2.6 Save/compat

Dev phase — không migration (E8). Không field save mới.

### 2.7 Debug tooling [MỚI B5 — dev-only, không production API]

- Console helper (pattern `__tutienPhaserGame` có sẵn): `spawnEnemy(enemyId, tags)` — force spawn qua applyEnemyTags để test tương tác tag; `forcePerfectClear(stageId)` — set PC cho stage để thử idle gate không phải grind. Live ở dev build only (`import.meta.env.DEV` guard như `DevMode.ts`).

## 3. Kiến trúc — owner & ranh giới [SỬA bảng theo D4]

| Trách nhiệm | Owner | Ghi chú |
|---|---|---|
| Tag contract + applier | `core/enemy/EnemyTag.ts` | generic; priority sort (B3) |
| Tag data (tinh_anh) | `data/enemy/EnemyTags.ts` | registry 1 tag v1 |
| Boss variant | `core/enemy/Enemy.ts` `createBossVariant` — GIỮ NGUYÊN 1 owner (D4) | không qua tag |
| Công thức stat | `applyEliteMultiplier`/`applyBossMultiplier` — giữ nguyên (A2/A9) | tag tham chiếu |
| Roll tag + boss spawn | `StageWaveSystem.pickEnemyForSpawn` + option `allowTags` | 1 signature mở rộng |
| Quy định stage + builder | `data/stage/ChapterStages.ts` | D9 |
| Predicate Hoàn Mỹ | `GameManagerTurnBattleOps.recordPerfectClearIfEligible` | query thuần |
| Idle rate/gate/cap | hiện trạng — KHÔNG ĐỔI | D6 |
| UI badge | `StageSelectPanel.vue` | A7 |

Không đổi: normalize (Layer 2), combat pipeline (Layer 4), `createBossVariant`, BattleLootSystem reward path, auto-farm cycle math, QuestSystem, tribulation.

## 4. Verification strategy [SỬA theo mode]

- (a) Characterization: `applyEnemyTags(['tinh_anh'])` === `createEliteVariant` (stat/flag/name — rewards KHÔNG assert vì D8 bỏ switch); (b) stack + dedupe + priority-order test; (c) predicate alive-for-all + 5 edge B4 (regression lock hiện trạng); (d) data test: 30 stage X=3/5 đúng vị trí, bossEnemyId chỉ 3 floor-10, eliteChance 30 entries nguyên vẹn, waves parity 30/30; (e) **spawn mode test [MỚI]**: seeded roll — active gắn tag, idle (`allowTags: false`) KHÔNG gắn; floor 10: cả 2 mode đều boss base, active 10% ra boss+tinh_anh; (f) idle reward parity — `rollAutoFarmCycleReward` với allowTags:false vẫn boss base ở floor 10, reward chain boss như cũ.
- P3 quick mỗi task; full cuối mission. P14 browser: badge Boss 3 node; thắng Động 1 ≤3 turn toàn đội sống → chip Hoàn Mỹ enable; idle Động 1 sau PC → reward base (không tag prefix trong log). P4 adversarial quick.
- QA hypotheses bắt buộc: seeded 0.1 phân phối đúng; auto-farm không đột nhiên roll tag (mode pass đúng); once-only PC; X=3 khả thi với dummy fight (turn budget thật ≥3).

## 5. Out of scope [SỬA]

- Boss+tinh_anh reward multiplier + item tier-up — **debt roadmap "hệ thống drop hoàn thiện" (D8)**. [MỚI] **[SỬA 2026-09-12: nợ đã có spec riêng — `2026-09-12-drop-system-design.md`. Vẫn ngoài phạm vi mission PC; hai spec chạy độc lập, xem D8.]**
- Tag mới ngoài tinh_anh; T_base idle cố định (D6 giữ rate cá nhân hóa); cap 12h riêng (D6 giữ 24h chung).
- Enemy stat factory tier 4+ (D7 note); balance thật X (X=3/5 là khởi điểm — chỉnh bằng playtest đợt balance, nhưng không phải "placeholder" — là con số phát hành).
- Rebalance eliteRewards/drop data; idle gate thay đổi.

## 6. Risks [SỬA]

| Rủi ro | Mitigation |
|---|---|
| Idle floor 10 giờ spawn boss base (hôm nay roll qua pickEnemyForTurnSpawn có elite-roll) — reward idle floor 10 đổi? | Kiểm tra: hôm nay idle floor-10 boss spawn cũng có thể roll tinh_anh nếu entry cuối trúng 0.1 → sau v3 idle boss KHÔNG còn tag → reward badge giảm nhẹ ở idle boss. **Đây là hành vi có chủ đích của A1** (idle = reward thấp nhất) — ghi intentional change, verify bằng parity test mode idle |
| X=3 với combat thật: 10 quái cần ~20+ actor-actions | Xác minh bằng playtest P14 — nếu 3 quá chật cho stage 10-quái thì chỉnh number (data) không phải mechanism |
| Xóa createEliteVariant phá test ngầm | Characterization trước; grep; migrate rồi remove (A12) |
| Builder parity lệch field nào đó | Parity test 30 stage mọi field trừ 3 thay đổi ghi rõ (X mới, bossEnemyId 1-9, [không còn] placeholder) |
| allowTags option bị quên pass ở đường mới | 1 consumer duy nhất idle; test lock idle mode không tag |

## 7. [XÓA khỏi v2 — đã giải quyết hoặc hủy]

- [XÓA] Q2 bản 2 "boss + tinh_anh stack được?" — đã chốt: stack được (active floor-10), nhưng reward stack là debt D8.
- [XÓA] Placeholder X (2×total / 14) — thay bằng X cứng 3/5 (A2).
- [XÓA] boss-as-tag + migrate createBossVariant — D4 giữ hàm nguyên vẹn.
- [XÓA] Open question "định nghĩa turn" — đóng bằng code evidence: turn = 1 actor action.
- [XÓA] B8 cache applyStat — YAGNI (spawn không phải hot path; không có DB reload event); bỏ khỏi plan.
- [XÓA] B6 cross-ref spec Archetype — file archetype spec chưa từng commit (chỉ brainstorm chat); thay bằng 1 dòng debt roadmap khi mở factory tier 4+.
