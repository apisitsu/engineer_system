import { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Typography, Tag, Badge, Button, Space,
  Descriptions, Form, Input, Select, Spin, Steps, Alert,
} from 'antd';
import {
  ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SyncOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { requestsAPI, workflowAPI } from '../api/client';

import { color } from '../constance/constance';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const STATUS_COLOR = {
  'Pending Eng Check':    'default',
  'Pending Draft Man':    'processing',
  'Pending DWG Check':    'processing',
  'Pending Eng Review':   'processing',
  'Pending Eng Approve':  'warning',
  'Pending Eng Inform':   'warning',
  'Completed & Informed': 'success',
  'Denied':               'error',
  'Denied by Approve':    'error',
};

const STAGE_STEPS = [
  'Eng Check', 'Draft Man', 'DWG Check', 'Eng Review', 'Eng Approve', 'Eng Inform',
];

function stepStatus(stage, currentStage, requestStatus) {
  const isDenied = requestStatus?.startsWith('Denied');
  const ci = STAGE_STEPS.indexOf(currentStage);
  const si = STAGE_STEPS.indexOf(stage);
  if (isDenied && si === ci) return 'error';
  if (si < ci) return 'finish';
  if (si === ci) return 'process';
  return 'wait';
}

/* ── Workflow Action Panels ── */

function EngCheckPanel({ requestId, onDone }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const onFinish = async (v) => {
    if (v.status === 'Deny' && !v.comment) {
      return Swal.fire({ icon: 'warning', title: 'Comment required when denying' });
    }
    setLoading(true);
    try {
      await workflowAPI.engCheck({ requestId, ...v });
      Swal.fire({ icon: 'success', title: 'Done', timer: 1500, showConfirmButton: false });
      onDone();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Error', text: e.response?.data?.message || 'Failed' });
    } finally { setLoading(false); }
  };
  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item name="status" label="Decision" rules={[{ required: true }]}>
            <Select placeholder="Select">
              <Option value="Approve"><CheckCircleOutlined style={{ color: '#52c41a' }} /> Approve</Option>
              <Option value="Deny"><CloseCircleOutlined style={{ color: '#ff4d4f' }} /> Deny</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item name="requestNo" label="Request No. (optional)">
            <Input placeholder="Auto-generate if blank" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="comment" label="Comment">
        <TextArea rows={3} placeholder="Required if Deny" />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={loading}
        style={{ background: color.primary, borderColor: color.primary }}>
        Submit Eng Check
      </Button>
    </Form>
  );
}

function DraftManPanel({ requestId, onDone }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const onFinish = async (v) => {
    setLoading(true);
    try {
      await workflowAPI.draftMan({ requestId, dwgFiles: v.dwgFiles || '' });
      Swal.fire({ icon: 'success', title: 'Drawing submitted', timer: 1500, showConfirmButton: false });
      onDone();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Error', text: e.response?.data?.message || 'Failed' });
    } finally { setLoading(false); }
  };
  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item name="dwgFiles" label="Drawing Files (file paths / links)">
        <TextArea rows={3} placeholder="Enter file paths or links to drawing files" />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={loading}
        style={{ background: color.primary, borderColor: color.primary }}>
        Submit Drawing
      </Button>
    </Form>
  );
}

function DwgCheckPanel({ requestId, onDone }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const onFinish = async (v) => {
    setLoading(true);
    try {
      await workflowAPI.dwgCheck({ requestId, ...v });
      Swal.fire({ icon: 'success', title: 'Done', timer: 1500, showConfirmButton: false });
      onDone();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Error', text: e.response?.data?.message || 'Failed' });
    } finally { setLoading(false); }
  };
  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item name="status" label="Decision" rules={[{ required: true }]}>
            <Select placeholder="Select">
              <Option value="Approve"><CheckCircleOutlined style={{ color: '#52c41a' }} /> Approve</Option>
              <Option value="Return"><SyncOutlined style={{ color: '#faad14' }} /> Return for Revision</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="comment" label="Comment">
        <TextArea rows={3} />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={loading}
        style={{ background: color.primary, borderColor: color.primary }}>
        Submit DWG Check
      </Button>
    </Form>
  );
}

