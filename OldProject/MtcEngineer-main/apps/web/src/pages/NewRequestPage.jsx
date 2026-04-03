import { useState, useEffect } from 'react';
import {
  Form, Input, Select, Button, Card, Row, Col,
  Typography, Space, Divider, AutoComplete,
} from 'antd';
import { ArrowLeftOutlined, SendOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { requestsAPI, masterAPI } from '../api/client';
import { color } from '../constance/constance';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const TYPE_OF_REQUEST = ['Draft Drawing', 'Regist Drawing', '3D Print'];
const CATEGORY = ['Machine part', 'Gauge', 'Spare Part', 'Tool', 'Jig & Fixture', 'Other'];
const TYPE_OF_DRAWING = ['2D', '3D', '2D & 3D'];

export default function NewRequestPage() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [workCenters, setWorkCenters] = useState([]);
  const [machineOptions, setMachineOptions] = useState([]);
  const [drawingRequired, setDrawingRequired] = useState(false);

  useEffect(() => {
    masterAPI.departments().then(res => setDepartments(res.data.data || [])).catch(() => {});
  }, []);

  const onDeptChange = (dept) => {
    form.setFieldsValue({ workCenter: undefined, workCenterName: undefined });
    setWorkCenters([]);
    if (!dept) return;
    masterAPI.workCenters(dept)
      .then(res => setWorkCenters(res.data.data || []))
      .catch(() => {});
  };

  const onWorkCenterChange = (code) => {
    const wc = workCenters.find(w => w.code === code);
    form.setFieldsValue({ workCenterName: wc?.name || '' });
  };

  const onMachineSearch = (val) => {
    if (!val || val.length < 2) { setMachineOptions([]); return; }
    masterAPI.machines(val)
      .then(res => {
        const opts = (res.data.data || []).map(m => ({
          value: m.code,
          label: `${m.code} — ${m.name}`,
          name: m.name,
        }));
        setMachineOptions(opts);
      })
      .catch(() => {});
  };

  const onMachineSelect = (val, option) => {
    form.setFieldsValue({ machineNo: val, machineName: option.name });
  };

  const onFinish = async (values) => {
    setSubmitting(true);
    try {
      const res = await requestsAPI.create({
        ...values,
        drawingRequired: drawingRequired,
        typeOfDrawing: drawingRequired ? values.typeOfDrawing : null,
      });
      await Swal.fire({
        icon: 'success',
        title: 'Request Created',
        text: `Request Item: ${res.data.data.requestItem}`,
        confirmButtonColor: color.primary,
      });
      navigate('/drawing-request');
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || 'Failed to create request',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/drawing-request')}>Back</Button>
        <Title level={4} style={{ margin: 0, color: color.primary }}>New Drawing Request</Title>
      </Space>

      <Card>
        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark>

          <Divider orientation="left" style={{ color: color.primary, borderColor: '#d9c4b0' }}>
            Department & Work Center
          </Divider>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="department" label="Department" rules={[{ required: true }]}>
                <Select placeholder="Select department" onChange={onDeptChange} showSearch>
                  {departments.map(d => <Option key={d.name} value={d.name}>{d.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="workCenter" label="Work Center" rules={[{ required: true }]}>
                <Select placeholder="Select work center" onChange={onWorkCenterChange} showSearch
                  disabled={workCenters.length === 0}>
                  {workCenters.map(w => <Option key={w.code} value={w.code}>{w.code} — {w.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="workCenterName" label="Work Center Name">
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ color: color.primary, borderColor: '#d9c4b0' }}>
            Machine
          </Divider>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="machineNo" label="Machine No." rules={[{ required: true }]}>
                <AutoComplete
                  options={machineOptions}
                  onSearch={onMachineSearch}
                  onSelect={onMachineSelect}
                  placeholder="Type machine code to search..."
                  filterOption={false}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
              <Form.Item name="machineName" label="Machine Name" rules={[{ required: true }]}>
                <Input placeholder="Machine name" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ color: color.primary, borderColor: '#d9c4b0' }}>
            Request Details
          </Divider>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="typeOfRequest" label="Type of Request" rules={[{ required: true }]}>
                <Select placeholder="Select type">
                  {TYPE_OF_REQUEST.map(t => <Option key={t} value={t}>{t}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                <Select placeholder="Select category">
                  {CATEGORY.map(c => <Option key={c} value={c}>{c}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Drawing Required">
                <Select value={drawingRequired ? 'yes' : 'no'}
                  onChange={v => { setDrawingRequired(v === 'yes'); form.setFieldsValue({ typeOfDrawing: undefined }); }}>
                  <Option value="no">No</Option>
                  <Option value="yes">Yes</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {drawingRequired && (
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="typeOfDrawing" label="Type of Drawing" rules={[{ required: true }]}>
                  <Select placeholder="Select drawing type">
                    {TYPE_OF_DRAWING.map(t => <Option key={t} value={t}>{t}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          )}

          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Short description of the request" />
          </Form.Item>

          <Form.Item name="detail" label="Detail / Reason" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="Detailed description and reason for this request..." />
          </Form.Item>

          <Form.Item name="attachments" label="Attachments (file paths / URLs)">
            <TextArea rows={2} placeholder="Optional: file paths or URLs to attachments" />
          </Form.Item>

          <Divider />
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => navigate('/drawing-request')}>Cancel</Button>
              <Button type="primary" htmlType="submit" icon={<SendOutlined />}
                loading={submitting}
                style={{ background: color.primary, borderColor: color.primary }}>
                Submit Request
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
