import React from 'react';
import { Form, InputNumber, Slider, Collapse, Space, Tag, Tooltip, Alert, Select } from 'antd';
import { RadiusSettingOutlined, ColumnWidthOutlined, AimOutlined } from '@ant-design/icons';
import { PARAM_LIMITS, GDT_SYMBOLS, MODEL_TYPES } from '../../constants';
import useBushingParams from '../../hooks/useBushingParams';

const { Panel } = Collapse;
const { Option } = Select;

function ParamField({ label, symbol, paramKey, value, onChange, limits, precision = 3, unit = 'mm', tooltip }) {
  const lim = limits || PARAM_LIMITS[paramKey] || { min: 0, max: 999, step: 0.01 };

  return (
    <div className="bushing-param-field">
      <div className="param-label-row">
        <Tooltip title={tooltip}>
          <span className="param-label">{label}</span>
        </Tooltip>
        {symbol && <Tag color="blue" className="param-symbol">{symbol}</Tag>}
      </div>
      <div className="param-input-row">
        <InputNumber
          value={value} min={lim.min} max={lim.max} step={lim.step} precision={precision}
          onChange={(v) => onChange(paramKey, v)} style={{ width: '100%' }} addonAfter={unit} size="small"
        />
      </div>
      <Slider
        value={value} min={lim.min} max={lim.max} step={lim.step}
        onChange={(v) => onChange(paramKey, v)} tooltip={{ formatter: (v) => `${v} ${unit}` }} className="param-slider"
      />
    </div>
  );
}

function ToleranceField({ label, plusKey, minusKey, plusValue, minusValue, onChange }) {
  return (
    <div className="bushing-tolerance-field">
      <span className="tolerance-label">{label}</span>
      <Space size={4}>
        <InputNumber value={plusValue || 0} step={0.001} precision={3} onChange={(v) => onChange(plusKey, v)} style={{ width: 90 }} addonBefore="+" size="small" />
        <InputNumber value={minusValue || 0} step={0.001} precision={3} onChange={(v) => onChange(minusKey, v)} style={{ width: 90 }} addonBefore="-" size="small" max={0} />
      </Space>
    </div>
  );
}

