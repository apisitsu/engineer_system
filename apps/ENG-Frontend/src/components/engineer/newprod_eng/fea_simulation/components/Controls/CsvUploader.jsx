import React, { useState } from 'react';
import { Upload, Button, Card, Typography, Space, Alert } from 'antd';
import { UploadOutlined, PlayCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function CsvUploader({ onStartSimulation, isSimulating }) {
  const [files, setFiles] = useState({
    parameters: null,
    material: null,
    timestep: null,
    setting: null
  });

  const handleUpload = (type, file) => {
    setFiles(prev => ({ ...prev, [type]: file }));
    return false; // Prevent automatic upload by AntD
  };

  const handleStart = () => {
    // In a real app, read the files and send to backend
    // For now, we mock the content as we send it
    onStartSimulation({
      params: "mock_params",
      material: "mock_material",
      timestep: "mock_timestep",
      setting: "mock_setting"
    });
  };

  const allFilesUploaded = Object.values(files).every(f => f !== null);

  const FileCard = ({ title, type }) => (
    <Card size="small" style={{ marginBottom: 8, background: '#222', borderColor: '#333' }}>
      <Space justify="space-between" style={{ width: '100%', display: 'flex' }}>
        <Text style={{ color: '#ccc' }}>{title}</Text>
        <Upload
          beforeUpload={(file) => handleUpload(type, file)}
          showUploadList={false}
          accept=".csv"
        >
          <Button 
            size="small" 
            type={files[type] ? "primary" : "default"}
            icon={files[type] ? <CheckCircleOutlined /> : <UploadOutlined />}
            style={{ 
              backgroundColor: files[type] ? '#00b96b' : 'transparent',
              borderColor: files[type] ? '#00b96b' : '#555'
            }}
          >
            {files[type] ? files[type].name : "Upload"}
          </Button>
        </Upload>
      </Space>
    </Card>
  );

  return (
    <div style={{ padding: '16px' }}>
      <Alert 
        message="Upload configuration CSV files to build the geometry and solve." 
        type="info" 
        showIcon 
        style={{ marginBottom: 16, backgroundColor: '#111', borderColor: '#333', color: '#aaa' }}
      />
      
      <FileCard title="1. Geometry Parameters (parameters.csv)" type="parameters" />
      <FileCard title="2. Material Properties (material.csv)" type="material" />
      <FileCard title="3. Solver Timesteps (timestep.csv)" type="timestep" />
      <FileCard title="4. Boundary Settings (setting.csv)" type="setting" />

      <Button
        type="primary"
        icon={<PlayCircleOutlined />}
        style={{ width: '100%', marginTop: 16, height: 40, fontWeight: 'bold' }}
        onClick={handleStart}
        loading={isSimulating}
        disabled={!allFilesUploaded && !isSimulating} // Disable if not all files are uploaded (for strictness)
        // For development / boilerplate testing, you might want to remove the disabled condition
      >
        RUN FEA SIMULATION
      </Button>
    </div>
  );
}
