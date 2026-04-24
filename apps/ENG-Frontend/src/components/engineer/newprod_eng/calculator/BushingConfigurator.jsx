/**
 * BushingConfigurator - Main Application Layout
 * Assembles the three-column layout: Controls, 3D Viewer, and Results.
 */
import React, { useState, useEffect } from 'react';
import { ConfigProvider, Button, Tooltip, theme } from 'antd';
import { ArrowLeftOutlined, BgColorsOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

// Hooks
import useBushingParams from './hooks/useBushingParams';
import useCalculations from './hooks/useCalculations';
import useMeasurement from './hooks/useMeasurement';

// Components
import ParameterForm from './components/Controls/ParameterForm';
import ExportActions from './components/Controls/ExportActions';
import BushingScene from './components/Viewer/BushingScene';
import ResultsPanel from './components/Results/ResultsPanel';
import MiniPreview from './components/Results/MiniPreview';

// Utils
import { exportToSTL } from './utils/exportUtils';
import { DEFAULT_MATERIAL } from './constants';

import './BushingConfigurator.css';

export default function BushingConfigurator() {
  const navigate = useNavigate();

  // State Management
  const {
    params,
    validation,
    setParam,
    resetDefaults,
    loadConfig,
    setModelType,
  } = useBushingParams();

  const [materialKey, setMaterialKey] = useState(DEFAULT_MATERIAL);
  
  // View options
  const [showDimensions, setShowDimensions] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [wireframe, setWireframe] = useState(false);

  // Measurements
  const measurement = useMeasurement();

  // Computations
  const calculations = useCalculations(params, materialKey);

  // Handlers
  const handleExportSTL = () => {
    // Generate an STL name based on params
    const name = params.modelType === 'ball' 
      ? `Bushing_Ball_S${params.outerSphereDia?.toFixed(0)}_B${params.width?.toFixed(0)}`
      : `Bushing_Flange_OD${params.flangeDia?.toFixed(0)}_L${params.bodyLength?.toFixed(0)}`;
    
    const event = new CustomEvent('export-bushing-stl', { detail: { name } });
    window.dispatchEvent(event);
  };

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <div className="bushing-configurator-layout">
        <header className="bushing-header">
          <Tooltip title="Back to New Product Tools">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
              style={{ color: 'white' }}
            />
          </Tooltip>
          
          <h1 className="header-title">
            <BgColorsOutlined style={{ marginRight: 8, color: '#00ff88' }} />
            Parametric Bushing Configurator
          </h1>
        </header>

        <main className="bushing-main-content">
          <section className="bushing-sider-left">
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div className="param-header" style={{ padding: '16px 16px 4px' }}>
                PARAMETERS
              </div>
              <ParameterForm
                params={params}
                validation={validation}
                setParam={setParam}
                setModelType={setModelType}
              />
            </div>
            
            <ExportActions
              params={params}
              materialKey={materialKey}
              onMaterialChange={setMaterialKey}
              onResetDefaults={resetDefaults}
              onLoadConfig={loadConfig}
              onExportSTL={handleExportSTL}
              showDimensions={showDimensions}
              onToggleDimensions={() => setShowDimensions(!showDimensions)}
              showGrid={showGrid}
              onToggleGrid={() => setShowGrid(!showGrid)}
              wireframe={wireframe}
              onToggleWireframe={() => setWireframe(!wireframe)}
              measurementActive={measurement.isActive}
              onToggleMeasurement={measurement.toggleActive}
              onClearMeasurements={measurement.clearMeasurements}
            />
          </section>

          {/* Center Column - 3D Viewer */}
          <section className="bushing-viewer-container">
            <BushingScene
              params={params}
              materialColor={calculations.material.color}
              showDimensions={showDimensions}
              showGrid={showGrid}
              wireframe={wireframe}
              measurement={measurement}
            />
          </section>

          {/* Right Column - Results */}
          <section className="bushing-sider-right">
            <div className="param-header" style={{ padding: '16px 16px 4px' }}>
              LIVE RESULTS
            </div>
            
            <ResultsPanel
              surfaceArea={calculations.surfaceArea}
              volume={calculations.volume}
              weight={calculations.weight}
              material={calculations.material}
              params={params}
            />
            
            <div style={{ padding: '0 16px 16px' }}>
              <div className="param-header" style={{ marginBottom: 0 }}>
                GEOMETRY PREVIEW
              </div>
              <MiniPreview 
                params={params} 
                materialColor={calculations.material.color} 
              />
            </div>
          </section>

        </main>
      </div>
    </ConfigProvider>
  );
}
