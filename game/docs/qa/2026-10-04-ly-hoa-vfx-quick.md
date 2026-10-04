# QA — Ly Hỏa Thuật VFX pack (quick mode)

Date: 2026-10-04. Branch: `devin/1791138897-ly-hoa-vfx` (base `codex/hoa-cau-fireball-vfx`).

## Scope (Minh spec, 5 parts)

1. Tụ hỏa chậm hơn magic circle — old charge clip was 0.55s authored stretched
   over the 1700ms charge window (~0.32×). Re-authored `Hoa Tu Charge` as a
   1.7s Genki-dama-style converging-energy charge (particles fly INTO the
   point), exported 51 frames @ss2; render runs at authored rate.
2. Ring count by cast tier — `SkillCastPresentation.empowered` (from
   `declared.execution.source === 'empowered'`); portal renders 1/2/3 stacked
   tripleCircle sprites (scale + alpha + spin-phase offset per ring). 3 = ult
   placeholder per spec.
3. Projectile — `phoenixProjectileEmpowered` atlas (offline hue-shift +175°,
   achromatic → azure); empowered casts fly blue, normal stays red.
4. Bake speed into asset — charge re-timed to authored rate (above); Hoa The
   burn tail retimed 900ms → authored 1200ms; all other sheets already ran at
   authored rate.
5. Tier-5 Hoa The instant burn — removed 2400ms reveal; burn tail loops from
   ms 0 in CombatScene + lab mirror, constants shared in `HoaCauVfxAssets`.

## Evidence

- `npm run type-check` — clean (vue-tsc exit 0).
- `npx vitest run src/game/support/skill-vfx src/game/scenes src/dev
  src/core/battle/turn tests/architecture tests/e2e/vfx-lab.spec.ts` —
  227 files / 1933 passed.
- Arcadia validate: `Hoa Tu Charge` + `Hoa Cau Phoenix Empowered` = 0 errors.
- Lab screenshots (dev/skill-vfx.html?preset=hoa_cau_comet):
  - normal charge — converging sparks + single ring;
  - empowered charge — two concentric rings (phase-offset outer ring reads
    as a second disc);
  - normal flight — red comet; empowered flight — azure comet.
- Pins updated: `hoaCauChargeArt` (1.7s/51f/1700ms/1536x1344),
  `HoaCauFireballTimeline` (chargeFrame max 50), `HoaCauFireballPresentation`
  (reduced 27-44, empowered ring+blue variant), `CombatScene.skillPresentation`
  (burn tail frame_18+, no reveal), `vfx-lab` e2e (burn starts >=18, varies).

## Base regression repaired (not from this diff)

Base commit `2162d5d5` (Codex, in-flight) added raw `player.spellPath?.element`
+ `pathId === 'spell'` reads in `CharacterSurface.vue` → 3 guard failures
(betaFrontendScopeExposure, cultivationPathIsolation x2). Repaired minimally:
identity reads now go through `isActivePath`/`getActiveElement`
(CultivationPathSystem seam, same UX), and `CharacterSurface.vue` joined the
recorded hero-art identity exception next to `CharacterFigureWheel.vue`
(element read only for the Ly Hoa Chi Dao identity plate — same purpose
class). Flagged for Minh since it edits his in-flight frontend commit.

## P18 OCR (delegation mode)

- previewed_files: 25 | reviewed_files: 25 | skipped: 0 (+2 binary png
  excluded by ocr, verified via runtime screenshots) | coverage 100%.
- Findings: none Medium+; all files reviewed against resolved rules or
  validated as generated artifacts (builders reviewed, docs validate clean).

## Independence note

No native isolated reviewer context in this environment — internal checks and
the sequential review below are self-review, per protocol fallback; stated
explicitly per policy.

## Sequential review

Pass 1 — Local correctness (post-OCR state):
- Checked: empowered defaults false everywhere (no cast misidentifies);
  `?empowered=` + checkbox flow; scrub replay passes empowered; ring frames
  clamp inside show(); hoaTheSealFrame modulo handles unbounded ms; charge
  frame mapping 0..50 across the full window; lab mirrors scene constants.
- Findings: none Medium+. Nit: second `fireball.play` arg named `autoplay`
  at call site is pre-existing naming, left as-is.

Pass 2 — Architecture / authority:
- Checked: empowered is a presentation fact derived from declared execution
  (no new battle state); ring count lives in presentation only; asset
  selection by flag (not tint at runtime) matches pipeline; seal constants
  shared between scene + lab instead of duplicated literals (removes a
  drift source); CharacterSurface now reads identity via the path
  authority — no slice reads, no literals.
- Findings: none.

Pass 3 — Adversarial integration:
- Checked: non-hoa-cau presets unaffected (empowered only read inside
  isHoaCauFireballCast path); `slotRole === 'ultimate'` ring-3 placeholder
  cannot fire until ult casts exist (documented); cancel() destroys the
  extra ring sprites via the sprites map; reduced-motion pins updated on
  both timeline and presentation; e2e drives initial autoplay path
  unchanged (empowered default off).
- Findings: none.

Result: QA_FIXED_POINT_REACHED (quick mode, self-review caveat noted).
