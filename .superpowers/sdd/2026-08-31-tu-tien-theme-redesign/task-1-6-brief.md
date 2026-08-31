# Task 1.6 Brief — ThemeSwitcher component

## Where this fits

Task 1.6 of 36. Creates the UI component that lets the user pick a theme.
Uses `useTheme()` from Task 1.4. Renders 5 preview cards. Task 5.6 will
integrate this into the Settings panel.

**Worktree:** `E:\tutienidle\.agent-worktrees\tu-tien-redesign`
**Branch:** `feat/tu-tien-theme-redesign`
**Base commit:** `7ccc061` (after Task 1.5)

## Global constraints

- Vue 3 + TypeScript
- DO NOT use `any` unless absolutely necessary
- DO NOT add dependencies
- 5 theme IDs: 'default' | 'ink-minimal' | 'landscape-shanshui' | 'xianxia-glow' | 'classical-imperial'

## Files

**Create:**
- `game/src/components/settings/ThemeSwitcher.vue`
- `game/src/components/settings/ThemeSwitcher.test.ts`

## Implementation steps

### Step 1: Write failing test (verbatim)

```typescript
// game/src/components/settings/ThemeSwitcher.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ThemeSwitcher from './ThemeSwitcher.vue'
import { useThemeStore } from '@/stores/themeStore'

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders 5 theme cards', () => {
    const wrapper = mount(ThemeSwitcher)
    const cards = wrapper.findAll('[data-testid="theme-card"]')
    expect(cards).toHaveLength(5)
  })

  it('clicking a card calls setTheme', async () => {
    const store = useThemeStore()
    const wrapper = mount(ThemeSwitcher)
    const card = wrapper.findAll('[data-testid="theme-card"]')[2]
    await card?.trigger('click')
    expect(store.currentTheme).toBe('xianxia-glow')
  })

  it('marks current theme card as selected', () => {
    const store = useThemeStore()
    store.setTheme('landscape-shanshui')
    const wrapper = mount(ThemeSwitcher)
    const selected = wrapper.findAll('[data-testid="theme-card"][data-selected="true"]')
    expect(selected).toHaveLength(1)
    expect(selected[0]?.attributes('data-theme-id')).toBe('landscape-shanshui')
  })
})
```

### Step 2: Verify test fails

Run: `npm.cmd run test -- --run src/components/settings/ThemeSwitcher.test.ts`
Expected: FAIL

### Step 3: Write ThemeSwitcher.vue (verbatim)

```vue
<!-- game/src/components/settings/ThemeSwitcher.vue -->
<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { currentTheme, themes, setTheme } = useTheme()
</script>

<template>
  <div class="theme-switcher" data-testid="theme-switcher">
    <div
      v-for="theme in themes"
      :key="theme.id"
      class="theme-card"
      :class="{ 'theme-card--selected': theme.id === currentTheme }"
      :data-testid="'theme-card'"
      :data-theme-id="theme.id"
      :data-selected="theme.id === currentTheme ? 'true' : 'false'"
      role="button"
      tabindex="0"
      :aria-label="theme.label"
      @click="setTheme(theme.id)"
      @keydown.enter="setTheme(theme.id)"
    >
      <img :src="theme.preview" :alt="theme.label" class="theme-card__preview" />
      <span class="theme-card__label">{{ theme.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.theme-switcher {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 16px;
}

.theme-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--surface-line-soft);
  border-radius: 8px;
  background: var(--surface-800);
  cursor: pointer;
  transition: transform 200ms ease, border-color 200ms ease;
}

.theme-card:hover {
  border-color: var(--chrome-300);
  transform: translateY(-2px);
}

.theme-card--selected {
  border-color: var(--surface-eyebrow);
  box-shadow: 0 0 0 2px var(--surface-eyebrow);
}

.theme-card__preview {
  width: 100%;
  max-width: 240px;
  height: 120px;
  object-fit: cover;
  border-radius: 4px;
}

.theme-card__label {
  font-family: var(--font-body);
  font-size: var(--text-body);
  color: var(--surface-text);
}
</style>
```

### Step 4: Verify test passes

Run: `npm.cmd run test -- --run src/components/settings/ThemeSwitcher.test.ts`
Expected: PASS (3 tests)

### Step 5: Run typecheck

Run: `npm.cmd run type-check`
Expected: PASS

### Step 6: Commit

```bash
cd "E:\tutienidle\.agent-worktrees\tu-tien-redesign"
git add game/src/components/settings/ThemeSwitcher.vue game/src/components/settings/ThemeSwitcher.test.ts
git commit -m "feat(theme): add ThemeSwitcher component"
```

## Report contract

Write to: `E:\tutienidle\.agent-worktrees\tu-tien-redesign\.superpowers\sdd\2026-08-31-tu-tien-theme-redesign\task-1-6-report.md`

Return ONLY:
- Status: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
- Commit SHA(s)
- One-line test summary
- Concerns

Do NOT paste file contents. Do NOT dispatch subagents. Begin.