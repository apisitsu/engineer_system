/**
 * @vitest-environment jsdom
 *
 * Render gates for the library panel. The record shape is
 * `engine/savedWork.test.js` and the sequencing is `stores/libraryStore.test.js`;
 * what needs the DOM is whether the rows an operator has to click are actually
 * on screen — a saved item with no Open button is a saved item that is gone.
 *
 * The panel's contents live in a popover, which antd renders into a portal, so
 * assertions run against `document.body` rather than the container.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

// `lib/workApi.js` — the module the store actually imports. This used to mock
// `lib/workDb.js`, which the store stopped importing when the library moved onto
// the server, so the mock had quietly stopped standing in for anything.
vi.mock('../lib/workApi.js', () => ({
  putRecord: async ({ meta }) => meta,
  listMeta: async () => [],
  getData: async () => undefined,
  deleteRecord: async (k) => k,
  clearAll: async () => {},
}));

const { default: LibraryPanel } = await import('./LibraryPanel.jsx');
const { useLibraryStore } = await import('../stores/libraryStore.js');

let container;
let root;

/**
 * Two of mine and one a colleague published — the arrangement the panel exists
 * to keep distinguishable. Rows carry the server's own permission answers
 * (`canShare` / `canUnshare` / `canDelete`), because that is what the panel
 * renders from; it does not work them out for itself.
 */
const MINE = [
  {
    id: '1',
    key: 'project/OR35128 OP10',
    kind: 'project',
    name: 'OR35128 OP10',
    savedAt: '2026-08-05T09:00:00.000Z',
    bytes: 41200,
    note: '412 blocks · 3 ops · a part',
    shared: false, mine: true,
    canShare: true, canUnshare: false, canDelete: true,
  },
  {
    id: '2',
    key: 'program/Facing test',
    kind: 'program',
    name: 'Facing test',
    savedAt: '2026-08-01T09:00:00.000Z',
    bytes: 812,
    note: '18 blocks',
    shared: false, mine: true,
    canShare: true, canUnshare: false, canDelete: true,
  },
];

const THEIRS = {
  id: '3',
  key: 'program/Shop standard',
  kind: 'program',
  name: 'Shop standard',
  savedAt: '2026-08-04T09:00:00.000Z',
  bytes: 400,
  note: '9 blocks',
  shared: true, mine: false,
  owner_empno: 'XX999', owner_name: 'Somchai',
  canShare: false, canUnshare: false, canDelete: false,
};

const ITEMS = [...MINE, THEIRS];

