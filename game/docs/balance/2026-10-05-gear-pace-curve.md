# Retune duong cong suc manh trang bi (gear pace) — 2026-10-05

Boi canh: retune pace-floor tren `codex/hoa-cau-fireball-vfx` (Luyen Khi
~1 ngay, Truc Co ~1 tuan base-rate). Worker quai stage chiu trach nhiem
nguong quai moi tang; worker nay chiu trach nhiem TOC DO tich luy suc
manh tu trang bi — sao cho "can farm do + nang cap o mot muc nhat dinh
de qua" la dieu game dien dat duoc, khong phai lo hong ngau nhien.

Phuong phap: do bang pipeline roll THAT qua
`tests/lab/gearPaceMeasure.test.ts` (20k roll/diem do, rng seeded
mulberry32, registry that tu data/equipment + data/equipment/affixes).
Chay lai:
`npx vitest run --config vitest.lab.config.mts tests/lab/gearPaceMeasure.test.ts --disableConsoleIntercept`

## 1. Van de do duoc (BEFORE)

Chat luong (quality) roll **doc lap voi floor** — cung trong so o moi
tang: hoang 75 / huyen 15 / dia 8 / thien 1.99 / tien 0.01.

Ket qua: `floor | thien/rot | E[kills toi thien dau tien]` truoc tune:

| floor bat ky | P(thien) | mortal (1 item/kill) | qi/foundation (~0.29-0.57/kill) |
|---|---|---|---|
| 1 | 2.0% | ~50 kill = **2.5 phut** | ~176 kill = **8.8 phut** |

Mot mon thien o Pham Nhan Dong 1 = ~1.5-2.2x mainStat hoang va mang
gap doi luong affix. Vi enhance song theo SLOT (khong mat khi thay
do), mon "trung so" nay duoc nhan len mai mai — **1 lan rot hoan thanh
luon 1 slot**, dung nhu loi bao cao.

Full set 6 slot thien o chuong dau: ~30-60 phut farm (coupon-collector
qua 8 template). Sau do chi con truc enhance de nhan.

Bang suc manh do duoc theo quality (base_kiem, mainStat might + tong
tri so affix; realm L10):

| quality | E[mainStat] mortal/qi/found | E[so affix] | E[affix sum] | E[tier] |
|---|---|---|---|---|
| hoang | 24.1 / 38.5 / 53.0 | 0.50 | ~0 | 0.50 |
| huyen | 27.7 / 44.3 / 60.9 | 1.01 | 0.5 | 0.93* |
| dia | 31.2 / 49.9 / 68.6 | 1.50 | 9.1 | 1.26* |
| thien | 36.2 / 57.9 / 79.6 | 2.06 | 10.2 | 1.40* |
| tien | ~42 / ~68 / ~93 | ~4 | ~23 | ~1.5* |

\* E[tier] va E[affixSum] da theo trong so tier MOI (sau tune — phan 2b).
Truoc tune tier roll deu: dia co t3 ~33%/affix, thien t3-4 ~50%/affix.

## 2. Retune (AFTER)

### 2a. Tran chat luong theo floor — `ITEM_QUALITY_FLOOR_CEILING`
(`src/core/equipment/ItemQualityBalance.ts`)

| floor | tran roll | phan phoi do duoc (qi L10, 20k roll) |
|---|---|---|
| 1-3 | huyen | hoang 83.0% / huyen 17.0% |
| 4-6 | dia | hoang 76.7% / huyen 15.1% / dia 8.2% |
| 7-9 | thien | hoang 75.5% / huyen 14.5% / dia 7.9% / thien 2.2% |
| 10+ | tien | nhu tren + tien 0.01% |

- Cap chi chan ROLL goc; `qualityBonusSteps` (kill boss+elite gom)
  van day quality len sau do (spec E5/E9 giu nguyen) — kill stacked o
  floor thap van co the cham len 1 band cao hon, boss floor 10 la
  diem "xo so" tien.
- Drop khong co stage context (debug/lab/`obtainEquipment`) giu
  ladder phang — khong doi hanh vi ngoai stage pipeline.
- Grade theo realm van nhu cu (canUseItemGrade) — khong cham.

Plumbing: `BattleLootSystem.grantResolvedDrops` nhan them floor theo
read canonical `stage.floor ?? stage.requiredRealmLevel ?? 1` (fallback
giong `GameManagerStageOps` + mac dinh `?? 1` ben trong
`stageDropTableFor`, de ceiling va drop table luon resolve cung 1
floor) -> `itemQualityCeilingForFloor` -> `createInstance(...,
maxQuality)`. `rollItemQuality` bo quality tren tran khoi bang trong
so va renormalize (khong don xac suat len tran).

### 2b. Tier affix roll nghieng ve tier thap — `AFFIX_TIER_ROLL_WEIGHT`
t1..t5 = 7/5/3/2/1 (truoc: deu trong cac tier hop le; ban dau de
10/6/3/2/1 nhung khi merge voi stat-wall ladder cua worker quai,
pinned early-loop seed 11 khong qua duoc mortal_dong_9 — giam xuong
7/5/3/2/1 giu nguyen huong nghieng-thap nhung du dau ra power cho
wall; xem them flag 6)

Phan phoi tier do duoc theo quality (roll khong tran, qi L10):

