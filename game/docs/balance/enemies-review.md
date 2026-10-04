# Review balance quai (enemy) — Tu Tien Idle

Ngay: 2026-10-04. Nguoi choi: Devin (agent), vai tro mot PLAYER THAT.
Phuong phap: choi that qua cac buoc cua game (EarlyGameSession journey
hai seed khac nhau), do bang sim headless TurnBattleSystem qua ba mo
hinh build (NAKED khong trang bi, GEARED gear 6 roll thuc qua pipeline,
va "honest entry" Truc Co tu tay danh dau kiem, respec, hold pill).
Ghi cam giac o muc A truoc khi nhin so o muc B. Muc C la tune da ap.

So lieu tho: `game/.audit-out/*.json` (journey-seed7, journey-seed13,
floor-sweep, foundation-entry — chay lai bang
`npx vitest run --config vitest.lab.config.mts tests/lab/enemyJourneyAudit.test.ts`).

---

## A. Trai nghiem choi that (ghi truoc khi nhin so)

### A1. Chuong Pham Nhan (mortal, Dong 1-10)
- Dong 1 phai chay lai 2-3 lan — cam giac "tutorial wall" dung chieu:
  vao game chua quen tay thi thua, cai thien chut la qua.
- Dong 2-9 di muot: moi man 1 lan thang, tru 1 dot gai o Dong 6
  (seed 7 mat 218 mau, chien 26 hiep — bay elite chay khoang nhau khien
  tran keo dai). Cam giac do doc deu, khong "ngat".
- Dong 10 (boss Heo Rung Vuong) qua 1-try ca hai seed — trau nhung don
  thuong nhe; dung vi tri "cap check nhe cuoi chuong".

### A2. Chuong Luyen Khi (qi_refining, Quat 1-10)
- Quat 1 (Khu Rung): tuong ngay cua chuong — seed 7 phai 4 lan
  (3 thua), seed 13 phai 8 lan (7 thua) truoc khi qua. Cam giac:
  "bat buoc cay them tang Luyen Khi truoc khi noi chuyen voi Son Tac".
  Khong kho chiu, hop idle game — nhung la buc tuong dung sau kiem
  kiem kiem, khong phai "quat 1 cho tan thu".
- Sau khi qua Quat 1 thi Quat 2-5 di gan nhu luon: duong cong quai
  ngang hang (1 loai Son Tac) — do kho tang bang so luong + elite %.
- Quat 8-9 (mineral_pit, mystic_marsh) lai tuong: seed 13 phai cai tu
  qi:12 len qi:18 moi qua mystic_marsh (6 tang, 7 lan chien). Cam giac
  "nhat dan" o doan sau chuong — nhung do la frontier co tinh, qua duoc.
- Quat 10 (Dai Vuong Son Tac Vuong): seed 7 thua 10/10 khong bao gio qua;
  seed 13 qua ngay try 1 o qi:18. Cam giac "dao song" — dung build gap
  dung roll la qua, build yeu hon la tuong.

### A3. Chuong Truc Co (foundation, Man 3.1-3.10) — TRUOC TUNE
- Tuong be tong. Moi mo hinh (journey chuan bi, GEARED gear that,
  honest-entry Truc Co) deu 0 tran thang o floor 1, giu duoc 0-2 con
  Linh Lang tren 10. Linh Lang ra formula tier 4 = 684 mau / 64 cong /
  26 giao — gap ~5.3 lan mau Son Tac chuong truoc.
- Day la LOI so lieu chu khong phai "vung dot kho": perfectClearTurnLimit
  floor 1 = 20 hiep cho 10 quai = nguoi thiet ke mong ~2 hiep/giet 1
  con; EHP tuong ung ~170-220, trong khi con so that la 684.

### A4. Do Kiem Truc Co (tribulation)
- Build "honest" qi:12 theo duong strength truoc (24 diem strength) thua
  lap lai: tong sat thuong kiem ~2.86 x mit vs def — can def >= ~130
  (grade human) moi dung duoc. Nguoi choi point-buy attack truoc se
  "dang mat" vao kiem — phai respec vitality hoac xay tank.
- Ngoai pham vi tune (domain khac — `src/data/tribulation/`), chi ghi.

