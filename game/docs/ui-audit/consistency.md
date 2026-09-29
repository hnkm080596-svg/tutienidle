# UI Deep-Scan — Pass 5: Cross-Cutting Consistency (coordinator)

Scope: `game/src/components/**` static audit on origin/master — design tokens, shared primitives, i18n, conventions. Per-screen player-perspective findings come from the 4 slice reports.

## Findings

### [Medium] C-1 — Hardcoded Vietnamese leaks into EN locale
~15 sites across 13 shared components render raw Vietnamese template text regardless of locale: `ToastContainer` ("Nhận được"), `TutorialOverlay` ("Bỏ Qua"), `SaveIncompatibleScreen` (3 strings), `ErrorScreen` (3), `TurnCombatSkillBar` ("Bị Động" / "Thủ công" / "Đến lượt bạn — chọn kỹ năng"), `TechniqueSlotCard` (2), `ArtifactGradeSection` (2), `ActionFeedbackLog` ("Nhật ký thao tác"), `LoreCodex`, `ArtifactExperienceBar`, `CombatSkillSlot`, `LoadingScreen` ("TIÊN HIỆP IDLE" — brand, acceptable).
Detector gap: `tests/architecture/i18nKeyParity.test.ts` only verifies `t()`/`$t()` key resolution — non-key template text is unguarded.
Fix: route all sites through `t()` keys in vi.json/en.json; extend the parity guard with a template-literal CJK/diacritics check on `src/components/**`.

### [Low] C-2 — Theme token leakage
28/65 component files embed raw hex colors instead of `theme.css` tokens (~92 `var(--` usages exist — tokens ARE the convention; leakage is concentrated in combat HUD + a few panels). Visual drift risk when re-skinning; some hex values are near-but-not-equal to the token they shadow.
Fix: gradual tokenization + CI grep rule banning new hex in `.vue` scoped styles outside a small allowlist (gradients/Phaser-coupled canvas colors).

### [Low] C-3 — Button convention split
32 files use raw `<button>` vs 42 using `GameButton`. Ad-hoc buttons lack the shared disabled/focus/keyboard affordances and look inconsistent next to GameButton elsewhere (e.g. same panel mixing both).
Fix: codify "interactive click target = GameButton" convention; migrate highest-traffic offenders first (combat HUD, panel headers).

### [Nit] C-4 — Same token, two different px fallbacks
`var(--text-xs, 11px)` vs `var(--text-xs, 12px)` inside the same combat HUD (`TurnCombatSkillBar.vue:261` vs `:278`); `TranPhapPanel` mirrors the 11px fallback. Pick one canonical fallback per token.

### [Nit] C-5 — Letter-spacing spray
8 distinct em values (0.02/0.03/0.04/0.05/0.06/0.08/0.1/0.13) for eyebrow-style caps text. Standardize 2-3 tracking tokens.

### [Info] C-6 — Stacking & shells healthy
Max z-index 50, small local scale, no obvious stacking wars statically. 16 components share `OverlayPanel`; 5 custom overlays (`CombatPauseOverlay`, `OfflineSummaryModal`, `TutorialOverlay`, `TalentEntitlementModal`, `FunctionOverlayPanel`) — acceptable given distinct purposes; dialogFocus tests cover ESC/focus infra. Runtime layering still needs the slice reports.

## Positives
Typography is heavily tokenized (~300 `var(--text-*)` uses); a real primitives layer exists (`common/primitives`: EmptyState/Eyebrow/Chip/Bar/StatRow); focus/dialog infrastructure is tested (`dialogFocus*.test.ts`); 82 of 65+ components already consume i18n.
