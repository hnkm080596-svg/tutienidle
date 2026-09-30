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
  font-family: var(--hk-font-ui);
}

.eyebrow--chrome {
  color: var(--hk-gold);
}

.eyebrow--muted {
  color: var(--hk-text-muted);
}

.eyebrow--inherit {
  color: inherit;
}
</style>
