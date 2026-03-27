import { Card, Button, Input, Form, Row, Col, Radio, Divider, Upload, Select, Space } from 'antd';
import { UploadOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useTheme } from '../../../../../../theme';
import Swal from 'sweetalert2';
import axios from 'axios';
import { server } from '../../../../../../constance/constance';

const { TextArea } = Input;
const { Option } = Select;

export default function Step3_5({ onNext, ecrData }) {
    const { theme } = useTheme();
    const [form] = Form.useForm();

    const normFile = (e) => {
        if (Array.isArray(e)) return e;
        return e?.fileList;
    };

    const uploadFileToServer = async (fileList) => {
        if (fileList && fileList.length > 0 && fileList[0].originFileObj) {
            const formData = new FormData();
            formData.append('file', fileList[0].originFileObj);
            try {
                const res = await axios.post(server.UPLOAD_API, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (res.data.success) {
                    return res.data.file_url;
                }
            } catch (error) {
                console.error("File upload error", error);
            }
        }
        return null;
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            const upload_disposition_sheet = await uploadFileToServer(values.upload_disposition_sheet);

            // Save Dynamic Tasks to ecnt_tasks
            if (values.assigned_tasks && values.assigned_tasks.length > 0) {
                await axios.post(`${server.ECR_REQUIRE_TASKS}${ecrData.id}/tasks`, {
                    tasks: values.assigned_tasks
                });
            }

            // Remove assigned_tasks from values to prevent polluting ECR details json
            const { assigned_tasks, ...restValues } = values;

            Swal.fire('Complete', 'Execution & Plan details saved.', 'success')
                .then(() => onNext(3.5, 'ECN Execution', 'Execution Plan Saved', { ...restValues, upload_disposition_sheet }));
        } catch (err) {
            console.error("Validation Failed:", err);
            if (err.errorFields) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Missing Required Fields',
                    text: 'Please fill in all required fields before submitting.'
                });
            }
        }
    };

    return (
        <Card title="Step 3.5: ECN Execution & Plan"
            style={{ borderColor: theme.colors.info, marginTop: 20 }}>
            <Form form={form} layout="vertical">
                <Row gutter={24}>
                    <Col span={24}>
                        <Divider orientation="left">Engineer Assigned Scope</Divider>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Scope of Implementation" name="scope_implementation" rules={[{ required: true }]}>
                            <TextArea rows={3} placeholder="Describe the scope" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Before Change" name="exec_before_change" rules={[{ required: true }]}>
                            <TextArea rows={3} placeholder="Current State" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="After Change" name="exec_after_change" rules={[{ required: true }]}>
                            <TextArea rows={3} placeholder="Future State" />
                        </Form.Item>
                    </Col>

                    <Col span={24}>
                        <Divider orientation="left">Production Control (PC) Scope</Divider>
                    </Col>
                    <Col span={24}>
                        <Form.Item label="Target Lots to Hold (If Needed)" name="target_lots">
                            <Input placeholder="E.g., Lot #12345, #12346" />
                        </Form.Item>
                        <Form.Item label="Upload Disposition Sheet" name="upload_disposition_sheet" valuePropName="fileList" getValueFromEvent={normFile}>
                            <Upload beforeUpload={() => false} maxCount={1} accept=".pdf,.png,.jpg,.jpeg">
                                <Button icon={<UploadOutlined />}>Upload File</Button>
                            </Upload>
                        </Form.Item>
                    </Col>

                    <Col span={24}>
                        <Divider orientation="left">Quality Control (QC) Scope</Divider>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="MSA Requirement" name="msa_requirement" rules={[{ required: true }]}>
                            <Radio.Group>
                                <Radio value="Require">Require</Radio>
                                <Radio value="Not Require">Not Require</Radio>
                            </Radio.Group>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="FAI Requirement" name="fai_requirement" rules={[{ required: true }]}>
                            <Radio.Group>
                                <Radio value="Require">Require</Radio>
                                <Radio value="Full">Full</Radio>
                                <Radio value="Not Require">Not Require</Radio>
                            </Radio.Group>
                        </Form.Item>
                    </Col>
                    <Col span={24}>
                        <Divider orientation="left">Department Acknowledgement Tasks</Divider>
                    </Col>
                    <Col span={24}>
                        <Form.List name="assigned_tasks">
                            {(fields, { add, remove }) => (
                                <>
                                    {fields.map(({ key, name, ...restField }) => (
                                        <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'dept_name']}
                                                rules={[{ required: true, message: 'Missing dept' }]}
                                            >
                                                <Select placeholder="Department" style={{ width: 130 }}>
                                                    <Option value="PC">PC</Option>
                                                    <Option value="QA">QA</Option>
                                                    <Option value="QC">QC</Option>
                                                    <Option value="PD1">PD1</Option>
                                                    <Option value="PD2">PD2</Option>
                                                    <Option value="MC">MC</Option>
                                                    <Option value="MM">MM</Option>
                                                </Select>
                                            </Form.Item>
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'task_detail']}
                                                rules={[{ required: true, message: 'Missing task detail' }]}
                                            >
                                                <Input placeholder="Task Description" style={{ width: 500 }} />
                                            </Form.Item>
                                            <MinusCircleOutlined onClick={() => remove(name)} style={{ color: 'red' }} />
                                        </Space>
                                    ))}
                                    <Form.Item>
                                        <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                            Assign Department Task
                                        </Button>
                                    </Form.Item>
                                </>
                            )}
                        </Form.List>
                    </Col>
                </Row>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                    <Button type="primary" onClick={handleSubmit}>Save Execution Plan</Button>
                </div>
            </Form>
        </Card>
    );
}
