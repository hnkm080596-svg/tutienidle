<script setup lang="ts">
// Primitive section title — chữ uppercase letter-spacing dùng làm eyebrow
// cho mọi nhóm nội dung (đang lặp ~25 chỗ với tracking .02–.13em tùy nơi,
// chuẩn hóa về --eyebrow-tracking default .04em).
withDefaults(defineProps<{
  as?: 'h3' | 'h4' | 'h5' | 'span' | 'p'
  tone?: 'chrome' | 'muted' | 'inherit'
}>(), {
  as: 'h4',
  tone: 'chrome',
})
</script>

<script lang="ts">
export default { name: 'Eyebrow' }
</script>

<template>
  <component :is="as" class="eyebrow" :class="`eyebrow--${tone}`">
    <slot />
  </component>
</template>

<style scoped>
.eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: var(--eyebrow-tracking, 0.04em);
  font-size: var(--text-sm);
  font-weight: 700;
  font-family: var(--sys-font-body, var(--font-body));
}

.eyebrow--chrome {
  color: var(--sys-accent, var(--paper-eyebrow));
}

.eyebrow--muted {
  color: var(--sys-text-dim, var(--paper-text-muted));
}

.eyebrow--inherit {
  color: inherit;
}
</style>