### A5. Tong quat cam giac
- Chuong 1-2 co hinh balance hop ly: tuong o dau chuong, muot o giua,
  frontier o cuoi, boss la cap-check.
- Chuong 3 vo hinh hoan toan do MOT con so sai (cong thuc tier sai cho
  species normal). Sau tune no co lai hinh chuong 2.

---

## B. So lieu chung minh

### B1. Journey thuc (2 seed, chay qua pipeline that, grind giua cac lan thua)

| Stage | seed 7 | seed 13 |
|---|---|---|
| mortal_dong_1 | 2 try (1 thua) | 3 try (2 thua) |
| mortal_dong_2..9 | 1-try muot | 1-try muot |
| mortal_dong_10 (boss) | 1-try | 1-try |
| qi_forest (Quat 1) | 4 try, clear qi:4 | 8 try, clear qi:8 |
| qi_quat_2..7 | 1-2 try | 1-2 try |
| qi_mystic_marsh (Quat 9) | — | 7 try, clear qi:18 |
| qi_abyssal_pool (Quat 10) | 10/10 THUA, khong clear | 1 try, qi:18 |
| foundation_floor_1 (so cu 684) | — | locked, 0 kill |

### B2. Floor sweep GEARED (build gear that, stats gan dung moc moi floor)

GEARED thang 10/10 floor mortal (k=10-18, mat 29-184 mau), thang
3/10 floor qi (Quat 1-3), thua 7/10 floor qi con lai (k=7-13 truoc khi
chet — sat nguc, frontier dung thiet ke), thua 9/10 floor foundation
SAU TUNE o model nay (k=3-7; model GEARED yeu hon nguoi choi that da
grind — honest-entry co growth thang duoc floor 1-4).

### B3. Do doc species-normal qua cac chuong (sau tune)

| Chuong | Normal | hp | cong | giao | spd | Ti le hp vs chuong truoc |
|---|---|---|---|---|---|---|
| 1 mortal | Heo Rung | 60 | 6 | 6 | 0.95 | — |
| 2 qi | Son Tac | 130 | 13 | 10 | 1.0 | 2.17x |
| 3 foundation | Linh Lang (CU) | **684** | **64** | **26** | 1.2 | **5.26x** ← outlier |
| 3 foundation | Linh Lang (MOI) | 190 | 30 | 15 | 1.2 | 1.46x |

Budget tu thiet ke: `perfectClearTurnLimit = totalEnemyCount + 10`
(floor 1 = 20 hiep / 10 quai) ngu y ~2 hiep/1 con. Voi atk ~85-105 o
cua vao Truc Co (mit giao 15 ≈ 10%) thi EHP muc tieu ~170-230.
684 la ~3-4x tren budget — loi auth ro, khong phai tune chu quan.

### B4. Elite / boss multipliers (spec-author, giu nguyen)
- Elite: x2.5 hp / x1.35 cong / x1.15 giao — ap cho moi normal.
  Sau tune elite Lang = 475 hp / ~40 cong — nguy hiem dung vi tri
  "hiem gap nhung tuong" o floor 7-9 (eliteChance 5% -> 21%).
- Boss: x7 hp / x2 cong / x1.2 giao tren literal shell.
  Shell ratio vs normal cung chuong:
  - Heo Rung Vuong: literal 390 vs 60 = 6.5x (lech cao nhat, nhung
    journey clear muot — player mortal khoe ty le voi truong hop nay).
  - Son Tac Vuong: literal 350 vs 130 = 2.7x.
  - Linh Lang Vuong: literal 550 vs 684 cu = 0.8x (cu thap hon normal!),
    vs 190 moi = 2.9x → da trim xuong 420 (~2.2x).
- Elite x boss stacking (~10% o floor 10, authored): elite Lang Vuong
  7350 hp — tuong co y, flag giu spec.
- Do dac biet: stomp x2 (heo vuong), slash_multi x2.5 (son tac vuong),
  bite_multi x2.5 (lang vuong) — moi 4 hiep; enrage lang vuong turn 60.
  Tan suat 4-hiep de doc truoc, khong phai spike.
- Sudden death: +30% damage/hiep (ca 2 phia) sau hiep 9 — tran nao keo
  qua deu phan thang nhanh, khong bi "vo han 0-0".

### B5. Ket qua sau tune (honest-entry Truc Co, grind giua cac lan thua)

