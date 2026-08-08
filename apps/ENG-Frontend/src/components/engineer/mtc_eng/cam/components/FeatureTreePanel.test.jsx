/**
 * @vitest-environment jsdom
 *
 * The feature tree in the DOM.
 *
 * The geometry and the replay are proved in `engine/solid/featureTree.test.js`
 * and `stores/featureStore.test.js`. What cannot be seen from there is the panel
 * itself: a tree that does not say it is out of date, or a Rebuild button that
 * is not reachable, makes the whole thing look like it does not work.
 */
import {
  describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import FeatureTreePanel from './FeatureTreePanel.jsx';
import { useFeatureStore } from '../stores/featureStore.js';
import { useSketchStore } from '../stores/sketchStore.js';
import { createSketch, addPoint, addLine } from '../engine/sketch/model.js';

let container;
let root;

function rectSketch(x0, y0, x1, y1) {
  const sk = createSketch();
  const p1 = addPoint(sk, x0, y0);
  const p2 = addPoint(sk, x1, y0);
  const p3 = addPoint(sk, x1, y1);
  const p4 = addPoint(sk, x0, y1);
  addLine(sk, p1, p2);
  addLine(sk, p2, p3);
  addLine(sk, p3, p4);
  addLine(sk, p4, p1);
  return sk;
}

/** Render and open the popover; returns the portalled text. */
async function open() {
  await act(async () => {
    root.render(React.createElement(FeatureTreePanel, {
      trigger: React.createElement('button', null, 'tree'),
    }));
  });
  await act(async () => {
    container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  return document.body.textContent;
}

const click = async (el) => act(async () => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  useFeatureStore.getState().clear();
  const doc = rectSketch(0, 0, 40, 40);
  useSketchStore.setState({
    sk: doc,
    sketches: [{
      id: 1, name: 'Base sketch', plane: { preset: 'XY', offset: 0 }, doc, past: [], future: [],
    }],
    activeId: 1,
    nextSketchId: 2,
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('FeatureTreePanel', () => {
  it('says there is nothing yet, and how to start', async () => {
    const text = await open();
    expect(text).toMatch(/Nothing built yet/i);
    expect(document.querySelector('[data-feature-rebuild]').disabled).toBe(true);
  });

  it('lists each feature with what it does and which sketch it came from', async () => {
    useFeatureStore.getState().addFeature('extrude', {
      sketchId: 1, depth: 12, name: 'Plate',
    });
    const text = await open();
    expect(text).toMatch(/Plate/);
    expect(text).toMatch(/Extrude 12 mm/);
    expect(text).toMatch(/Base sketch/);
  });

  it('offers Rebuild and says the tree is out of date', async () => {
    useFeatureStore.getState().addFeature('extrude', { sketchId: 1, depth: 6 });
    const text = await open();
    expect(text).toMatch(/Out of date/i);
    expect(document.querySelector('[data-feature-rebuild]').disabled).toBe(false);
  });

  it('replays the tree when Rebuild is pressed, and stops saying it is stale', async () => {
    useFeatureStore.getState().addFeature('extrude', { sketchId: 1, depth: 6 });
    await open();
    await click(document.querySelector('[data-feature-rebuild]'));
    expect(useFeatureStore.getState().dirty).toBe(false);
    expect(useFeatureStore.getState().errors).toEqual([]);
  });

  it('edits a parameter through the panel and marks the tree stale again', async () => {
    // `addFeature` selects what it added, so the editor is already open —
    // clicking the row here would *de*select it.
    const f = useFeatureStore.getState().addFeature('extrude', { sketchId: 1, depth: 6 });
    expect(useFeatureStore.getState().selectedId).toBe(f.id);
    await open();

    // antd puts extra props on the `<input>` for a bare InputNumber and on a
    // wrapper when it carries an addon, so accept either.
    const host = document.querySelector('[data-feature-depth]');
    const input = host?.tagName === 'INPUT' ? host : host?.querySelector('input');
    expect(input).toBeTruthy();
    await act(async () => {
      // antd's InputNumber commits on blur/Enter, not on every keystroke.
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '25');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(useFeatureStore.getState().features[0].depth).toBe(25);
    expect(useFeatureStore.getState().dirty).toBe(true);
  });

  it('suppresses a feature from the panel', async () => {
    const f = useFeatureStore.getState().addFeature('extrude', { sketchId: 1, depth: 6 });
    await open();
    await click(document.querySelector(`[data-feature-suppress="${f.id}"]`));
    expect(useFeatureStore.getState().features[0].suppressed).toBe(true);
  });

  it('shows the failure against the feature that could not build', async () => {
    useFeatureStore.getState().addFeature('extrude', {
      sketchId: 404, depth: 6, name: 'Broken',
    });
    await act(async () => { await useFeatureStore.getState().rebuild(); });
    const text = await open();
    expect(text).toMatch(/Broken: .*sketch is gone/i);
  });

  it('says an imported base cannot be edited here, rather than offering nothing', async () => {
    const base = useFeatureStore.getState().captureImport(
      { positions: new Float32Array(9), triangleCount: 1 }, 'plate.stl',
    );
    await open();
    await click(document.querySelector(`[data-feature-item="${base.id}"]`));
    expect(document.body.textContent).toMatch(/cannot be edited here/i);
  });
});