| quality | t1 | t2 | t3 | t4 | t5 |
|---|---|---|---|---|---|
| hoang | 100% | - | - | - | - |
| huyen | 58.3% | 41.7% | - | - | - |
| dia | 46.7% | 33.3% | 20.0% | - | - |
| thien | 46.7% | 33.3% | 20.0%* | 0.9% | - |

*thien dieu kien: t4 chi 4/19 affix co pool; ti le t3 theo trong so.

Y nghia: item "cap tran" cua 1 band (vd dia o floor 4-6) thuong ra
tier thap — san them drop trong cung band moi day tier len. San affix
tot tro thanh vong farm that, khong phai "1 mon dia la xong slot".

### 2c. Truc nang cap (da san, giu nguyen)
- Enhance theo SLOT: +6%/level, cap 100, success 100%x0.956^(L-1),
  pity 10; E[ops] toi +10 ~ 11 lan, toi +15 ~ 15 lan; cu ton tai khi
  thay item (nen dau tu khong bi mat khi doi sang drop moi).
- Chi phi: 2x(L+1) ore + 50 linh thach/lan. Nguon ore qi ~1.7/kill ->
  wall "enhance >= N" dien dat duoc, N<=15 khong doi hoi kinh te moi.
- Wash/refine (Tay/Tinh Luyen): beta scope-hidden — khong cham.

## 3. Bang thoi gian-toi-nguong (gia dinh wall profile)

Gia dinh nguong stage wall (de coordinator cross-check voi worker
quai): moi floor doi hoi "trang bi dang o muc band truoc + enhance o
muc band". Neu wall cua worker quai dat cao hon/thap hon cau truc nay,
giao thoa la bang tran quality + enhance ladder ben duoi.

| band floor | gear wall dien dat duoc | E[item power index] (kiem, qi L10) | E[gio farm toi full-set band] |
|---|---|---|---|
| 1-3 | bat ky gear, enhance 0-2 | ~39.5 | ~0.5h (hoang/huyen du) |
| 4-6 | huyen -> dia, enhance 3-5 | ~42.4 (+7%) | ~1.5-3h (dia 8.2%) |
| 7-9 | dia -> thien, enhance 6-9 | ~46.7 (+9%) | ~2-4h (thien 2.2%) |
| 10 | thien/tien, enhance 10-12 | ~46.7 + tien lottery | boss farm + enhance sink |

Item power index = E[mainStat + tong affix] chua nhan enhance; nhan
x(1+0.06*L) khi tinh effective. Band gap ~+7-9% moi band tu QUALITY
RIENG — chu yeu wall duoc ganh boi truc enhance (x1.3..x1.9 o +5..+15).

## 4. Structural flags cho Minh (khong tu quyet sua)

1. **Band gap tu quality chi ~+8%/band.** Neu worker quai muon wall
   "bat buoc do band moi" nghia la >15-20% suc manh, cua do dap ung la
   ENHANCE (x0.06/level, rat sau), khong phai tang implicit multiplier
   (co y dinh giu nho de mot drop khong tu hoan thanh slot). Neu Minh
   muon quality band gap lon hon, tang ITEM_QUALITY_IMPLICIT_MULTIPLIER
   (1/1.15/1.3/1.5/1.75 -> vd 1/1.2/1.45/1.8/2.2) — 1 so trong bang.
2. **Mortal 100% equipment/kill** (~1200 item/gio): bag overflow ->
   auto-dissolve nhieu — van de kinh te/UX, thuoc surface currency/drop
   frequency cua worker khac. Khong cham o day.
3. **Essence income tu dissolve giam o floor thap** (vi khong con dia/
   thien rot som): tinh hoa gioi han band — flag cho worker kinh te.
4. **Kill khong co stage context** (stageManager khong active hoac
   template lookup miss) -> floor undefined -> roll khong tran (flat
   ladder). Day la semantics cu cua debug/lab paths, co y giu nguyen —
   chi flag de ro: neu sau nay co them production path rot do khong
   qua stage, phai truyen floor vao grantResolvedDrops.
5. **The Tu Luyen The (BodyRefinement)** yeu ro so voi gear: 175 tinh
   hoa (~125 kill) cho +5 might vs ~30 might tu 1 kiem huyen. Khong
   canh tranh duoc truc gear — chi phi cap la surface worker khac;
   neu muon The Tu la truc song song, can tang baseGains (data/realm
   /BodyRefinement.ts dang ghi "P7-M-F PLACEHOLDER"). Flag, khong sua.
6. **Affix-weight margin rat mong.** Merge voi stat-wall ladder (qua
   commit 0848268d cua worker quai): pinned early-loop seed 11 qua
   mortal_dong_9 voi weight 7/5/3/2/1, FAIL voi 8/5/3/2/1 (da do
   truc tiep). Neu worker quai day statScale cao hon nua, dau ra gear
   cua toi can noi ve phia deu hon — hoac Minh quyet dinh wall dong_9
   dung la doi hoi affix tier cao hon nua va chap nhan grind sau hon.

## 5. Scope

So doi: `src/core/equipment/ItemQualityBalance.ts` (2 bang moi +
lookup), `src/core/equipment/EquipmentRolling.ts` (roll cap + weighted
tier), `src/core/equipment/EquipmentSystem.ts` (delegate param),
`src/core/game/BattleLootSystem.ts` (floor plumbing), test pins
(`ItemQualityBalance.test.ts`, `EquipmentSystem.test.ts`,
`BattleLootSystem.dropResult.test.ts`), doc nay.
