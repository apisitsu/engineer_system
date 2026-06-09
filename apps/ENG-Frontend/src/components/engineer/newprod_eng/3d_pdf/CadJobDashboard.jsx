/**
 * CadJobDashboard — Main Page for 3D CAD PDF Generation
 * 
 * Integrates all phases:
 *   - Parameter input form (with template selection)
 *   - Job submission → BullMQ queue
 *   - Real-time progress tracking (polling)
 *   - 3D model preview (CadViewer)
 *   - Drawing board layout (DrawingBoard)
 *   - PDF generation & download
 *   - Job history table
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  ConfigProvider,
  Layout,
  Card,
  Form,
  Input,
  Button,
  Select,
  Space,
  Progress,
  Steps,
  Tabs,
  Table,
  Tag,
  Tooltip,
  Typography,
  Alert,
  Divider,
  Row,
  Col,
  Upload,
  message,
  theme
} from 'antd';
import {
  ArrowLeftOutlined,
  SendOutlined,
  FilePdfOutlined,
  DownloadOutlined,
  ReloadOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  SettingOutlined,
  InboxOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import CadViewer from './CadViewer';
import DrawingBoard from './DrawingBoard';
import useXmlParser from './hooks/useXmlParser';
import useCadJobPolling from './hooks/useCadJobPolling';
import useCadStore from '../../../../stores/cadStore';
import './CadJobDashboard.css';

const { Header, Content } = Layout;
const { Text, Title } = Typography;
const { Option } = Select;

// Pipeline steps
const PIPELINE_STEPS = [
  { title: 'Queued', icon: <ClockCircleOutlined /> },
  { title: 'CATIA Processing', icon: <SettingOutlined /> },
  { title: '3D Export', icon: <CloudUploadOutlined /> },
  { title: 'Preview Ready', icon: <EyeOutlined /> },
  { title: 'PDF Generated', icon: <FilePdfOutlined /> }
];

// Status → Step index map
const STATUS_STEP = {
  PENDING: 0,
  PROCESSING: 1,
  COMPLETED: 3,
  FAILED: -1
};

// Status tag colors
const STATUS_COLORS = {
  PENDING: 'gold',
  PROCESSING: 'blue',
  COMPLETED: 'green',
  FAILED: 'red'
};

// Job history columns
const historyColumns = [
  {
    title: 'Job ID',
    dataIndex: 'job_id',
    key: 'job_id',
    width: 100,
    render: (id) => <Text code style={{ fontSize: 11 }}>{id?.substring(0, 8)}...</Text>
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (status) => (
      <Tag color={STATUS_COLORS[status] || 'default'}>
        {status}
      </Tag>
    )
  },
  {
    title: 'Input File',
    dataIndex: 'input_file_path',
    key: 'input_file_path',
    ellipsis: true,
    render: (path) => path?.split(/[/\\]/).pop() || '-'
  },
  {
    title: 'Duration',
    dataIndex: 'catia_duration_ms',
    key: 'duration',
    width: 100,
    render: (ms) => ms ? `${(ms / 1000).toFixed(1)}s` : '-'
  },
  {
    title: 'Created',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 160,
    render: (date) => date ? new Date(date).toLocaleString() : '-'
  }
];

export default function CadJobDashboard() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('submit');
  const [showDrawingBoard, setShowDrawingBoard] = useState(false);
  const [fileList, setFileList] = useState([]);

  // Zustand store
  const {
    currentJobId,
    jobStatus,
    progress: storeProgress,
    modelUrl,
    viewportImageUrl,
    pmiData,
    pdfUrl,
    jobs,
    loading,
    error,
    submitJob,
    fetchJobResult,
    generatePdf,
    downloadPdf,
    fetchJobs,
    reset
  } = useCadStore();

  // Job polling hook
  const {
    status: polledStatus,
    progress: polledProgress,
    result: polledResult,
    isLoading: isPolling
  } = useCadJobPolling(currentJobId, {
    enabled: !!currentJobId && !['COMPLETED', 'FAILED'].includes(jobStatus),
    onComplete: (data) => {
      message.success('CAD processing completed!');
      fetchJobResult();
      setActiveTab('preview');
    },
    onFail: (errorMsg) => {
      message.error(`Job failed: ${errorMsg}`);
    }
  });

  // XML parser for metadata
  const {
    titleBlock,
    parameters: xmlParameters,
    loading: xmlLoading
  } = useXmlParser(polledResult?.output_metadata_xml, { autoFetch: false });

  // Load job history on mount
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Derive current step for progress display
  const currentStep = (() => {
    const status = polledStatus || jobStatus;
    if (!status) return -1;
    if (status === 'PROCESSING') {
      const msg = (polledProgress || storeProgress || '').toLowerCase();
      if (msg.includes('export')) return 2;
      if (msg.includes('camera') || msg.includes('viewport')) return 2;
      return 1;
    }
    return STATUS_STEP[status] ?? -1;
  })();

  // Progress percentage
  const progressPercent = (() => {
    if (!currentJobId) return 0;
    const status = polledStatus || jobStatus;
    if (status === 'COMPLETED') return 100;
    if (status === 'FAILED') return 100;
    if (status === 'PENDING') return 5;
    // Map step to percentage
    return Math.min(20 + (currentStep * 20), 90);
  })();

  // Handle form submission
  const handleSubmit = useCallback(async (values) => {
    if (fileList.length === 0) {
      message.error('Please upload at least the main CATProduct file.');
      return;
    }

    try {
      const formData = new FormData();
      
      // Append all selected files
      fileList.forEach(file => {
        // Ant Design Upload wraps files, the actual File is in originFileObj, 
        // but beforeUpload provides the raw file if we don't return false, actually we return false so it's the raw file or wrapped?
        // Using file directly or originFileObj
        formData.append('files', file.originFileObj || file);
      });

      // Append form fields
      formData.append('parameters', values.parameters || '{}');
      formData.append('exportFormat', values.exportFormat || 'both');
      formData.append('mode', values.mode || 'design_table');
      formData.append('view', values.view || 'isometric');

      await submitJob(formData);
      
      // Clear files after successful submission
      setFileList([]);
      message.info('Job submitted to queue');
      setActiveTab('progress');
    } catch (err) {
      message.error(err.message || 'Failed to submit job');
    }
  }, [submitJob, fileList]);

  // Handle PDF generation
  const handleGeneratePdf = useCallback(async () => {
    try {
      await generatePdf();
      message.success('PDF generated successfully!');
    } catch (err) {
      message.error('PDF generation failed');
    }
  }, [generatePdf]);

  // Tab items
  const tabItems = [
    {
      key: 'submit',
      label: (
        <span>
          <SendOutlined /> Submit Job
        </span>
      ),
      children: (
        <div className="dashboard-tab-content">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              exportFormat: 'both',
              mode: 'design_table',
              view: 'isometric'
            }}
          >
            <Form.Item label="Upload Project Files (Folder or Multiple Files)" required>
              <Upload.Dragger
                multiple
                directory // Allows uploading entire folders (WebKit feature)
                fileList={fileList}
                beforeUpload={(file) => {
                  setFileList((prev) => [...prev, file]);
                  return false; // Prevent automatic upload, we upload manually via Form submit
                }}
                onRemove={(file) => {
                  setFileList((prev) => prev.filter(item => item.uid !== file.uid));
                }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">Click or drag folder/files to this area to upload</p>
                <p className="ant-upload-hint">
                  Please upload the main Assembly (`_DRS01_.CATProduct`), all sub-parts (`.CATPart`), and the Design Table Excel (`.xlsx`) at the same time.
                </p>
              </Upload.Dragger>
            </Form.Item>

            <Form.Item
              name="parameters"
              label="Parameters (JSON) - Optional if using Excel"
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    // Check if there is an excel file in the fileList
                    const hasExcel = fileList.some(f => f.name && f.name.toLowerCase().endsWith('.xlsx'));
                    if (value || hasExcel) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Please provide either Parameters (JSON) or upload an Excel Design Table file'));
                  },
                }),
              ]}
            >
              <Input.TextArea
                rows={6}
                placeholder={`{\n  "W_2_2(mm)": 15.5,\n  "OD_2_2(mm)": 37.0\n}\n\n(Leave blank if only using Excel)`}
                style={{ fontFamily: 'Consolas, monospace', fontSize: 12 }}
              />
            </Form.Item>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="exportFormat" label="Export Format">
                  <Select>
                    <Option value="both">Both (STEP + 3D XML)</Option>
                    <Option value="step">STEP AP242 Only</Option>
                    <Option value="3dxml">3D XML Only</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="mode" label="Parameter Mode">
                  <Select>
                    <Option value="design_table">Design Table (Excel)</Option>
                    <Option value="direct">Direct Parameters</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="view" label="Camera View">
                  <Select>
                    <Option value="isometric">Isometric</Option>
                    <Option value="front">Front</Option>
                    <Option value="top">Top</Option>
                    <Option value="right">Right</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<SendOutlined />}
                size="large"
                block
                className="submit-btn"
              >
                Submit CAD Generation Job
              </Button>
            </Form.Item>
          </Form>
        </div>
      )
    },
    {
      key: 'progress',
      label: (
        <span>
          <LoadingOutlined spin={isPolling} /> Progress
          {currentJobId && (
            <Tag color={STATUS_COLORS[polledStatus || jobStatus]} style={{ marginLeft: 8 }}>
              {polledStatus || jobStatus || 'N/A'}
            </Tag>
          )}
        </span>
      ),
      children: (
        <div className="dashboard-tab-content">
          {!currentJobId ? (
            <Alert
              message="No Active Job"
              description="Submit a CAD generation job to track its progress here."
              type="info"
              showIcon
            />
          ) : (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* Job ID */}
              <div className="progress-job-id">
                <Text type="secondary">Job ID: </Text>
                <Text code>{currentJobId}</Text>
              </div>

              {/* Progress Bar */}
              <Progress
                percent={progressPercent}
                status={
                  (polledStatus || jobStatus) === 'FAILED' ? 'exception' :
                  (polledStatus || jobStatus) === 'COMPLETED' ? 'success' :
                  'active'
                }
                strokeColor={{
                  '0%': '#1890ff',
                  '100%': '#52c41a'
                }}
                size="default"
              />

              {/* Pipeline Steps */}
              <Steps
                current={currentStep}
                status={
                  (polledStatus || jobStatus) === 'FAILED' ? 'error' :
                  (polledStatus || jobStatus) === 'COMPLETED' ? 'finish' :
                  'process'
                }
                items={PIPELINE_STEPS}
                size="small"
              />

              {/* Progress Message */}
              <Alert
                message={polledProgress || storeProgress || 'Waiting...'}
                type={
                  (polledStatus || jobStatus) === 'FAILED' ? 'error' :
                  (polledStatus || jobStatus) === 'COMPLETED' ? 'success' :
                  'info'
                }
                showIcon
                icon={isPolling ? <LoadingOutlined spin /> : undefined}
              />

              {/* Error */}
              {error && (
                <Alert
                  message="Error"
                  description={error}
                  type="error"
                  showIcon
                />
              )}

              {/* Actions when complete */}
              {(polledStatus || jobStatus) === 'COMPLETED' && (
                <Space>
                  <Button
                    type="primary"
                    icon={<EyeOutlined />}
                    onClick={() => setActiveTab('preview')}
                  >
                    View 3D Preview
                  </Button>
                  <Button
                    icon={<FilePdfOutlined />}
                    onClick={handleGeneratePdf}
                    loading={loading}
                  >
                    Generate PDF
                  </Button>
                  {pdfUrl && (
                    <Button
                      icon={<DownloadOutlined />}
                      onClick={() => downloadPdf()}
                    >
                      Download PDF
                    </Button>
                  )}
                </Space>
              )}
            </Space>
          )}
        </div>
      )
    },
    {
      key: 'preview',
      label: (
        <span>
          <EyeOutlined /> 3D Preview
        </span>
      ),
      children: (
        <div className="dashboard-tab-content preview-tab">
          <div className="preview-controls">
            <Space>
              <Button
                type={showDrawingBoard ? 'default' : 'primary'}
                onClick={() => setShowDrawingBoard(false)}
              >
                3D Viewer
              </Button>
              <Button
                type={showDrawingBoard ? 'primary' : 'default'}
                onClick={() => setShowDrawingBoard(true)}
              >
                Drawing Board (A4)
              </Button>
              <Divider type="vertical" />
              <Button
                icon={<FilePdfOutlined />}
                onClick={handleGeneratePdf}
                loading={loading}
              >
                Generate PDF
              </Button>
              {pdfUrl && (
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => downloadPdf()}
                >
                  Download PDF
                </Button>
              )}
            </Space>
          </div>

          <div className="preview-content">
            {showDrawingBoard ? (
              <DrawingBoard
                modelUrl={modelUrl}
                viewportImageUrl={viewportImageUrl}
                pmiData={pmiData}
                titleBlockData={titleBlock}
                parameters={xmlParameters}
                size="A4"
              />
            ) : (
              <div className="standalone-viewer">
                <CadViewer
                  modelUrl={modelUrl}
                  viewportImageUrl={viewportImageUrl}
                  pmiData={pmiData}
                  style={{ width: '100%', height: '600px' }}
                />
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'history',
      label: (
        <span>
          <ClockCircleOutlined /> Job History
        </span>
      ),
      children: (
        <div className="dashboard-tab-content">
          <div style={{ marginBottom: 16 }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchJobs}
              size="small"
            >
              Refresh
            </Button>
          </div>
          <Table
            dataSource={jobs}
            columns={[
              ...historyColumns,
              {
                title: 'Action',
                key: 'action',
                width: 80,
                render: (_, record) => (
                  <Button 
                    type="primary" 
                    size="small"
                    icon={<EyeOutlined />}
                    disabled={record.status !== 'COMPLETED'}
                    onClick={() => {
                      useCadStore.setState({ 
                        currentJobId: record.job_id, 
                        jobStatus: record.status 
                      });
                      fetchJobResult(record.job_id);
                      setActiveTab('preview');
                    }}
                  >
                    View
                  </Button>
                )
              }
            ]}
            rowKey="job_id"
            size="small"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 700 }}
          />
        </div>
      )
    }
  ];

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <Layout className="cad-dashboard-layout">
        <Header className="cad-dashboard-header">
          <div className="header-left">
            <Tooltip title="Back">
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate(-1)}
                style={{ color: '#fff' }}
              />
            </Tooltip>
            <div className="header-title-group">
              <h1 className="header-title">
                <FilePdfOutlined style={{ marginRight: 8, color: '#ff6b6b' }} />
                3D CAD PDF Generator
              </h1>
              <span className="header-subtitle">
                CATIA V5-6R2023 Automation • Parameter Update • STEP/3DXML Export • PDF Drawing
              </span>
            </div>
          </div>

          {currentJobId && (
            <div className="header-status">
              <Tag color={STATUS_COLORS[polledStatus || jobStatus] || 'default'} className="status-tag">
                {polledStatus || jobStatus || 'N/A'}
              </Tag>
              <Button
                type="text"
                icon={<ReloadOutlined />}
                size="small"
                onClick={reset}
                style={{ color: 'rgba(255,255,255,0.6)' }}
              />
            </div>
          )}
        </Header>

        <Content className="cad-dashboard-content">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="large"
            className="dashboard-tabs"
          />
        </Content>
      </Layout>
    </ConfigProvider>
  );
}
