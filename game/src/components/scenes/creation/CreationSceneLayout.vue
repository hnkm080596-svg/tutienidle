<template>
  <main class="creation-layout" data-testid="character-creation-screen" data-hk-scene="creation">
    <div class="creation-layout__scroll" data-hk-region="creation-scroll"><slot name="scroll" /></div>
  </main>
</template>

<style scoped>
.creation-layout { position: relative; width: 100%; height: 100%; display: grid; justify-items: end; align-items: center; color: #343125; }
.creation-layout__scroll { position: relative; width: 579px; aspect-ratio: 1074 / 1440; margin-right: 58px; }
</style>
