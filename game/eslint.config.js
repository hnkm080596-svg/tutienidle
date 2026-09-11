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
    // Policy: strict severity applies to core files INCLUDING tests. The
    // pre-existing violations this surfaced (2026-09-11) were fixed when the
    // combat branch merged; keep this block last so it wins over src/**.
    files: ['src/core/**/*.{ts,vue}'],
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
)
