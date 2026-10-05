# PC Paper Acupoint Aura

Canonical source: `Pc Paper Acupoint Aura.json`. One gold node aura, authored with Arcadia sprite layers and periodic scale/opacity tracks. No new character, gameplay animation, or progression rule.

Arcadia validation: 1 file, 0 errors. RGBA atlas: 1024 x 512, 8 x 4 cells, 32 frames at 16 fps, 2 second loop. Cell size 128 x 128; CSS display size 64 x 64. `acupoint-aura-poster.png` is frame 3 from the same Arcadia export. Alpha range 0..248; zero nontransparent pixels on all cell edges. Hashes and export API in `provenance.json`.

Re-export from game root while the external editor server is running at 5179:

`node art/vfx/pc-paper-meridian/export.mjs`

Visual proof: `/art/vfx/pc-paper-meridian/preview.html` on the existing worktree server at 5449. `capture.mjs` captures motion and reduced-motion evidence. Anchor remained exactly 64 x 64 at the same coordinates across frames. Reduced motion uses the poster with `animation: none`; no page errors. Both screenshots visually inspected: restrained antique gold, transparent soft halo, no checkerboard, no clipping, legible on warm paper and dark ink.

`acupoint-aura.css` provides a single reusable absolutely positioned overlay. Set its `left` and `top` to the already established acupoint anchor; pointer events are excluded. Do not attach progression commands to the effect. The isolated preview line and node positions are visual proof only, not a domain map.

Limits: no production imports; no body/meridian/zhou preview integration yet; no external library copy or existing effect overwrite; no broad game tests were run for this art-only export. This isolated preview does not establish final whole-scene density or multi-node performance. External Arcadia server was launched through its unmodified existing server entry point; source remains canonical in this worktree.
