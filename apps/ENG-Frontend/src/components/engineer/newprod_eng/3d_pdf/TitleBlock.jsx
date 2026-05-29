/**
 * TitleBlock — ISO 7200 Engineering Drawing Title Block
 * 
 * Renders a standard engineering drawing title block using Ant Design components.
 * Designed for A4 landscape paper layout.
 */
import React from 'react';
import { Descriptions } from 'antd';

export default function TitleBlock({ data = {}, compact = false }) {
  const {
    partNumber = '',
    partName = '',
    revision = 'A',
    scale = '1:1',
    sheet = '1/1',
    drawingSize = 'A4',
    material = '',
    weight = '',
    tolerance = 'ISO 2768-mK',
    drawnBy = '',
    checkedBy = '',
    approvedBy = '',
    date = ''
  } = data;

  return (
    <div className="title-block" data-xml-loaded={partName ? 'true' : 'false'}>
      {/* Company Header Row */}
      <div className="tb-company-row">
        <div className="tb-company-logo">
          <span className="tb-company-name">ENGINEERING</span>
          <span className="tb-company-sub">CAD Drawing System</span>
        </div>
        <div className="tb-drawing-title">
          <span className="tb-part-name">{partName || 'Untitled Drawing'}</span>
        </div>
        <div className="tb-revision-box">
          <span className="tb-rev-label">REV</span>
          <span className="tb-rev-value">{revision}</span>
        </div>
      </div>

      {/* Main Info Grid */}
      <div className="tb-info-grid">
        {/* Left section — Signatures */}
        <div className="tb-signatures">
          <div className="tb-sig-row">
            <span className="tb-sig-label">Drawn</span>
            <span className="tb-sig-name">{drawnBy}</span>
            <span className="tb-sig-date">{date}</span>
          </div>
          <div className="tb-sig-row">
            <span className="tb-sig-label">Checked</span>
            <span className="tb-sig-name">{checkedBy}</span>
            <span className="tb-sig-date">{date}</span>
          </div>
          <div className="tb-sig-row">
            <span className="tb-sig-label">Approved</span>
            <span className="tb-sig-name">{approvedBy}</span>
            <span className="tb-sig-date">{date}</span>
          </div>
        </div>

        {/* Center section — Part Details */}
        <div className="tb-details">
          <Descriptions
            column={2}
            size="small"
            bordered
            className="tb-descriptions"
            labelStyle={{
              background: 'rgba(0, 0, 0, 0.04)',
              fontSize: compact ? 9 : 10,
              padding: compact ? '2px 6px' : '4px 8px',
              fontWeight: 600,
              color: '#333'
            }}
            contentStyle={{
              fontSize: compact ? 9 : 10,
              padding: compact ? '2px 6px' : '4px 8px',
              color: '#000'
            }}
          >
            <Descriptions.Item label="Part No.">{partNumber}</Descriptions.Item>
            <Descriptions.Item label="Material">{material}</Descriptions.Item>
            <Descriptions.Item label="Tolerance">{tolerance}</Descriptions.Item>
            <Descriptions.Item label="Weight">{weight}</Descriptions.Item>
          </Descriptions>
        </div>

        {/* Right section — Drawing Info */}
        <div className="tb-drawing-info">
          <div className="tb-info-item">
            <span className="tb-info-label">Scale</span>
            <span className="tb-info-value">{scale}</span>
          </div>
          <div className="tb-info-item">
            <span className="tb-info-label">Size</span>
            <span className="tb-info-value">{drawingSize}</span>
          </div>
          <div className="tb-info-item">
            <span className="tb-info-label">Sheet</span>
            <span className="tb-info-value">{sheet}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
