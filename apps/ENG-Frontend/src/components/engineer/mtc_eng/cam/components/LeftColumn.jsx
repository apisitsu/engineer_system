/**
 * LeftColumn — the part window's left pane: the model, or the program.
 *
 * Two things belong on screen while you work, and they are not the same thing:
 * the **model's structure** (the feature tree) while you are building it, and
 * the **program listing** while it runs, scrolling to the executing line. They
 * are tabs of one column rather than two panels, because a viewport is small and
 * you are never reading both at once.
 *
 * ## Why the program is here and not in Setup
 *
 * `engine/view/sidebar.js` has always said it: everything needed to *prepare* a
 * job is dead weight the moment the program is running, and the listing is the
 * one panel that is live. When setup moved into a drawer the listing went with
 * it, and pressing Play left nothing to watch — the drawer is closed by default,
 * which is right for setup and wrong for this. So the listing came back out.
 *
 * The column switches to Program on its own when playback starts, and when a
 * parse fails. That second one is the older rule: a failure must never be
 * suppressed by a mode change. It does **not** switch back on pause — you were
 * put on a tab by the machine, and being moved off it again by the machine is
 * how a panel loses your place.
 */
import { useEffect } from 'react';
import { Segmented, Button, Tooltip, Alert } from 'antd';
import { ApartmentOutlined, CodeOutlined, MenuOutlined } from '@ant-design/icons';
import FeatureTree, { TREE_SIZE } from './FeatureTree.jsx';
import GcodePanel from './GcodePanel.jsx';
import { useCamStore } from '../stores/camStore.js';
import { useFeatureStore } from '../stores/featureStore.js';
import { useSketchStore } from '../stores/sketchStore.js';
import { describeFeature } from '../engine/solid/featureTree.js';
import { CAD } from '../theme.js';

// The words stay beside the icons: a column that lost them would have to be hovered
// to be read, which is what the Ribbon's labels were added to get away from.
const TABS = [
  { label: 'Model', value: 'model', icon: <ApartmentOutlined /> },
  { label: 'Program', value: 'program', icon: <CodeOutlined /> },
];

export default function LeftColumn({ activeLine = 0, tab, onTab: setTab }) {
  const open = useFeatureStore((s) => s.treeOpen);
  const setOpen = useFeatureStore((s) => s.setTreeOpen);
  const features = useFeatureStore((s) => s.features);
  const selectedId = useFeatureStore((s) => s.selectedId);
  const sketches = useSketchStore((s) => s.sketches);
  const selected = features.find((f) => f.id === selectedId);

  const gcode = useCamStore((s) => s.gcode);
  const setGcode = useCamStore((s) => s.setGcode);
  const playing = useCamStore((s) => s.playing);
  const error = useCamStore((s) => s.error);

  // Playback and a parse failure both mean "the program is what matters now".
  useEffect(() => { if (playing) setTab('program'); }, [playing, setTab]);
  useEffect(() => { if (error) setTab('program'); }, [error, setTab]);

  if (!open) {
    return (
      <div style={{
        height: '100%', background: CAD.panelBg,
        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 6,
      }}
      >
        <Tooltip title="Show the model and program panel" placement="right">
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setOpen(true)}
            style={{ width: TREE_SIZE.TREE_STRIP - 2, height: 34, color: CAD.icon }}
            data-column-toggle
          />
        </Tooltip>
      </div>
    );
  }

  return (
    <div style={{
      height: '100%', background: CAD.panelBg,
      display: 'flex', flexDirection: 'column', minWidth: 0,
    }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: 6, borderBottom: `1px solid ${CAD.border}`,
      }}
      >
        <Segmented
          size="small"
          value={tab}
          onChange={setTab}
          options={TABS}
          style={{ flex: 1 }}
          data-column-tabs
        />
        <Tooltip title="Collapse">
          <Button
            size="small"
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setOpen(false)}
            data-column-toggle
          />
        </Tooltip>
      </div>

      {tab === 'model' ? (
        <>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <FeatureTree embedded />
          </div>
          {/* What the selected feature is, in words, under the list it was picked from. */}
          {selected && (
            <div
              data-column-note
              style={{
                flex: '0 0 auto',
                padding: '8px 10px',
                fontSize: 11,
                lineHeight: 1.4,
                color: CAD.label,
                background: CAD.headerBg,
                borderTop: `1px solid ${CAD.border}`,
              }}
            >
              <b style={{ fontWeight: 600 }}>{selected.name}</b>
              {' '}
              {describeFeature(selected, sketches.find((s) => s.id === selected.sketchId)?.name)}
            </div>
          )}
        </>
      ) : (
        // `hidden`, not `auto`: the listing owns the scrolling now — it draws
        // only the rows on screen, so it has to be the element whose height is
        // the panel's and whose scrollTop means a position in the program. A
        // second scroller around it would take both away.
        <div style={{
          flex: 1, minHeight: 0, overflow: 'hidden', padding: 6,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}
        >
          {/* The parse error rides with the listing: it is about this text, and
              the line it names is in the panel underneath it. */}
          {error && (
            <Alert
              type="error"
              showIcon
              message="Parse failed"
              description={error}
              style={{ flex: '0 0 auto' }}
            />
          )}
          <GcodePanel gcode={gcode} activeLine={activeLine} onChange={setGcode} />
        </div>
      )}
    </div>
  );
}
