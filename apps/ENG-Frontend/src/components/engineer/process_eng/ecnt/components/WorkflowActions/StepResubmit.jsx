import React from 'react';
import { Card, Button, Input, Form, Alert, Typography, Divider } from 'antd';
import { SendOutlined, WarningOutlined } from '@ant-design/icons';
import { useTheme } from '../../../../../../theme';
import Swal from 'sweetalert2';

const { TextArea } = Input;
const { Text } = Typography;

export default function StepResubmit({ onResubmit, ecrData, actionLogs = [] }) {
    const { theme } = useTheme();
    const [form] = Form.useForm();

    // Find the RMD comment from the manager
    const rmdLog = [...actionLogs].reverse().find(
        log => log.action_status === 'Request More Detail'
    );

    const handleResubmit = () => {
        form.validateFields().then(values => {
            Swal.fire({
                title: 'ยืนยันส่งข้อมูลใหม่?',
                text: 'ECR จะถูกส่งกลับไปรอ Manager อนุมัติอีกครั้ง',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'ยืนยัน Resubmit',
                cancelButtonText: 'ยกเลิก',
            }).then((result) => {
                if (result.isConfirmed) {
                    onResubmit(values.additional_info || '');
                }
            });
        }).catch(err => {
            console.error("Validation Failed:", err);
            Swal.fire({
                icon: 'warning',
                title: 'กรุณากรอกข้อมูลเพิ่มเติม',
                text: 'ต้องกรอกข้อมูลเพิ่มเติมก่อนส่งกลับ'
            });
        });
    };

    return (
        <Card
            title={
                <span style={{ color: '#faad14' }}>
                    <WarningOutlined /> Require More Detail — กรุณากรอกข้อมูลเพิ่มเติม
                </span>
            }
            style={{ borderColor: '#faad14', marginTop: 20 }}
        >
            {rmdLog && (
                <Alert
                    message="ความเห็นจาก Manager"
                    description={
                        <div>
                            <Text strong>{rmdLog.action_by}</Text>
                            <Text type="secondary"> ({rmdLog.action_role})</Text>
                            <br />
                            <Text italic style={{ fontSize: 14, marginTop: 4, display: 'block' }}>
                                "{rmdLog.comments}"
                            </Text>
                        </div>
                    }
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            <Form form={form} layout="vertical">
                <Form.Item
                    label="ข้อมูลเพิ่มเติม / อธิบายเพิ่ม"
                    name="additional_info"
                    rules={[{ required: true, message: 'กรุณากรอกข้อมูลเพิ่มเติม' }]}
                >
                    <TextArea
                        rows={5}
                        placeholder="กรอกข้อมูลเพิ่มเติม หรือแก้ไขข้อมูลที่ Manager ร้องขอ"
                    />
                </Form.Item>

                <Divider style={{ margin: '12px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        type="primary"
                        icon={<SendOutlined />}
                        onClick={handleResubmit}
                        size="large"
                    >
                        Resubmit (ส่งข้อมูลใหม่)
                    </Button>
                </div>
            </Form>
        </Card>
    );
}
