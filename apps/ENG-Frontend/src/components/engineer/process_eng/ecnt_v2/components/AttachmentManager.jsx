import React, { useState, useEffect } from 'react';
import { Upload, Button, List, message, Typography, Popconfirm, Spin, Tag, Space } from 'antd';
import { UploadOutlined, DeleteOutlined, PaperClipOutlined, DownloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../../constance/constance';
import { deleteFileFromDrive, uploadEcntFileToDrive } from '../../../../../utils/uploadFileToDrive';

const { Text, Link } = Typography;

export default function AttachmentManager({ documentId, documentType, ecrNo = '', ecnNo = '', blockNumber = null, fieldName = null }) {
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
        // Open helper popup synchronously within user click/interaction gesture
        let popup = null;
        try {
            popup = window.open('about:blank', 'gas_upload', 'width=460,height=420,left=350,top=150');
        } catch (e) {
            popup = null;
        }

        const msgKey = `ecnt_att_${Date.now()}`;
        try {
            message.loading({ content: `กำลังอัปโหลด ${file.name} ไปยัง Google Drive...`, key: msgKey, duration: 0 });
            
            // 100% Direct to Google Drive via GAS (NO Backend Server Storage)
            const targetEcr = ecrNo || (documentType === 'ECR' ? `ECR_${documentId}` : '') || 'ECNT_General';
            const targetEcn = ecnNo || (documentType === 'ECN' ? `ECN_${documentId}` : '');

            const gasRes = await uploadEcntFileToDrive(file, {
                ecrNo: targetEcr,
                ecnNo: targetEcn,
                blockNumber: blockNumber,
                fieldName: fieldName || 'attachment'
            }, { popup });

            if (gasRes && gasRes.success) {
                // Step 2: Save metadata record in ecnt2_attachment
                await axios.post(`${server.URL}/api/ecnt/attachment`, {
                    document_id: documentId,
                    document_type: documentType,
                    block_number: blockNumber,
                    field_name: fieldName || 'attachment',
                    file_name: gasRes.fileName || file.name,
                    file_url: gasRes.webViewLink,
                    file_type: gasRes.mimeType || file.type || '',
                    file_size: gasRes.fileSize || file.size || null,
                    drive_file_id: gasRes.fileId,
                    drive_folder_url: gasRes.folderUrl
                }, { withCredentials: true });

                message.success({ content: `อัปโหลด ${file.name} ไปยัง Google Drive สำเร็จ!`, key: msgKey, duration: 3 });
                fetchAttachments();
            } else {
                throw new Error(gasRes?.error || "Google Drive upload failed");
            }
        } catch (err) {
            console.error("[AttachmentManager] Upload error:", err);
            message.error({ content: err.message || 'Upload failed.', key: msgKey, duration: 4 });
        }
    };

    const handleDelete = async (id, item = null) => {
        try {
            let driveFileId = item?.drive_file_id;
            if (!driveFileId && item?.file_url) {
                const match = item.file_url.match(/\/d\/([^/?#]+)/) || item.file_url.match(/[?&]id=([^/&?#]+)/);
                if (match && match[1]) driveFileId = match[1];
            }
            if (driveFileId) {
                let popup = null;
                try {
                    popup = window.open('about:blank', 'gas_delete', 'width=420,height=300,left=350,top=150');
                } catch (e) {
                    popup = null;
                }
                try {
                    await deleteFileFromDrive(driveFileId, { popup });
                } catch (driveErr) {
                    console.warn('[ECNT AttachmentManager] Drive deletion warning:', driveErr);
                }
            }

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
                                    <Popconfirm title="Delete this file?" onConfirm={() => handleDelete(item.id, item)} key="del">
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
