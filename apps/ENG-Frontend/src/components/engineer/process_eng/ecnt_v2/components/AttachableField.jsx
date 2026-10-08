import React, { useState } from 'react';
import { Form, Input, Upload, Button, Space, Typography, Tag, Spin, Tooltip, message as antdMessage, Modal } from 'antd';
import { PaperClipOutlined, FileOutlined, LoadingOutlined, EyeOutlined } from '@ant-design/icons';
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
        // Open helper popup synchronously within user click/interaction gesture
        let popup = null;
        try {
            popup = window.open('about:blank', 'gas_upload', 'width=460,height=420,left=350,top=150');
        } catch (e) {
            popup = null;
        }

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
            // Google Drive via GAS (Frontend direct to Google Apps Script Web App)
            if (!GAS_DRIVE_URL) {
                throw new Error('GAS_DRIVE_URL is not configured');
            }

            const targetEcr = ecrNo || 'ECNT_General';

            console.log('%c[AttachableField] 📎 uploadFile called:', 'color:#8b5cf6;font-weight:bold;', {
                fieldName: targetFieldName,
                fileName: file.name,
                fileSize: `${(file.size / 1024).toFixed(1)} KB`,
                fileType: file.type,
                ecrNo: targetEcr,
                ecnNo,
                blockNumber,
                popupOpened: Boolean(popup && !popup.closed)
            });

            const gasRes = await uploadEcntFileToDrive(file, {
                ecrNo: targetEcr,
                ecnNo,
                blockNumber,
                fieldName: targetFieldName
            }, { popup });

            console.log('%c[AttachableField] 📥 uploadEcntFileToDrive result:', 'color:#8b5cf6;', gasRes);

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
            } else {
                throw new Error(gasRes?.error || 'Google Drive upload failed');
            }
        } catch (gasErr) {
            console.error("[AttachableField] Google Drive upload error:", gasErr);
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
            antdMessage.error({
                content: `ไม่สามารถอัปโหลดไปยัง Google Drive ได้: ${gasErr.message || 'กรุณาลองใหม่อีกครั้ง'}`,
                key: msgKey,
                duration: 5
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
                        const isDrive = Boolean(item.drive_file_id) || 
                            (item.file_url && item.file_url.includes('drive.google.com')) || 
                            (fullUrl && fullUrl.includes('drive.google.com'));

                        if (isImg && isDrive) {
                            return (
                                <div key={idx} style={{ position: 'relative' }}>
                                    <Tooltip title={`Google Drive Image: ${fileName} (Click to preview)`}>
                                        <div 
                                            onClick={() => handleItemClick(item)}
                                            style={{ 
                                                width: 76, 
                                                height: 68, 
                                                borderRadius: 6, 
                                                overflow: 'hidden', 
                                                border: '1px solid #93c5fd', 
                                                cursor: 'pointer', 
                                                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                position: 'relative',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                                transition: 'all 0.2s ease',
                                                padding: '4px 6px'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = '#2563eb';
                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(37,99,235,0.2)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = '#93c5fd';
                                                e.currentTarget.style.transform = 'none';
                                                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
                                            }}
                                        >
                                            <div style={{
                                                position: 'absolute',
                                                top: 2,
                                                left: 4,
                                                fontSize: 8,
                                                fontWeight: 700,
                                                color: '#1d4ed8',
                                                letterSpacing: '0.3px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 2
                                            }}>
                                                📁 DRIVE
                                            </div>
                                            <div style={{ fontSize: 20, marginTop: 8, lineHeight: 1 }}>🖼️</div>
                                            <div style={{
                                                fontSize: 10,
                                                color: '#1e40af',
                                                fontWeight: 600,
                                                maxWidth: 68,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                marginTop: 2
                                            }}>
                                                {fileName.split('.').pop()?.toUpperCase() || 'IMG'}
                                            </div>
                                            <div style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                background: '#2563eb',
                                                color: '#fff',
                                                fontSize: 8,
                                                fontWeight: 600,
                                                textAlign: 'center',
                                                padding: '1px 0'
                                            }}>
                                                Preview
                                            </div>
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

                        if (isImg && !isDrive) {
                            const directImgUrl = getFileUrl({ ...item, file_path: fullUrl });
                            return (
                                <div key={idx} style={{ position: 'relative', width: 68, height: 68 }}>
                                    <Tooltip title={`Click to preview: ${fileName}`}>
                                        <div 
                                            onClick={() => handleItemClick(item)}
                                            style={{ 
                                                width: 68, 
                                                height: 68, 
                                                borderRadius: 6, 
                                                overflow: 'hidden', 
                                                border: '1px solid #cbd5e1', 
                                                cursor: 'pointer',
                                                background: '#fff',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                                            }}
                                        >
                                            <img
                                                src={directImgUrl}
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
