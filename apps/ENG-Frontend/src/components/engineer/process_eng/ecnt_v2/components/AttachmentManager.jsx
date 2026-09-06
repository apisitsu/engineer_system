import React, { useState, useEffect } from 'react';
import { Upload, Button, List, message, Typography, Popconfirm, Spin, Tag, Space } from 'antd';
import { UploadOutlined, DeleteOutlined, PaperClipOutlined, DownloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../../constance/constance';

const { Text, Link } = Typography;

export default function AttachmentManager({ documentId, documentType, blockNumber = null, fieldName = null }) {
    const [fileList, setFileList] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (documentId) {
            fetchAttachments();
        }
    }, [documentId, documentType]);

    const fetchAttachments = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${server.URL}/api/ecnt/attachment/${documentType}/${documentId}`, { withCredentials: true });
            setFileList(res.data.data || []);
        } catch (err) {
            console.error("Fetch Attachments Error:", err);
            message.error("Failed to load attachments.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async ({ file }) => {
        try {
            message.loading({ content: 'Uploading file...', key: 'uploading' });
            
            const formData = new FormData();
            formData.append('file', file);

            // Step 1: Upload to local server storage
            const uploadRes = await axios.post(`${server.URL}/api/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true
            });

            if (uploadRes.data && uploadRes.data.success) {
                // Step 2: Save record in ecnt2_attachment
                await axios.post(`${server.URL}/api/ecnt/attachment`, {
                    document_id: documentId,
                    document_type: documentType,
                    block_number: blockNumber,
                    field_name: fieldName,
                    file_name: uploadRes.data.file_name,
                    file_url: uploadRes.data.file_url,
                    file_type: file.type,
                    file_size: file.size
                }, { withCredentials: true });

                message.success({ content: 'Upload completed!', key: 'uploading' });
                fetchAttachments();
            } else {
                throw new Error(uploadRes.data?.error || "Upload failed");
            }
        } catch (err) {
            console.error("Upload error:", err);
            message.error({ content: err.message || 'Upload failed.', key: 'uploading' });
        }
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`${server.URL}/api/ecnt/attachment/${id}`, { withCredentials: true });
            message.success("Attachment deleted");
            fetchAttachments();
        } catch (err) {
            message.error("Failed to delete attachment");
        }
    };

    const getFileUrl = (item) => {
        if (item.file_url && item.file_url.startsWith('http')) return item.file_url;
        return `${server.URL}${item.file_url}`;
    };

    return (
        <div style={{ marginTop: 12 }}>
            <Upload 
                customRequest={handleUpload} 
                showUploadList={false}
                disabled={!documentId}
            >
                <Button icon={<UploadOutlined />} disabled={!documentId}>
                    Attach File / Image
                </Button>
                {!documentId && (
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                        Save document first to attach files.
                    </Text>
                )}
            </Upload>
            
            <Spin spinning={loading}>
                {fileList.length > 0 ? (
                    <List
                        size="small"
                        style={{ marginTop: 12, background: '#fafafa', borderRadius: 6 }}
                        bordered
                        dataSource={fileList}
                        renderItem={item => (
                            <List.Item
                                actions={[
                                    <Link href={getFileUrl(item)} target="_blank" key="download">
                                        <Button type="text" icon={<DownloadOutlined />} size="small" />
                                    </Link>,
                                    <Popconfirm title="Delete this file?" onConfirm={() => handleDelete(item.id)} key="del">
                                        <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                                    </Popconfirm>
                                ]}
                            >
                                <List.Item.Meta
                                    avatar={<PaperClipOutlined style={{ fontSize: 18, color: '#1890ff' }} />}
                                    title={
                                        <Space>
                                            <Link href={getFileUrl(item)} target="_blank">
                                                {item.file_name}
                                            </Link>
                                            {item.block_number && <Tag color="cyan">Block {item.block_number}</Tag>}
                                        </Space>
                                    }
                                    description={
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            Uploaded by {item.uploaded_by} | Size: {item.file_size ? `${(item.file_size / 1024).toFixed(1)} KB` : 'N/A'}
                                        </Text>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                ) : (
                    <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>No attachments uploaded yet.</Text>
                    </div>
                )}
            </Spin>
        </div>
    );
}
