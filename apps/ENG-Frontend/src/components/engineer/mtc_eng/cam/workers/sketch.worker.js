/**
 * Sketch constraint-solver worker (Phase 2).
 *
 * Wraps the planegcs (WASM) bridge so the FreeCAD PlaneGCS solve runs off the
 * main thread, exactly like the gcode/sim workers. Sketches cross the Comlink
 * boundary in serialized (plain-object) form; the worker deserializes, solves,
 * and returns the solved sketch plus planegcs' conflict/redundancy report.
 *
 * WASM loading differs per host. Standalone cam-web is vite, where
 * `planegcs.wasm?url` emits the file as an asset and hands back its URL; here in
 * EngineerSystem the bundler is CRA/webpack, which has no `?url`. So the wasm is
 * served as a **static public asset** instead — `public/wasm/planegcs.wasm`,
 * kept in step with the installed package by `scripts/copy-cam-wasm.js` on every
 * start/build. (The Node tests resolve the same file via createRequire.)
 *
 * This is one of only two lines under `cam/` that differ from the cam-web
 * original — see CamPage.jsx.
 */
import * as Comlink from 'comlink';
import { createSolver } from '../engine/sketch/planegcs.js';
import { deserialize, serialize } from '../engine/sketch/model.js';

// Root-relative, resolved by the browser against the worker script's own URL —
// webpack serves the worker from this origin, so both land on `/wasm/...` here.
// (Worth knowing if this ever moves: a worker created from a `blob:` URL has no
// base these can resolve against, and the dynamic import below would fail. The
// obvious guard, `self.location.origin`, is not available — CRA's eslint config
// restricts `self` and does not define `globalThis`, and both fail the build.)
//
// PUBLIC_URL is substituted at build time by webpack's DefinePlugin, so this
// needs no `process` at runtime — it is a string literal in the worker chunk.
const PUBLIC = process.env.PUBLIC_URL || '';
const wasmUrl = `${PUBLIC}/wasm/planegcs.wasm`;
const glueUrl = `${PUBLIC}/wasm/planegcs.js`;

/**
 * Load the emscripten glue at **runtime**, out of the same public folder as the
 * wasm, rather than letting webpack bundle it. The glue is a browser/Node dual
 * build, and its Node branch — dead code here — contains
 * `new URL('./', import.meta.url)`, which webpack resolves at build time and
 * fails on. `webpackIgnore` leaves the import alone so it stays a real dynamic
 * import the browser performs itself. vite has no such trouble, which is why
 * standalone cam-web imports the package directly.
 */
const initModule = async (opts) => {
  const glue = await import(/* webpackIgnore: true */ glueUrl);
  return glue.default(opts);
};

let solverPromise = null;
const getSolver = () => (solverPromise ??= createSolver({ wasmPath: wasmUrl, initModule }));

const api = {
  /**
   * @param {object} doc serialized sketch (from `serialize()`)
   * @returns {{success:boolean, status:number, conflicting:string[], redundant:string[], sketch:object}}
   */
  async solve(doc, opts) {
    const solver = await getSolver();
    const sk = deserialize(doc);
    const res = solver.solve(sk, opts);
    return { ...res, sketch: serialize(sk) };
  },
};

Comlink.expose(api);
