<template>
  <div class="menu-background" aria-hidden="true" />
</template>

<style scoped>
.menu-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 30%, rgba(212, 165, 87, 0.08), transparent 60%),
    linear-gradient(180deg, #0a0a0f 0%, #050507 100%);
}
</style>
