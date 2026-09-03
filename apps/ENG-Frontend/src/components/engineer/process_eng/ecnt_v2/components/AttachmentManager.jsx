import React, { useState, useEffect } from 'react';
import { Upload, Button, List, message, Typography, Popconfirm, Spin } from 'antd';
import { UploadOutlined, DeleteOutlined, PaperClipOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../../constance/constance';

const { Text, Link } = Typography;

export default function AttachmentManager({ documentId, documentType }) {
    const [fileList, setFileList] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (documentId) {
            fetchAttachments();
        }
    }, [documentId]);

    const fetchAttachments = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${server.URL}/api/ecnt/attachment/${documentType}/${documentId}`, { withCredentials: true });
            setFileList(res.data.data);
        } catch (err) {
            message.error("Failed to load attachments.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (file) => {
        // Step 1: Upload to Google Apps Script Bridge
        const GAS_URL = process.env.REACT_APP_GAS_DRIVE_URL || 'https://script.google.com/macros/s/AKfycbyeg7I4oCoNEX5K36D44IHG8O0iWOtsiBigO-eGqc9c9Twe8PYys0iLsrJXwydm4vdC/exec'; // Fallback to provided URL
        
        try {
            message.loading({ content: 'Uploading to Google Drive...', key: 'uploading' });
            
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Data = reader.result.split(',')[1];
                
                // Construct GAS Payload
                const payload = {
                    file: base64Data,
                    mimeType: file.type,
                    filename: file.name,
                    folderId: 'root' // Ideally configured per project in GAS
                };

                // Due to CORS/Proxy, we might need a traditional form POST or let the proxy handle it
                // Using standard axios POST (assuming proxy handles CORS or GAS is configured)
                const gasRes = await axios.post(GAS_URL, JSON.stringify(payload), {
                    headers: { 'Content-Type': 'text/plain' } // GAS avoids CORS preflight with text/plain
                });

                if (gasRes.data && gasRes.data.fileId) {
                    // Step 2: Save metadata to our database
                    await axios.post(`${server.URL}/api/ecnt/attachment`, {
                        document_id: documentId,
                        document_type: documentType,
                        file_name: file.name,
                        drive_file_id: gasRes.data.fileId,
                        mime_type: file.type
                    }, { withCredentials: true });

                    message.success({ content: 'Upload complete!', key: 'uploading' });
                    fetchAttachments();
                } else {
                    throw new Error("Invalid response from Google Drive");
                }
            };
        } catch (err) {
            console.error(err);
            message.error({ content: 'Upload failed.', key: 'uploading' });
        }
        
        return false; // Prevent AntD default upload behavior
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

    return (
        <div style={{ marginTop: 16 }}>
            <Upload 
                beforeUpload={handleUpload} 
                showUploadList={false}
                disabled={!documentId}
            >
                <Button icon={<UploadOutlined />} disabled={!documentId}>Attach File (Google Drive)</Button>
                {!documentId && <Text type="secondary" style={{marginLeft: 8}}>Save document first to attach files.</Text>}
            </Upload>
            
            <Spin spinning={loading}>
                <List
                    size="small"
                    style={{ marginTop: 16 }}
                    bordered
                    dataSource={fileList}
                    renderItem={item => (
                        <List.Item
                            actions={[
                                <Popconfirm title="Delete this file?" onConfirm={() => handleDelete(item.id)}>
                                    <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                                </Popconfirm>
                            ]}
                        >
                            <List.Item.Meta
                                avatar={<PaperClipOutlined />}
                                title={
                                    <Link href={`https://drive.google.com/file/d/${item.drive_file_id}/view`} target="_blank">
                                        {item.file_name}
                                    </Link>
                                }
                                description={`Uploaded by ${item.uploaded_by}`}
                            />
                        </List.Item>
                    )}
                />
            </Spin>
        </div>
    );
}
