import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Test config for the CAD/CAM module only (`src/components/engineer/mtc_eng/cam`).
 *
 * That code came from the standalone cam-web project, which is engine-first: the
 * geometry, the G-code interpreter, the toolpath planner and the carvers are pure
 * modules with ~66 test files beside them, and they are the only automated
 * coverage that code has — the R3F render layer has none. Running them is not
 * optional, so they keep their own runner rather than being dropped on import.
 *
 * They stay on vitest instead of moving to CRA's jest because they are written
 * against it: `@vitest-environment jsdom` pragmas per file, vitest's ESM handling
 * of three's module build, and `@react-three/test-renderer`. Rewriting 66 files to
 * jest would be a large change to code whose whole value is that it is proven.
 *
 * The other half of the split is in package.json: CRA's `testMatch` is overridden
 * to exclude this folder, so `npm test` (react-scripts) and `npm run test:cam`
 * (vitest) each own a disjoint set of files and neither trips over the other's.
 *
 * Mirrors cam-web/vite.config.js — keep the two in step.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/components/engineer/mtc_eng/cam/**/*.test.{js,jsx}'],
    // Engine and store suites are plain Node. Component suites opt into a DOM
    // per file with `@vitest-environment jsdom`, so the fast majority stays fast.
    environment: 'node',
    // R3F's test renderer builds a real scene graph without WebGL; three's
    // ESM build needs to be transformed rather than externalised for that.
    server: { deps: { inline: [/@react-three/] } },
    // Above vitest's 5s default. A handful of these are real compute — the
    // runaway-macro guard actually expands a program until it trips, ~0.9s on
    // its own — and under the whole suite's parallelism that headroom is not
    // enough, so they timed out here while passing in isolation. This raises the
    // ceiling only; nothing about what they assert changes.
    testTimeout: 30000,
  },
});
