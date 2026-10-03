# Luyện Đan v2 — bản duyệt UI

## G0: phạm vi đã duyệt

Worktree `E:/tutienidle/.agent-worktrees/hk-login-fidelity`, branch `codex/hk-login-fidelity`.
Preview riêng `/ui-alchemy.html`. Tờ giấy và navigation chung nằm trên DongFuVista hiện có. Danh sách trái, đan lô giữa, chi tiết phải, hàng chờ dưới. Không sửa background/parallax, logic luyện đan, timer, nguyên liệu, save hoặc live AlchemyView.

## G1: trách nhiệm và điểm nối

- Q1: Chọn đan phương đổi phần thông tin và lựa chọn nguyên liệu mẫu; nút luyện/hủy chỉ báo preview. Thông báo có vùng cố định.
- Q2/Q3: `AlchemyPreview` giữ selection/variant/notice/pointer, remount reset; không persistence/network/timer.
- Q4: HTML -> entry -> preview -> scene -> list/cauldron/details/queue. Không thay caller production.
- Q5: Tái sử dụng SceneDesignCanvas, DongFuVista, PaperPanelNavigation, giấy 9-slice, đan lô `alchemy-cauldron-prop@2x.png`, icon pill/herb có sẵn.
- Q6/Q7: Fidelity components chỉ props/emits. Không import core, store hoặc service; presentation không sản xuất thuốc.
- Q8/Q9: Input đã format, fixture không đại diện giá trị cân bằng. Percent là hiển thị, không tính thời gian thực.
- Q10: Click lặp chỉ selection/notice, không lặp nhận thưởng hoặc tiêu hao.
- Q11: Live AlchemyView và các scene components cũ giữ nguyên. Preview không phải migration hoàn chỉnh.
- Q12: Dừng ở bản UI để user chấm. Type-check, focused test, screenshot/click/scale trong browser; không chứng nhận QA toàn dự án.
- U1/U2: Canvas đồng tỷ lệ 1440×810. Danh sách/queue dài cuộn nội bộ, không đẩy khung; native radio cho variant.
- U3/U4: URL asset qua resolveAssetUrl. Không gen icon hoặc background.
- U5/U6: Text i18n; trình duyệt dùng server đúng worktree. Kiểm tra UI không chứng minh gameplay.

## Plugin list

- UI-50 `AlchemyFidelityScene`: selected recipe, recipes, variant, queue/capacity, navigation, notice; select/variant/brew/cancel/navigate/back intents.
- UI-51 `AlchemyPaperRecipes`: danh sách không cố định số mục; chọn bằng identity; trạng thái do host cung cấp.
- UI-52 `AlchemyPaperCauldron`: đan lô trang trí và nguyên liệu đã chọn; không socket có quyền mutate inventory.
- UI-53 `AlchemyPaperDetails`: variants/counts, costs, duration/outcome đã format; variant(id), brew. Host nối validation/cost/command sau.
- UI-54 `AlchemyPaperQueue`: jobs với id, name, icon, progress percent, remaining label; cancel(id). Không tự tick hoặc tự hoàn thành.
- UI-55 `AlchemyPreview`: chỉ dữ liệu mẫu; thay bằng read-model trong đợt tích hợp logic.

## Art

Không gen art mới. Tái sử dụng `public/assets/ui/huyen-kim/alchemy/alchemy-cauldron-prop@2x.png`, `scene/character-v2/paper-nine-slice.png`, icon dưới `public/assets/pills` và `public/assets/materials`. Không roller, nghề phụ, tăng tốc, mua ô hàng chờ hoặc quantity stepper từ ảnh AI.

## Bằng chứng bản duyệt

- `npm run type-check`: exit 0.
- `npx vitest run src/components/scenes/alchemy/fidelity/AlchemyPaperRecipes.test.ts`: 1 passed; trước handler test đã fail vì click không emit recipe identity.
- Edge trên server worktree port 5606: chọn Bách niên cập nhật nguyên liệu dưới đan lô; chọn Tố Cốt Đan cuộn được danh sách và reset variant sang Thập niên; luyện/hủy chỉ hiện notice, vị trí/chiều cao CTA không đổi.
- Screenshot xem trực tiếp ở 1280×720, 1920×1080 và 1000×800: bố cục giữ tỷ lệ, cửa sổ khác tỷ lệ dùng khoảng trống ngoài canvas; không reflow component.
- Evidence: `docs/qa/huyen-kim-reference-fidelity/evidence/alchemy-v2-1280.png`, `alchemy-v2-1920.png`, `alchemy-v2-1000x800.png`.
- Browser console: 0 errors / 0 warnings. Không sửa live AlchemyView, background hoặc gameplay.
- Chưa có chứng nhận full build/suite, OCR, adversarial hoặc sequential release gates. Đây là bản duyệt UI, không QA_FIXED_POINT_REACHED hay merge-ready. QA/logic tiếp tục thuộc implementer theo chỉ đạo user.