/** Open the panel and hand back the portal-rendered body. */
async function openPanel(props = {}) {
  await act(async () => {
    root.render(React.createElement(LibraryPanel, {
      trigger: React.createElement('button', { 'data-cmd': 'openLibrary' }, 'Library'),
      ...props,
    }));
  });
  await act(async () => {
    container.querySelector('[data-cmd="openLibrary"]').click();
  });
  return document.body;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  useLibraryStore.setState({
    items: ITEMS, loaded: true, busy: false, error: null,
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

describe('LibraryPanel — what is on screen', () => {
  it('stays shut until the trigger is pressed', async () => {
    await act(async () => {
      root.render(React.createElement(LibraryPanel, {
        trigger: React.createElement('button', { 'data-cmd': 'openLibrary' }, 'Library'),
      }));
    });
    expect(document.querySelector('[data-testid="library-panel"]')).toBeNull();
  });

  it('lists every saved item once opened', async () => {
    const body = await openPanel();
    expect(body.querySelector('[data-testid="library-panel"]')).not.toBeNull();
    expect(body.querySelectorAll('[data-library-item]')).toHaveLength(3);
  });

  it('separates my own work from the shared shelf, and names both', async () => {
    const body = await openPanel();
    expect(body.textContent).toContain('My work');
    expect(body.textContent).toContain('Shared library');
  });

  it('gives every row a way to open it', async () => {
    const body = await openPanel();
    for (const item of ITEMS) {
      expect(body.querySelector(`[data-library-open="${item.id}"]`)).not.toBeNull();
    }
  });

  it('offers Share and Delete on my own work', async () => {
    const body = await openPanel();
    for (const item of MINE) {
      expect(body.querySelector(`[data-library-share="${item.id}"]`)).not.toBeNull();
      expect(body.querySelector(`[data-library-delete="${item.id}"]`)).not.toBeNull();
    }
  });

  it('offers neither on what somebody else shared — a button that would fail is worse than none', async () => {
    const body = await openPanel();
    expect(body.querySelector(`[data-library-delete="${THEIRS.id}"]`)).toBeNull();
    expect(body.querySelector(`[data-library-unshare="${THEIRS.id}"]`)).toBeNull();
    expect(body.querySelector(`[data-library-share="${THEIRS.id}"]`)).toBeNull();
  });

  it('says whose a shared item is, so it is clear it is not yours', async () => {
    const body = await openPanel();
    const row = body.querySelector(`[data-library-item="${THEIRS.id}"]`);
    expect(row.textContent).toContain('by Somchai');
  });

  it('offers Unshare on what I published myself', async () => {
    useLibraryStore.setState({
      items: [{ ...THEIRS, mine: true, owner_name: 'Me', canUnshare: true, canDelete: true }],
    });
    const body = await openPanel();
    expect(body.querySelector(`[data-library-unshare="${THEIRS.id}"]`)).not.toBeNull();
  });

  it('says what each item is, so two saves of one job can be told apart', async () => {
    const body = await openPanel();
    const row = body.querySelector('[data-library-item="1"]');
    expect(row.textContent).toContain('OR35128 OP10');
    expect(row.textContent).toContain('412 blocks · 3 ops · a part');
    expect(row.textContent).toContain('41.2 kB');
  });

  it('offers both things worth saving, under one name', async () => {
    const body = await openPanel();
    expect(body.querySelector('[data-library-save="project"]')).not.toBeNull();
    expect(body.querySelector('[data-library-save="program"]')).not.toBeNull();
    expect(body.querySelector('[data-library-name]')).not.toBeNull();
  });

  it('offers a name to save under without one being typed', async () => {
    const body = await openPanel();
    expect(body.querySelector('[data-library-name]').value.length).toBeGreaterThan(0);
  });

  it('says so when the library is empty rather than showing a blank panel', async () => {
    useLibraryStore.setState({ items: [], loaded: true });
    const body = await openPanel();
    expect(body.textContent).toContain('Nothing saved yet');
  });

  it('puts the store\'s error where the button that caused it is', async () => {
    useLibraryStore.setState({ error: 'The disk is full.' });
    const body = await openPanel();
    expect(body.textContent).toContain('The disk is full.');
  });

  it('says a save is private, because the previous design made every save a publish', async () => {
    const body = await openPanel();
    expect(body.textContent).toContain('your own');
    expect(body.textContent).toContain("nobody else's work is touched");
  });
});

describe('LibraryPanel — saving', () => {
  it('saves under the name in the box, and reports it back', async () => {
    const saveProject = vi.fn(async () => ({ name: 'OP10 setup' }));
    useLibraryStore.setState({ saveProject });
    const onDone = vi.fn();
    const body = await openPanel({ onDone });

    await act(async () => {
      body.querySelector('[data-library-save="project"]').click();
    });
    expect(saveProject).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(expect.stringContaining('OP10 setup'));
  });

  it('does not report a save that failed', async () => {
    useLibraryStore.setState({
      saveProgram: vi.fn(async () => { throw new Error('no'); }),
    });
    const onDone = vi.fn();
    const body = await openPanel({ onDone });
    await act(async () => {
      body.querySelector('[data-library-save="program"]').click();
    });
    expect(onDone).not.toHaveBeenCalled();
  });
});
