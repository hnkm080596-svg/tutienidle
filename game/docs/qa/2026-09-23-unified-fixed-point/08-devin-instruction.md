# Instruction giao cho Devin

Bạn hãy đưa bộ thiết kế kèm theo vào project thành **một Internal Fixed-Point QA Workflow do agent chính sở hữu**, thay thế việc phải chạy cả internal QA lẫn external QA qua ChatGPT Web.

Đây là yêu cầu triển khai hạ tầng/quy trình QA, không phải yêu cầu sửa toàn bộ gameplay. Đọc trọn bộ tài liệu trước khi sửa. Các tài liệu mô tả trạng thái quan sát ngày 2026-09-23; hãy kiểm tra lại checkout và các PR hiện tại trên cloud. Không mặc định các SHA, branch, số test, đường dẫn hoặc kết quả cũ vẫn còn đúng.

## Kết quả bắt buộc

1. **Một authority duy nhất:** agent chính điều phối điều tra, sửa lỗi, kiểm chứng, review, học từ lỗi và kết luận. Test, OCR delegation, runtime, property/fuzz/mutation và reviewer nội bộ là nguồn bằng chứng của cùng workflow.
2. **Không phụ thuộc ChatGPT Web:** không cần C2C external verdict, browser login, DOM scraping, quota hay người dùng chuyển lời giữa agent và reviewer ngoài. Không gọi ChatGPT Web để hoàn thành nhiệm vụ này. Giữ lại lịch sử có ích và script cũ nếu cần; chỉ gỡ vai trò bắt buộc trong live workflow.
3. **Chuyển năng lực, không chỉ bỏ một bước:** những lỗi từng được C2C/external reviewer bắt phải trở thành bài benchmark, attack operator và regression/invariant pin để agent nội bộ bắt được. Không được giảm sức phát hiện để có quy trình ngắn hơn.
4. **Review aggregate:** approval gắn với toàn bộ trạng thái repository đã materialize, contract/attack-model/environment identity, không chỉ diff mới nhất hoặc PR đã từng được review.
5. **Lặp đến fixed point thực nghiệm:** detect -> prove -> invariant/root cause/root class -> repair -> pin -> sibling hunt -> reverify -> invalidate stale evidence -> re-audit aggregate -> novel attacks. Không lấy đủ ba vòng, hết quota hoặc hết thời gian làm điều kiện PASS.
6. **Tự học sau mỗi lần vấp:** sự cố phải tạo lesson có bằng chứng, nguyên nhân lọt kiểm tra, protection mới, qualification độc lập và promotion tự động; nhiệm vụ tiếp theo phải thực sự load và chạy bài học phù hợp. Học cả false positive, lỗi test, flake, stale evidence và tooling failure. Không tự học bằng cách nới chuẩn, bỏ test hay đổi gameplay.
7. **Độc lập thật ở bên trong:** dùng reviewer/context mới của chính harness nếu có; agent chính vẫn phải tự suy luận và tổng hợp. Không gọi ba vai trong cùng context là ba reviewer độc lập. Nếu thiếu capability, chứng minh khoảng trống và giữ kết quả QA_UNVERIFIED; không quay lại external QA.
8. **Bằng chứng trung thực:** mọi verdict gắn đúng state; kết quả lịch sử không phải test vừa chạy; SOURCE_PROOF không phải EXECUTED_RUNTIME; task-independent failure vẫn làm aggregate chưa được kiểm chứng nếu đó là gate bắt buộc.

## Cách thực hiện

Thực hiện theo `07-devin-adoption-plan.md`, dùng `00-current-qa-audit.md` làm bản đồ xuất phát và các file 01–06 làm đặc tả. Nếu nhận một file `DEVIN-PACK.md`, các phần trong file đó chính là nội dung đầy đủ của bộ tài liệu; tách ra đúng đường dẫn trong plan khi triển khai.

- Bắt đầu bằng kiểm tra trạng thái Git, instruction hiện hành, nhánh tích hợp và PR chưa merge. Xác nhận dependency graph bằng dữ liệu hiện tại, không ghép diff các PR để giả lập aggregate.
- Tạo môi trường cô lập theo quy tắc project; không ghi đè thay đổi của người khác. Chỉ sửa instruction, protocol, QA adapter, ledger/schema/runner, benchmark và test hạ tầng cần thiết. Không commit/push/merge/deploy nếu phiên này chưa được người dùng cho phép.
- Cài protocol canonical; cập nhật AGENTS, architecture-worker G4/G5, skill QA, agent entrypoints và cloud context để không còn luật kết luận mâu thuẫn. Giữ các phép thử và domain packs cũ.
- Implement schema, manifest/hash, coordinator journal/lease, stale invalidation, finding lifecycle, coverage matrix, message correlation và terminal predicate. Command/interface trong plan là yêu cầu phải implement, không phải công cụ đã có sẵn.
- Tách lesson history khỏi promoted policy. Additive lesson được tự động promote sau original-bug kill, legal controls, sibling hunt và independent qualification; thay policy phải invalidate bằng chứng liên quan.
- Chạy qualification của chính QA system, replay golden bugs và kiểm tra preservation mapping. Dùng lịch sử external review làm nhãn benchmark offline; không cần external review mới.
- Giữ trạng thái ADOPTING cho đến khi hạ tầng và capability chuyển giao được chứng minh. Trong giai đoạn này vẫn chạy các internal gate hiện có; không mở lỗ hổng cho nhiệm vụ production được gọi hoàn tất khi new gate chưa qualified.
- Khi gặp lỗi gameplay ngoài scope, ghi finding và phạm vi ảnh hưởng. Không tự sửa hoặc lờ đi; installation qualification và game-wide fixed point là hai kết luận khác nhau.

## Không chấp nhận các cách làm sau

- Chỉ dán thêm một prompt dài vào AGENTS rồi tuyên bố đã có gate tự động.
- Xóa external review nhưng không chứng minh agent nội bộ bắt lại được những lớp lỗi external từng tìm ra.
- Một script gọi test rồi exit 0 được gọi là fixed-point orchestrator.
- Ba checklist cùng context được ghi thành independent review.
- Lưu “bài học” nhưng nhiệm vụ sau không route thành test/attack thực tế.
- Rule mới tự chứng nhận chính nó, hoặc sửa expected value/fixture để test xanh mà không chứng minh intended behavior.
- Ngầm bỏ qua Low correctness defect, pre-existing required failure, thiếu tool, thiếu quyền đọc hoặc ảnh/test của checkout khác.
- Áp dụng waiver tự động, cắt số vòng theo budget hoặc bỏ qua sibling/out-of-diff consumer.

## Báo cáo bàn giao

Trả về: branch/worktree và exact state; files changed -> purpose; authority map trước/sau; từng capability cũ -> owner/bằng chứng nội bộ mới; qualification case results; golden-bug baseline/new results với phần chưa chạy; học được gì và bằng chứng promotion/next-task consumption; P3/OCR/runtime/adversarial/sequential evidence cần thiết; các gap còn lại.

Chỉ gọi cơ chế đã cài là `PROTOCOL_ADOPTION_QUALIFIED` khi các điều kiện trong qualification document thực sự đạt. Chỉ gọi game là `QA_FIXED_POINT_REACHED` khi một run aggregate thực tế đạt đầy đủ terminal predicate. Nếu chưa đủ, nói rõ còn gì chưa chứng minh; không thay bằng một câu “tests pass”.
