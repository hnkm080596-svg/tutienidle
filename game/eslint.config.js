import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs(
  { ignores: ['dist/', 'dist-electron/', 'node_modules/', 'coverage/', 'playwright-report/', 'test-results/'] },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    files: ['src/data/**/*.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    // R14.1a (AR-33): general src rules MUST come before the stricter
    // src/core block. In flat config the LAST matching block wins, so the
    // previous order (core first, then src/**) silently downgraded the
    // core-only 'error' severities back to 'warn'. Tests:
    // tests/architecture/eslintCoreSeverity.test.ts
    files: ['src/**/*.{ts,vue}'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': 'off',
      'prefer-const': 'warn',
      'vue/multi-word-component-names': 'off',
      'vue/return-in-computed-property': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/attributes-order': 'off',
      'vue/component-name-in-template-casing': 'off',
    },
  },
  {
    // Stricter layer-specific block: kept after src/** so it is the
    // effective winner for core files (see R14.1a comment above).
    // Policy: strict severities target PRODUCTION core only. Core test
    // fixtures stay at the src/** warnings — at de-overlap time (2026-09-11)
    // effective errors would have surfaced 59 pre-existing violations in
    // core *.test.ts, most inside core/battle/turn/** (combat-turn-mechanism
    // branch territory); fixing them there now would collide with that
    // branch. Revisit after it merges.
    files: ['src/core/**/*.{ts,vue}'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-expressions': 'off',
      'prefer-const': 'error',
      'vue/multi-word-component-names': 'off',
      'vue/return-in-computed-property': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/attributes-order': 'off',
      'vue/component-name-in-template-casing': 'off',
    },
  },
  {
    // R14.1a follow-up: combat-held files (GameManager.ts /
    // GameManagerTurnBattleOps.ts, owned by the in-flight
    // combat-turn-mechanism branch) carry a pre-existing dead
    // `type PresentationHold` import that the de-overlap surfaced as an
    // error. Editing those files here would collide with that branch, so
    // they temporarily stay at the repo-wide warning; delete this block and
    // the dead import together when the branch merges.
    files: ['src/core/game/GameManager.ts', 'src/core/game/GameManagerTurnBattleOps.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
)
