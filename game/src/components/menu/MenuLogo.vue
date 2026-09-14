<template>
  <div class="menu-logo">
    <h1 class="menu-logo__title">
      TIÊN HIỆP IDLE
    </h1>
    <div class="menu-logo__underline" />
  </div>
</template>

<style scoped>
.menu-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.menu-logo__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 3rem;
  font-weight: 400;
  letter-spacing: 0.15em;
  color: var(--surface-text);
  line-height: 1.2;
}

.menu-logo__underline {
  width: 100%;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--surface-eyebrow) 20%,
    var(--surface-eyebrow) 80%,
    transparent
  );
}
</style>