export default function ParameterForm({ params, validation, setParam, setModelType }) {
  return (
    <div className="bushing-parameter-form">
      
      <div style={{ marginBottom: 16 }}>
        <Select 
          value={params.modelType} 
          onChange={(val) => setModelType(val)}
          style={{ width: '100%' }}
          size="middle"
          popupClassName="bushing-dark-dropdown"
        >
          <Option value={MODEL_TYPES.BALL}>Spherical Bearing (Ball)</Option>
          <Option value={MODEL_TYPES.FLANGE}>Sleeve Flange</Option>
          <Option value={MODEL_TYPES.SLEEVE}>Straight Sleeve</Option>
        </Select>
      </div>

      {!validation.valid && (
        <Alert message="Parameter Error" description={<ul style={{ margin: 0, paddingLeft: 16 }}>{validation.errors.map((err, i) => (<li key={i} style={{ fontSize: 12 }}>{err}</li>))}</ul>} type="error" showIcon style={{ marginBottom: 12 }} />
      )}

      {params.modelType === MODEL_TYPES.BALL && (
        // --- BALL FORM ---
        <Collapse defaultActiveKey={['dimensions', 'chamfer']} ghost expandIconPosition="end" className="param-collapse">
          <Panel header={<span className="panel-header"><ColumnWidthOutlined /> Global Dimensions</span>} key="dimensions">
            <ParamField label="Width / Length" symbol="B" paramKey="width" value={params.width} onChange={setParam} precision={3} tooltip="Total height of the bearing" />
            <ParamField label="Outer Sphere Dia" symbol={GDT_SYMBOLS.sphereDiameter} paramKey="outerSphereDia" value={params.outerSphereDia} onChange={setParam} precision={3} tooltip="Outer spherical diameter" />
            <ParamField label="Inner Bore Dia" symbol={`${GDT_SYMBOLS.diameter}ID`} paramKey="innerBoreDia" value={params.innerBoreDia} onChange={setParam} precision={3} tooltip="Inner bore diameter" />
          </Panel>

          <Panel header={<span className="panel-header"><AimOutlined /> Engineering Limits</span>} key="tolerances">
            <ToleranceField label="Width" plusKey="widthTolPlus" minusKey="widthTolMinus" plusValue={params.widthTolPlus} minusValue={params.widthTolMinus} onChange={setParam} />
            <ToleranceField label={`Sphere (${GDT_SYMBOLS.sphereDiameter})`} plusKey="sphereTolPlus" minusKey="sphereTolMinus" plusValue={params.sphereTolPlus} minusValue={params.sphereTolMinus} onChange={setParam} />
            <ToleranceField label={`Bore (${GDT_SYMBOLS.diameter}ID)`} plusKey="boreTolPlus" minusKey="boreTolMinus" plusValue={params.boreTolPlus} minusValue={params.boreTolMinus} onChange={setParam} />
          </Panel>

          <Panel header={<span className="panel-header"><RadiusSettingOutlined /> Inner Edge Chamfer</span>} key="chamfer">
            <ParamField label="Chamfer Start Dia" symbol="2x Ø" paramKey="chamferDia" value={params.chamferDia} onChange={setParam} precision={3} tooltip="Outer width at start of hole chamfer" />
            <ParamField label="Chamfer Angle" symbol="°" paramKey="chamferAngle" value={params.chamferAngle} onChange={setParam} unit="°" precision={1} tooltip="Angle relative to orthogonal face" />
          </Panel>
        </Collapse>
      )}

      {params.modelType === MODEL_TYPES.FLANGE && (
        // --- FLANGE SLEEVE FORM ---
        <Collapse defaultActiveKey={['primary', 'internal']} ghost expandIconPosition="end" className="param-collapse">
          <Panel header={<span className="panel-header"><ColumnWidthOutlined /> Primary Dimensions</span>} key="primary">
            <ParamField label="Flange OD" paramKey="flangeDia" value={params.flangeDia} onChange={setParam} precision={3} tooltip="Outer diameter of the flange" />
            <ParamField label="Sleeve Body OD" paramKey="bodyDia" value={params.bodyDia} onChange={setParam} precision={3} tooltip="Outer diameter of the sleeve" />
            <ParamField label="Flange Thickness" paramKey="flangeThickness" value={params.flangeThickness} onChange={setParam} precision={3} tooltip="Thickness of the flange base" />
            <ParamField label="Sleeve Length" paramKey="bodyLength" value={params.bodyLength} onChange={setParam} precision={3} tooltip="Length from inside flange face to end" />
            <ParamField label="Inner Bore (TFE Liner)" paramKey="innerBoreDia" value={params.innerBoreDia} onChange={setParam} precision={3} tooltip="Innermost flush bore diameter" />
          </Panel>
          
          <Panel header={<span className="panel-header"><RadiusSettingOutlined /> Internal Liner Geometry</span>} key="internal">
            <ParamField label="Liner Setback (Flange Side)" paramKey="linerSetbackFlange" value={params.linerSetbackFlange} onChange={setParam} precision={3} tooltip="Distance from flange face to TFE liner" />
            <ParamField label="Liner Setback (End Side)" paramKey="linerSetbackEnd" value={params.linerSetbackEnd} onChange={setParam} precision={3} tooltip="Distance from end face to TFE liner" />
            <ParamField label="TFE Groove Depth (Radial)" paramKey="linerGrooveDepth" value={params.linerGrooveDepth} onChange={setParam} precision={3} tooltip="Radial depth the liner is seated into" />
          </Panel>

          <Panel header={<span className="panel-header"><AimOutlined /> Flange & Sleeve Ends</span>} key="features">
            <ParamField label="Undercut Length" paramKey="undercutLength" value={params.undercutLength} onChange={setParam} precision={3} tooltip="Relief cut length behind flange" />
            <ParamField label="Undercut Depth (Radial)" paramKey="undercutDepth" value={params.undercutDepth} onChange={setParam} precision={3} tooltip="Relief cut depth radially" />
            <ParamField label="Inner Flange Chamfer" paramKey="flangeInnerChamfer" value={params.flangeInnerChamfer} onChange={setParam} precision={3} tooltip="Inner step chamfer at flange" />
            <ParamField label="Outer Sleeve End Chamfer (L)" paramKey="endOuterChamferL" value={params.endOuterChamferL} onChange={setParam} precision={3} tooltip="Outer chamfer horizontal length" />
            <ParamField label="Outer Sleeve End Depth (R)" paramKey="endOuterChamferD" value={params.endOuterChamferD} onChange={setParam} precision={3} tooltip="Outer chamfer radial depth" />
          </Panel>
        </Collapse>
      )}

      {params.modelType === MODEL_TYPES.SLEEVE && (
        // --- SLEEVE FORM ---
        <Collapse defaultActiveKey={['primary', 'internal']} ghost expandIconPosition="end" className="param-collapse">
          <Panel header={<span className="panel-header"><ColumnWidthOutlined /> Primary Dimensions</span>} key="primary">
            <ParamField label="Sleeve Body OD" paramKey="bodyDia" value={params.bodyDia} onChange={setParam} precision={3} tooltip="Outer diameter of the sleeve" />
            <ParamField label="Sleeve Length" paramKey="bodyLength" value={params.bodyLength} onChange={setParam} precision={3} tooltip="Total length of the sleeve" />
            <ParamField label="Inner Bore (TFE Liner)" paramKey="innerBoreDia" value={params.innerBoreDia} onChange={setParam} precision={3} tooltip="Innermost flush bore diameter" />
          </Panel>
          
          <Panel header={<span className="panel-header"><RadiusSettingOutlined /> Internal Liner Geometry</span>} key="internal">
            <ParamField label="Liner Setback (Both Ends)" paramKey="linerSetback" value={params.linerSetback} onChange={setParam} precision={3} tooltip="Distance from faces to TFE liner" />
            <ParamField label="TFE Groove Depth (Radial)" paramKey="linerGrooveDepth" value={params.linerGrooveDepth} onChange={setParam} precision={3} tooltip="Radial depth the liner is seated into" />
          </Panel>

          <Panel header={<span className="panel-header"><AimOutlined /> Outer Chamfers</span>} key="features">
            <ParamField label="Outer End Chamfer (L)" paramKey="endOuterChamferL" value={params.endOuterChamferL} onChange={setParam} precision={3} tooltip="Outer chamfer horizontal length" />
            <ParamField label="Outer End Depth (R)" paramKey="endOuterChamferD" value={params.endOuterChamferD} onChange={setParam} precision={3} tooltip="Outer chamfer radial depth" />
            <ParamField label="Inner Groove Taper °" paramKey="innerTaperAngle" value={params.innerTaperAngle} onChange={setParam} precision={1} unit="°" tooltip="Taper lead-in for inner groove" />
          </Panel>
        </Collapse>
      )}
    </div>
  );
}
