import React, { useState, useEffect } from 'react';
import {
  Modal, Form, Input, Select, Button, Row, Col, Descriptions,
  Tag, Divider, Space, Steps, Timeline, Typography, Alert, message, Radio, Upload
} from 'antd';
import {
  EditOutlined, SaveOutlined, CloseOutlined, DeleteOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SendOutlined,
  FileTextOutlined, AuditOutlined, UserOutlined, UploadOutlined
} from '@ant-design/icons';
import { httpClient as axios } from '../../../../../utils/HttpClient';
import moment from 'moment';
import { server } from '../../../../../constance/constance';
import { useAuthStore } from '../../../../../stores/authStore';
import { 
    WORKFLOW_STAGES, 
    STAGE_LABELS, 
    WORKFLOW_STATUS, 
    STATUS_COLORS,
    REQUEST_TYPES,
    CATEGORIES,
    DRAWING_REQUIRED,
    DRAWING_TYPES,
    ACTION_TYPES,
    isDoneStatus,
    isDeniedStatus,
    getDefaultRequestTemplate,
} from '../../../../../constants/workflowConstants';

const { Option } = Select;
const { TextArea } = Input;
const { Text, Title } = Typography;

// ── Stage config ──────────────────────────────────────────────────────────────
const STAGES = [
  { key: 'Eng Check',   label: 'Eng Check',   stage: WORKFLOW_STAGES.ENG_CHECK,   icon: <AuditOutlined /> },
  { key: 'Draft Man',   label: 'Draft Man',   stage: WORKFLOW_STAGES.DRAFT_MAN,   icon: <FileTextOutlined /> },
  { key: 'DWG Check',   label: 'DWG Check',   stage: WORKFLOW_STAGES.DWG_CHECK,   icon: <AuditOutlined /> },
  { key: 'Eng Review',  label: 'Eng Review',  stage: WORKFLOW_STAGES.ENG_REVIEW,  icon: <UserOutlined /> },
  { key: 'Eng Approve', label: 'Eng Approve', stage: WORKFLOW_STAGES.ENG_APPROVE, icon: <CheckCircleOutlined /> },
  { key: 'Eng Inform',  label: 'Eng Inform',  stage: WORKFLOW_STAGES.ENG_INFORM,  icon: <SendOutlined /> },
];

const STAGE_COLOR = STATUS_COLORS;

const WORKFLOW_LABELS = {
  [WORKFLOW_STAGES.ENG_CHECK]: 'Eng Check', 
  [WORKFLOW_STAGES.DRAFT_MAN]: 'Draft Man', 
  [WORKFLOW_STAGES.DWG_CHECK]: 'DWG Check',
  [WORKFLOW_STAGES.ENG_REVIEW]: 'Eng Review', 
  [WORKFLOW_STAGES.ENG_APPROVE]: 'Eng Approve', 
  [WORKFLOW_STAGES.ENG_INFORM]: 'Eng Inform',
};

// ── Stage Action Panel ────────────────────────────────────────────────────────
const stripFilePrefix = (p) => {
  const raw = p.split('/').pop(); // e.g. "37_1717000000000_drawing.pdf"
  const parts = raw.split('_');
  // format: {id}_{timestamp}_{originalname} — ตัด 2 ส่วนแรกออก
  return parts.length > 2 ? parts.slice(2).join('_') : raw;
};

const FileLinks = ({ paths, names, label }) => {
  if (!paths?.length) return null;
  // Use server API URL from config instead of hardcoded localhost
  const baseUrl = server.API_URL || 'http://localhost:2005';
  return (
    <div style={{ marginBottom: 12 }}>
      <Text strong>{label}: </Text>
      <Space wrap>
        {paths.map((p, i) => (
          <a key={i} href={`${baseUrl}${p}`} target="_blank" rel="noreferrer">
            {names?.[i] || stripFilePrefix(p)}
          </a>
        ))}
      </Space>
    </div>
  );
};