function EngReviewPanel({ requestId, onDone }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const onFinish = async (v) => {
    setLoading(true);
    try {
      await workflowAPI.engReview({ requestId, ...v });
      Swal.fire({ icon: 'success', title: 'Review completed', timer: 1500, showConfirmButton: false });
      onDone();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Error', text: e.response?.data?.message || 'Failed' });
    } finally { setLoading(false); }
  };
  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item name="section" label="Section" rules={[{ required: true }]}>
            <Input placeholder="e.g. MTC" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item name="drawingNo" label="Drawing No." rules={[{ required: true }]}>
            <Input placeholder="e.g. DWG-2025-001" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item name="noOfDwg" label="No. of DWG" rules={[{ required: true }]}>
            <Input type="number" min={1} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item name="sparePartType" label="Spare Part Type">
            <Input placeholder="Optional" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item name="general" label="General">
            <Input placeholder="Optional" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item name="machinePart" label="Machine Part">
            <Input placeholder="Optional" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item name="gaugeType" label="Gauge Type">
            <Input placeholder="Optional" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={16}>
          <Form.Item name="attachFiles" label="Attach Files">
            <Input placeholder="Optional: file paths or links" />
          </Form.Item>
        </Col>
      </Row>
      <Button type="primary" htmlType="submit" loading={loading}
        style={{ background: color.primary, borderColor: color.primary }}>
        Submit Eng Review
      </Button>
    </Form>
  );
}

function EngApprovePanel({ requestId, onDone }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const onFinish = async (v) => {
    setLoading(true);
    try {
      await workflowAPI.engApprove({ requestId, ...v });
      Swal.fire({ icon: 'success', title: 'Done', timer: 1500, showConfirmButton: false });
      onDone();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Error', text: e.response?.data?.message || 'Failed' });
    } finally { setLoading(false); }
  };
  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item name="judgement" label="Judgement" rules={[{ required: true }]}>
            <Select placeholder="Select">
              <Option value="Approve"><CheckCircleOutlined style={{ color: '#52c41a' }} /> Approve</Option>
              <Option value="Deny"><CloseCircleOutlined style={{ color: '#ff4d4f' }} /> Deny</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="comment" label="Comment">
        <TextArea rows={3} />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={loading}
        style={{ background: color.primary, borderColor: color.primary }}>
        Submit Approval
      </Button>
    </Form>
  );
}

function EngInformPanel({ requestId, onDone }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const onFinish = async (v) => {
    setLoading(true);
    try {
      await workflowAPI.engInform({ requestId, ...v });
      Swal.fire({ icon: 'success', title: 'Requester notified!', timer: 1500, showConfirmButton: false });
      onDone();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Error', text: e.response?.data?.message || 'Failed' });
    } finally { setLoading(false); }
  };
  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item name="cost" label="Cost">
            <Input placeholder="Optional" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item name="evidence" label="Evidence">
            <Input placeholder="Optional" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item name="attachFiles" label="Attach Files">
            <Input placeholder="Optional: file paths or links" />
          </Form.Item>
        </Col>
      </Row>
      <Button type="primary" htmlType="submit" loading={loading}
        style={{ background: color.primary, borderColor: color.primary }}>
        Inform Requester
      </Button>
    </Form>
  );
}

/* ── Main Page ── */

