import React, { useState } from 'react';
import { Form, Input, Upload, Button, Space, Typography, Tag, Spin, Tooltip, message as antdMessage, Modal } from 'antd';
import { PaperClipOutlined, FileOutlined, LoadingOutlined, EyeOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server, GAS_DRIVE_URL } from '../../../../../constance/constance';
import { uploadEcntFileToDrive, openGoogleDriveAuthWindow } from '../../../../../utils/uploadFileToDrive';
import { AttachmentPreviewModal, getFileType, getFileUrl } from '../../../kanban/CardDetail/AttachmentViewManager';

const { TextArea } = Input;
const { Text } = Typography;

export default function AttachableField({
    name,
    fieldName,
    label,
    placeholder,
    rows = 3,
    rules = [],
    attachments = [],
    onAttachmentsChange,
    blockNumber = 2,
    ecrNo = '',
    ecnNo = ''
}) {
    const [uploading, setUploading] = useState(false);
    const [previewTarget, setPreviewTarget] = useState(null);

    const getFullUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        const base = (server.URL || server.API_URL || '').replace(/\/$/, '');
        return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const uploadFile = async (file) => {
        setUploading(true);
        const targetFieldName = fieldName || (Array.isArray(name) ? name.join('_') : String(name || 'attachment'));

        // Live uploading message banner (keeps user aware that upload is in progress)
        const msgKey = `drive_up_${Date.now()}_${file.name}`;
        antdMessage.loading({
            content: `กำลังอัปโหลด ${file.name} ไปยัง Google Drive...`,
            key: msgKey,
            duration: 0
        });

        try {
            // Priority 1: Google Drive via GAS (Frontend direct to Google Apps Script)
            if (GAS_DRIVE_URL) {
                let popup = null;
                try {
                    popup = window.open('about:blank', 'gas_upload', 'width=460,height=380,left=300,top=120');
                } catch (e) {
                    popup = null;
                }

                try {
                    const gasRes = await uploadEcntFileToDrive(file, {
                        ecrNo,
                        ecnNo,
                        blockNumber,
                        fieldName: targetFieldName
                    }, { popup });

                    if (gasRes && gasRes.success) {
                        const newAttachment = {
                            field_name: targetFieldName,
                            block_number: blockNumber,
                            file_name: gasRes.fileName || file.name,
                            file_url: gasRes.webViewLink,
                            file_type: gasRes.mimeType || file.type || '',
                            file_size: gasRes.fileSize || file.size || null,
                            drive_file_id: gasRes.fileId,
                            drive_folder_url: gasRes.folderUrl
                        };
                        if (onAttachmentsChange) {
                            onAttachmentsChange([...attachments, newAttachment]);
                        }
                        antdMessage.success({
                            content: `อัปโหลด ${file.name} ไปยัง Google Drive สำเร็จ`,
                            key: msgKey,
                            duration: 3
                        });
                        return;
                    }
                } catch (gasErr) {
                    if (popup && !popup.closed) {
                        try { popup.close(); } catch (e) {}
                    }
                    console.warn("[AttachableField] Google Drive upload error/fallback:", gasErr.message);
                    if (gasErr.isAuthRequired) {
                        Modal.confirm({
                            title: 'จำเป็นต้องยืนยันสิทธิ์ Google Drive',
                            content: (
                                <div>
                                    <p>ไม่สามารถอัปโหลดไฟล์ในเบื้องหลังได้ เนื่องจากระบบต้องการการเข้าสู่ระบบหรืออนุญาตสิทธิ์ Google Apps Script ก่อน</p>
                                    <p style={{ color: '#ef4444', fontSize: 12, margin: '4px 0 0' }}>
                                        รายละเอียด: {gasErr.message}
                                    </p>
                                </div>
                            ),
                            okText: '🔑 เปิดหน้าต่างยืนยันสิทธิ์ (Popup)',
                            cancelText: 'ปิด',
                            onOk: () => {
                                openGoogleDriveAuthWindow();
                            }
                        });
                    }
                }
            }

            // Priority 2: Fallback to local server multipart upload
            antdMessage.loading({
                content: `กำลังส่งไฟล์ ${file.name} ไปยังระบบเซิร์ฟเวอร์...`,
                key: msgKey,
                duration: 0
            });

            const formData = new FormData();
            formData.append('file', file);

            const token = localStorage.getItem("token");
            const baseUrl = (server.URL || server.API_URL || '').replace(/\/$/, '');
            const res = await axios.post(`${baseUrl}/api/upload`, formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                withCredentials: true
            });

            if (res.data && res.data.success) {
                const newAttachment = {
                    field_name: targetFieldName,
                    block_number: blockNumber,
                    file_name: res.data.file_name,
                    file_url: res.data.file_url,
                    file_type: file.type || '',
                    file_size: file.size || null
                };
                if (onAttachmentsChange) {
                    onAttachmentsChange([...attachments, newAttachment]);
                }
                antdMessage.success({
                    content: `แนบไฟล์ ${file.name} เรียบร้อยแล้ว`,
                    key: msgKey,
                    duration: 3
                });
            }
        } catch (err) {
            console.error("[AttachableField] Upload error:", err);
            antdMessage.error({
                content: `อัปโหลดล้มเหลว: ${err.message || 'Server error'}`,
                key: msgKey,
                duration: 4
            });
        } finally {
            setUploading(false);
        }
    };

    const handlePaste = (e) => {
        const clipboardData = e.clipboardData;
        if (!clipboardData || !clipboardData.items) return;

        for (let i = 0; i < clipboardData.items.length; i++) {
            const item = clipboardData.items[i];
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    const namedFile = new File([file], `screenshot_${Date.now()}.png`, { type: file.type });
                    uploadFile(namedFile);
                }
            }
        }
    };

    const handleDelete = (index) => {
        const updated = attachments.filter((_, i) => i !== index);
        if (onAttachmentsChange) onAttachmentsChange(updated);
    };

    const handleItemClick = (item) => {
        const fullUrl = getFullUrl(item.file_url);
        setPreviewTarget({
            ...item,
            file_name: item.file_name || item.name || 'Attachment',
            file_path: fullUrl,
            file_url: fullUrl
        });
    };

    const imageFallback = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='68' height='68' viewBox='0 0 68 68'%3E%3Crect width='68' height='68' fill='%23f5f5f5' stroke='%23d9d9d9' rx='4'/%3E%3Cpath d='M18 46l10-12 8 9 10-14 12 17H18z' fill='%23bfbfbf'/%3E%3Ccircle cx='26' cy='24' r='4' fill='%23bfbfbf'/%3E%3C/svg%3E";

    return (
        <div style={{ marginBottom: 14 }}>
            <Form.Item name={name} label={label} rules={rules} style={{ marginBottom: 6 }}>
                <TextArea 
                    rows={rows} 
                    placeholder={placeholder || 'Enter details (Press Ctrl+V to paste captured screenshots directly)...'} 
                    onPaste={handlePaste}
                />
            </Form.Item>

            {/* Attachment Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Space size="small">
                    <Upload 
                        customRequest={({ file }) => uploadFile(file)}
                        showUploadList={false}
                        multiple
                    >
                        <Button 
                            size="small" 
                            icon={uploading ? <LoadingOutlined /> : <PaperClipOutlined />}
                            disabled={uploading}
                            style={{ fontSize: 12, borderRadius: 4 }}
                        >
                            {uploading ? 'Uploading to Drive...' : 'Attach File / Image'}
                        </Button>
                    </Upload>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                        (or press Ctrl+V in text box to paste image)
                    </Text>
                </Space>
                {uploading && <Spin size="small" />}
            </div>

            {/* Attachments List / Gallery */}
            {attachments.length > 0 && (
                <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 8, 
                    padding: '8px 10px', 
                    background: '#f8fafc', 
                    borderRadius: 6, 
                    border: '1px solid #e2e8f0' 
                }}>
                    {attachments.map((item, idx) => {
                        const fullUrl = getFullUrl(item.file_url);
                        const fileName = item.file_name || item.name || `File_${idx + 1}`;
                        const type = getFileType(fullUrl, fileName);
                        const isImg = type === 'image';

                        if (isImg) {
                            return (
                                <div key={idx} style={{ position: 'relative', width: 68, height: 68 }}>
                                    <Tooltip title={`Click to preview: ${fileName}`}>
                                        <div 
                                            onClick={() => handleItemClick(item)}
                                            style={{ 
                                                width: 68, 
                                                height: 68, 
                                                borderRadius: 4, 
                                                overflow: 'hidden', 
                                                border: '1px solid #cbd5e1', 
                                                cursor: 'pointer',
                                                background: '#fff'
                                            }}
                                        >
                                            <img
                                                src={getFileUrl({ ...item, file_path: fullUrl })}
                                                alt={fileName}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => { e.currentTarget.src = imageFallback; }}
                                            />
                                        </div>
                                    </Tooltip>
                                    <div 
                                        onClick={() => handleDelete(idx)}
                                        style={{
                                            position: 'absolute',
                                            top: -6,
                                            right: -6,
                                            background: '#ff4d4f',
                                            color: '#fff',
                                            width: 18,
                                            height: 18,
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            fontSize: 10,
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                            zIndex: 10
                                        }}
                                        title="Delete attachment"
                                    >
                                        ✕
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <Tag 
                                key={idx} 
                                closable 
                                onClose={() => handleDelete(idx)}
                                style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
                                icon={type === 'pdf' ? <EyeOutlined /> : <FileOutlined />}
                                color={type === 'pdf' ? 'volcano' : 'blue'}
                            >
                                <span 
                                    onClick={() => handleItemClick(item)}
                                    style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}
                                >
                                    {fileName}
                                </span>
                            </Tag>
                        );
                    })}
                </div>
            )}

            {/* High-Fidelity Technical Drawing & Document Preview Modal */}
            <AttachmentPreviewModal
                visible={Boolean(previewTarget)}
                onClose={() => setPreviewTarget(null)}
                attachment={previewTarget}
                theme={{ colors: { primary: '#1890ff', textTertiary: '#8c8c8c' } }}
            />
        </div>
    );
}