const StageActionPanel = ({ stage, request, workflow, onSubmit, loading }) => {
  const [form] = Form.useForm();
  const [selectedDecision, setSelectedDecision] = useState(null);

  const isRegistDrawing = request?.type_of_request === 'Regist Drawing';

  const findLastStep = (stageName) => {
    const list = workflow || [];
    return list.findLast?.(w => w.stage_name === stageName) || [...list].reverse().find(w => w.stage_name === stageName);
  };

  // ไฟล์จาก Draft Man (สำหรับ DWG Check, Eng Review)
  const draftManStep    = findLastStep('draft_man');
  const draftManFiles      = draftManStep?.extra_data?.dwg_file_paths || [];
  const draftManFileNames  = draftManStep?.extra_data?.dwg_file_names || [];

  // ไฟล์จาก Eng Review (สำหรับ Eng Approve)
  const engReviewStep      = findLastStep('eng_review');
  const reviewFiles        = engReviewStep?.extra_data?.review_file_paths || [];
  const reviewFileNames    = engReviewStep?.extra_data?.review_file_names || [];

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
          <Form.Item
            label="แนบไฟล์ Drawing"
            name="dwg_file"
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
          >
            <Upload beforeUpload={() => false} multiple maxCount={10} accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg">
              <Button icon={<UploadOutlined />}>เลือกไฟล์ (PDF / DWG / DXF / Image)</Button>
            </Upload>
          </Form.Item>
          <Form.Item label="Drawing File Path (optional)" name="dwg_files">
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
        <>
          <FileLinks paths={draftManFiles} names={draftManFileNames} label="ไฟล์จาก Draft Man" />
          <ApproveDenyForm
            approveDenyLabels={['Approve — Drawing is correct', 'Deny — Need revision']}
          />
        </>
      )}

      {/* Eng Review */}
      {stage === 'Eng Review' && (
        <>
          <FileLinks paths={draftManFiles} names={draftManFileNames} label="ไฟล์จาก Draft Man" />
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
          <Form.Item
            label="แนบไฟล์"
            name="review_file"
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
          >
            <Upload beforeUpload={() => false} multiple maxCount={10} accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg">
              <Button icon={<UploadOutlined />}>เลือกไฟล์ (PDF / DWG / DXF / Image)</Button>
            </Upload>
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
        <>
          <FileLinks paths={reviewFiles} names={reviewFileNames} label="ไฟล์จาก Eng Review" />
          <ApproveDenyForm
            approveDenyLabels={['Approve — Request is completed', 'Deny — Need more work']}
          />
        </>
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
          <FileLinks paths={reviewFiles} names={reviewFileNames} label="ไฟล์ที่จะส่งให้ Requestor (Eng Review)" />
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
  const [wcCodes, setWCCodes] = useState([]);
  const [wcLoading, setWCLoading] = useState(false);
  const [permissions, setPermissions] = useState({});
  const userName = useAuthStore(state => state.userName);
  const userInfo = useAuthStore(state => state.userInfo);
  const userRole = useAuthStore(state => state.userRole);
  const userDepartment = useAuthStore(state => state.userDepartment);
  const userCode = userInfo?.u_code || '';        // e.g. "apisit.su" หรือ "LE485"
  const userEmail = userInfo?.gmail_email || userInfo?.email || '';

  useEffect(() => { setLocalIsEditing(isEditing); }, [isEditing]);

  useEffect(() => {
    if (visible) {
      fetchWCCodes();
      axios.get(server.MTC_TOOL_REQUEST_PERMISSIONS)
        .then(({ data }) => setPermissions(data.data || {}))
        .catch(() => {});
    }
  }, [visible]);

  const fetchWCCodes = async () => {
    setWCLoading(true);
    try {
      console.log('🔄 Fetching Work Centers from:', server.MASTER_WC);
      const { data } = await axios.get(server.MASTER_WC);
      console.log('✅ Work Centers received:', data.data);
      setWCCodes(data.data || []);
    } catch (error) {
      console.error('❌ Error fetching WC codes:', error);
    } finally {
      setWCLoading(false);
    }
  };

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

  const onWCChange = (value) => {
    const selectedWC = wcCodes.find(wc => wc.code === value);
    if (selectedWC) {
      form.setFieldsValue({ work_center_name: selectedWC.department || '' });
    }
  };

  const handleAction = async ({ decision, ...extra }) => {
    const stageConfig = STAGES.find(s => s.key === request?.current_stage);
    if (!stageConfig) return;

    const {
      comment, request_no, dwg_files, dwg_file, review_file, drawing_no, no_of_dwg, section,
      inform_note, cost, evidence, review_general, review_machine_part, review_gauge_type
    } = extra;
    const extraData = {
      request_no, dwg_files, drawing_no, no_of_dwg, section,
      inform_note, cost, evidence, review_general, review_machine_part, review_gauge_type, comment,
      // แนบ review files ไปกับ eng_inform เพื่อส่งใน email
      ...(stageConfig.stage === WORKFLOW_STAGES.ENG_INFORM && (() => {
        const wf = request.workflow || [];
        const reviewStep = wf.findLast?.(w => w.stage_name === WORKFLOW_STAGES.ENG_REVIEW)
          || [...wf].reverse().find(w => w.stage_name === WORKFLOW_STAGES.ENG_REVIEW);
        const paths = reviewStep?.extra_data?.review_file_paths || [];
        const names = reviewStep?.extra_data?.review_file_names || [];
        return paths.length > 0 ? { attached_file_paths: paths, attached_file_names: names } : {};
      })()),
    };

    // รวมไฟล์จากทุก stage ที่มี upload
    const draftFiles  = dwg_file?.filter(f => f.originFileObj) || [];
    const reviewFiles = review_file?.filter(f => f.originFileObj) || [];
    const allFiles    = [...draftFiles, ...reviewFiles];
    const fileKey     = reviewFiles.length > 0 ? 'review_files' : 'dwg_files';
    const useFormData = allFiles.length > 0;

    setActionLoading(true);
    try {
      if (useFormData) {
        const formData = new FormData();
        formData.append('stage', stageConfig.stage);
        formData.append('decision', decision);
        formData.append('comment', comment || '');
        formData.append('extra', JSON.stringify(extraData));
        formData.append('action_by', userName);
        formData.append('action_by_email', userEmail);
        formData.append('user_department', userDepartment);
        formData.append('user_code', userCode);
        allFiles.forEach(f => formData.append(fileKey, f.originFileObj));
        await axios.post(`${server.MTC_TOOL_REQUESTS}/${request.id}/action`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await axios.post(`${server.MTC_TOOL_REQUESTS}/${request.id}/action`, {
          stage: stageConfig.stage,
          decision,
          comment,
          extra: extraData,
          action_by: userName,
          action_by_email: userEmail,
          user_department: userDepartment,
          user_code: userCode,
        });
      }
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
  const isDone = isDoneStatus(request.status);
  const currentStageConfig = STAGES.find(s => s.key === request.current_stage);

  // ตรวจสิทธิ์ — AD department bypass ทุก stage
  const allowedForStage = permissions[currentStageConfig?.stage] || [];
  const allowedCodes = allowedForStage.map(e => e.split('@')[0].toLowerCase());
  const canAct = userDepartment === 'AD'
    || allowedForStage.length === 0
    || allowedCodes.includes(userCode?.toLowerCase())
    || (userEmail && allowedForStage.map(e => e.toLowerCase()).includes(userEmail.toLowerCase()));
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
      <Form form={form} layout="vertical" initialValues={request}
        style={{ display: localIsEditing || isNewRequest ? 'block' : 'none' }}>
          <Divider orientation="left">Requester Information</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Requester" name="requester" rules={[{ required: true }]}>
                <Input readOnly />
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
                <Input readOnly />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Work Center" name="work_center" rules={[{ required: true }]}>
                <Select 
                  placeholder="Select Work Center" 
                  showSearch 
                  onChange={onWCChange}
                  loading={wcLoading}
                >
                  {wcCodes.map(wc => (
                    <Option key={wc.code} value={wc.code}>{wc.description}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Work Center Name" name="work_center_name">
                <Input readOnly placeholder="Auto-filled" />
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

          <Divider orientation="left">Attachments & Machines</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Attach File (Image / PDF)" name="attachment" valuePropName="fileList" getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}>
                <Upload
                  beforeUpload={() => false}
                  maxCount={1}
                >
                  <Button icon={<UploadOutlined />}>Click to Upload</Button>
                </Upload>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Machine No." name="machine_no"><Input /></Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="Machine Name" name="machine_name"><Input /></Form.Item>
            </Col>
          </Row>
        </Form>
        {/* ── View Mode ──────────────────────────────────────────────────────── */}
        <div style={{ display: localIsEditing || isNewRequest ? 'none' : 'block' }}>
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
            {request.file_path && (
              <Descriptions.Item label="ไฟล์แนบ (Requestor)" span={2}>
                <a href={`http://localhost:2005${request.file_path}`} target="_blank" rel="noreferrer">
                  {request.file_path.split('/').pop()}
                </a>
              </Descriptions.Item>
            )}
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
                            {moment(w.action_date || w.created_at).format('DD/MM/YYYY HH:mm')}
                          </Text>
                          <Text type="secondary">by {w.action_by}</Text>
                        </Space>
                        {w.comment && <div><Text type="secondary">Comment: {w.comment}</Text></div>}
                        {extra.request_no && <div><Text type="secondary">Request No: {extra.request_no}</Text></div>}
                        {extra.drawing_no && <div><Text type="secondary">Drawing No: {extra.drawing_no}</Text></div>}
                        {extra.dwg_files && <div><Text type="secondary">Files: {extra.dwg_files}</Text></div>}
                        {extra.dwg_file_paths?.length > 0 && (
                          <div>
                            <Text type="secondary">ไฟล์แนบ: </Text>
                            <Space wrap>
                              {extra.dwg_file_paths.map((p, i) => (
                                <a key={i} href={`http://localhost:2005${p}`} target="_blank" rel="noreferrer">
                                  {extra.dwg_file_names?.[i] || stripFilePrefix(p)}
                                </a>
                              ))}
                            </Space>
                          </div>
                        )}
                        {extra.review_file_paths?.length > 0 && (
                          <div>
                            <Text type="secondary">ไฟล์ Review: </Text>
                            <Space wrap>
                              {extra.review_file_paths.map((p, i) => (
                                <a key={i} href={`http://localhost:2005${p}`} target="_blank" rel="noreferrer">
                                  {extra.review_file_names?.[i] || stripFilePrefix(p)}
                                </a>
                              ))}
                            </Space>
                          </div>
                        )}
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
              {canAct ? (
                <>
                  <Alert
                    type="info"
                    showIcon
                    message={`This request is waiting for ${currentStageConfig.label} action.`}
                    style={{ marginBottom: 16 }}
                  />
                  <StageActionPanel
                    stage={request.current_stage}
                    request={request}
                    workflow={workflow}
                    onSubmit={handleAction}
                    loading={actionLoading}
                  />
                </>
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  message={`คุณไม่มีสิทธิ์ดำเนินการในขั้นตอน ${currentStageConfig.label}`}
                  description={`กรุณาติดต่อผู้รับผิดชอบในขั้นตอนนี้`}
                />
              )}
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
    </Modal>
  );
};

export default RequestDetailsModal;
