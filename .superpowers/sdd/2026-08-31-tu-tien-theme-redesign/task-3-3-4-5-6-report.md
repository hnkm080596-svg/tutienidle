# Task 3.3–3.6 Report: Combat Component Theme Token Refactor

**Status:** DONE

**Single commit SHA:** No commit created — zero changes were needed. All 8 files in scope already use theme tokens. A commit with `--allow-empty` was not requested; if the coordinator requires one, the command is:

```bash
cd "E:\tutienidle\.agent-worktrees\tu-tien-redesign"
git commit --allow-empty -m "refactor(combat): use theme tokens in combat bar/slot/result components"
```

**One-line test summary:** 252 test files / 1510 tests PASS; type-check PASS; build PASS.

---

## Per-File Findings

### Task 3.3 — CombatTopBar.vue
- **Hex replaced:** none
- **No hex found:** component already uses `--ink-950`, `--frame-outer`, `--chrome-100`, `--text-secondary`, `--font-display`, `--font-body`. No hardcoded hex in CSS.

### Task 3.4 — CombatSkillSlot.vue
- **Hex replaced:** none
- **No hex found:** component already uses `--ink-950`, `--jade`, `--text-primary`, `--text-muted`, `--ink-900`, `--font-display`. The `rgba(0,0,0,0.8)` on line 170 is a text-shadow, not a hex color.

### Task 3.5 — CombatStatusBar.vue
- **Hex replaced:** none
- **No hex found:** component already uses `--ink-950`, `--frame-outer`, `--ink-900`, `--ink-line`, `--hp-color`, `--jade`, `--gold-500`. The `rgba(0,0,0,0.9)` on line 229 is a text-shadow, not a hex color.

### Task 3.5 — CombatEventBar.vue
- **Hex replaced:** none
- **Hex found, left as-is:** `--gl: var(--gold-400, #c9a45c)` (line 122). The fallback `#c9a45c` does not map cleanly to any known token. `--gold-400` does not exist in the theme (only `--gold-100/300/500/700`); the fallback is a reasonable standalone hex for the glyph color variable. Left unchanged per task rules.

### Task 3.5 — CombatControlBar.vue
- **Hex replaced:** none
- **No hex found:** component already uses `--ink-950`, `--ink-800`, `--ink-line-soft`, `--crimson`, `--gold-500`, `--gold-300`, `--scrim`, `--text-secondary`, `--radius-sm`, `--radius-md`, `--shadow-panel`.

### Task 3.6 — CombatVictoryPanel.vue
- **Hex replaced:** none
- **No hex found:** component already uses `--paper-text`, `--paper-text-soft`, `--jade`, `--ink-700`, `--text-muted`. The CSS fallbacks `var(--paper-text, #211f1a)` and `var(--paper-text-soft, #5e5a50)` on lines 163/181 are valid CSS variable fallbacks matching the theme token definitions exactly.

### Task 3.6 — CombatDefeatPanel.vue
- **Hex replaced:** none
- **No hex found:** component already uses `--crimson`, `--paper-text-soft`, `--jade`, `--ink-700`, `--text-muted`. Same valid CSS variable fallback `var(--paper-text-soft, #5e5a50)` on line 154.

### Task 3.6 — CombatResultModal.vue
- **Hex replaced:** none
- **No hex found:** component only uses `var(--scrim)`.

---

## Summary

All 8 files in scope (CombatTopBar, CombatSkillSlot, CombatStatusBar, CombatEventBar, CombatControlBar, CombatVictoryPanel, CombatDefeatPanel, CombatResultModal) were already refactored to use theme tokens. The specific hex values listed in the task brief (`#15151c`, `#2a2a36`, `#d4a557`, `#e8e4dc`, `#a8a498`) are not present in any of these files. One hex fallback in CombatEventBar.vue (`#c9a45c`) was left unchanged as it doesn't map cleanly to an existing theme token.
