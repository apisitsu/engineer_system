/**
 * FeatureTreePanel — the operations that made the part, and the controls to
 * change them.
 *
 * The list is the model. Editing a number here and pressing Rebuild replays
 * everything from the top, which is what makes this a CAD you can come back to
 * rather than a one-way build button.
 *
 * **Rebuild is deliberately manual.** The tree goes stale on any edit and says
 * so; it does not recompute as you drag. A sketch drag emits a solve per frame
 * and a tree with a solid boolean in it would fire a CSG evaluation per frame
 * with it — SolidWorks lights up a rebuild button for exactly this reason.
 */
import {
  Button, Tooltip, Popover, Space, Typography, InputNumber, Segmented, Badge, Alert,
} from 'antd';
import {
  DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined,
  EyeOutlined, EyeInvisibleOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useFeatureStore } from '../stores/featureStore.js';
import { useSketchStore } from '../stores/sketchStore.js';
import { describeFeature } from '../engine/solid/featureTree.js';
import { CAD } from '../theme.js';

const { Text } = Typography;

const MERGE_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'cut', label: 'Cut' },
  { value: 'add', label: 'Add' },
  { value: 'common', label: 'Common' },
];

/** The parameters of the selected feature, editable. */
function FeatureEditor({ feature, sketches }) {
  const update = useFeatureStore((s) => s.updateFeature);
  if (feature.kind === 'import') {
    return (
      <Text style={{ color: CAD.dim, fontSize: 10 }}>
        The mesh this job was imported from. Its geometry cannot be edited here —
        it is the base everything else is cut from.
      </Text>
    );
  }
  const sketch = sketches.find((s) => s.id === feature.sketchId);
  return (
    <Space direction="vertical" size={4} style={{ width: '100%' }}>
      {feature.kind === 'extrude' ? (
        <Space size={4} style={{ width: '100%' }}>
          <InputNumber
            size="small"
            value={feature.depth}
            onChange={(v) => update(feature.id, { depth: Number(v) || 0 })}
            addonBefore="Depth"
            style={{ width: 138 }}
            data-feature-depth
          />
          <Tooltip title="Lift the whole solid off its plane — a boss standing on a face, or a cut starting below one">
            <InputNumber
              size="small"
              value={feature.base}
              onChange={(v) => update(feature.id, { base: Number(v) || 0 })}
              addonBefore="From"
              style={{ width: 128 }}
            />
          </Tooltip>
        </Space>
      ) : (
        <Space size={4} style={{ width: '100%' }}>
          <Segmented
            size="small"
            value={feature.axis}
            onChange={(v) => update(feature.id, { axis: v })}
            options={[{ label: 'X', value: 'x' }, { label: 'Y', value: 'y' }]}
          />
          <InputNumber
            size="small"
            min={1}
            max={360}
            value={Math.round((feature.angle * 180) / Math.PI)}
            onChange={(v) => update(feature.id, { angle: ((Number(v) || 360) * Math.PI) / 180 })}
            addonAfter="°"
            style={{ width: 110 }}
          />
        </Space>
      )}
      <Segmented
        size="small"
        block
        value={feature.merge}
        onChange={(v) => update(feature.id, { merge: v })}
        options={MERGE_OPTIONS}
      />
      <Text style={{ color: CAD.dim, fontSize: 10 }}>
        {sketch
          ? `Built from “${sketch.name}”. Editing that sketch changes this feature.`
          : 'Its sketch has been deleted — this feature cannot rebuild.'}
      </Text>
    </Space>
  );
}

export default function FeatureTreePanel({ trigger }) {
  const features = useFeatureStore((s) => s.features);
  const selectedId = useFeatureStore((s) => s.selectedId);
  const dirty = useFeatureStore((s) => s.dirty);
  const building = useFeatureStore((s) => s.building);
  const errors = useFeatureStore((s) => s.errors);
  const select = useFeatureStore((s) => s.select);
  const remove = useFeatureStore((s) => s.removeFeature);
  const move = useFeatureStore((s) => s.moveFeature);
  const toggleSuppress = useFeatureStore((s) => s.toggleSuppress);
  const rebuild = useFeatureStore((s) => s.rebuild);
  const sketches = useSketchStore((s) => s.sketches);

  const selected = features.find((f) => f.id === selectedId) || null;
  const errorOf = (id) => errors.find((e) => e.id === id);

  const content = (
    <Space direction="vertical" size={6} style={{ minWidth: 300 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Text style={{ color: CAD.dim, fontSize: 11 }}>
          Feature tree{features.length ? ` · ${features.length}` : ''}
        </Text>
        <Tooltip title={dirty
          ? 'The tree or a sketch under it has changed — replay it'
          : 'Everything is up to date'}
        >
          <Button
            size="small"
            type={dirty ? 'primary' : 'default'}
            icon={<ReloadOutlined />}
            loading={building}
            disabled={!features.length}
            onClick={() => rebuild()}
            data-feature-rebuild
          >
            Rebuild
          </Button>
        </Tooltip>
      </Space>

      {!features.length && (
        <Text style={{ color: CAD.dim, fontSize: 10 }}>
          Nothing built yet. Import a part, or draw a profile and press Build —
          each one becomes a feature here that you can come back and change.
        </Text>
      )}

      {features.map((f, i) => {
        const failed = errorOf(f.id);
        const isSel = f.id === selectedId;
        const sketch = sketches.find((s) => s.id === f.sketchId);
        return (
          <div key={f.id} style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <Button
              size="small"
              type={isSel ? 'primary' : 'text'}
              onClick={() => select(isSel ? null : f.id)}
              style={{
                flex: 1,
                textAlign: 'left',
                opacity: f.suppressed ? 0.45 : 1,
                textDecoration: f.suppressed ? 'line-through' : undefined,
              }}
              data-feature-item={f.id}
            >
              {failed && <Badge status="error" style={{ marginRight: 4 }} />}
              {f.name}
              <Text style={{ color: isSel ? undefined : CAD.dim, fontSize: 10, marginLeft: 6 }}>
                {describeFeature(f, sketch?.name)}
              </Text>
            </Button>
            <Tooltip title={f.suppressed ? 'Include this feature again' : 'Leave this feature out of the rebuild'}>
              <Button
                size="small"
                type="text"
                icon={f.suppressed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={() => toggleSuppress(f.id)}
                data-feature-suppress={f.id}
              />
            </Tooltip>
            <Tooltip title="Move earlier — order decides what cuts what">
              <span>
                <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => move(f.id, -1)} />
              </span>
            </Tooltip>
            <Tooltip title="Move later">
              <span>
                <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={i === features.length - 1} onClick={() => move(f.id, 1)} />
              </span>
            </Tooltip>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => remove(f.id)} />
          </div>
        );
      })}

      {errors.map((e) => (
        <Alert
          key={e.id}
          type="error"
          showIcon
          message={<span style={{ fontSize: 11 }}>{`${e.name}: ${e.message}`}</span>}
          style={{ padding: '4px 8px' }}
        />
      ))}

      {selected && (
        <>
          <Text style={{ color: CAD.dim, fontSize: 11 }}>“{selected.name}”</Text>
          <FeatureEditor feature={selected} sketches={sketches} />
        </>
      )}

      {dirty && features.length > 0 && (
        <Text style={{ color: CAD.accent, fontSize: 10 }}>
          Out of date — press Rebuild to replay the tree onto the part.
        </Text>
      )}
    </Space>
  );

  return (
    <Popover trigger="click" placement="bottomLeft" content={content}>
      {trigger}
    </Popover>
  );
}
