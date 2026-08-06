/**
 * The library, as a panel that drops out of the toolbar.
 *
 * Thin by the usual rule: every decision it shows — what a row says, how the
 * list is ordered, what name to offer, whether a name is allowed — comes from
 * `engine/savedWork.js`, and every action is one call into `libraryStore`. What
 * is here is the arrangement: a name box with the two things worth saving, and
 * under it the list of what is already kept.
 *
 * The rows carry words, and that is not a breach of the icon-only toolbar rule:
 * this is a menu that drops open, and SolidWorks labels those too. A saved item
 * has a name the operator typed — a list of glyphs would be unreadable.
 */
import { useEffect, useState } from 'react';
import {
  Button, Popconfirm, Popover, Space, Tag, Typography, Input, Empty, Alert, Spin,
  Tooltip,
} from 'antd';
import {
  DeleteOutlined, FolderOpenOutlined, SaveOutlined, DownloadOutlined,
  ShareAltOutlined, RollbackOutlined, LockOutlined, TeamOutlined,
} from '@ant-design/icons';
import { useLibraryStore } from '../stores/libraryStore.js';
import { formatBytes, formatSavedAt } from '../engine/savedWork.js';
import { CAD } from '../theme.js';

const { Text } = Typography;

const ROW = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '6px 0', borderTop: `1px solid ${CAD.borderSoft}`,
};

const LIST = { maxHeight: 260, overflowY: 'auto', marginTop: 4 };

/**
 * The heading over one shelf, saying plainly whose it is.
 *
 * Both shelves look identical row for row, so the only thing telling an operator
 * that deleting here is safe and deleting there is not is this line. It is
 * therefore a label with an icon and a sentence, not a tab.
 */
function Shelf({ icon, title, hint, count, children }) {
  return (
    <div style={{ marginTop: 10 }}>
      <Space size={6} align="center">
        {icon}
        <Text style={{ color: CAD.label, fontSize: 12, fontWeight: 600 }}>{title}</Text>
        <Text style={{ color: CAD.dim, fontSize: 11 }}>{count}</Text>
      </Space>
      <Text style={{ color: CAD.dim, fontSize: 11, display: 'block' }}>{hint}</Text>
      {children}
    </div>
  );
}

/**
 * One saved item.
 *
 * Which buttons appear is the server's answer (`canShare` / `canUnshare` /
 * `canDelete`), not this component's opinion — the same rules are enforced on
 * the row itself, and a panel that computed its own version would eventually
 * offer a button that fails. A shared row somebody else published therefore has
 * only Open, which is the honest set.
 */
function Row({ item, onOpen, onRemove, onShare, onUnshare, busy }) {
  const by = item.shared && item.owner_name ? `by ${item.owner_name}` : null;
  return (
    <div style={ROW} data-library-item={item.id}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: CAD.text }} ellipsis>{item.name}</Text>
          <Tag color={item.kind === 'project' ? 'blue' : 'default'} style={{ marginInlineEnd: 0 }}>
            {item.kind}
          </Tag>
        </div>
        <Text style={{ color: CAD.muted, fontSize: 12 }}>
          {[by, item.note, formatBytes(item.bytes), formatSavedAt(item.savedAt)]
            .filter(Boolean).join(' · ')}
        </Text>
      </div>
      <Tooltip title={`Open ${item.name}`}>
        <Button
          size="small"
          icon={<FolderOpenOutlined />}
          aria-label={`Open ${item.name}`}
          data-library-open={item.id}
          disabled={busy}
          onClick={() => onOpen(item)}
        />
      </Tooltip>
      {item.canShare && (
        <Popconfirm
          title="Put this in the shared library?"
          description="Everyone will be able to open it. It leaves your own list."
          okText="Share"
          onConfirm={() => onShare(item)}
        >
          <Tooltip title="Share with everyone">
            <Button
              size="small"
              icon={<ShareAltOutlined />}
              aria-label={`Share ${item.name}`}
              data-library-share={item.id}
              disabled={busy}
            />
          </Tooltip>
        </Popconfirm>
      )}
      {item.canUnshare && (
        <Tooltip title="Take back into your own list">
          <Button
            size="small"
            icon={<RollbackOutlined />}
            aria-label={`Unshare ${item.name}`}
            data-library-unshare={item.id}
            disabled={busy}
            onClick={() => onUnshare(item)}
          />
        </Tooltip>
      )}
      {item.canDelete && (
        <Popconfirm
          title={item.shared ? 'Delete this from the shared library?' : 'Delete this saved item?'}
          okText="Delete"
          okButtonProps={{ danger: true }}
          onConfirm={() => onRemove(item)}
        >
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            aria-label={`Delete ${item.name}`}
            data-library-delete={item.id}
            disabled={busy}
          />
        </Popconfirm>
      )}
    </div>
  );
}

/**
 * The panel itself, in either of two settings.
 *
 * **Inline** (`inline`, with `open` controlled by the caller) is how the sidebar
 * shows it: the library is a place you work, not a menu you dip into — you save
 * something, look at what is there, open one, delete two — and a popover that
 * shuts when you click near its edge is the wrong container for that. It gets
 * the sidebar's own width and stays put until it is closed.
 *
 * **Popover** (`trigger`) is for the sketch rail, which has no sidebar to put a
 * panel in.
 *
 * @param {{trigger?:React.ReactNode, inline?:boolean, open?:boolean,
 *   onDone?:(msg:string)=>void}} props
 *   `onDone` reports a finished action back to the sidebar's own confirmation
 *   line, the same place saving a file reports to.
 */
