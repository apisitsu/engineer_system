/**
 * Loads the manifold-3d solid boolean (wasm), once.
 *
 * This file differs between cam-web and EngineerSystem, like `stdApi.js`. cam-web
 * installs the `manifold-3d` package and vite hands over the wasm's URL. Here it
 * is NOT an npm dependency: the package pulls in some fifty others (gltf-transform,
 * sharp) for its command-line tool, none of which the boolean uses, and the
 * company machine should not have to install them. Instead the two files that
 * matter — the emscripten glue `manifold.js` and `manifold.wasm`, v3.5.4,
 * Apache-2.0 (`manifold.LICENSE.txt`) — are committed in `public/wasm/` beside
 * planegcs and served as static assets, for the same reason planegcs is (see
 * `workers/sketch.worker.js`: CRA cannot bundle the glue). To upgrade, copy both
 * from a newer `manifold-3d` package over them.
 *
 * Under Node — `npm run test:cam`, run from apps/ENG-Frontend — the same files
 * are imported straight off the disk.
 */
let ready = null;

const PUBLIC = process.env.PUBLIC_URL || '';

/** The initialised module: `{ Manifold, Mesh, ... }`. */
export function loadManifold() {
  ready ??= (async () => {
    const node = typeof process !== 'undefined' && Boolean(process.versions?.node);
    const glueUrl = node
      ? `file:///${process.cwd().replace(/\\/g, '/').replace(/^\//, '')}/public/wasm/manifold.js`
      : `${PUBLIC}/wasm/manifold.js`;
    const { default: Module } = await import(/* webpackIgnore: true */ glueUrl);
    const wasm = await Module(node ? {} : { locateFile: () => `${PUBLIC}/wasm/manifold.wasm` });
    wasm.setup();
    return wasm;
  })();
  return ready;
}
