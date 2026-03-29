import React, { useState, useEffect } from 'react';
import {
  Modal, Form, Input, Select, Button, Row, Col, Descriptions,
  Tag, Divider, Space, Steps, Timeline, Typography, Alert, message, Radio
} from 'antd';
import {
  EditOutlined, SaveOutlined, CloseOutlined, DeleteOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SendOutlined,
  FileTextOutlined, AuditOutlined, UserOutlined
} from '@ant-design/icons';
import { httpClient as axios } from '../../../../../utils/HttpClient';
import moment from 'moment';
import { server } from '../../../../../constance/constance';
import { useAuthStore } from '../../../../../stores/authStore';

const { Option } = Select;
const { TextArea } = Input;
const { Text, Title } = Typography;

// ── Stage config ──────────────────────────────────────────────────────────────
const STAGES = [
  { key: 'Eng Check',   label: 'Eng Check',   stage: 'eng_check',   icon: <AuditOutlined /> },
  { key: 'Draft Man',   label: 'Draft Man',   stage: 'draft_man',   icon: <FileTextOutlined /> },
  { key: 'DWG Check',   label: 'DWG Check',   stage: 'dwg_check',   icon: <AuditOutlined /> },
  { key: 'Eng Review',  label: 'Eng Review',  stage: 'eng_review',  icon: <UserOutlined /> },
  { key: 'Eng Approve', label: 'Eng Approve', stage: 'eng_approve', icon: <CheckCircleOutlined /> },
  { key: 'Eng Inform',  label: 'Eng Inform',  stage: 'eng_inform',  icon: <SendOutlined /> },
];

const STAGE_COLOR = {
  'Pending Eng Check':   'orange',
  'Pending Draft Man':   'blue',
  'Pending DWG Check':   'blue',
  'Pending Eng Review':  'purple',
  'Pending Eng Approve': 'gold',
  'Pending Eng Inform':  'cyan',
  'Completed & Informed':'green',
  'Denied':              'red',
  'Denied by Approve':   'red',
};

const WORKFLOW_LABELS = {
  eng_check: 'Eng Check', draft_man: 'Draft Man', dwg_check: 'DWG Check',
  eng_review: 'Eng Review', eng_approve: 'Eng Approve', eng_inform: 'Eng Inform',
};

