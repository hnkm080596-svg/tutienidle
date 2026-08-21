# Project Rules

- Vue 3 + TypeScript
- Không dùng any nếu không cần thiết
- Không thay đổi architecture nếu chưa được yêu cầu
- Không sửa file ngoài phạm vi task
- Không tạo dependency mới nếu chưa được yêu cầu
- Ưu tiên sửa code hiện tại thay vì viết lại
- Sau khi sửa chỉ chạy typecheck liên quan
- Không giải thích dài nếu không được yêu cầu



# Autonomous Development Rules

## Execution Policy

You are the primary implementation agent for this project.

When given a development task:

1. Inspect the existing codebase first.
2. Make reasonable implementation decisions without asking for confirmation.
3. Implement the complete solution.
4. Run relevant tests, type checks, linting, and build commands.
5. Fix all errors discovered during verification.
6. Re-run verification after fixes.
7. Continue iterating until the task is actually complete.
8. Do not stop merely because the initial implementation is finished.
9. Do not ask for permission to edit files or run normal development commands.
10. Do not ask unnecessary clarification questions.

Only stop and ask the user when:
- The requirement is genuinely ambiguous and different interpretations would
  materially change the architecture or gameplay.
- A destructive action could permanently delete important user data.
- An external credential, payment, deployment, or irreversible external action
  is required.

Otherwise, make the most reasonable engineering decision and continue.

## Definition of Done

A task is NOT complete when the code has merely been written.

A task is complete only when:

- Implementation is finished.
- Existing functionality still works.
- Relevant tests pass.
- Type checking passes.
- Build succeeds.
- Runtime errors have been investigated.
- Obvious edge cases have been handled.
- The implementation is consistent with the existing architecture.

After completing a task, summarize:
- What changed
- What was tested
- Any remaining limitations