<script setup lang="ts">
// Scene 12 (Khi Duong) mount seam: the panel only loads the shared
// qi-hall vocabulary sheet and mounts the production surface - the
// fidelity composition + workspace tabs live in EquipmentSurface.
//
// The shared qi-hall vocabulary sheet must be imported HERE - the
// ownership guard (tests/architecture/qiHallLayoutOwnership.test.ts)
// names this file the shell that loads it, and the op tab bodies inside
// the scene still read its .qi-hall__* rules.
import './equipment-hall/qi-hall.css'
import EquipmentSurface from '@/components/scenes/equipment/EquipmentSurface.vue'
</script>

<template>
  <EquipmentSurface />
</template>
