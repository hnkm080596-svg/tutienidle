# Task 2.1 Brief — MenuButton component

## Where this fits

Task 2.1 of 36 (Phase 2: Main Menu + Onboarding). Creates a reusable
button with primary/secondary variants, themed via CSS tokens. Used in
Task 2.4 (MainMenu).

**Worktree:** `E:\tutienidle\.agent-worktrees\tu-tien-redesign`
**Branch:** `feat/tu-tien-theme-redesign`
**Base commit:** `a34b622` (after Task 1.8)

## Global constraints

- Vue 3 + TypeScript
- DO NOT use `any` unless absolutely necessary
- DO NOT add dependencies
- 5 theme IDs: 'default' | 'ink-minimal' | 'landscape-shanshui' | 'xianxia-glow' | 'classical-imperial'

## Files

**Create:**
- `game/src/components/menu/MenuButton.vue`
- `game/src/components/menu/MenuButton.test.ts`

## Implementation steps

### Step 1: Write failing test (verbatim)

```typescript
// game/src/components/menu/MenuButton.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MenuButton from './MenuButton.vue'

describe('MenuButton', () => {
  it('renders label', () => {
    const wrapper = mount(MenuButton, { props: { label: 'Bắt đầu' } })
    expect(wrapper.text()).toContain('Bắt đầu')
  })

  it('emits click event on press', async () => {
    const wrapper = mount(MenuButton, { props: { label: 'Test' } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('applies primary variant class', () => {
    const wrapper = mount(MenuButton, { props: { label: 'X', variant: 'primary' } })
    expect(wrapper.classes()).toContain('menu-button--primary')
  })

  it('applies secondary variant class', () => {
    const wrapper = mount(MenuButton, { props: { label: 'X', variant: 'secondary' } })
    expect(wrapper.classes()).toContain('menu-button--secondary')
  })
})
```

NOTE: `@vue/test-utils` is not installed. Use the same project pattern as
Task 1.6: mount via `createApp`/`h`. See `game/src/components/settings/ThemeSwitcher.test.ts`
for the working pattern.

### Step 2: Verify test fails

Run: `npm.cmd run test -- --run src/components/menu/MenuButton.test.ts`
Expected: FAIL

### Step 3: Write MenuButton.vue (verbatim)

```vue
<!-- game/src/components/menu/MenuButton.vue -->
<script setup lang="ts">
interface Props {
  label: string
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  disabled: false,
})

defineEmits<{
  (e: 'click'): void
}>()
</script>

<template>
  <button
    class="menu-button"
    :class="[
      `menu-button--${variant}`,
      { 'menu-button--disabled': disabled },
    ]"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <span class="menu-button__label">{{ label }}</span>
  </button>
</template>

<style scoped>
.menu-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 200px;
  min-height: 48px;
  padding: 12px 32px;
  font-family: var(--font-display);
  font-size: var(--text-md);
  font-weight: 600;
  letter-spacing: 0.05em;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: transform 200ms ease, box-shadow 200ms ease, background 200ms ease;
  background: transparent;
  color: var(--surface-text);
  border: 1px solid var(--surface-line);
}

.menu-button:hover:not(.menu-button--disabled) {
  transform: translateY(-1px);
}

.menu-button--primary {
  background: linear-gradient(180deg, var(--surface-600), var(--surface-700));
  border-color: var(--surface-eyebrow);
  color: var(--surface-text);
}

.menu-button--primary:hover:not(.menu-button--disabled) {
  box-shadow: var(--surface-glow-gold);
}

.menu-button--secondary {
  background: transparent;
  border-color: var(--surface-line);
}

.menu-button--secondary:hover:not(.menu-button--disabled) {
  background: var(--surface-700);
  border-color: var(--chrome-300);
}

.menu-button--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
```

### Step 4: Verify test passes

Run: `npm.cmd run test -- --run src/components/menu/MenuButton.test.ts`
Expected: PASS (4 tests)

### Step 5: Commit

```bash
cd "E:\tutienidle\.agent-worktrees\tu-tien-redesign"
git add game/src/components/menu/MenuButton.vue game/src/components/menu/MenuButton.test.ts
git commit -m "feat(menu): add MenuButton component with primary/secondary variants"
```

## Report contract

Write to: `E:\tutienidle\.agent-worktrees\tu-tien-redesign\.superpowers\sdd\2026-08-31-tu-tien-theme-redesign\task-2-1-report.md`

Return ONLY:
- Status: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
- Commit SHA(s)
- One-line test summary
- Concerns

Do NOT paste file contents. Do NOT dispatch subagents. Begin.