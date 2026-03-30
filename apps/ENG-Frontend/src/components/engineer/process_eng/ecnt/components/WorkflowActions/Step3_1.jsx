import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Form, Select, Space, Divider, Alert, Popconfirm } from 'antd';
import { UserAddOutlined, CloseCircleOutlined, InfoCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useTheme } from '../../../../../../theme';
import { server } from '../../../../../../constance/constance';
import axios from 'axios';
import Swal from 'sweetalert2';

const { TextArea } = Input;

export default function Step3_1({ onNext, ecrData }) {
    const { theme } = useTheme();
    const [form] = Form.useForm();
    const [engUsers, setEngUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Fetch ENG department users for assignee dropdown
    useEffect(() => {
        const fetchEngUsers = async () => {
            setLoadingUsers(true);
            try {
                const res = await axios.get(`${server.ECR_USERS_BY_DEPT}ENG`);
                setEngUsers(res.data.data || []);
            } catch (err) {
                console.error("Failed to fetch ENG users:", err);
            } finally {
                setLoadingUsers(false);
            }
        };
        fetchEngUsers();
    }, []);

    const handleApprove = () => {
        form.validateFields().then(values => {
            Swal.fire({
                icon: 'success',
                title: 'Approved',
                text: `ECR approved and assigned to ${values.assigned_to}`,
                timer: 2000,
                showConfirmButton: false
            }).then(() => {
                onNext(3.2, 'Approve', values.comment || '', { assigned_to: values.assigned_to });
            });
        }).catch(err => {
            console.error("Validation Failed:", err);
            Swal.fire({
                icon: 'warning',
                title: 'กรุณากรอกข้อมูลให้ครบ',
                text: 'ต้องเลือกผู้รับผิดชอบ (ENG) ก่อน Approve'
            });
        });
    };

    const handleDeny = () => {
        const comment = form.getFieldValue('comment');
        Swal.fire({
            title: 'ยืนยันการปฏิเสธ ECR?',
            text: 'ECR นี้จะถูกยกเลิกและไม่สามารถดำเนินการต่อได้',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ff4d4f',
            cancelButtonText: 'ยกเลิก',
            confirmButtonText: 'ยืนยัน Deny',
            input: !comment ? 'textarea' : undefined,
            inputPlaceholder: !comment ? 'กรุณาระบุเหตุผลในการปฏิเสธ' : undefined,
            inputValidator: (value) => {
                if (!comment && !value) return 'กรุณาระบุเหตุผลในการปฏิเสธ';
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const finalComment = comment || result.value || '';
                onNext('denied', 'Deny', finalComment, {});
            }
        });
    };

    const handleRequestMoreDetail = () => {
        const comment = form.getFieldValue('comment');
        if (!comment || comment.trim() === '') {
            Swal.fire({
                icon: 'warning',
                title: 'กรุณาระบุรายละเอียด',
                text: 'ต้องกรอก Comment เพื่อบอกผู้ร้องขอว่าต้องการข้อมูลอะไรเพิ่มเติม'
            });
            return;
        }
        Swal.fire({
            title: 'ส่งกลับเพื่อขอข้อมูลเพิ่ม?',
            text: 'ECR จะถูกส่งกลับไปหาผู้ร้องขอเพื่อกรอกข้อมูลเพิ่มเติม',
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'ยืนยัน',
            cancelButtonText: 'ยกเลิก',
        }).then((result) => {
            if (result.isConfirmed) {
                onNext('rmd', 'Request More Detail', comment, {});
            }
        });
    };

    return (
        <Card
            title={
                <span style={{ color: theme.colors.primary }}>
                    Step 3.1: Requester's Dept. Manager Approval
                </span>
            }
            style={{ borderColor: theme.colors.primary, marginTop: 20 }}
        >
            <Alert
                message="กรุณาตรวจสอบข้อมูล ECR และเลือกผู้รับผิดชอบก่อนอนุมัติ"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
            />

            <Form form={form} layout="vertical">
                <Form.Item
                    label="มอบหมายผู้รับผิดชอบ (แผนก ENG)"
                    name="assigned_to"
                    rules={[{ required: true, message: 'กรุณาเลือกผู้รับผิดชอบในแผนก ENG' }]}
                >
                    <Select
                        placeholder="เลือกผู้รับผิดชอบ"
                        loading={loadingUsers}
                        showSearch
                        optionFilterProp="children"
                        suffixIcon={<UserAddOutlined />}
                        size="large"
                    >
                        {engUsers.map(user => (
                            <Select.Option key={user.u_code} value={user.u_name}>
                                {user.u_name} {user.u_nickname ? `(${user.u_nickname})` : ''} — {user.position || user.role || 'ENG'}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item label="Comment / Remark" name="comment">
                    <TextArea rows={4} placeholder="ระบุความเห็นหรือเหตุผลประกอบ" />
                </Form.Item>

                <Divider style={{ margin: '12px 0' }} />

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <Button
                        danger
                        icon={<CloseCircleOutlined />}
                        onClick={handleDeny}
                    >
                        Deny (ปฏิเสธ)
                    </Button>
                    <Button
                        icon={<InfoCircleOutlined />}
                        onClick={handleRequestMoreDetail}
                        style={{ borderColor: '#faad14', color: '#faad14' }}
                    >
                        Request More Detail
                    </Button>
                    <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={handleApprove}
                    >
                        Approve (อนุมัติ)
                    </Button>
                </div>
            </Form>
        </Card>
    );
}
