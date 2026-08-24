import { createRouter, createWebHashHistory } from 'vue-router'

// Hash history (không phải createWebHistory) — bắt buộc để router hoạt
// động đúng khi load qua file:// (bản đóng gói Electron, xem
// uncommitted-audit-followup-plan.md's Ưu tiên 2): createWebHistory cần
// server rewrite path, không tồn tại dưới file://. An toàn để đổi vì
// routes hiện đang rỗng, chưa có route/link nào phụ thuộc shape URL.
const router = createRouter({
  history: createWebHashHistory(),
  routes: [],
})

export default router
