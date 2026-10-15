# Enemy Art Wave 1 — Blood-Fir-Forest Reskin — Plan

Status: v1 — DRAFT (chờ spec review của user trước khi implement)
Spec: `docs/p7/missions/enemy-art-wave1.spec.md`
Worktree: `.agent-worktrees/enemy-art-wave1` (tạo khi bắt đầu phase B —
phase A read-only research + script authoring có thể trong worktree luôn;
P2: multi-file feature → worktree required)

## Phase 0 — Confirmations — DONE (user rulings 2026-09-28)

- [x] Mapping: 9 loài/3 cảnh giới + boss recolor pipeline — spec §2.1/2.2.
- [x] Ferocious = recolor cùng species (spec §2.3).
- [x] Species thiếu sfx → silent, thiết kế sau.
- [x] `wugu-demon-king` → reserve (pack, không wire).
- [x] Không combat speed → chỉ x1 ogg.
- [x] Avatar có consumer: CombatScene/BattleLane — wire được.

## Phase A — Asset staging script (no game-code change)

A1. `scripts/pack-enemy-art.mjs`:
- Walk monster-library + forest-region + boss dirs; parse Unity `.json`
  chỉ để lấy `m_Pivot` (frame idle-1).
- Normalize names: strip `.png.png`, kebab-case.
- Pack sheet (PADDING=2, max width ≤ 4096 → wrap rows) + emit atlas JSON
  Hash (`<slug>-<clip>-<NNN>.png` frame names).
- Measure `opaqueBounds` per species trên frame cao nhất → emit extents
  JSON + TS constants fragment.
- Derive avatar.png cho 4 loài thiếu (alpha-bbox crop của idle-1).
- Emit `manifest.json` per species: { slug, clips:{idle,attack,death},
  frameCounts, pivot, extent, sheetKey, files[] } — manifest này là
  parity-test input.
- Output: `public/assets/enemies/animated/<slug>/` + staged
  `public/assets/audio/enemies/<slug>/` (copy ogg theo tier x1; x1.5/x2
  stage cùng nếu combat speed map được).
- Dry-run report: species × clips × frames × sizes; in danh sách species
  thiếu clip bắt buộc (idle/death) → fail-closed nếu species được map
  mà thiếu.

A2. Verify: script idempotent (chạy 2 lần output hash giống nhau);
manifest parses; atlas loads trong Phaser smoke (node-side schema check
đủ cho A, runtime check ở phase C).

Gate A: `node scripts/pack-enemy-art.mjs --dry-run` report clean; output
dir generated; tests cho packer (unit: frame-name format, pivot extract,
extent math, fail-closed missing clips).

## Phase B — Registry + contract amendment

B1. `src/game/support/MonsterArt.ts` (owner mới):
- `MONSTER_ART: Record<slug, { sheetKey, sheetUrl, atlasUrl, avatarUrl,
  sfxUrl?, pivot, extent, sourceSize }>` — generated/curated từ manifest.
- `ENEMY_RESKIN_MAP: Record<templateId, slug>` — chỉ các row đã duyệt.
- `resolveEnemyArt(templateIdOrRuntimeId)` — longest-prefix giữ nguyên
  semantic; trả `{ kind:'static' }` cho unmapped (giữ EnemyArt path).

B2. `src/presentation/art/CombatEntityPresentation.ts`:
- `CombatAnimationName` += `'attack'`; `CombatAnimationCatalogue.attack?`
  optional; doc rõ repeat=0, play-once, fallback lunge.
- `COMBAT_ANIMATION_NAMES` += attack.

B3. `CombatPresentationCatalogue.ts`:
- `ANIMATED_ENEMY_SET` canonical list (từ ENEMY_RESKIN_MAP keys);
  buildCatalogue register mapped enemies với clips thật (idle←idle,
  standby←idle frames shared clip entry, death←death, attack←attack);
  unmapped giữ static.
- `presentationFor` per-entity kind resolution.

B4. EnemyArt.ts giữ vai trò enumeration; comment pointer sang MonsterArt.

Gate B: type-check + vitest art tests; contract test pin: attack optional
không bắt buộc; static path không đổi cho unmapped.

## Phase C — Runtime wiring

C1. CombatPreload/AssetBundleCatalog: enqueue atlas keys của
ANIMATED_ENEMY_SET; parity test cập nhật (manifest-driven).
C2. `combat-animation-playback`: register attack clip; hook
`ActionImpactEvent` → entity.play(attack) → on complete return idle;
absent → existing lunge.
C3. Sprite origin: pivot → `setOrigin(pivot.x, pivot.y)` hoặc offset
tương đương; verify vs bodyAnchor/combatBodyAnchors + grid projection.
C4. Audio: sampled channel — `scene.sound` hoặc adapter trong
combatAudioBinding; map action_impact attacker→species sfx; fallback
silent; speed mapping nếu domain expose combat speed.
C5. Avatar: wire vào surface thật nếu tồn tại consumer; else stage-only
(và spec ghi rõ không wire để tránh dead asset claim).

Gate C: P3 quick + P13/P14 Playwright evidence: battle với ≥2 reskinned
enemies — idle loop chạy, attack fire trên impact, death settle, sfx nổ;
unmapped enemy vẫn static đúng; regression: mortal player art intact.

## Phase D — Ferocious/elite handling + polish

D1. Nếu mapping dùng shared species cho base+ferocious (sau review):
    palette variant hoặc silhouette swap — quyết trong review.
D2. Death single-frame hold + fade (existing tween path).
D3. Perf check: total VRAM của sheets; lazy-load per-encounter nếu cần
    (bundle split theo region).

## Phase E — Docs + QA gates + closure

- Update `EnemyArt.ts` header comment + roadmap.md entry.
- Ledger run `enemy-art-wave1-<date>`: coverage rows cho mapping
  completeness, animation contract, audio path; findings + closure.
- P18 OCR + P4 adversarial quick + P5 3-pass sequential.
- Report: animated enemy count, coverage % của roster ≤ Trúc Cơ,
  residual gaps (unmapped list), deferred items.

## Open questions còn lại cho user review

1. `forest-region` 6 loài + `monster-library` 15 loài — có phải 2 region
   khác nhau? (forest-region naming không numbered)
2. Trial-tower boss `wugu-demon-king` — có enemy trial-tower nào trong
   game data để bind không? (chưa thấy trong enemy files — cần tìm
   stage/wave data)
3. Speed variant ogg có map combat speed không, hay chỉ x1?
4. Palette variants trong `_reskin-demo/` (yuejianxin) — có muốn dùng
   mechanism reskin này cho ferocious sau không?
