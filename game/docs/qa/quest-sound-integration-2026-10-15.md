# Quest and Sound local integration

G0: integrate existing committed and uncommitted Quest V2 slices and UI soundpack into master f831335f3 in isolated codex/quest-sound-integration. Original quest-v2-integration remains unchanged. No push, deletion, balance patch or activation of incomplete V2 producers/save/UI.

G1: Q1 preserve live V1 and transactional claims; canonical material selectors and existing audio cues work. Q2-Q4 QuestSystem/QuestManager retain quest authority; GameManagerQuestOps coordinates rollback across actual owners; AudioManager owns playback via AudioCueManifest and AssetBundleCatalog. Q5-Q9 reuse existing contracts without a second quest or audio path; read models remain observational; content selectors own material identities. Q10 duplicate/stale claims and receipts remain covered by imported transaction/receipt tests. Q11 V2 mainline, receipts, achievements and recurrence remain dormant where runtime consumers are not yet implemented. Q12 focused tests, type-check, build into a fresh output directory and isolated runtime exercise, followed by resulting-state review. User requests local integration only.

Plan: import candidate without mutating source; regression-test canonical IDs and lifetime ore/realm gate; repair selector conflicts; verify Quest/audio and live runtime; review resulting state; commit and fast-forward local master.

Ruling: ore achievements count lifetime delivery, retaining claim eligibility gates by achievement band. No numerical balance changes.

## Integrated candidate and evidence

- Git merge of committed codex/quest-v2-integration plus three-way application of its pending tracked changes completed without textual conflicts. Sixty-one specifically selected untracked Quest/Sound files were copied into the isolated worktree; source files were not changed.
- Installed WAVs: 43; source SHA-256 mismatches: zero. Manifest uses 37 existing cue IDs and preserves channel routing, fallback, cooldown and ducking. Unmapped proposed/reserved deliverables are retained in the source worktree, not activated here.
- Focused initial verification: type-check passed; 22 files / 343 tests passed (Quest, achievement, receipt/recurrence, audio manifest/engine/bundles/asset integrity).
- Resulting-state UTC repair verification: type-check passed; 7 files / 173 tests passed. Content follow-up: 3 files / 34 tests passed. Counts overlap and must not be added together.
- Production build passed into a new .qa-quest-sound-build-20261015 directory without erasing an existing dist. Vite reports the existing large-chunk warning.
- Actual Edge/Playwright from this worktree, fresh isolated guest: Quest panel visible; 37 WAV HTTP responses; 14 native AudioBufferSourceNode starts; ui.panel.open decoded through the production AudioManager; zero page exceptions. Repeated after the UTC/content fixes with the same successful observations. Screenshot: quest-sound-live-2026-10-15.png. This is technical playback evidence, not a subjective listening assessment.
- No staged file deletions. Six incoming design documents already on master as untracked files are clean-filter hash-identical; preserve them during integration. Scratch data and original worktrees remain untouched.

## Sequential Review Pass 1

Reviewed state: imported candidate after canonical material selectors and lifetime ore/realm eligibility ruling. Cross-consumer review found a Medium defect: recurring and achievement receipts used different numeric identities for the same Monday UTC week. New integration regression failed. Fix: one GameClock.utcWeekBucket, consumed/re-exported by recurrence and consumed by achievements. Verification: type-check and the 173 affected tests passed. Previous review evidence for weekly receipt identity was invalidated.

## Sequential Review Pass 2

Reviewed state after Pass 1 fixes: YES. Reviewed receipt identity validation/replay/monotonic restore, quest reservation/atomic rollback across player/bags/notifications/quest state, objective projection/query purity, authored selectors and real audio loading path. Ore descriptions still referred to realm-specific resources despite canonical selectors; corrected descriptions without changing amounts or realm admission. Receipt EOF whitespace normalized. Verification: 34 content/integration tests passed; staged whitespace check passed. No additional confirmed Medium+ issue found in this focused pass.

## Sequential Review Pass 3

Reviewed state after Pass 2 fixes: YES. Re-exercised fresh-guest Quest rendering and actual decoded WAV playback in the isolated candidate server; reviewed no runtime activation of incomplete V2 adapters and no replacement of current master UI. Checked source/target WAV hashes and destination untracked collisions. No new confirmed Medium+ issue found in this focused resulting-state pass.

## Independent review reservation

One fresh-context read-only reviewer, quest_sound_final_review (GPT-6.1 Sol low), was dispatched under requesting-code-review to review the candidate against f831335f3, including staged, unstaged and task-owned untracked files. Slot remains reserved until its result is reconciled. The reviewer returned no confirmed Medium-or-higher production regression. Its one Low concerned the runtime audio oracle and was repaired and independently re-reviewed as closed. The reservation is now released.

## Limits

This is integration of the existing slices, not a complete playable Quest V2 release: durable producers/cutover, full V2 save closure, recurring/achievement runtime ownership and UI activation remain absent and disabled. Live V1 remains active. No numeric balance patch, migration or remote push.

Full-suite QA, aggregate fixed-point qualification, two independently sealed clean protocol reviews are not certified by the focused checks above. Prior user direction is focused checks rather than full QA; no QA_FIXED_POINT_REACHED or release-readiness claim is made. The earlier local-master acceptance of QA gaps is recorded separately and is not a claim that these gates ran for this candidate.

## Independent/OCR reconciliation and final local integration scope

OCR latest selection: 47 previewed, 45 reviewed, 2 skipped with explicit reasons (questV2QaBrief.json and questV2QaTask.json are generated intake metadata). Reviewed coverage 95.7%; accounted coverage 100%. Reviewer accounted all selected production/test/helper paths. No unresolved confirmed Medium+ production finding. Rules resolved for the selected paths.

Low detector gap: a source-start count could be satisfied by the generic click instead of panel-open WAV. The script now hashes the PCM channel data and buffer dimensions of native started buffers, independently decodes ui_panel_open.wav, and requires that exact fingerprint among starts after the Quest click. Fresh Edge output: wavResponses=37, startedSources=14, panelWavPlayed=true, questVisible=true, pageErrors=[]. Independent follow-up: Low closed, no new actionable issue.

Local commit/merge is explicitly requested by the user; retained scope is focused verification rather than full QA. Full fixed-point/release certification is not claimed. This records the existing V2 slices and functioning sound integration only, with incomplete V2 runtime/save/UI activation remaining disabled. No push or source-worktree modifications.
