/**
 * ViewerToolbar — Floating 3D Viewer Control Toolbar
 * 
 * Provides view presets, PMI toggle, wireframe toggle, screenshot, and zoom-to-fit.
 */
import React from 'react';
import { Tooltip } from 'antd';
import {
  EyeOutlined,
  EyeInvisibleOutlined,
  CameraOutlined,
  ExpandOutlined,
  BorderOutlined,
  AppstoreOutlined
} from '@ant-design/icons';

const VIEW_PRESETS = [
  { key: 'isometric', label: 'ISO', icon: '◇' },
  { key: 'front',     label: 'F',   icon: '□' },
  { key: 'top',       label: 'T',   icon: '⊡' },
  { key: 'right',     label: 'R',   icon: '▷' }
];

export default function ViewerToolbar({
  showPMI,
  onTogglePMI,
  wireframe,
  onToggleWireframe,
  currentView,
  onViewChange,
  onScreenshot,
  onFitAll
}) {
  return (
    <div className="viewer-toolbar" data-no-print>
      {/* View Presets */}
      {VIEW_PRESETS.map((preset) => (
        <Tooltip key={preset.key} title={`${preset.label} View`} placement="left">
          <button
            className={`toolbar-btn ${currentView === preset.key ? 'active' : ''}`}
            onClick={() => onViewChange?.(preset.key)}
          >
            {preset.icon}
          </button>
        </Tooltip>
      ))}

      <div className="toolbar-divider" />

      {/* PMI Toggle */}
      <Tooltip title={showPMI ? 'Hide PMI' : 'Show PMI'} placement="left">
        <button
          className={`toolbar-btn ${showPMI ? 'active' : ''}`}
          onClick={onTogglePMI}
        >
          {showPMI ? <EyeOutlined /> : <EyeInvisibleOutlined />}
        </button>
      </Tooltip>

      {/* Wireframe Toggle */}
      <Tooltip title={wireframe ? 'Solid Mode' : 'Wireframe Mode'} placement="left">
        <button
          className={`toolbar-btn ${wireframe ? 'active' : ''}`}
          onClick={onToggleWireframe}
        >
          {wireframe ? <AppstoreOutlined /> : <BorderOutlined />}
        </button>
      </Tooltip>

      <div className="toolbar-divider" />

      {/* Fit All */}
      <Tooltip title="Fit All" placement="left">
        <button className="toolbar-btn" onClick={onFitAll}>
          <ExpandOutlined />
        </button>
      </Tooltip>

      {/* Screenshot */}
      <Tooltip title="Screenshot" placement="left">
        <button className="toolbar-btn" onClick={onScreenshot}>
          <CameraOutlined />
        </button>
      </Tooltip>
    </div>
  );
}
