# Task 2.1 Report — MenuButton component

## Status
DONE

## Commit SHA(s)
`6cd84f5` `9563797`

## One-line test summary
4 PASS — MenuButton renders label, emits click, and applies primary/secondary variant classes correctly.

## Fix round 1

**What changed:** Added `addEventListener('click')` capture in the "emits click event on press" test before calling `button.click()`, then asserted `callCount === 1`. This ensures the test fails if the `@click="$emit('click')"` handler is ever removed.

**Test command:** `npm.cmd run test -- --run src/components/menu/MenuButton.test.ts`
**Result:** 4 PASS

**New commit SHA:** `30287bd`

---

## Fix round 2

**What changed:** Replaced the broken "emits click event" test that used `addEventListener('click')` (which always fires on native DOM click) with a parent-wrapper pattern. The new test mounts a parent Vue component that listens to MenuButton's `@click` emit via `@click="onClick"` — `onClick` increments a counter. This proves Vue's emit system is working, not just the browser's click event.

**Test command:** `npm.cmd run test -- --run src/components/menu/MenuButton.test.ts`
**Result:** 4 PASS

**Red-green verification performed:**
- Without `@click="$emit('click')"` in MenuButton.vue: test fails with "expected 1, received 0"
- With emit restored: test passes
- This proves the test actually verifies the Vue emit

**New commit SHA:** `9563797`

---

## Concerns
None.
