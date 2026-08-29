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
  {
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
)
