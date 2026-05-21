import React, { useState } from 'react';
import {
    Card, Button, Typography, Upload, InputNumber, Divider, Space,
    Spin, Empty, message, Tooltip, Modal, Form,
} from 'antd';
import {
    EditOutlined, SafetyCertificateOutlined, UploadOutlined,
    CheckCircleOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../../../../theme';
import { useAuthStore } from '../../../../../stores/authStore';

const { Title, Text } = Typography;

/**
 * StampPalette — Right-side panel showing user's stamps/signatures
 * with physical dimension display and selection controls.
 */
const StampPalette = ({
    stampData,
    stampLoading,
    activeStampType,
    onSelectStampType,
    onUploadStamp,
}) => {
    const { theme } = useTheme();
    const { empNo, userName } = useAuthStore();
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [form] = Form.useForm();
    const [stampPreview, setStampPreview] = useState(null);
    const [sigPreview, setSigPreview] = useState(null);

    const handleFileRead = (file, setter) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1]; // Remove data:xxx;base64, prefix
            setter(base64);
        };
        reader.readAsDataURL(file);
        return false; // Prevent upload
    };

    const handleUploadSubmit = async () => {
        try {
            const values = await form.validateFields();
            const data = {
                em_id: empNo,
                first_name: userName?.split(' ')[0] || '',
                last_name: userName?.split(' ').slice(1).join(' ') || '',
                department: '',
                stamp_width_mm: values.stamp_width_mm,
                stamp_height_mm: values.stamp_height_mm,
                sig_width_mm: values.sig_width_mm,
                sig_height_mm: values.sig_height_mm,
            };
            if (stampPreview) data.stamp_image = stampPreview;
            if (sigPreview) data.signature_image = sigPreview;

            await onUploadStamp(data);
            setUploadModalOpen(false);
            setStampPreview(null);
            setSigPreview(null);
            form.resetFields();
        } catch (err) {
            if (err.errorFields) return; // Validation error
            message.error('Failed to upload stamp');
        }
    };

    const StampPreviewCard = ({ type, label, icon, imageSrc, widthMm, heightMm }) => {
        const isActive = activeStampType === type;
        const hasImage = !!imageSrc;

        return (
            <div
                onClick={() => hasImage && onSelectStampType(isActive ? null : type)}
                style={{
                    padding: 16,
                    borderRadius: 14,
                    border: `2px solid ${isActive ? theme.colors.primary : theme.colors.border}`,
                    background: isActive ? `${theme.colors.primary}0a` : theme.colors.surface,
                    cursor: hasImage ? 'pointer' : 'not-allowed',
                    opacity: hasImage ? 1 : 0.5,
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    marginBottom: 12,
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Active indicator */}
                {isActive && (
                    <div style={{
                        position: 'absolute', top: 8, right: 8,
                        background: theme.colors.primary, color: '#fff',
                        borderRadius: '50%', width: 22, height: 22,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                    }}>
                        <CheckCircleOutlined />
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: `${theme.colors.primary}15`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: theme.colors.primary, fontSize: 18,
                    }}>
                        {icon}
                    </div>
                    <div>
                        <Text strong style={{ display: 'block', color: theme.colors.textPrimary, fontSize: 14 }}>{label}</Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                            {widthMm}mm × {heightMm}mm
                        </Text>
                    </div>
                </div>

                {/* Image preview */}
                {hasImage ? (
                    <div style={{
                        background: '#fff',
                        borderRadius: 8,
                        padding: 8,
                        border: `1px solid ${theme.colors.border}`,
                        textAlign: 'center',
                    }}>
                        <img
                            src={`data:image/png;base64,${imageSrc}`}
                            alt={label}
                            style={{
                                maxWidth: '100%',
                                maxHeight: 80,
                                objectFit: 'contain',
                            }}
                        />
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>No image uploaded</Text>
                    </div>
                )}

                {/* Click instruction */}
                {hasImage && (
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                        <Text style={{ fontSize: 11, color: isActive ? theme.colors.primary : theme.colors.textSecondary }}>
                            {isActive ? '✓ Selected — click on PDF to place' : 'Click to select'}
                        </Text>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{
                padding: '16px 16px 12px',
                borderBottom: `1px solid ${theme.colors.border}`,
            }}>
                <Title level={5} style={{ margin: 0, color: theme.colors.textPrimary, fontSize: 15 }}>
                    Stamps & Signatures
                </Title>
                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                    Select an item, then click on the PDF to place it
                </Text>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }} className="kb-vscroll">
                {stampLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <Spin tip="Loading stamps..." />
                    </div>
                ) : stampData ? (
                    <>
                        <StampPreviewCard
                            type="stamp"
                            label="Company Stamp"
                            icon={<SafetyCertificateOutlined />}
                            imageSrc={stampData.stamp_image}
                            widthMm={stampData.stamp_width_mm || 40}
                            heightMm={stampData.stamp_height_mm || 40}
                        />
                        <StampPreviewCard
                            type="signature"
                            label="Signature"
                            icon={<EditOutlined />}
                            imageSrc={stampData.signature_image}
                            widthMm={stampData.sig_width_mm || 50}
                            heightMm={stampData.sig_height_mm || 20}
                        />

                        <Divider style={{ margin: '12px 0' }} />

                        <Tooltip title="Physical accuracy info">
                            <div style={{
                                padding: 12, borderRadius: 10,
                                background: `${theme.colors.info || '#1890ff'}08`,
                                border: `1px solid ${theme.colors.info || '#1890ff'}22`,
                            }}>
                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                                    <InfoCircleOutlined style={{ marginRight: 6, color: theme.colors.info || '#1890ff' }} />
                                    Dimensions are calibrated for 1:1 print accuracy (1mm ≈ 2.835pt).
                                </Text>
                            </div>
                        </Tooltip>
                    </>
                ) : (
                    <Empty
                        description={<Text type="secondary">No stamps found for your account</Text>}
                        style={{ padding: '24px 0' }}
                    />
                )}
            </div>

            {/* Footer — Upload Button */}
            <div style={{
                padding: 12,
                borderTop: `1px solid ${theme.colors.border}`,
            }}>
                <Button
                    type="primary"
                    block
                    icon={<UploadOutlined />}
                    onClick={() => setUploadModalOpen(true)}
                    style={{
                        height: 42, borderRadius: 10,
                        fontWeight: 600,
                    }}
                >
                    {stampData ? 'Update Stamps' : 'Upload Stamps'}
                </Button>
            </div>

            {/* Upload Modal */}
            <Modal
                title="Upload Stamps & Signatures"
                open={uploadModalOpen}
                onCancel={() => {
                    setUploadModalOpen(false);
                    setStampPreview(null);
                    setSigPreview(null);
                    form.resetFields();
                }}
                onOk={handleUploadSubmit}
                okText="Save"
                width={520}
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                        stamp_width_mm: stampData?.stamp_width_mm || 40,
                        stamp_height_mm: stampData?.stamp_height_mm || 40,
                        sig_width_mm: stampData?.sig_width_mm || 50,
                        sig_height_mm: stampData?.sig_height_mm || 20,
                    }}
                >
                    <Divider orientation="left" plain>Company Stamp</Divider>
                    <Upload
                        accept="image/*"
                        maxCount={1}
                        beforeUpload={(file) => handleFileRead(file, setStampPreview)}
                        showUploadList={false}
                    >
                        <Button icon={<UploadOutlined />}>Select Stamp Image</Button>
                    </Upload>
                    {(stampPreview || stampData?.stamp_image) && (
                        <div style={{ margin: '8px 0', padding: 8, border: '1px solid #f0f0f0', borderRadius: 8, textAlign: 'center' }}>
                            <img
                                src={`data:image/png;base64,${stampPreview || stampData.stamp_image}`}
                                alt="Stamp preview"
                                style={{ maxHeight: 60, maxWidth: '100%' }}
                            />
                        </div>
                    )}
                    <Space style={{ marginTop: 8 }}>
                        <Form.Item name="stamp_width_mm" label="Width (mm)" style={{ marginBottom: 0 }}>
                            <InputNumber min={5} max={200} step={0.5} style={{ width: 100 }} />
                        </Form.Item>
                        <Form.Item name="stamp_height_mm" label="Height (mm)" style={{ marginBottom: 0 }}>
                            <InputNumber min={5} max={200} step={0.5} style={{ width: 100 }} />
                        </Form.Item>
                    </Space>

                    <Divider orientation="left" plain>Signature</Divider>
                    <Upload
                        accept="image/*"
                        maxCount={1}
                        beforeUpload={(file) => handleFileRead(file, setSigPreview)}
                        showUploadList={false}
                    >
                        <Button icon={<UploadOutlined />}>Select Signature Image</Button>
                    </Upload>
                    {(sigPreview || stampData?.signature_image) && (
                        <div style={{ margin: '8px 0', padding: 8, border: '1px solid #f0f0f0', borderRadius: 8, textAlign: 'center' }}>
                            <img
                                src={`data:image/png;base64,${sigPreview || stampData.signature_image}`}
                                alt="Signature preview"
                                style={{ maxHeight: 40, maxWidth: '100%' }}
                            />
                        </div>
                    )}
                    <Space style={{ marginTop: 8 }}>
                        <Form.Item name="sig_width_mm" label="Width (mm)" style={{ marginBottom: 0 }}>
                            <InputNumber min={5} max={200} step={0.5} style={{ width: 100 }} />
                        </Form.Item>
                        <Form.Item name="sig_height_mm" label="Height (mm)" style={{ marginBottom: 0 }}>
                            <InputNumber min={5} max={200} step={0.5} style={{ width: 100 }} />
                        </Form.Item>
                    </Space>
                </Form>
            </Modal>
        </div>
    );
};

export default StampPalette;
