/**
 * FeaSimulation - Main Application Layout
 * Assembles the three-column layout: Controls, 3D/2D Viewer, and Results.
 * Supports toggling between 2D cross-section and 3D revolved mesh views.
 */
import React, { useState, useMemo } from 'react';
import { ConfigProvider, Button, Tooltip, theme, Typography, Spin, Alert, Statistic, Row, Col, Card, Radio } from 'antd';
import { ArrowLeftOutlined, FireOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

// Hooks
import useFeaSimulation from './hooks/useFeaSimulation';

// Components
import CsvUploader from './components/Controls/CsvUploader';
import FeaScene from './components/Viewer/FeaScene';
import FeaScene2D from './components/Viewer/FeaScene2D';
import TimelineSlider from './components/Results/TimelineSlider';

import './FeaSimulation.css';

const { Text } = Typography;

export default function FeaSimulation() {
  const navigate = useNavigate();

  // State Management
  const {
    isSimulating,
    progressMessage,
    simulationResult,
    error,
    startSimulation
  } = useFeaSimulation();

  const [currentStep, setCurrentStep] = useState(1);
  const [viewMode, setViewMode] = useState('2d'); // '2d' or '3d'

  const handleStartSimulation = (csvData) => {
    startSimulation(csvData);
    setCurrentStep(1); // Reset timeline
  };

  // Extract current timestep data
  const timeStepData = useMemo(() => {
    if (!simulationResult || !simulationResult.time_series) return null;
    // Step is 1-indexed, array is 0-indexed
    return simulationResult.time_series[currentStep - 1];
  }, [simulationResult, currentStep]);

  // Calculate global max stress to normalize colors
  const maxStress = useMemo(() => {
    if (!simulationResult || !simulationResult.time_series) return 0;
    let max = 0;
    simulationResult.time_series.forEach(step => {
        step.stresses.forEach(s => {
            if (s > max) max = s;
        });
    });
    return max;
  }, [simulationResult]);

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <div className="fea-simulation-layout">
        <header className="fea-header">
          <Tooltip title="Back to New Product Tools">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
              style={{ color: 'white' }}
            />
          </Tooltip>
          
          <h1 className="header-title">
            <FireOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
            Non-linear FEA Simulation
          </h1>

          {/* View Mode Toggle */}
          <div className="view-mode-toggle">
            <Radio.Group 
              value={viewMode} 
              onChange={(e) => setViewMode(e.target.value)}
              buttonStyle="solid"
              size="small"
            >
              <Radio.Button value="2d">2D Section</Radio.Button>
              <Radio.Button value="3d">3D Model</Radio.Button>
            </Radio.Group>
          </div>
        </header>

        <main className="fea-main-content">
          {/* Left Column - Controls */}
          <section className="fea-sider-left">
            <div className="param-header" style={{ padding: '16px 16px 4px' }}>
              CONFIGURATION
            </div>
            <CsvUploader onStartSimulation={handleStartSimulation} isSimulating={isSimulating} />
            
            {/* Simulation Status */}
            <div style={{ padding: '16px' }}>
                {isSimulating && (
                    <Alert
                        message={<span style={{ color: '#faad14', fontWeight: 'bold' }}>Simulation Running</span>}
                        description={<span style={{ color: '#fff' }}>{progressMessage || 'Processing...'}</span>}
                        type="warning"
                        icon={<Spin />}
                        showIcon
                        style={{ background: 'rgba(250, 173, 20, 0.1)', border: '1px solid #faad14' }}
                    />
                )}
                {error && (
                    <Alert
                        message={<span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>Error</span>}
                        description={<span style={{ color: '#fff' }}>{error}</span>}
                        type="error"
                        showIcon
                        style={{ background: 'rgba(255, 77, 79, 0.1)', border: '1px solid #ff4d4f' }}
                    />
                )}
                {!isSimulating && !error && simulationResult && (
                     <Alert
                     message={<span style={{ color: '#52c41a', fontWeight: 'bold' }}>Simulation Complete</span>}
                     type="success"
                     showIcon
                     style={{ background: 'rgba(82, 196, 26, 0.1)', border: '1px solid #52c41a' }}
                 />
                )}
            </div>
          </section>

          {/* Center Column - Viewer (2D or 3D) */}
          <section className="fea-viewer-container">
             {viewMode === '2d' ? (
               <FeaScene2D
                 meshData={simulationResult?.mesh}
                 timeStepData={timeStepData}
                 maxStress={maxStress}
               />
             ) : (
               <FeaScene 
                 meshData={simulationResult?.mesh} 
                 timeStepData={timeStepData}
                 maxStress={maxStress}
               />
             )}
             <div className="fea-viewer-overlay">
                <TimelineSlider 
                    currentTimeStep={currentStep} 
                    maxSteps={simulationResult?.time_series?.length || 0} 
                    onChange={setCurrentStep} 
                />
             </div>
          </section>

          {/* Right Column - Results */}
          <section className="fea-sider-right">
            <div className="param-header" style={{ padding: '16px 16px 4px' }}>
              LIVE RESULTS
            </div>
            
            <div style={{ padding: '16px' }}>
                {!simulationResult ? (
                    <Text type="secondary">Run a simulation to view results.</Text>
                ) : (
                    <>
                        <Row gutter={[16, 16]}>
                            <Col span={24}>
                                <Card size="small" className="result-card">
                                    <Statistic 
                                        title="Job ID" 
                                        value={simulationResult.metadata?.jobId || '-'} 
                                        valueStyle={{ fontSize: '14px', color: '#1890ff' }} 
                                    />
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card size="small" className="result-card">
                                    <Statistic 
                                        title="Nodes" 
                                        value={simulationResult.metadata?.nodes_count || 0} 
                                    />
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card size="small" className="result-card">
                                    <Statistic 
                                        title="Elements" 
                                        value={simulationResult.metadata?.elements_count || 0} 
                                    />
                                </Card>
                            </Col>
                            <Col span={24}>
                                <Card size="small" className="result-card">
                                    <Statistic 
                                        title="Max Von Mises Stress" 
                                        value={maxStress} 
                                        precision={2}
                                        suffix="MPa"
                                        valueStyle={{ color: '#ff4d4f' }}
                                    />
                                </Card>
                            </Col>
                            <Col span={24}>
                                <Card size="small" className="result-card">
                                    <Statistic 
                                        title="Element Type" 
                                        value={simulationResult.metadata?.element_type || '-'} 
                                        valueStyle={{ fontSize: '14px', color: '#52c41a' }} 
                                    />
                                </Card>
                            </Col>
                        </Row>
                        
                        <div style={{ marginTop: 24 }}>
                            <Text strong>Stress Heatmap Legend</Text>
                            <div className="heatmap-legend" style={{ 
                                background: 'linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)', 
                                height: 20, 
                                borderRadius: 4,
                                marginTop: 8 
                            }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                                <span>0</span>
                                <span>{maxStress.toFixed(1)} MPa</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
          </section>

        </main>
      </div>
    </ConfigProvider>
  );
}
