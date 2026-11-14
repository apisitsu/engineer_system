/**
 * Loads OpenCascade's STEP/IGES reader (`occt-import-js` v0.0.23, LGPL-2.1,
 * `occt-import-js.LICENSE.txt` and `occt.LICENSE.txt`), once, the first time a
 * STEP or IGES part is opened — it is 7.6 MB and nothing else needs it.
 *
 * This file differs between cam-web and EngineerSystem, like `manifoldLoader.js`.
 * Here it is NOT an npm dependency: the glue `occt-import-js.js` and the wasm
 * are committed in `public/wasm/` and served as they are, unmodified. The glue
 * is a classic script (it sets `occtimportjs`), so the browser loads it with a
 * script tag; Node — `npm run test:cam` — imports it straight off the disk. To
 * upgrade, copy both from a newer `occt-import-js` package over them.
 */
let ready = null;

const PUBLIC = process.env.PUBLIC_URL || '';

/** Load a classic script once. */
function script(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = resolve;
    el.onerror = () => reject(new Error(`Could not load ${src} — the STEP reader is missing from this deploy.`));
    document.head.appendChild(el);
  });
}

/** The initialised reader: `{ ReadStepFile, ReadIgesFile, ... }`. */
export function loadOcct() {
  ready ??= (async () => {
    const node = typeof process !== 'undefined' && Boolean(process.versions?.node);
    if (node) {
      const glueUrl = `file:///${process.cwd().replace(/\\/g, '/').replace(/^\//, '')}/public/wasm/occt-import-js.js`;
      const mod = await import(/* webpackIgnore: true */ glueUrl);
      return (mod.default ?? mod)({});
    }
    if (!window.occtimportjs) await script(`${PUBLIC}/wasm/occt-import-js.js`);
    return window.occtimportjs({ locateFile: () => `${PUBLIC}/wasm/occt-import-js.wasm` });
  })();
  return ready;
}
