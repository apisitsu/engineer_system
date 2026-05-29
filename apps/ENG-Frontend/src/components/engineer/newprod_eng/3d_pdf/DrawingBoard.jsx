/**
 * DrawingBoard — Unified A4 Engineering Drawing Layout
 * 
 * Combines the 3D Viewer (CadViewer) + Title Block + Parameter Table
 * into a single drawing board view with fixed A4 landscape dimensions.
 * Designed for high-quality PDF export via Puppeteer.
 */
import React from 'react';
import { Table } from 'antd';
import CadViewer from './CadViewer';
import TitleBlock from './TitleBlock';
import './DrawingBoard.css';

// A4 Landscape aspect ratio: 297mm x 210mm ≈ 1.414:1
const DRAWING_CONFIG = {
  A4: {
    width: 1122,   // 297mm at 96dpi
    height: 794,   // 210mm at 96dpi
    label: 'A4 Landscape'
  },
  A3: {
    width: 1587,   // 420mm at 96dpi
    height: 1122,  // 297mm at 96dpi
    label: 'A3 Landscape'
  }
};

// Parameter table columns
const paramColumns = [
  {
    title: 'Parameter',
    dataIndex: 'name',
    key: 'name',
    width: 180,
    render: (text) => (
      <span style={{ fontFamily: 'Consolas, monospace', fontSize: 10 }}>
        {text}
      </span>
    )
  },
  {
    title: 'Value',
    dataIndex: 'value',
    key: 'value',
    width: 80,
    align: 'right',
    render: (val) => (
      <span style={{ fontFamily: 'Consolas, monospace', fontSize: 10, fontWeight: 600 }}>
        {typeof val === 'number' ? val.toFixed(3) : val}
      </span>
    )
  },
  {
    title: 'Unit',
    dataIndex: 'unit',
    key: 'unit',
    width: 50,
    render: (text) => (
      <span style={{ fontSize: 10, color: '#666' }}>{text}</span>
    )
  }
];

export default function DrawingBoard({
  modelUrl,
  viewportImageUrl,
  pmiData = [],
  titleBlockData = {},
  parameters = [],
  size = 'A4',
  onModelLoaded
}) {
  const config = DRAWING_CONFIG[size] || DRAWING_CONFIG.A4;

  // Show only first 15 parameters in the drawing to keep it clean
  const visibleParams = parameters.slice(0, 15);
  const hasMoreParams = parameters.length > 15;

  return (
    <div className="drawing-board-container">
      <div
        className="drawing-board"
        style={{ width: config.width, height: config.height }}
      >
        {/* Outer Border */}
        <div className="drawing-border-outer">
          {/* Inner Border */}
          <div className="drawing-border-inner">
            {/* Main Content Area */}
            <div className="drawing-content">

              {/* 3D Viewport Area — Takes ~70% width */}
              <div className="drawing-viewport">
                <CadViewer
                  modelUrl={modelUrl}
                  viewportImageUrl={viewportImageUrl}
                  pmiData={pmiData}
                  onLoaded={onModelLoaded}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>

              {/* Right Panel — Parameter Table */}
              <div className="drawing-right-panel">
                <div className="drawing-param-header">PARAMETERS</div>
                <div className="drawing-param-table">
                  <Table
                    dataSource={visibleParams}
                    columns={paramColumns}
                    size="small"
                    pagination={false}
                    bordered
                    showHeader={true}
                    rowClassName="param-row"
                    style={{ fontSize: 10 }}
                  />
                  {hasMoreParams && (
                    <div className="param-more">
                      +{parameters.length - 15} more parameters
                    </div>
                  )}
                </div>

                {/* Notes section */}
                <div className="drawing-notes">
                  <div className="drawing-notes-header">NOTES</div>
                  <div className="drawing-notes-content">
                    <p>1. ALL DIMENSIONS IN MILLIMETERS</p>
                    <p>2. GENERAL TOLERANCE: {titleBlockData.tolerance || 'ISO 2768-mK'}</p>
                    <p>3. BREAK ALL SHARP EDGES</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Title Block — Bottom */}
            <div className="drawing-title-block-area">
              <TitleBlock data={titleBlockData} compact />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
