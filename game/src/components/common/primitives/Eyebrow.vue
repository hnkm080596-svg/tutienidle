<script setup lang="ts">
// Primitive section title - chu uppercase letter-spacing dung lam eyebrow
// cho moi nhom noi dung (dang lap ~25 cho voi tracking .02-.13em tuy noi,
// chuan hoa ve --eyebrow-tracking default .04em).
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
