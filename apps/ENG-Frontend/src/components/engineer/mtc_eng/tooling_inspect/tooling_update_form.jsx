import React, { useEffect, useState } from 'react';
import { Modal, Button, Form, Input, DatePicker, Select, Row, Col, Typography, Alert, Table, Tag, Radio, Space } from 'antd';
import { InfoCircleFilled, FileProtectOutlined } from '@ant-design/icons';
import { MEASURING_TOOL_OPTIONS } from './options_measuring';
import moment from 'moment';
import dayjs from 'dayjs';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import axios from 'axios';
import Swal from 'sweetalert2';

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const JUDGEMENT_OPTIONS = [
  { label: 'Accept', value: 'Accept' },
  { label: 'Reject', value: 'Reject' },
];

const REASON_OPTIONS = [
  { label: 'Over capacity', value: 'Over capacity' },
  { label: 'Wait to use special measuring tool', value: 'Wait to use special measuring tool' },
  { label: 'New tooling type', value: 'New tooling type' },
];

const calculateWorkingDays = (startDateStr, endDateStr) => {
  let count = 0;
  let current = moment(startDateStr).startOf('day');
  const end = moment(endDateStr).startOf('day');
  while (current.isSameOrBefore(end)) {
    if (current.isoWeekday() !== 7) count++; // exclude Sunday only (Saturday is working day)
    current.add(1, 'days');
  }
  return count;
};

