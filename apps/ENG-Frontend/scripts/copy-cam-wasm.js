/**
 * Copies the planegcs solver — its wasm and its emscripten glue — out of
 * node_modules into public/wasm/, where the CAD/CAM sketch worker loads both at
 * runtime. Run automatically by `predev`/`prestart`/`prebuild`.
 *
 * Why they are static assets rather than bundled: cam-web (the standalone
 * project this came from) is built by vite, which imports the package directly
 * and emits the wasm via `?url`. CRA/webpack can do neither — it has no `?url`,
 * and it fails outright on the glue, whose dead Node branch contains
 * `new URL('./', import.meta.url)`. Serving both from the public root sidesteps
 * the bundler entirely; see cam/workers/sketch.worker.js.
 *
 * The copies ARE committed to git as well. Deploys are git-based, so a build
 * step is not the only thing that has to work for these files to exist on prod;
 * keeping them tracked means the solver still loads if this script never runs,
 * and running this script means they cannot silently go stale when
 * @salusoft89/planegcs is upgraded. It only writes when the bytes actually
 * differ, so a normal start is a no-op and does not dirty the working tree.
 */
const fs = require('fs');
const path = require('path');

const FILES = ['planegcs.wasm', 'planegcs.js'];

for (const name of FILES) {
  try {
    const src = fs.readFileSync(
      require.resolve(`@salusoft89/planegcs/dist/planegcs_dist/${name}`)
    );
    const dest = path.resolve(__dirname, `../public/wasm/${name}`);
    if (fs.existsSync(dest) && fs.readFileSync(dest).equals(src)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, src);
    console.log(`[copy-cam-wasm] updated public/wasm/${name} (${src.length} bytes) — commit it`);
  } catch (err) {
    // Never block a build on this: the committed copies are the ones that ship.
    console.warn(`[copy-cam-wasm] skipped ${name}: ${err.message}`);
  }
}