| Floor | Ket qua |
|---|---|
| 1 | thang try 1-2 (r19-20, con 6-41% mau) |
| 2 | thang try 5 |
| 3 | thang try 3-7 |
| 4 | thang try 2 |
| 5-9 | chua thang trong 8 lan (kills 8-12/14-16 — sat nguc, frontier) |
| 10 (Lang Vuong) | thua (kills 0/1, boss duel cap-check) |

Hinh thai y het chuong 2: quat dau clear som, giua chuong thanh
frontier cay, floor 10 la cap. Model sim bi gioi han growth (chi
~+24 attr/stage, gear roll co dinh) nen bi quan hon nguoi choi that —
real player co quest + drop 10 floor + technique mastery.

---

## C. Tune da ap (chi outlier ro, bao thu)

### C1. `foundation_spirit_wolf` (Linh Lang) — src/data/enemy/FoundationEnemies.ts
- CU: `foundationBeast({ t: 4 })` -> 684 hp / 64 cong / 26 giao / spd 1.2
- MOI: literal defineEnemy -> **190 hp / 30 cong / 15 giao / spd 1.2**,
  rewards giu t2-equivalent (52 mastery / 12 stone).
- Ly do: (a) 0 tran thang qua 100+ run moi build — khong phai "kho",
  la "khong choi duoc"; (b) perfectClear budget ngu y EHP ~2-hiep-kill
  (~170-230); (c) bo sung formula tier o day sai vi tri — species
  normal khong duoc nhay bang species truoc >1.5-2x, do doc phai nam
  o count ladder + eliteChance.

### C2. `foundation_ferocious_spirit_wolf` (Lang Vuong) — cung file
- CU: literal 550 hp / 35 cong / 34 giao
- MOI: **420 hp / 35 cong / 30 giao**
- Ly do: literal duoc can cu theo normal cu (684) nen shell-ratio chi
  0.8x; sau retune no tro thanh 2.9x normal moi. 420 giu ~2.2x —
  van la cap-check (co bite_multi x2.5 + enrage turn 60) nhung khong
  qua moc "boss >2x baseline" nhieu.

### C3. Khong tune (ghi nhan, khong so)
- `bandit` / `ferocious_bandit` (qi): da retune 2026-10-04 theo entry
  strength; journey clear duoc — dung spec.
- `mortal_ferocious_wild_boar`: shell-ratio 6.5x nhung journey 2 seed
  deu 1-try — khong phai outlier thuc nghiem.
- Elite x2.5 / boss x7 multipliers, eliteChance ramp, elite x boss 10%:
  tat ca la spec-author (Stages.ts comment); giu.
- Do dac biet stomp/slash_multi/bite_multi: tan suat + magnitude hop ly.

### C4. Invariant re them vao
- `src/data/enemy/EnemyRealmJump.test.ts`: bat chapter-normal hp jump
  <= 3x va might jump <= 3.5x so voi chuong truoc (so qua stage floor-1
  roster). Con so cu 684/64 = 5.3x/4.9x se fail ngay; so moi
  190/30 = 1.46x/2.31x pass. Rat re (~ms), chi doc ENEMIES + STAGES.

---

## Ngoai pham vi (ghi nhan, khong sua)

1. **Do Kiem Truc Co**: gate mat-xa ~2.86x mit → can def >= ~130 o grade
   human. Build strength-first (hap dan tu nhien cho nguoi choi "build
   dam") thua kiem lap lai phai respec vitality — trai nghiem "dao
   nguoc build" co the kho chiu. Domain `src/data/tribulation/`.
2. **abyssal_pool variance**: seed 7 thua 10/10 o qi:18 vs seed 13
   1-try — co the do elite x boss roll ~10% ket hop build variance.
   Theo doi them neu nguoi choi that phan nan; hieu tai khong tune.
3. **Reward/drop**: techniqueMastery/spiritStone giu t2-equivalent sau
   khi giam stats — keo hon "power" mob mot chut; drop domain khac,
   de nguoi khac danh gia.
4. **Model sim GEARED yeu hon nguoi choi that** (attribute spend ngau
   nhien, khong co skill/node growth sau tung floor) — ket qua sim la
   lower-bound; nen doc them khi co telemetry that.
