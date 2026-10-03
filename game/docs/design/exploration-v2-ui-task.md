# Sơn Hà Đồ — preview UI

## G0 / phạm vi đã duyệt

Worktree `E:/tutienidle/.agent-worktrees/hk-login-fidelity`, branch `codex/hk-login-fidelity`. Dựng preview riêng, ba dải địa hình trên giấy, node và đường nối độc lập, bảng thông tin giấy bên phải. Không tạo background ngoài giấy, không nối gameplay, không sửa live exploration.

## G1 / component và authority

- Q1: Chọn cả node khóa để xem chi tiết; CTA chỉ thông báo preview, không bắt đầu combat.
- Q2–Q3: `ExplorationPreview` giữ selection/notice/pointer cục bộ, reset khi remount, không persistence.
- Q4: `ui-exploration.html` → `exploration.ts` → preview → scene → map/details. Không có caller gameplay.
- Q5: Tái sử dụng `SceneDesignCanvas`, `DongFuVista`, `PaperPanelNavigation`, paper-nine-slice và ring của Skill.
- Q6–Q9: Model chỉ dữ liệu trình bày; props xuống, emit lên; không import core/store. Fixture không được xem là progression thật.
- Q10: Click lặp chỉ đổi selection hoặc notice; không timer/network/save.
- Q11: Live exploration giữ nguyên; preview là đường riêng được user yêu cầu.
- Q12: Dừng ở bản duyệt có art, node chọn được, chi tiết đổi theo node, scale đồng tỷ lệ. Kiểm tra type và trình duyệt; QA toàn dự án do implementer xử lý theo chỉ đạo user, không tuyên bố fixed point.
- U1/U2: Canvas 1440×810 chung; node dùng tọa độ trong canvas, không tự đo viewport riêng.
- U3/U4: Art qua resolveAssetUrl; map sở hữu render SVG/nodes, details chỉ emit challenge.
- U5/U6: Text qua i18n; kiểm tra trình duyệt trong worktree, ảnh không phải bằng chứng gameplay.

## Art

ImageGen built-in, transparent_background=true. Asset `public/assets/ui/huyen-kim/scene/exploration-v2/terrain-three-realms-v1.png`.
Source `exec-8b23105c-2288-4c25-ab2a-0b0d766d4f4f.png` trong generated_images phiên `01a0f7b5-053f-71d0-a72c-75577519a956`.

Prompt: Three horizontal xianxia ink-watercolor terrain strips stacked vertically, warm jade foothills / ink-blue higher peaks / restrained violet crags, delicate pavilions and pines, atmospheric upper terrain and low-detail foreground for separate nodes, organic transparent edges. No paper rectangle, scroll rollers, frames, UI, text, numbers, routes, nodes, characters, monsters or icons. Landscape is artwork inside existing paper, never the exterior background.

## Plugin hooks

- UI-40 `ExplorationFidelityScene`: model, selected, notice, navigation; select(id), challenge, navigate(id), back.
- UI-41 `ExplorationPaperMap`: chapters with independently supplied nodes (id, label, x, y, state, boss), edges, terrain URL; select(id). Coordinates are presentation units in each 720×140 band; current fixture counts are not gameplay rules.
- UI-42 `ExplorationPaperDetails`: selected stage description/enemy/rewards/state supplied by model; challenge intent only, fixed notice region.
- UI-43 `ExplorationPreview`: disposable selection and fixture data. Implementer replaces fixture with read-model and binds challenge to domain command later.

## Bằng chứng duyệt UI

- `npm run type-check`: exit 0 sau thay đổi cuối.
- `npx vitest run src/components/scenes/exploration/fidelity/ExplorationPaperMap.test.ts`: 1 passed. Trước implementation handler, test thất bại vì click không emit identity; sau đó pass. Test kiểm tra node khóa vẫn xem được và không mutate input.
- Server từ worktree, port 5606. Đã xem trực tiếp ảnh ở 1280×720 và 1920×1080; giấy, địa hình, node và thông tin giữ bố cục đồng tỷ lệ.
- Click node Trúc Cơ 10 đổi heading thành 3-10; CTA hiện notice, vị trí nút trước/sau không đổi. Console: 0 errors, 0 warnings.
- Evidence: `docs/qa/huyen-kim-reference-fidelity/evidence/exploration-v2-review.png`, `exploration-v2-1920.png`.
- Điều hướng Thám Hiểm được nối từ các preview Nhân Vật/Cảnh Giới/Tâm Pháp/Kỹ Năng/Luyện Thể. Chưa thay scene runtime.
- QA toàn dự án, OCR, adversarial/sequential release gates chưa thực hiện trong đợt duyệt UI này; không tuyên bố merge-ready hoặc QA_FIXED_POINT_REACHED. Icon quái/vật phẩm vẫn chưa vẽ theo phạm vi user.
