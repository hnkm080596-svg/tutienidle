# Live-Beta Gap Analysis — 2026-09-29

Scope: what is still missing for a real live Beta (players install/launch, create a
character, progress Phàm Nhân → Luyện Khí → Trúc Cơ, save/reload, on the six Ways).
Target audited: `master @ f1049b5e` on branch `qa/beta-2026-09-29` (no tracked dirt).
This is a gap inventory, not a pass/fail verdict — the exhaustive adversarial audit
runs in parallel under `docs/qa/runs/beta-release-2026-09-29/` and the delegated
cloud review.

Official gate consulted: `docs/roadmap.md` §0.12 (Beta release gate: architecture /
content / verification).

## Verified present (evidence on this machine)

| Gate item | Evidence |
|---|---|
| `npm run verify` (type-check + build + full Vitest) | 7258/7259 pass; sole failure `tests/architecture/audioManifestCompleteness.test.ts` — regex `\n\n` assumes LF checkout; this machine checks out `CombatAction.ts` CRLF. Env-fragile test, not a game defect. |
| `npm run test:balance` | 8/8, three seeds deterministic (Perfect-ion economy sim ~20 min wall). |
| `npm run test:e2e` | Effectively green. One deterministic failure was a **test-flow defect** (Quán Khí preset editor never closed before wheel interaction — fixed in `cultivation-path-ritual.spec.ts`, spec re-passes). `combat-idle-motion-capture` is a flake (passed clean on re-run). Late-run `ERR_CONNECTION_REFUSED` cascade was the Playwright dev server dying under parallel load, not game failures. |
| i18n | 961/961 leaf keys vi↔en, zero drift either direction. |
| Save UX | Manual save (failure-toast wired), reload-load, export file, import file, reset request, `SaveIncompatibleScreen` for version mismatch. |
| Auth | Guest (MockAuthService, works with zero env) + login/register (SupabaseAuthService, env-gated). Session resume path exists (`resumeSession`). |
| Electron packaging | `dist:win` → electron-builder → NSIS; quit-flush (`src/main-process/quitFlush.ts`) tested; `dist`/`dist-electron` only packaged, node_modules excluded. |
| Stages | 30 authored stages (10/realm), boss metadata floor-10 only, perfect-clear thresholds in rounds. |
| Realm ceiling | `ReleasePolicy.progressionCeilingRealmId = 'foundation_establishment'`; six-way matrix E2E passes for all six Ways. |
| Runtime art closure | Every runtime-referenced player/enemy texture is git-tracked. The 8 untracked `mortal-*-v1.png` are **superseded** — reskinned to animated variants (`ENEMY_RESKIN_MAP`); `CombatPreload`/`CombatPresentationCatalogue` skip them by design. |
| Settings | Locale switch, UI scale, audio sliders, free respec (Beta note), save ops. |
| Audio engine | Lazy bundles, gesture unlock, mute/volume, per-cue fallback — fully wired (W1–W10). |

## Gap inventory

### A. Content gaps (player-visible)

- **A1. Audio content absent.** `AudioCueManifest` ships `src: ''` entries + 77
  synthesized fallback cues; the only authored audio is ~26 enemy attack SFX via
  `MonsterArt`. No music, ambient, or UI cues. The engine is ready — the asset
  drop is the missing piece. Player-facing: near-silent game.