export default function RequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await requestsAPI.get(id);
      setRequest(res.data.data);
    } catch {
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  if (!request) return <Alert type="error" message="Request not found" style={{ margin: 20 }} />;

  const isDone = request.status === 'Completed & Informed';
  const isDenied = request.status?.startsWith('Denied');
  const currentStageIdx = STAGE_STEPS.indexOf(request.currentStage);

  const stepsItems = STAGE_STEPS.map((s, i) => ({
    title: s,
    status: stepStatus(s, request.currentStage, request.status),
    description: (() => {
      if (s === 'Eng Check' && request.engCheck)
        return <Text style={{ fontSize: 11 }} type="secondary">{request.engCheck.checkerName} · {request.engCheck.status}</Text>;
      if (s === 'Draft Man' && request.draftMan)
        return <Text style={{ fontSize: 11 }} type="secondary">{request.draftMan.draftmanName}</Text>;
      if (s === 'DWG Check' && request.dwgCheck)
        return <Text style={{ fontSize: 11 }} type="secondary">{request.dwgCheck.checkerName} · {request.dwgCheck.status}</Text>;
      if (s === 'Eng Review' && request.engReview)
        return <Text style={{ fontSize: 11 }} type="secondary">{request.engReview.reviewerName} · DWG: {request.engReview.drawingNo}</Text>;
      if (s === 'Eng Approve' && request.engApprove)
        return <Text style={{ fontSize: 11 }} type="secondary">{request.engApprove.approverName} · {request.engApprove.judgement}</Text>;
      if (s === 'Eng Inform' && request.engInform)
        return <Text style={{ fontSize: 11 }} type="secondary">Cost: {request.engInform.cost || '-'}</Text>;
      return null;
    })(),
  }));

  const renderActionPanel = () => {
    if (isDone || isDenied) return null;
    switch (request.currentStage) {
      case 'Eng Check':  return <EngCheckPanel  requestId={request.id} onDone={fetch} />;
      case 'Draft Man':  return <DraftManPanel   requestId={request.id} onDone={fetch} />;
      case 'DWG Check':  return <DwgCheckPanel   requestId={request.id} onDone={fetch} />;
      case 'Eng Review': return <EngReviewPanel  requestId={request.id} onDone={fetch} />;
      case 'Eng Approve':return <EngApprovePanel requestId={request.id} onDone={fetch} />;
      case 'Eng Inform': return <EngInformPanel  requestId={request.id} onDone={fetch} />;
      default: return null;
    }
  };

  const actionPanel = renderActionPanel();

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/drawing-request')}>Back</Button>
        <Title level={4} style={{ margin: 0, color: color.primary }}>
          {request.requestItem}
          {request.requestNo && <Text style={{ marginLeft: 8, fontSize: 14, color: '#888' }}>#{request.requestNo}</Text>}
        </Title>
        <Badge status={STATUS_COLOR[request.status] || 'default'} text={request.status} />
        <Button icon={<ReloadOutlined />} size="small" onClick={fetch} />
      </Space>

      {/* Request Info */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} bordered>
          <Descriptions.Item label="Stage">
            <Tag color="#836953">{request.currentStage}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Department">{request.department}</Descriptions.Item>
          <Descriptions.Item label="Work Center">{request.workCenter} {request.workCenterName && `— ${request.workCenterName}`}</Descriptions.Item>
          <Descriptions.Item label="Requester">{request.requester || '-'}</Descriptions.Item>
          <Descriptions.Item label="Type">{request.typeOfRequest}</Descriptions.Item>
          <Descriptions.Item label="Category">{request.category}</Descriptions.Item>
          <Descriptions.Item label="Machine No.">{request.machineNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="Machine Name">{request.machineName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Due Date">
            {request.reqDueDate ? new Date(request.reqDueDate).toLocaleDateString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Drawing Required">{request.drawingRequired ? 'Yes' : 'No'}</Descriptions.Item>
          {request.drawingRequired && (
            <Descriptions.Item label="Type of Drawing">{request.typeOfDrawing || '-'}</Descriptions.Item>
          )}
          <Descriptions.Item label="Created">{new Date(request.createdAt).toLocaleDateString()}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" title="Title / Detail" style={{ marginBottom: 12 }}>
        <Text strong>{request.title}</Text>
        {request.detail && <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', color: '#555' }}>{request.detail}</div>}
        {request.attachments && (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Attachments: {request.attachments}</Text>
          </div>
        )}
      </Card>

      {/* Workflow Steps */}
      <Card size="small" title="Workflow Progress" style={{ marginBottom: 12 }}>
        <Steps
          size="small"
          current={isDenied ? currentStageIdx : currentStageIdx}
          items={stepsItems}
          style={{ overflowX: 'auto' }}
        />
      </Card>

      {/* Eng Review Details */}
      {request.engReview && (
        <Card size="small" title="Eng Review Result" style={{ marginBottom: 12 }}>
          <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} bordered>
            <Descriptions.Item label="Drawing No.">{request.engReview.drawingNo}</Descriptions.Item>
            <Descriptions.Item label="No. of DWG">{request.engReview.noOfDwg}</Descriptions.Item>
            <Descriptions.Item label="Section">{request.engReview.section}</Descriptions.Item>
            {request.engReview.sparePartType && <Descriptions.Item label="Spare Part Type">{request.engReview.sparePartType}</Descriptions.Item>}
            {request.engReview.general && <Descriptions.Item label="General">{request.engReview.general}</Descriptions.Item>}
            {request.engReview.machinePart && <Descriptions.Item label="Machine Part">{request.engReview.machinePart}</Descriptions.Item>}
            {request.engReview.gaugeType && <Descriptions.Item label="Gauge Type">{request.engReview.gaugeType}</Descriptions.Item>}
          </Descriptions>
        </Card>
      )}

      {/* Denied reason */}
      {isDenied && (
        <Alert
          type="error"
          showIcon
          message="Request Denied"
          description={
            request.engCheck?.comment || request.engApprove?.comment || 'No comment provided'
          }
          style={{ marginBottom: 12 }}
        />
      )}

      {/* Action Panel */}
      {actionPanel && (
        <Card
          size="small"
          title={`Action: ${request.currentStage}`}
          style={{ borderColor: color.primary, borderTop: `3px solid ${color.primary}` }}
        >
          {actionPanel}
        </Card>
      )}

      {isDone && (
        <Alert type="success" showIcon
          message="Completed & Informed"
          description={`This request has been completed and the requester has been notified.${request.engInform?.cost ? ` Cost: ${request.engInform.cost}` : ''}`}
        />
      )}
    </div>
  );
}
