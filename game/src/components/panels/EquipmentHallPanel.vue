<script setup lang="ts">
// Scene 12 scaffold (Huyen Kim rebuild): the panel is a thin mount for
// the ref-faithful scene under components/scenes/equipment/ - ops rail
// left, paperdoll center-left, item detail + ops workspace center-right,
// bag grid right (owner ruling: the ref keeps the bag on the right, not
// the forge column the previous layout used).
//
// The shared qi-hall vocabulary sheet must be imported HERE - the
// ownership guard (tests/architecture/qiHallLayoutOwnership.test.ts)
// names this file the shell that loads it, and the op tab bodies inside
// the scene still read its .qi-hall__* rules.
import './equipment-hall/qi-hall.css'
import EquipmentScene from '@/components/scenes/equipment/EquipmentScene.vue'
</script>

<template>
  <EquipmentScene />
</template>