- **A2. Enemy art coverage ~52%.** Of 67 enemy templates: 23 resolve to animated
  reskins, 12 to tracked mortal statics, **32 fall through to the shared
  placeholder entity** — including `huyet_mong` (hidden beast), and
  `foundation_dragon_phase1/phase2/enrage` (the Foundation boss family), plus
  ~14 Qi-tier and ~10 Foundation species. Placeholder is the sanctioned
  uniformity fallback, but §0.12 content gate ("no required normal-flow
  placeholder/test-only content") makes a 3-phase final boss on placeholder a
  release-decision item.
- **A3. No dedicated Thể Tu player art.** `PLAYER_VISUAL_PROFILES.the_tu`
  falls back to mortal textures for both combat and cultivation
  (`PlayerVisualProfiles.ts`: "the_tu art is future content"). Kiếm/Pháp
  have dedicated art; hidden_spell even has a way-keyed cultivate
  override — body-path players see mortal art the whole game.
- **A4. No app icon.** `electron-builder.yml` explicitly notes the default
  Electron icon ships until `build/icon.ico` exists.

### B. Ops/distribution gaps (outside game code, required to actually go live)

- **B1. Supabase deployment.** Account auth + cloud save need a real Supabase
  project and `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` injected at build
  time. Guest mode works without it — but "live beta" with accounts needs the
  backend stood up and a build-time secret path (CI secret or local .env).
- **B2. No update channel.** No `publish`/`autoUpdater` config — every build is a
  manual installer download. Acceptable for a closed beta; needs a story before
  scale.
- **B3. Unsigned installer.** No code-signing cert configured → Windows
  SmartScreen warning on install.
- **B4. No in-app feedback channel.** Beta players have no bug-report /
  feedback path inside the game.
- **B5. No visible build/version string.** `SaveIncompatibleScreen` reports the
  save's version but no UI surface shows the running build id — beta bug
  reports can't be tied to a build.

### C. Quality-gate gaps

- **C1. Lint debt: 79 errors / 180 warnings.** Mostly test hygiene
  (`prefer-const`, unused vars, triple-slash ref in `vitest.lab.config.mts`,
  unused `bootToGuestHome` in `sound-system.spec.ts`). Not player-facing; does
  block a clean-gate claim and hides real warnings in noise.
- **C2. Env-fragile tests.** `audioManifestCompleteness` LF-only regex;
  `PlayerPortrait` vitest worker timeout under load; `combat-idle-motion-capture`
  flake; Playwright `webServer` fragile under parallel CPU load. Each passed in
  isolation — flake budget is thin for CI.
- **C3. Test file outside QA write surface.** `tests/architecture/**` is not in
  the QA-writable set, so the CRLF fix must ride a normal production-side change
  (it is a test-file edit, low risk).

### D. Balance/design open items (roadmap-acknowledged)

- **D1. Stat cap (Phàm Nhân) + CDR cap 300% undecided** — roadmap: "chưa chốt,
  không chặn beta — xử lý ở Phase D balance pass". Decision still open.
- **D2. Perfection-lineage pacing.** `PerfectionEconomy` seed 7 reports
  `proven_infeasible` while income stays inside tolerance — i.e. the hidden
  lineage is deliberately hard/late. Confirm this is intended before beta
  players hit it as "impossible".
- **D3. World map parked** (user decision 2026-09-13) — stage list ships
  instead; intended scope, but players may read it as missing content.
- **D4. Kim Đan+ / artifact / online foundation** all deferred by policy —
  `ReleasePolicy` enforces; Beta players reaching the ceiling need a clear
  "end of beta" message (labels were repaired earlier — confirm in journey
  pass).

### E. Audit-coverage status

- Four domain auditors (persistence/progression/combat/economy) still running
  at report time — confirmed defects they surface get appended to this list and
  the run ledger.
- Cloud agent holds the exhaustive mission; this report feeds it the local
  environment/asset/distribution findings it cannot see (untracked files, CRLF
  checkout, dev-server behavior under load).

## Bottom line

The **engineering spine is Beta-ready**: deterministic gates effectively green,
save/auth/packaging/persistence/i18n all real and tested, all six Ways playable
end-to-end, ceiling enforced.

What stands between `master` and a *live* Beta is mostly **content drops and
release plumbing**, in priority order:

1. Authored audio drop (A1) — the only truly "missing system" feeling.
2. Enemy art decision (A2) — either ship reskins for the boss family + common
   Qi/Foundation species or accept placeholder coverage formally.
3. Release ops (B1–B5) — Supabase project + credentialed build, icon, version
   stamp, feedback path; auto-update optional for closed beta.
4. Lint + flake hygiene (C1–C2) — cheap, mostly mechanical.
5. Balance decisions (D1–D2) — rulings, not engineering.