// ── Stage Action Panel ────────────────────────────────────────────────────────
const StageActionPanel = ({ stage, request, onSubmit, loading }) => {
  const [form] = Form.useForm();
  const [selectedDecision, setSelectedDecision] = useState(null);

  const isRegistDrawing = request?.type_of_request === 'Regist Drawing';

  const handleDecisionSubmit = async () => {
    try {
      const vals = await form.validateFields();
      onSubmit({ decision: vals.decision, ...vals });
    } catch (_) {}
  };

  const handleSubmit = async () => {
    try {
      const vals = await form.validateFields();
      onSubmit({ decision: 'submit', ...vals });
    } catch (_) {}
  };

  if (!stage) return null;

  // Approve / Deny radio pattern (Eng Check, DWG Check, Eng Approve)
  const ApproveDenyForm = ({ extraBefore, approveDenyLabels }) => (
    <>
      {extraBefore}
      <Form.Item
        label="Status"
        name="decision"
        rules={[{ required: true, message: 'Please select Approve or Deny' }]}
      >
        <Radio.Group onChange={(e) => setSelectedDecision(e.target.value)}>
          <Space direction="vertical">
            <Radio value="approve">
              <Text style={{ color: '#389e0d', fontWeight: 500 }}>
                {approveDenyLabels?.[0] || 'Approve'}
              </Text>
            </Radio>
            <Radio value="deny">
              <Text style={{ color: '#cf1322', fontWeight: 500 }}>
                {approveDenyLabels?.[1] || 'Deny'}
              </Text>
            </Radio>
          </Space>
        </Radio.Group>
      </Form.Item>
      {selectedDecision === 'deny' && (
        <Form.Item
          label="Comment"
          name="comment"
          rules={[{ required: true, message: 'Comment is required when Deny' }]}
        >
          <TextArea rows={3} placeholder="Reason for denial..." />
        </Form.Item>
      )}
      {selectedDecision === 'approve' && (
        <Form.Item label="Comment" name="comment">
          <TextArea rows={2} />
        </Form.Item>
      )}
      <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={handleDecisionSubmit}>
        Submit
      </Button>
    </>
  );

  return (
    <Form form={form} layout="vertical" style={{ marginTop: 8 }}>

      {/* Eng Check */}
      {stage === 'Eng Check' && (
        <ApproveDenyForm
          extraBefore={
            <Form.Item
              label="Assign Request No."
              name="request_no"
              rules={[{
                validator: (_, val) => {
                  const dec = form.getFieldValue('decision');
                  if (dec === 'approve' && !val) return Promise.reject('Required when Approve');
                  return Promise.resolve();
                }
              }]}
            >
              <Input placeholder="e.g. DWG-2024-001" />
            </Form.Item>
          }
        />
      )}

      {/* Draft Man */}
      {stage === 'Draft Man' && (
        <>
          <Form.Item label="Drawing File(s) URL / Path" name="dwg_files">
            <Input placeholder="\\server\drawings\DWG-001.pdf" />
          </Form.Item>
          <Form.Item label="Comment" name="comment">
            <TextArea rows={2} />
          </Form.Item>
          <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={handleSubmit}>
            Submit Drawing
          </Button>
        </>
      )}

      {/* DWG Check */}
      {stage === 'DWG Check' && (
        <ApproveDenyForm
          approveDenyLabels={['Approve — Drawing is correct', 'Deny — Need revision']}
        />
      )}

      {/* Eng Review */}
      {stage === 'Eng Review' && (
        <>
          <Form.Item label="Section" name="section" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="Section name" />
          </Form.Item>

          {/* Classification fields — Regist Drawing only */}
          {isRegistDrawing && (
            <>
              <Form.Item label="General (01)" name="review_general" rules={[{ required: true, message: 'Required' }]}>
                <Radio.Group>
                  <Space wrap>
                    <Radio value="Single part">Single part</Radio>
                    <Radio value="Assembly part">Assembly part</Radio>
                    <Radio value="Other">Other</Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>
              <Form.Item label="Machine part (02)" name="review_machine_part" rules={[{ required: true, message: 'Required' }]}>
                <Radio.Group>
                  <Space wrap>
                    <Radio value="Maintenance">Maintenance</Radio>
                    <Radio value="Improvement">Improvement</Radio>
                    <Radio value="Other">Other</Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>
              <Form.Item label="Gauge type (03)" name="review_gauge_type" rules={[{ required: true, message: 'Required' }]}>
                <Radio.Group>
                  <Space wrap>
                    <Radio value="Inspection">Inspection</Radio>
                    <Radio value="Sorting">Sorting</Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>
            </>
          )}

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="No. of DWG." name="no_of_dwg" rules={[{ required: true, message: 'Required' }]}>
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Drawing No." name="drawing_no" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g. ENG-DWG-2024-001" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Attach Files (URL / Path)" name="attach_files">
            <Input placeholder="File path or URL" />
          </Form.Item>
          <Form.Item label="Comment" name="comment">
            <TextArea rows={2} />
          </Form.Item>
          <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={handleSubmit}>
            Submit Review
          </Button>
        </>
      )}

      {/* Eng Approve */}
      {stage === 'Eng Approve' && (
        <ApproveDenyForm
          approveDenyLabels={['Approve — Request is completed', 'Deny — Need more work']}
        />
      )}

      {/* Eng Inform */}
      {stage === 'Eng Inform' && (
        <>
          {request?.requester_email && (
            <Alert
              type="info"
              showIcon={false}
              style={{ marginBottom: 12 }}
              message={<Text><strong>Email will be sent to:</strong> {request.requester_email}</Text>}
            />
          )}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Cost (if applicable)" name="cost">
                <Input placeholder="e.g. 5,000 THB or N/A" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Evidence / Notes" name="evidence">
                <Input placeholder="Evidence reference or note" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Inform Detail" name="inform_note">
            <TextArea rows={2} placeholder="Additional notes to requester..." />
          </Form.Item>
          <Button type="primary" icon={<CheckCircleOutlined />} loading={loading} onClick={handleSubmit}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}>
            Mark as Completed & Informed
          </Button>
        </>
      )}
    </Form>
  );
};

