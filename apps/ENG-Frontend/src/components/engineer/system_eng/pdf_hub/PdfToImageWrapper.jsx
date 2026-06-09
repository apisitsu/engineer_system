import React, { useState } from 'react';
import {
    Card, Upload, Input, Select, Button, Form, Row, Col, Spin,
    Image, message, Typography, Tag,
} from 'antd';
import { InboxOutlined, FileImageOutlined, DownloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';

const { Dragger } = Upload;
const { Option } = Select;
const { Title, Text } = Typography;

/**
 * PdfToImageWrapper — Renders the PDF-to-Image converter content
 * without its own Layout/Sidebar wrapper, for embedding inside PdfHubLayout.
 */
const PdfToImageWrapper = () => {
    const [form] = Form.useForm();
    const { theme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [outputImages, setOutputImages] = useState([]);
    const [fileList, setFileList] = useState([]);

    const handleFileChange = ({ fileList: newFileList }) => {
        setFileList(newFileList.slice(-1));
    };

    const handleSubmit = async (values) => {
        if (fileList.length === 0) {
            message.error('Please upload a PDF file.');
            return;
        }

        setLoading(true);
        setOutputImages([]);

        const formData = new FormData();
        formData.append('pdf', fileList[0].originFileObj);
        formData.append('pages', values.pages || '');
        formData.append('format', values.format || 'jpg');

        const token = localStorage.getItem("token");

        try {
            const response = await axios.post(server.PDF_TO_IMAGE, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.data.success) {
                message.success('Conversion successful!');
                const fullImageUrls = response.data.images.map(img => `${server.API_URL}${img.startsWith('/') ? '' : '/'}${img}`);
                setOutputImages(fullImageUrls);
            } else {
                message.error(response.data.message || 'Conversion failed.');
            }
        } catch (error) {
            console.error('Conversion API error:', error);
            const errorMessage = error.response?.data?.message || 'An unexpected error occurred.';
            message.error(`Error: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    const draggerProps = {
        name: 'file',
        multiple: false,
        fileList,
        beforeUpload: (file) => {
            if (file.type !== 'application/pdf') {
                message.error(`${file.name} is not a PDF file.`);
                return Upload.LIST_IGNORE;
            }
            return false;
        },
        onChange: handleFileChange,
        onRemove: () => setFileList([]),
    };

    const handleDownload = async (url, filename) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error("Download failed:", error);
            window.open(url, '_blank');
        }
    };

    return (
        <Spin spinning={loading} tip="Converting PDF..." size="large">
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <Title level={3} style={{ color: theme.colors.textPrimary, marginBottom: 24 }}>
                    <FileImageOutlined style={{ marginRight: 12, color: theme.colors.primary }} />
                    PDF to Image Converter
                </Title>

                <Card style={{
                    borderRadius: 16,
                    boxShadow: theme.shadows.sm,
                    border: `1px solid ${theme.colors.border}`,
                    background: theme.colors.surface,
                }}>
                    <Row gutter={[32, 32]}>
                        <Col xs={24} lg={10}>
                            <Title level={4} style={{ marginBottom: 24, color: theme.colors.textPrimary }}>1. Upload & Configure</Title>
                            <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ format: 'jpg' }}>
                                <Form.Item name="pdfFile" label="PDF File"
                                    rules={[{ required: true, message: 'Please upload a file' }]}
                                    getValueFromEvent={(e) => Array.isArray(e) ? e : e?.fileList}
                                >
                                    <Dragger {...draggerProps} style={{
                                        borderRadius: 12, padding: 24,
                                        border: `1px dashed ${theme.colors.primary}88`,
                                        background: `${theme.colors.primary}05`,
                                    }}>
                                        <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: theme.colors.primary }} /></p>
                                        <p className="ant-upload-text">Click or drag PDF file to this area</p>
                                        <p className="ant-upload-hint">Supports a single PDF file for conversion.</p>
                                    </Dragger>
                                </Form.Item>
                                <Form.Item name="pages" label="Pages to Convert" help="e.g., 1, 3, 5-7. Leave blank for all.">
                                    <Input placeholder="All pages" size="large" style={{ borderRadius: 8 }} />
                                </Form.Item>
                                <Form.Item name="format" label="Output Image Format" rules={[{ required: true }]}>
                                    <Select size="large"><Option value="jpg">JPG</Option><Option value="png">PNG</Option></Select>
                                </Form.Item>
                                <Form.Item style={{ marginTop: 32 }}>
                                    <Button type="primary" htmlType="submit" block loading={loading} size="large"
                                        style={{ height: 50, borderRadius: 10, fontWeight: 600, fontSize: 16 }}>
                                        Convert to Images
                                    </Button>
                                </Form.Item>
                            </Form>
                        </Col>
                        <Col xs={24} lg={14}>
                            <Title level={4} style={{ marginBottom: 24, color: theme.colors.textPrimary }}>2. Results</Title>
                            <div style={{
                                border: `1px solid ${theme.colors.border}`, borderRadius: 12, padding: 24,
                                minHeight: 400, backgroundColor: `${theme.colors.background}88`,
                                display: 'flex', flexDirection: 'column',
                            }}>
                                {outputImages.length > 0 ? (
                                    <>
                                        <div style={{ textAlign: 'center', marginBottom: 20 }}>
                                            <Tag color="success" style={{ padding: '4px 12px', borderRadius: 20 }}>
                                                {outputImages.length} image(s) generated
                                            </Tag>
                                        </div>
                                        <div style={{ flex: 1, overflowY: 'auto', maxHeight: 600, paddingRight: 8 }} className="kb-vscroll">
                                            <Image.PreviewGroup>
                                                <Row gutter={[16, 16]}>
                                                    {outputImages.map((imageUrl, index) => (
                                                        <Col key={index} xs={12} sm={8}>
                                                            <Card hoverable
                                                                cover={<Image alt={`Page ${index + 1}`} src={imageUrl} style={{ height: 160, objectFit: 'contain', padding: 12, background: 'white' }} />}
                                                                bodyStyle={{ padding: 8 }} style={{ borderRadius: 12, overflow: 'hidden' }}
                                                                actions={[
                                                                    <Button type="link" icon={<DownloadOutlined />}
                                                                        onClick={() => handleDownload(imageUrl, `page_${index + 1}.jpg`)} style={{ padding: 0 }}>
                                                                        Download
                                                                    </Button>
                                                                ]}
                                                            />
                                                        </Col>
                                                    ))}
                                                </Row>
                                            </Image.PreviewGroup>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ margin: 'auto', textAlign: 'center' }}>
                                        <FileImageOutlined style={{ fontSize: 64, color: theme.colors.border }} />
                                        <Title level={5} style={{ color: theme.colors.textSecondary, marginTop: 16 }}>Your converted images will appear here</Title>
                                        <Text type="secondary">Upload a PDF and click convert to see results.</Text>
                                    </div>
                                )}
                            </div>
                        </Col>
                    </Row>
                </Card>
            </div>
        </Spin>
    );
};

export default PdfToImageWrapper;
