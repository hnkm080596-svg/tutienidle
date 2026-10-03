# ART MASTER v3 — LEAN BETA (Huyền Kim Sơn Thủy)

Thay v2 — thu theo **BETA SCOPE LOCK v2**: vertical slice Phàm Nhân → Luyện Khí → Trúc Cơ, một way duy nhất `spell_pathway` (5 element đều chơi được). Authority = allow-list `src/core/betaScope.ts` · `betaScopeSurface.ts` · `betaScopeSkillDomain.ts` + map UI `frontend-contract.md` (PR #82–#91). Roster + budget đối chiếu `2026-09-30-beta-stage-roster-audit.md` §6.

**Scope đổi so với v2:**
- Enemy roster = **12 identity** (9 normal + 3 boss), verify từ `BETA_ENEMY_ROSTER` — **6/12 đã có art bind sẵn → chỉ 6 normal cần vẽ**
- Icon beta-facing = **14** (7 đã có → **7 cần vẽ**: 5 Special + 2 đan) + 1 material icon conditional
- Không vẽ cho scope-hidden: Kiếm Tu, Thể Tu, hidden ways (Pháp Tu Ẩn), hidden beasts (Huyết Mông/Cổ Thú), Nghịch Chu Thiên, Ultimate slot, orb-picker, passive emblem, companion, formation, artifact, daily quests, workforce UI thủ công, Wash/Refine/Decompose tabs, Kim Đan+. Ferocious/elite (`tinh_anh`) = runtime tint+aura — modifier, không phải species → không vẽ sheet riêng.
- `frame-s-slot` + `scrollbar` tiếp tục HOLD

**Spec liên quan:** `huyen-kim-chrome-art-spec.md` (chrome contract) · `huyen-kim-component-state-matrix.md` (state contract — state scope-hidden chỉ là reference) · `beta-art-drawing-spec.md` (mô tả entity/icon cần vẽ).

---

## ⚠ SCOPE BOUNDARY — ĐỌC TRƯỚC KHI GENERATE BẤT KỲ ASSET NÀO

File này liệt kê **toàn bộ việc cần làm**, không phải toàn bộ việc của một agent. Owner ghi trên từng section — KHÔNG suy rộng sang section khác.

**CODEX (frontend/UI agent) ĐƯỢC phép:**
1. Implement UI/UX trong code — layout, components, state rendering theo `huyen-kim-component-state-matrix.md` + `frontend-contract.md`.
2. Generate art — **CHỈ Section B** (chrome/static UI: frames, panels, buttons, dividers, decorative) theo phong cách Huyền Kim Sơn Thủy.

**CODEX CẤM — việc của MINH (hand-drawn), không generate/vẽ/placeholder-ify:**
- **Section C** — enemy/boss spritesheets, animation clips (idle/attack/death/special), bất kỳ asset có `impactFrame`/feet-anchor.
- **Section D** — skill/spell icons, pill/material icons (kể cả dòng "VẼ").
- **Section A** — scene master concepts là concept art của Minh; Codex dùng làm reference implement UI, KHÔNG generate thay.
- Character art, combat VFX, aura/particle overlays — mọi gameplay-facing art.

**Một câu:** entity/gameplay art → MINH; khung/chrome/nền UI tĩnh → Codex được gen. Nghi ngờ → hỏi, đừng vẽ.

---

## A. SCENE MASTER CONCEPTS — 1672×941 + state strip nhỏ   ⟦OWNER: MINH — Codex KHÔNG generate⟧

| # | Scene | Mockup | State strip | Priority |
|---|-------|--------|-------------|----------|
| A1 | **M1 Động Phủ** | Top bar; thế giới ≥70%; Đạo Luân đúng **10 destination render trong beta**: Character·Realm·Skill·Quest (ring 1) · Teleport Array·Pill Room·Gathering Outpost·Equipment Hall (ring 3) · Tàng Kinh Các·Settings (ring 4). KHÔNG Pháp Bảo/Trận/Companion/Chi Hiền Quán (scope-hidden); `talisman_slot` tồn tại catalog nhưng không render nút. Thiên Cơ Bảng drawer; building hotspot trên vách chỉ teleport·pill·gathering·equipment·**vendor Kỳ Bảo Các** (chi_hien_quan không render); depth layers sky→far→mid→mist→foreground | Wheel: normal·hover·active·locked(progression)·upgradeable·notification · Building: normal·hover·selected·locked·ready·upgradeable·active·hidden | ⭐ ĐẦU TIÊN |
| A2 | **M8 Combat** | Battlefield ≥75%; top bar gọn; **action rail = Basic + Special only — Ultimate slot ABSENT** (scope-hidden: không render cả dạng locked). Special render `progression-locked` tới khi commit element; entity HUD; safe regions VFX/damage; intro/countdown/pause/exit-confirm/victory/defeat/result | Rail: ready·hover/selected·cooldown+count·blocked-resource·locked·actionable · HUD: ally·enemy·targeted·low-HP·dead | ⭐ Cao |
| A3 | **M2 Character** | Study template; hero = Mortal hoặc Pháp Tu Ngũ Hành; creation chỉ name + talent pick (mortal starter `linh_bao` cố định — không skill/way/element pick); talent seal = **18 beta ids** (`pham_cot` loại) | Talent: idle·hover·selected·available·locked·acquired·maxed·disabled | Cao |
| A4 | M3 Realm Thiên Lộ | Ladder beta render **3 rung**: Phàm Nhân → Kiến Cơ → Trúc Cơ. Node Kim Đan+ = scope-hidden (không render, không teaser); **không CTA đột phá ở trần Trúc Cơ** | completed·current·locked (release-hidden = post-beta ref); CTA enabled/disabled; req met/unmet | Sau A1-A3 |
| A5 | M4 Skill+Technique | **Single committed-element tree** — 4 branch còn lại scope-hidden (không render locked lẫn teaser); technique band `five_elements_art` (icon đã có `dai_ngu_hanh_chan_quyet.png`) + grade CTA | Node: hidden·locked·available·selected·learned·unlocking·levelled·maxed·gated | Sau A1-A3 |
| A6 | M5 Equipment | Paperdoll + bag — **2 tab beta: Cường Hóa (enhance) · Hóa Luyện (dissolve)**; Tẩy Luyện/Tinh Luyện/Phân Giải scope-hidden | Slot states đầy đủ (state contract §2.6) | Sau A1-A3 |
| A7 | M6 Pill Room | **5 recipe families**: tu_linh · hoi_linh · khai_linh · thong_mach · truc_co; special ingredient Yêu Đan (`yeu_dan_hung_giao`, drop boss Act II) | recipe·ingredient enough/insufficient·brew·brewing·output-ready | Sau A1-A3 |
| A8 | M7 Region | 3 act × 10 floor — boss floor 10; normal band 1-3/4-6/7-9 → species A/B/C; stage surface states theo `gameManager.stageOps` | locked·available·current·completed·perfect·boss·auto-farm armed·Start enabled/disabled | Sau A1-A3 |
| A9 | Tribulation + beta ending | master + 3 inset (lightning / mind / victory-defeat); **beta-complete beat** khi clear boss Act III — dùng `frame-xl-ceremony`/`surface-xl-scroll` chrome, không concept riêng | phase chain §9.6 | Cuối |

---

## B. CHROME — 18 slot vẽ + 2 HOLD (đúng như v2, ceremonial = GRAYSCALE)   ⟦OWNER: CODEX được gen / MINH vẽ cũng được⟧

Như v2 — xem `huyen-kim-chrome-art-spec.md` (count 20, divider 4/4). HOLD: `frame-s-slot`, `scrollbar`. `button-ceremonial` vẽ **grayscale** (game tô gold/cinnabar). Không slot nào thuộc scope-hidden feature → manifest giữ nguyên.

---

## C. ENEMY ART — **12 identity** (đúng `BETA_ENEMY_ROSTER`, stage-roster-audit §6)   ⟦OWNER: MINH only — Codex CẤM⟧

**Format:** 1 PNG sheet/clip; nền trong suốt; cell ~500×500; chân chạm đáy; feet-anchor. **Clip contract: normal = `idle/attack/death`; boss = `idle/attack/special/death`** (`special` map `specialAttacks` — water_surge mỗi action thứ 4). **BẮT BUỘC `impactFrame`/`impactFrames[]`** trên clip attack+special (impact-sync pipeline). Boss phase/enrage feedback ưu tiên runtime tint/aura/glyph — shape không đổi thì không vẽ sheet riêng. Hung/elite-normal (`tinh_anh`) = runtime modifier — KHÔNG vẽ.

**Art status hôm nay** (binding: `game/src/game/support/MonsterArt.ts#ENEMY_RESKIN_MAP` + `EnemyArt.ts`): **6/12 đã có** → vẽ mới chỉ **6 normal**.

### Act I — Phàm Nhân · nguồn `data/enemy/MortalEnemies.ts`
| id | Tên (hệ) | Role | Art status | Clips |
|---|---|---|---|---|
| `mortal_wild_boar` | Dã Trư (Mộc) | melee thẳng | ✔ bound `tusked-mountain-boar` | idle·attack·death |
| `mortal_savage_tiger` | Man Hổ (Hỏa) | melee áp lực | ✔ `mortal-savage-tiger-v1.png` (static) | idle·attack·death |
| `mortal_water_wolf` | Thủy Lang (Thủy) | nhanh/mobile | ✔ `mortal-water-wolf-v1.png` (static) | idle·attack·death |
| `mortal_ferocious_giant_crocodile` | Hung Cự Ngạc (Thủy) | **Boss I** — enrage 60 turn + special/4 | ✔ bound `bloodflower-tree-fiend-mudboss-ferocious` | idle·attack·special·death |

### Act II — Luyện Khí (Quật) · nguồn `data/enemy/MortalEnemies.ts`
| id | Tên (hệ) | Role | Art status | Clips |
|---|---|---|---|---|
| `wild_wolf` | Dã Lang (Mộc) | melee baseline | **VẼ** | idle·attack·death |
| `flame_fox` | Viêm Hồ (Hỏa) | ranged | **VẼ** | idle·attack·death |
| `giant_earthworm` | Trùn Đất (Thổ) | caster — underground telegraph | **VẼ** | idle·attack·death |
| `ferocious_flood_serpent` | Hung Giao Xà (Thủy) | **Boss II** — enrage 60t + water_surge ×2.5/4 action | ✔ bound `streamscale-forkman-floodserpent-ferocious` | idle·attack·special·death |

### Act III — Trúc Cơ · nguồn `data/enemy/FoundationEnemies.ts` — FINAL BOSS beta
| id | Tên (hệ) | Role | Art status | Clips |
|---|---|---|---|---|
| `foundation_lava_hound` | Dực Hỏa Khuyển (Hỏa) | melee | **VẼ** | idle·attack·death |
| `foundation_sand_scorpion` | Sa Hắc (Hỏa) | ranged | **VẼ** | idle·attack·death |
| `foundation_mud_golem` | Nê Cự Nhân (Thổ) | caster/heavy | **VẼ** | idle·attack·death |
| `foundation_ferocious_flood_dragon_whelp` | Hung Giao Sủng (Thủy) | **FINAL BOSS** — phase 50%/25% + enrage 60t + water_surge | ✔ bound `blood-locust-elder` (boss art thật) | idle·attack·special·death |

**Boss `special` gap:** cả 3 boss art bind hiện chỉ có idle/attack/death → telegraph `water_surge`/phase/enrage render runtime (aura tint + marker) theo state contract; `special` clip = optional top-up, không blocking. Mô tả vẽ: `beta-art-drawing-spec.md`.

**POST-BETA / NON-BLOCKING:** mọi template off-roster (~50 dormant), hidden beasts (Huyết Mông — Cổ Thú art `wugu-demon-king` sẵn nhưng scope-hidden), companion, Thể Tu player sheet.

---

## D. ICONS — **14 beta-facing · 7 cần vẽ** (+1 conditional), ~256² ink-wash nền tối   ⟦OWNER: MINH only — Codex CẤM⟧

Surface cần icon trong beta: combat rail (basic·special), skill-tree node, Đạo Quyển technique band, Pill Room recipe + breakthrough gate, bag/inventory row.

| Nhóm | Icons | Status |
|---|---|---|
| Mortal starter | `linh_bao` (Linh Bạo) | ✔ `assets/skills/linh_bao.png` |
| Basic Ngũ Hành | `hoa_cau_thuat` · `thuy_tien_thuat` · `doc_chuong` · `diem_kim_thuat` · `tho_cau_thuat` | ✔ 5× `assets/skills/` |
| Special Ngũ Hành (kit `SPELL_KIT_IDS`) | `tam_muoi_chan_hoa` · `thanh_tuyen_duong_linh` · `van_moc_sinh_co` · `kim_y_ngung_phong` · `trong_nhac` | **VẼ 5** → `public/assets/skills/` |
| Technique | `five_elements_art` (Tiểu Ngũ Hành Quyết — grade 2 = Đại Ngũ Hành Quyết Trúc Cơ) | ✔ `assets/techniques/dai_ngu_hanh_chan_quyet.png` |
| Pill gate/family | `thong_mach_dan` · `truc_co_dan` | **VẼ 2** → `public/assets/pills/` (production đang chữ-fallback, chặn Trúc Cơ) |
| Pill family còn lại | `tu_linh_dan` · `hoi_linh_dan` · `khai_linh_dan` | ✔ đã có `assets/pills/` |
| Conditional material | `yeu_dan_hung_giao` (Yêu Đan — ingredient 2 recipe gate, ingredient row + drop preview đang text-fallback) | +1 nếu làm |

**Utility-pill enumeration:** Pill Room render đủ 5 beta recipe family → cần icon cả 5: `tu_linh/hoi_linh/khai_linh` **đã có**, `thong_mach/truc_co` **vẽ** (đã nằm trong list 14). Không pill icon nào khác cần cho beta surface.

Đặt skill icons tại `public/assets/skills/`. **Acceptance (giữ nguyên):** Devin wire `iconKey` + `SKILL_ICON_MANIFEST` + verify HUD resolve — giao icon theo đợt.

**POST-BETA:** icon Kiếm/Thể/hidden-way skills, ~36 companion icons, orb icons, Ngộ Đạo emblem, đan ngoài 5 family.

---

## Thứ tự tổng v3
1. **A1 Động Phủ + state strip** (unblock mọi thứ)
2. **D — 2 đan gate** (`truc_co_dan` + `thong_mach_dan` — production đang fallback)
3. **B1 chrome Động Phủ** (5 slot)
4. **C Act II — 3 normal** (wild_wolf·flame_fox·giant_earthworm — floor Quật toàn silhouette)
5. **A2 Combat + rail state board** → **A3 Character**
6. **C Act III — 3 normal** (foundation_lava_hound·sand_scorpion·mud_golem)
7. **B2/B3 chrome** (ceremonial grayscale, divider 4/4)
8. **D — 5 Special icons** (+`yeu_dan_hung_giao` nếu làm)
9. **A4-A9 còn lại**

*Act I không cần enemy art — cả 4 identity đã bind. 3 boss đã bind — không vẽ boss mới trong beta.*