export default function LibraryPanel({
  trigger, inline = false, open: openProp, onDone,
}) {
  const [openState, setOpenState] = useState(false);
  const open = inline ? openProp !== false : openState;
  const setOpen = inline ? () => {} : setOpenState;
  const [name, setName] = useState('');
  // Has the operator typed a name of their own? Once they have, nothing may
  // overwrite it — least of all the list finishing loading a moment later.
  const [typed, setTyped] = useState(false);
  const {
    items, loaded, busy, error, saveProject, saveProgram,
    open: openItem, remove, nameFor, mine, shared, share, unshare,
  } = useLibraryStore();
  const myItems = mine();
  const sharedItems = shared();

  // Read the list when the panel is first opened, not on mount: a request on
  // every page load costs a round trip for a panel nobody may open. The name
  // follows the list rather than racing it — offered before the names in the
  // library are known, it could look free and replace something on save.
  useEffect(() => {
    if (!open || typed) return undefined;
    let live = true;
    nameFor('project').then((n) => { if (live) setName(n); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, typed, loaded, items]);

  const run = async (fn, message) => {
    try {
      const result = await fn();
      onDone?.(message(result));
      return result;
    } catch {
      // The store has already put the sentence in `error`, which is rendered
      // below — rethrowing here would only produce an unhandled rejection.
      return null;
    }
  };

  const body = (
    <div
      style={inline ? { width: '100%' } : { width: 360 }}
      data-testid="library-panel"
    >
      {/* No "this browser cannot hold a library" branch any more: that was the
          IndexedDB store's, where private browsing could refuse to open the
          database before anything was attempted. The library is on the server
          now — it is either reachable or it is not, which is not knowable up
          front, so a failure lands in `error` beside the button that caused it. */}
      <Space.Compact style={{ width: '100%' }}>
        <Input
          value={name}
          onChange={(e) => { setTyped(true); setName(e.target.value); }}
          placeholder="Name this work"
          aria-label="Name for the saved item"
          data-library-name
          onPressEnter={() => run(() => saveProject(name), (m) => `Saved project “${m.name}”`)}
        />
        <Button
          icon={<SaveOutlined />}
          data-library-save="project"
          disabled={busy}
          onClick={() => run(() => saveProject(name), (m) => `Saved project “${m.name}”`)}
        >
          Project
        </Button>
        <Button
          icon={<DownloadOutlined />}
          data-library-save="program"
          disabled={busy}
          onClick={() => run(() => saveProgram(name), (m) => `Saved program “${m.name}”`)}
        >
          Program
        </Button>
      </Space.Compact>
      <Text style={{ color: CAD.muted, fontSize: 12, display: 'block', marginTop: 4 }}>
        A project keeps the part, setup, operations and sketch. A program is
        just the G-code. This saves to <b>your own</b> list — saving over one of
        your own names replaces it, and nobody else's work is touched.
      </Text>

      {error && (
        <Alert type="error" showIcon style={{ marginTop: 8 }} message={error} />
      )}

      {busy && !items.length && <Spin size="small" style={{ marginTop: 8 }} />}

      <Shelf
        icon={<LockOutlined style={{ color: CAD.label }} />}
        title="My work"
        hint="Only you can see, open or delete these."
        count={myItems.length ? `${myItems.length}` : ''}
      >
        <div style={LIST}>
          {loaded && !myItems.length && !busy && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<Text style={{ color: CAD.muted }}>Nothing saved yet</Text>}
            />
          )}
          {myItems.map((item) => (
            <Row
              key={item.id}
              item={item}
              busy={busy}
              onOpen={(it) => run(
                () => openItem(it.id).then(() => it),
                (m) => `Opened “${m.name}”`,
              ).then((ok) => { if (ok) setOpen(false); })}
              onRemove={(it) => run(() => remove(it.id).then(() => it), (m) => `Deleted “${m.name}”`)}
              onShare={(it) => run(() => share(it.id).then(() => it), (m) => `Shared “${m.name}”`)}
            />
          ))}
        </div>
      </Shelf>

      <Shelf
        icon={<TeamOutlined style={{ color: CAD.label }} />}
        title="Shared library"
        hint="Everyone can open these. Only whoever shared one can remove it."
        count={sharedItems.length ? `${sharedItems.length}` : ''}
      >
        <div style={LIST}>
          {loaded && !sharedItems.length && !busy && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<Text style={{ color: CAD.muted }}>Nothing shared yet</Text>}
            />
          )}
          {sharedItems.map((item) => (
            <Row
              key={item.id}
              item={item}
              busy={busy}
              onOpen={(it) => run(
                () => openItem(it.id).then(() => it),
                (m) => `Opened “${m.name}”`,
              ).then((ok) => { if (ok) setOpen(false); })}
              onRemove={(it) => run(() => remove(it.id).then(() => it), (m) => `Deleted “${m.name}”`)}
              onUnshare={(it) => run(
                () => unshare(it.id).then(() => it),
                (m) => `“${m.name}” is back in your own list`,
              )}
            />
          ))}
        </div>
      </Shelf>
    </div>
  );

  if (inline) {
    if (!open) return null;
    return (
      <div style={{
        border: `1px solid ${CAD.borderSoft}`, borderRadius: 8, padding: 10,
        background: CAD.surface,
      }}>
        <Text style={{ color: CAD.muted, fontSize: 11, letterSpacing: 0.6 }}>
          LIBRARY — YOUR WORK, AND THE SHARED SHELF
        </Text>
        <div style={{ marginTop: 6 }}>{body}</div>
      </div>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomLeft"
      title={<span style={{ color: CAD.text }}>Library — your work, and the shared shelf</span>}
      content={body}
    >
      {trigger}
    </Popover>
  );
}