const UpdateFormModal = ({ open, initialData, onCancel, onSuccess }) => {
  const { theme } = useTheme();
  const [form] = Form.useForm();

  const [conflictList, setConflictList] = useState([]);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState(null);
  const [resolutions, setResolutions] = useState({});

  // Reset Form เมื่อเปิด Modal ใหม่
  useEffect(() => {
    if (open && initialData) {
      // แปลงวันที่ string เป็น dayjs object เพื่อให้ DatePicker แสดงผลถูก (Antd 5 ใช ้ dayjs)
      const formData = { ...initialData };
      if (formData.issue_date) {
        formData.issue_date = dayjs(formData.issue_date);
      }
      form.setFieldsValue(formData);
    } else {
      form.resetFields();
    }
    if (onCancel && !open) {
      form.resetFields();
    }

  }, [open, initialData, form, onCancel]);


  const formFields = [
    { name: 'issue_date', label: 'Issue Date', type: 'date', span: 12, required: false, placeholder: 'DD-MM-YYYY' },
    { name: 'measuring_tools', label: 'Measuring Tools', type: 'select', span: 12, required: false, placeholder: '-- Select --', options: MEASURING_TOOL_OPTIONS },
    { name: 'judgement', label: 'Judgement', type: 'select', span: 12, required: false, placeholder: '-- Select --', options: JUDGEMENT_OPTIONS },
    { name: 'remark', label: 'Remark', type: 'textarea', span: 24, required: false, placeholder: 'Additional notes...' },
  ];

  const renderInput = (field) => {
    switch (field.type) {
      case 'date':
        return <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" placeholder={field.placeholder} />;
      case 'select':
        return (
          <Select placeholder={field?.placeholder} allowClear>
            {field.options?.map((opt) => (
              <Option key={opt?.value} value={opt?.value}>{opt?.label}</Option>
            ))}
          </Select>
        );
      case 'textarea':
        return <TextArea rows={2} placeholder={field.placeholder} />;
      default:
        return <Input placeholder={field.placeholder} />;
    }
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    const currentValues = { ...values };

    if (currentValues.issue_date) {
      currentValues.issue_date = dayjs(currentValues.issue_date).format('YYYY-MM-DD');
    }

    // Check for Delay: ask the backend (single source of truth — same calc that
    // sets the saved status: excludes Sundays + holidays, Delay when diff > 3)
    // so the reason prompt can never disagree with the stored status.
    let reason = null;
    if (currentValues.issue_date && initialData?.receive_date) {
      let isDelay = false;
      let workingDays = null;
      try {
        const { data } = await axios.get(server.TOOLING_INSPECT_STATUS_PREVIEW, {
          params: { receive_date: initialData.receive_date, issue_date: currentValues.issue_date },
        });
        isDelay = data?.status === 'Delay';
        workingDays = data?.diff;
      } catch (err) {
        // Fallback if preview endpoint is unreachable: local count (Sundays only)
        workingDays = calculateWorkingDays(initialData.receive_date, currentValues.issue_date);
        isDelay = workingDays > 3;
      }
      if (isDelay) {
        const inputOptions = REASON_OPTIONS.reduce((acc, o) => ({ ...acc, [o.value]: o.label }), {});
        const { value: selectedReason, isConfirmed } = await Swal.fire({
          icon: 'warning',
          title: 'Status: Delay',
          html: `Took <b>${workingDays}</b> working days. Please specify the reason`,
          input: 'select',
          inputOptions,
          inputPlaceholder: '-- Select Reason --',
          showCancelButton: true,
          confirmButtonText: 'Submit',
          cancelButtonText: 'Cancel',
          inputValidator: (v) => !v && 'Please select a reason',
        });
        if (!isConfirmed) return;
        reason = selectedReason;
      }
    }
    currentValues.reason = reason;

    const fieldsToCheck = ['issue_date', 'measuring_tools', 'judgement', 'remark'];
    const conflicts = [];

    fieldsToCheck.forEach((field) => {
      const oldValue = initialData[field];
      const newValue = currentValues[field];
      if (oldValue && oldValue !== '' && newValue && newValue !== '' && oldValue !== newValue) {
        conflicts.push({ field, oldValue, newValue });
      }
    });

    if (conflicts.length > 0) {
      setConflictList(conflicts);
      setPendingValues(currentValues);
      const initialResolutions = {};
      conflicts.forEach(c => initialResolutions[c.field] = 'new');
      setResolutions(initialResolutions);
      setIsConflictModalOpen(true);
    } else {
      const payload = { ...initialData, ...currentValues };
      onSubmit(payload);
      onCancel();
    }
  };

  const onSubmit = async (payload) => {
    // console.log("Final Payload:", payload);

    try {
      const res = await axios.post(`${server.TOOLING_INSPECT_UPDATE}`, payload);

      if (res.data.result === "true" || res.data === "OK" || res.status === 200) {

        await Swal.fire({
          icon: 'success',
          title: 'Success',
          text: res.data.message || 'Data saved successfully',
          timer: 2000,
          showConfirmButton: false
        });

        if (onSuccess) { onSuccess(payload) }

      } else {
        throw new Error(res.data.message || 'An error occurred while saving');
      }

    } catch (error) {
      console.error("Submit Error:", error);

      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || error.message || 'Please try again or contact the administrator',
      });
    }
  };

  const handleConfirmResolution = () => {
    const finalPayload = { ...initialData, ...pendingValues };

    conflictList.forEach((conflict) => {
      const { field, oldValue, newValue } = conflict;
      const choice = resolutions[field];
      if (choice === 'new') finalPayload[field] = newValue;
      else if (choice === 'old') finalPayload[field] = oldValue;
      else if (choice === 'both') finalPayload[field] = `${oldValue} / ${newValue}`;
    });

    onSubmit(finalPayload);
    setIsConflictModalOpen(false);
    setPendingValues(null);
    onCancel();
  };

  const sectionStyle = { border: `1px solid ${theme.colors.border}`, borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' };
  const headerStyle = { backgroundColor: theme.colors.surfaceHover, padding: '8px 16px', borderBottom: `1px solid ${theme.colors.border}`, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' };
  const contentStyle = { padding: '16px' };

  return (
    // 2. ต้องมี Fragment (<>...</>) ครอบ Modals ทั้งสองตัวเสมอ
    <>
      <Modal
        title={
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
            Update: PO {initialData?.po_no || '---'} - {initialData?.item_name || '---'}
          </div>
        }
        open={open}
        onCancel={onCancel}
        centered
        forceRender
        width={700}
        footer={[
          <Button key="cancel" onClick={onCancel}>Cancel</Button>,
          <Button key="submit" type="primary" onClick={handleSave}>Save Changes</Button>,
        ]}
      >
        <Form layout="vertical" form={form}>
          {/* --- Section 1: Record Info --- */}
          <div style={sectionStyle}>
            <div style={headerStyle}><InfoCircleFilled /> Record Info</div>
            <div style={contentStyle}>
              <Row gutter={[16, 8]}>
                <Col span={12}><Text strong>PO No.:</Text> <Text>{initialData?.po_no || '-'}</Text></Col>
                <Col span={12}><Text strong>Item Name:</Text> <Text>{initialData?.item_name || '-'}</Text></Col>
                <Col span={12}><Text strong>Receive Date:</Text> <Text>{initialData?.receive_date || '-'}</Text></Col>
                <Col span={12}><Text strong>W/C:</Text> <Text>{initialData?.w_c || '-'}</Text></Col>
              </Row>
            </div>
          </div>

          {/* --- Section 2: Inspection Details --- */}
          <div style={sectionStyle}>
            <div style={headerStyle}><FileProtectOutlined /> Inspection Details</div>
            <div style={contentStyle}>
              <Row gutter={[16, 0]}>
                {formFields.map((field, index) => (
                  <Col key={field.name || index} span={field.span}>
                    <Form.Item
                      name={field.name}
                      style={{ marginBottom: 8 }}
                      label={
                        <span>
                          {field.label}
                          {!field.required && <span style={{ color: '#999', fontStyle: 'italic', marginLeft: '4px', fontWeight: 'normal' }}>(Optional)</span>}
                        </span>
                      }
                      rules={field.required ? [{ required: true, message: `Please input ${field.label}!` }] : []}
                    >
                      {renderInput(field)}
                    </Form.Item>
                  </Col>
                ))}
              </Row>
            </div>
          </div>

          {/* --- Section 3: Notification Alert --- */}
          <Alert
            message={
              <span>
                <b>Note:</b> All fields are optional. <br />
                Diff. and Status will be calculated automatically when Issue Date is provided.
              </span>
            }
            type="info"
            showIcon
            style={{ backgroundColor: `${theme.colors.info}15`, borderColor: theme.colors.info }}
          />
        </Form>
      </Modal>

      {/* --- Conflict Modal --- */}
      <Modal
        title="⚠️ Data Conflict detected"
        open={isConflictModalOpen}
        onOk={handleConfirmResolution}
        onCancel={() => setIsConflictModalOpen(false)}
        width={800}
        okText="Confirm changes"
        cancelText="Cancel"
      >
        <p><b>Initial Data</b> and <b>Form Value</b> differ. Please choose the data to save:</p>

        <Table
          dataSource={conflictList}
          rowKey="field"
          pagination={false}
          columns={[
            {
              title: 'Field',
              dataIndex: 'field',
              key: 'field',
              render: (text) => <Tag color="blue">{text}</Tag>
            },
            {
              title: 'Initial',
              dataIndex: 'oldValue',
              key: 'oldValue',
              width: '25%',
              render: (text) => <span style={{ color: 'gray' }}>{text}</span>
            },
            {
              title: 'New',
              dataIndex: 'newValue',
              key: 'newValue',
              width: '25%',
              render: (text) => <span style={{ color: 'green', fontWeight: 'bold' }}>{text}</span>
            },
            {
              title: 'Decision',
              key: 'action',
              render: (_, record) => (
                <Radio.Group
                  value={resolutions[record.field]}
                  onChange={(e) => {
                    setResolutions({ ...resolutions, [record.field]: e.target.value });
                  }}
                >
                  <Space direction="vertical">
                    <Radio value="old">Use original</Radio>
                    <Radio value="new">Use new</Radio>
                    {(record.field === 'remark') && (
                      <Radio value="both">Keep both</Radio>
                    )}
                  </Space>
                </Radio.Group>
              )
            }
          ]}
        />
      </Modal>
    </>
  );
};

export default UpdateFormModal;