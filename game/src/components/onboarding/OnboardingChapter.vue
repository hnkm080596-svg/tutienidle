<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface Props {
  chapterNumber: number
  title: string
  body: string
  isLast?: boolean
}

withDefaults(defineProps<Props>(), { isLast: false })

defineEmits<{ (e: 'next'): void; (e: 'skip'): void }>()

const { t } = useI18n({ useScope: 'local' })
</script>

<template>
  <div class="onboarding-chapter">
    <div class="onboarding-chapter__illustration" aria-hidden="true" />
    <div class="onboarding-chapter__content">
      <div class="onboarding-chapter__eyebrow">{{ t('onboarding.chapter.eyebrow', { number: chapterNumber }) }}</div>
      <h2 class="onboarding-chapter__title">{{ title }}</h2>
      <p class="onboarding-chapter__body">{{ body }}</p>
    </div>
    <div class="onboarding-chapter__actions">
      <button class="onboarding-chapter__btn onboarding-chapter__btn--primary" @click="$emit('next')">
        {{ isLast ? t('onboarding.chapter.start') : t('onboarding.chapter.next') }}
      </button>
      <button v-if="!isLast" class="onboarding-chapter__btn onboarding-chapter__btn--ghost" @click="$emit('skip')">
        {{ t('onboarding.chapter.skip') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.onboarding-chapter {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 32px;
  max-width: 720px;
  margin: 0 auto;
  background: var(--surface-800);
  border: 1px solid var(--surface-line);
  border-radius: 12px;
}

.onboarding-chapter__illustration {
  width: 100%;
  height: 240px;
  background: var(--surface-grain), linear-gradient(180deg, var(--surface-700), var(--surface-800));
  border-radius: 8px;
}

.onboarding-chapter__eyebrow {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: 0.2em;
  color: var(--surface-eyebrow);
}

.onboarding-chapter__title {
  font-family: var(--font-display);
  font-size: var(--text-display);
  color: var(--surface-text);
  margin: 0;
}

.onboarding-chapter__body {
  font-family: var(--font-body);
  font-size: var(--text-md);
  line-height: var(--lh-relaxed);
  color: var(--surface-text-soft);
}

.onboarding-chapter__actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.onboarding-chapter__btn {
  min-height: 44px;
  padding: 12px 24px;
  font-family: var(--font-body);
  font-size: var(--text-body);
  border-radius: var(--radius-md);
  cursor: pointer;
  border: 1px solid var(--surface-line);
  background: var(--surface-700);
  color: var(--surface-text);
}

.onboarding-chapter__btn--primary {
  background: var(--surface-600);
  border-color: var(--surface-eyebrow);
  color: var(--surface-text);
}

.onboarding-chapter__btn--ghost {
  background: transparent;
}
</style>
