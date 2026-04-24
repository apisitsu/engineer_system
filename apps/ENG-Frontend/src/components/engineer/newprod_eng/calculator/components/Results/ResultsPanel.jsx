import React from 'react';
import { Divider, Progress, Typography } from 'antd';
import { AreaChartOutlined, BoxPlotOutlined, ExperimentOutlined, InfoCircleOutlined, CodeSandboxOutlined } from '@ant-design/icons';
import { MODEL_TYPES } from '../../constants';

const { Text } = Typography;

function ResultCard({ title, icon, children }) {
  return (
    <div className="result-card">
      <div className="result-card-header">{icon}<span className="result-card-title">{title}</span></div>
      <div className="result-card-body">{children}</div>
    </div>
  );
}

function BreakdownRow({ label, value, unit, color, total }) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="breakdown-row">
      <div className="breakdown-label"><span className="breakdown-dot" style={{ background: color }} /><span>{label}</span></div>
      <div className="breakdown-value"><span className="breakdown-number">{value.toFixed(2)}</span><span className="breakdown-unit">{unit}</span></div>
      <Progress percent={percentage} size="small" showInfo={false} strokeColor={color} trailColor="rgba(255,255,255,0.06)" className="breakdown-bar" />
    </div>
  );
}

export default function ResultsPanel({ surfaceArea, volume, weight, material, params }) {
  const isPoly = params.modelType === MODEL_TYPES.FLANGE || params.modelType === MODEL_TYPES.SLEEVE;

  return (
    <div className="bushing-results-panel">
      {/* ── Total Surface Area ── */}
      <ResultCard title="Surface Area" icon={<AreaChartOutlined style={{ color: '#00ff88' }} />}>
        <div className="result-total"><span className="result-total-value">{(surfaceArea.total / 100).toFixed(2)}</span><span className="result-total-unit">cm²</span></div>
        <div className="result-secondary"><span>{surfaceArea.total.toFixed(2)} mm²</span></div>
        <Divider className="result-divider" />
        <div className="breakdown-section">
          {isPoly ? (
            <>
              <Text className="breakdown-title">Polygonal Integration Area</Text>
              <BreakdownRow label="Metal Geometry (Excluding TFE)" value={surfaceArea.total} unit="mm²" color="#00ff88" total={surfaceArea.total} />
            </>
          ) : (
            <>
              <Text className="breakdown-title">Breakdown</Text>
              <BreakdownRow label="Outer Spherical" value={surfaceArea.outerSpherical} unit="mm²" color="#00ff88" total={surfaceArea.total} />
              <BreakdownRow label="Inner Bore" value={surfaceArea.innerBore} unit="mm²" color="#ff6b9d" total={surfaceArea.total} />
              <BreakdownRow label="Flat Faces (Ends)" value={surfaceArea.flatFaces} unit="mm²" color="#ffd93d" total={surfaceArea.total} />
              <BreakdownRow label="Chamfer Cut" value={surfaceArea.chamfers} unit="mm²" color="#b388ff" total={surfaceArea.total} />
            </>
          )}
        </div>
      </ResultCard>

      {/* ── Volume ── */}
      <ResultCard title="Volume" icon={<BoxPlotOutlined style={{ color: '#6bb3ff' }} />}>
        <div className="result-total"><span className="result-total-value">{volume.total.toFixed(2)}</span><span className="result-total-unit">mm³</span></div>
        <div className="result-secondary"><span>{weight.volumeCM3} cm³</span></div>
        <Divider className="result-divider" />
        <div className="breakdown-section">
          {isPoly ? (
            <BreakdownRow label="Total Revolved Metal" value={volume.total} unit="mm³" color="#6bb3ff" total={volume.total} />
          ) : (
            <>
              <BreakdownRow label="Spherical Body" value={volume.truncatedSphere} unit="mm³" color="#00ff88" total={volume.truncatedSphere} />
              <BreakdownRow label="Bore Removed (-)" value={volume.holeRemoved} unit="mm³" color="#ff4d6a" total={volume.truncatedSphere} />
            </>
          )}
        </div>
      </ResultCard>

      {/* ── Weight Estimate ── */}
      <ResultCard title="Weight Estimate" icon={<ExperimentOutlined style={{ color: '#ffd93d' }} />}>
        <div className="result-total"><span className="result-total-value">{weight.grams.toFixed(2)}</span><span className="result-total-unit">g</span></div>
        <div className="result-secondary"><span>{weight.kilograms} kg</span></div>
        <Divider className="result-divider" />
        <div className="material-info">
          <div className="material-info-row">
            <span className="material-label">Material</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-swatch" style={{ background: material.color }} />
              <span className="material-name">{material.name}</span>
            </div>
          </div>
          <div className="material-info-row"><span className="material-label">Density</span><span className="material-value">{material.density} g/cm³</span></div>
        </div>
      </ResultCard>

      {/* ── Quick Specs ── */}
      <ResultCard title="Quick Specs" icon={<InfoCircleOutlined style={{ color: '#b388ff' }} />}>
        <div className="quick-specs">
          {params.modelType === MODEL_TYPES.FLANGE && (
            <>
              <div className="spec-row"><span>Total Length</span><span className="spec-value">{(params.flangeThickness + params.bodyLength).toFixed(3)} mm</span></div>
              <div className="spec-row"><span>Flange OD</span><span className="spec-value">{params.flangeDia.toFixed(3)} mm</span></div>
              <div className="spec-row"><span>Body OD</span><span className="spec-value">{params.bodyDia.toFixed(3)} mm</span></div>
              <div className="spec-row"><span>ID (Inner Bore)</span><span className="spec-value">{params.innerBoreDia.toFixed(3)} mm</span></div>
            </>
          )}
          {params.modelType === MODEL_TYPES.SLEEVE && (
            <>
              <div className="spec-row"><span>Total Length</span><span className="spec-value">{params.bodyLength.toFixed(3)} mm</span></div>
              <div className="spec-row"><span>Body OD</span><span className="spec-value">{params.bodyDia.toFixed(3)} mm</span></div>
              <div className="spec-row"><span>ID (Inner Bore)</span><span className="spec-value">{params.innerBoreDia.toFixed(3)} mm</span></div>
            </>
          )}
          {params.modelType === MODEL_TYPES.BALL && (
            <>
              <div className="spec-row"><span>Width / Length</span><span className="spec-value">{params.width.toFixed(3)} mm</span></div>
              <div className="spec-row"><span>Sphere Dia (SØ)</span><span className="spec-value">{params.outerSphereDia.toFixed(3)} mm</span></div>
              <div className="spec-row"><span>Bore Dia (ID)</span><span className="spec-value">{params.innerBoreDia.toFixed(3)} mm</span></div>
              <div className="spec-row"><span>Chamfer Dia</span><span className="spec-value">{params.chamferDia.toFixed(2)} mm</span></div>
            </>
          )}
        </div>
      </ResultCard>
    </div>
  );
}