// ── Main Modal ────────────────────────────────────────────────────────────────
const RequestDetailsModal = ({ visible, onClose, request, isEditing, onSave, onDelete, onEdit, onActionDone }) => {
  const [form] = Form.useForm();
  const [localIsEditing, setLocalIsEditing] = useState(isEditing);
  const [actionLoading, setActionLoading] = useState(false);
  const userName = useAuthStore(state => state.userName);

  useEffect(() => { setLocalIsEditing(isEditing); }, [isEditing]);

  useEffect(() => {
    if (request && visible) {
      form.setFieldsValue({
        ...request,
        req_due_date: request.req_due_date ? moment(request.req_due_date).format('YYYY-MM-DD') : null
      });
    }
  }, [request, visible, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      onSave(values);
    } catch (_) {}
  };

  const handleCancel = () => {
    if (localIsEditing && request && !request.id) {
      onClose();
    } else {
      setLocalIsEditing(false);
      form.setFieldsValue(request);
    }
  };

  const handleAction = async ({ decision, ...extra }) => {
    const stageConfig = STAGES.find(s => s.key === request?.current_stage);
    if (!stageConfig) return;

    const {
      comment, request_no, dwg_files, drawing_no, no_of_dwg, section, attach_files, inform_note,
      cost, evidence, review_general, review_machine_part, review_gauge_type
    } = extra;
    const extraData = {
      request_no, dwg_files, drawing_no, no_of_dwg, section, attach_files,
      inform_note, cost, evidence, review_general, review_machine_part, review_gauge_type, comment
    };

    setActionLoading(true);
    try {
      await axios.post(`${server.MTC_TOOL_REQUESTS}/${request.id}/action`, {
        stage: stageConfig.stage,
        decision,
        comment,
        extra: extraData,
        action_by: userName,
      });
      message.success(`${stageConfig.label} ${decision} submitted`);
      onActionDone?.();
      onClose();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to submit action');
    } finally {
      setActionLoading(false);
    }
  };

  if (!request) return null;

  const isNewRequest = !request.id;
  const isDone = ['Completed & Informed', 'Denied', 'Denied by Approve', 'Complete'].includes(request.status);
  const currentStageConfig = STAGES.find(s => s.key === request.current_stage);
  const workflow = request.workflow || [];

  // Steps progress
  const currentStepIdx = STAGES.findIndex(s => s.key === request.current_stage);
  const stepStatus = isDone && request.status?.includes('Denied') ? 'error' : undefined;

  return (
    <Modal
      title={
        <Space>
          {isNewRequest ? <FileTextOutlined /> : <AuditOutlined />}
          <span style={{ fontWeight: 600 }}>
            {isNewRequest ? 'Create New DWG Request' : (request.request_item || request.req_no || `#${request.id}`)}
          </span>
          {!isNewRequest && (
            <Tag color={STAGE_COLOR[request.status] || 'default'}>{request.status}</Tag>
          )}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={960}
      footer={
        <Space>
          {!isNewRequest && !localIsEditing && !isDone && (
            <Button icon={<EditOutlined />} onClick={() => { setLocalIsEditing(true); onEdit(); }}>
              Edit
            </Button>
          )}
          {!isNewRequest && !localIsEditing && (
            <Button danger icon={<DeleteOutlined />} onClick={() => onDelete(request.id)}>
              Delete
            </Button>
          )}
          {localIsEditing && (
            <>
              <Button icon={<CloseOutlined />} onClick={handleCancel}>Cancel</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>Save</Button>
            </>
          )}
          {!localIsEditing && <Button onClick={onClose}>Close</Button>}
        </Space>
      }
    >
      {localIsEditing || isNewRequest ? (
        // ── Edit / Create Form ─────────────────────────────────────────────
        <Form form={form} layout="vertical" initialValues={request}>
          <Divider orientation="left">Requester Information</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Requester" name="requester" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Email" name="requester_email">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Department" name="department" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Work Center" name="work_center" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Work Center Name" name="work_center_name">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Request Details</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Type of Request" name="type_of_request" rules={[{ required: true }]}>
                <Select>
                  <Option value="Regist Drawing">Regist Drawing</Option>
                  <Option value="Draft Drawing">Draft Drawing</Option>
                  <Option value="3D Print">3D Print</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Category" name="category" rules={[{ required: true }]}>
                <Select>
                  <Option value="Machine part">Machine part</Option>
                  <Option value="Gauge">Gauge</Option>
                  <Option value="Other">Other</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Drawing Required" name="drawing_required">
                <Select>
                  <Option value="With Drawing">With Drawing</Option>
                  <Option value="Without Drawing">Without Drawing</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Type of Drawing" name="type_of_drawing">
                <Select>
                  <Option value="Copy Drawing">Copy Drawing</Option>
                  <Option value="Remake Drawing">Remake Drawing</Option>
                  <Option value="New Design">New Design</Option>
                  <Option value="Modify Drawing">Modify Drawing</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Title" name="title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Detail" name="detail" rules={[{ required: true }]}>
            <TextArea rows={4} />
          </Form.Item>

          <Divider orientation="left">Machine Information (Optional)</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Machine No." name="machine_no"><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Machine Name" name="machine_name"><Input /></Form.Item>
            </Col>
          </Row>
        </Form>
      ) : (
        // ── View Mode ──────────────────────────────────────────────────────
        <div>
          {/* Progress Steps */}
          <Steps
            size="small"
            current={isDone && request.status?.includes('Denied') ? currentStepIdx : (isDone ? STAGES.length : currentStepIdx)}
            status={stepStatus}
            items={STAGES.map(s => ({ title: s.label, icon: s.icon }))}
            style={{ marginBottom: 20 }}
          />

          {/* Request Info */}
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="Request Item">
              <Text strong>{request.request_item}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Request No.">
              {request.req_no !== request.request_item ? <Text strong style={{ color: '#1890ff' }}>{request.req_no}</Text> : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Requester">{request.requester}</Descriptions.Item>
            <Descriptions.Item label="Department">{request.department}</Descriptions.Item>
            <Descriptions.Item label="Work Center">{request.work_center} {request.work_center_name ? `(${request.work_center_name})` : ''}</Descriptions.Item>
            <Descriptions.Item label="Due Date">
              <Text type={moment(request.req_due_date).isBefore(moment()) && !isDone ? 'danger' : undefined}>
                {request.req_due_date ? moment(request.req_due_date).format('DD/MM/YYYY') : '-'}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Type">{request.type_of_request}</Descriptions.Item>
            <Descriptions.Item label="Category">{request.category}</Descriptions.Item>
            <Descriptions.Item label="Drawing Required">{request.drawing_required || '-'}</Descriptions.Item>
            <Descriptions.Item label="Type of Drawing">{request.type_of_drawing || '-'}</Descriptions.Item>
            <Descriptions.Item label="Machine">{request.machine_no ? `${request.machine_no} ${request.machine_name || ''}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="Created">{moment(request.created_at).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="Title" span={2}><Text strong>{request.title}</Text></Descriptions.Item>
            <Descriptions.Item label="Detail" span={2}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{request.detail}</div>
            </Descriptions.Item>
          </Descriptions>

          {/* Workflow History */}
          {workflow.length > 0 && (
            <>
              <Divider orientation="left">Workflow History</Divider>
              <Timeline
                items={workflow.map(w => {
                  const isApprove = w.action_type === 'approve' || w.action_type === 'submit';
                  const extra = w.extra_data || {};
                  return {
                    color: isApprove ? 'green' : w.action_type === 'deny' ? 'red' : 'blue',
                    dot: isApprove ? <CheckCircleOutlined style={{ color: 'green' }} /> : undefined,
                    children: (
                      <div>
                        <Space wrap>
                          <Text strong>{WORKFLOW_LABELS[w.stage_name] || w.stage_name}</Text>
                          <Tag color={isApprove ? 'green' : 'red'}>{w.action_type?.toUpperCase()}</Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {moment(w.action_date).format('DD/MM/YYYY HH:mm')}
                          </Text>
                          <Text type="secondary">by {w.action_by}</Text>
                        </Space>
                        {w.comment && <div><Text type="secondary">Comment: {w.comment}</Text></div>}
                        {extra.request_no && <div><Text type="secondary">Request No: {extra.request_no}</Text></div>}
                        {extra.drawing_no && <div><Text type="secondary">Drawing No: {extra.drawing_no}</Text></div>}
                        {extra.dwg_files && <div><Text type="secondary">Files: {extra.dwg_files}</Text></div>}
                      </div>
                    )
                  };
                })}
              />
            </>
          )}

          {/* Action Panel for current stage */}
          {!isDone && currentStageConfig && (
            <>
              <Divider orientation="left">
                <Space>
                  <Text strong>Action: {currentStageConfig.label}</Text>
                  <Tag color="blue">Pending</Tag>
                </Space>
              </Divider>
              <Alert
                type="info"
                showIcon
                message={`This request is waiting for ${currentStageConfig.label} action.`}
                style={{ marginBottom: 16 }}
              />
              <StageActionPanel
                stage={request.current_stage}
                request={request}
                onSubmit={handleAction}
                loading={actionLoading}
              />
            </>
          )}

          {isDone && (
            <Alert
              type={request.status?.includes('Denied') ? 'error' : 'success'}
              showIcon
              message={request.status}
              style={{ marginTop: 16 }}
            />
          )}
        </div>
      )}
    </Modal>
  );
};

export default RequestDetailsModal;
