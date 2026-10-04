# Technique paper preview

## G0/G1 scope

Worktree: `E:/tutienidle/.agent-worktrees/hk-login-fidelity`, branch `codex/hk-login-fidelity`.
User approved the three-region paper composition and temporary manual art; implement now, no further design approval required.

Q1/Q2: render Technique information, replaceable centerpiece, progression and upgrade intent within paper. Preview host owns fixture/selection/notice; components only render props and emit intentions.
Q3/Q4: `ui-technique.html` -> `TechniquePreview` -> `TechniqueFidelityScene` -> info/art/upgrade components. Selection resets on reload, never persists. No gameplay commands.
Q5/Q6: reuse SceneDesignCanvas, DongFuVista, PaperPanelNavigation, existing paper nine-slice and AssetBaseUrl. No dependency on stores or core mutations.
Q7/Q8/Q9: no timers, rewards, costs, eligibility or stat calculations. Format fixture values explicitly; do not reproduce reference's invented four-material cost or rank-up semantics. Actual source `betaScopeTechniqueDomain` exposes grade advance and one material quote; runtime unchanged.
Q10/Q11: repeat clicks only update reserved notice/selection. Existing live TechniqueScrollScene remains unchanged; preview is separate by user request.
Q12: stop at reviewable UI and hook documentation. No gameplay integration, commit, push or full QA claim.

U1/U2: existing shared navigation and uniformly scaled 1440x810 canvas. U3: temporary art via resolved public asset URL. U4: preview owns parallax pointer, no rendering resources created. U5: strings via preview i18n. U6: inspect actual worktree preview, selection/navigation, small viewport and fixed notice area. Full protocol/OCR/adversarial release gates remain unverified, not completion claims.

Component map: info renders name/description/sections; artifact renders replaceable image and selectable display stages; upgrade renders current/target grade, material and emits advance; scene composes paper/navigation; preview provides sample display model.
