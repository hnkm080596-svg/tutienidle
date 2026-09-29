# S4 verification

- `npm run type-check`: vue-tsc clean, exit 0
- `npm run build`: vite build clean, exit 0 (pre-existing chunk-size warning)
- `npx vitest run`: 815 files / 7266 tests passed, 5 expected-fail, exit 0

The previously-red CRLF-fragile audioManifestCompleteness oracle was repaired
(F-ENV-AUDIO-CRLF); the suite is fully green on this state.
