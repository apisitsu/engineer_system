import React, { useEffect, useState } from 'react';
import { Modal, Button, Form, Input, DatePicker, Select, Row, Col, Typography, Alert, Table, Tag, Radio, Space } from 'antd';
import { InfoCircleFilled, FileProtectOutlined } from '@ant-design/icons';
import { MEASURING_TOOL_OPTIONS } from './options_measuring';
import moment from 'moment';
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

const UpdateFormModal = ({ open, initialData, onCancel, onSuccess }) => {
  const { theme } = useTheme();
  const [form] = Form.useForm();

  const [conflictList, setConflictList] = useState([]);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  // const [pendingValues, setPendingValues] = useState(null);
  const [resolutions, setResolutions] = useState({});

  // Reset Form เมื่อเปิด Modal ใหม่
  useEffect(() => {
    if (open && initialData) {
      // แปลงวันที่ string เป็น moment object เพื่อให้ DatePicker แสดงผลถูก
      const formData = { ...initialData };
      if (formData.issue_date) {
        formData.issue_date = moment(formData.issue_date);
      }
      form.setFieldsValue(formData);
    } else {
      form.resetFields();
    }
    if (onCancel) {
      form.resetFields();
    }

  }, [open, initialData, form, onCancel]);


  const formFields = [
    { name: 'issue_date', label: 'Issue Date', type: 'date', span: 12, required: false, placeholder: 'DD-MM-YYYY' },
    { name: 'measuring_tools', label: 'Measuring Tools', type: 'select', span: 12, required: false, placeholder: '-- Select --', options: MEASURING_TOOL_OPTIONS },
    { name: 'judgement', label: 'Judgement', type: 'select', span: 12, required: false, placeholder: '-- Select --', options: JUDGEMENT_OPTIONS },
    { name: 'reason', label: 'Reason', type: 'select', span: 12, required: false, placeholder: '-- Select --', options: REASON_OPTIONS },
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

  const handleSave = () => {
    form.validateFields().then((values) => {
      // Clone values เพื่อป้องกันการแก้ไข Object โดยตรง (Best Practice)
      const currentValues = { ...values };
      // console.log(values)

      if (currentValues.issue_date) {
        currentValues.issue_date = moment(currentValues.issue_date).format('YYYY-MM-DD');
      }

      const fieldsToCheck = ['issue_date', 'measuring_tools', 'judgement', 'reason', 'remark'];
      const conflicts = [];

      fieldsToCheck.forEach((field) => {
        const oldValue = initialData[field];
        const newValue = currentValues[field];


        // ตรวจสอบ: ต้องมีค่าทั้งคู่ และ ค่าต้องไม่เหมือนกัน
        if (
          oldValue && oldValue !== '' &&
          newValue && newValue !== '' &&
          oldValue !== newValue
        ) {
          conflicts.push({
            field: field,
            oldValue: oldValue,
            newValue: newValue
          });
        }
      });

      if (conflicts.length > 0) {
        // console.log("เจอ Conflict:", conflicts);
        setConflictList(conflicts);
        // setPendingValues(currentValues);
        // console.log("Pending Values:", conflicts);
        // console.log("Resolutions:", resolutions);

        const initialResolutions = {};
        conflicts.forEach(c => initialResolutions[c.field] = 'new'); // Default เลือก New
        setResolutions(initialResolutions);

        setIsConflictModalOpen(true);
      } else {
        const payload = { ...initialData, ...currentValues };
        // console.log("Final Payload:", payload);
        onSubmit(payload);
        onCancel();
      }
    });
  };

  const onSubmit = async (payload) => {
    // console.log("Final Payload:", payload);

    try {
      const res = await axios.post(`${server.TOOLING_INSPECT_UPDATE}`, payload);

      if (res.data.result === "true" || res.data === "OK" || res.status === 200) {

        await Swal.fire({
          icon: 'success',
          title: 'Success',
          text: res.data.message || 'ข้อมูลถูกบันทึกเรียบร้อยแล้ว',
          timer: 2000,
          showConfirmButton: false
        });

        if (onSuccess) { onSuccess(payload) }

      } else {
        throw new Error(res.data.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }

    } catch (error) {
      console.error("Submit Error:", error);

      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || error.message || 'กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ',
      });
    }
  };

  const handleConfirmResolution = () => {
    const finalPayload = initialData;

    conflictList.forEach((conflict) => {
      const { field, oldValue, newValue } = conflict;
      const choice = resolutions[field];

      if (choice === 'new') {
        finalPayload[field] = newValue;
      } else if (choice === 'old') {
        finalPayload[field] = oldValue
      } else if (choice === 'both') {
        finalPayload[field] = `${oldValue} / ${newValue}`;
      }
    });

    // console.log(finalPayload)

    onSubmit(finalPayload);
    setIsConflictModalOpen(false);
    // setPendingValues(null);
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
        title="⚠️ ตรวจพบข้อมูลขัดแย้ง (Data Conflict)"
        open={isConflictModalOpen}
        onOk={handleConfirmResolution}
        onCancel={() => setIsConflictModalOpen(false)}
        width={800}
        okText="ยืนยันการแก้ไข"
        cancelText="ยกเลิก"
      >
        <p>มีการแก้ไขข้อมูลใน <b>Initial Data</b> และ <b>Form Value</b> ไม่ตรงกัน กรุณาเลือกข้อมูลที่ต้องการบันทึก:</p>

        <Table
          dataSource={conflictList}
          rowKey="field"
          pagination={false}
          columns={[
            {
              title: 'หัวข้อ (Field)',
              dataIndex: 'field',
              key: 'field',
              render: (text) => <Tag color="blue">{text}</Tag>
            },
            {
              title: 'ข้อมูลเดิม (Initial)',
              dataIndex: 'oldValue',
              key: 'oldValue',
              width: '25%',
              render: (text) => <span style={{ color: 'gray' }}>{text}</span>
            },
            {
              title: 'ข้อมูลใหม่ (New)',
              dataIndex: 'newValue',
              key: 'newValue',
              width: '25%',
              render: (text) => <span style={{ color: 'green', fontWeight: 'bold' }}>{text}</span>
            },
            {
              title: 'การตัดสินใจ',
              key: 'action',
              render: (_, record) => (
                <Radio.Group
                  value={resolutions[record.field]}
                  onChange={(e) => {
                    setResolutions({ ...resolutions, [record.field]: e.target.value });
                  }}
                >
                  <Space direction="vertical">
                    <Radio value="old">ใช้ข้อมูลเดิม</Radio>
                    <Radio value="new">ใช้ข้อมูลใหม่</Radio>
                    {(record.field === 'remark') && (
                      <Radio value="both">เก็บไว้ทั้งคู่</Radio>
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