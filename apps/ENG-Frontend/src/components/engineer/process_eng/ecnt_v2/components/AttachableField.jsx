import React, { useState } from 'react';
import { Form, Input, Upload, Button, Image, Space, Typography, Tooltip, Tag, Spin } from 'antd';
import { PaperClipOutlined, DeleteOutlined, DownloadOutlined, FileOutlined, LoadingOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../../constance/constance';

const { TextArea } = Input;
const { Text, Link } = Typography;

const isImageFile = (file) => {
    if (!file) return false;
    const type = file.file_type || file.type || '';
    const name = file.file_name || file.name || '';
    return type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name);
};

export default function AttachableField({
    name,
    label,
    placeholder,
    rows = 3,
    rules = [],
    attachments = [],
    onAttachmentsChange,
    blockNumber = 2
}) {
    const [uploading, setUploading] = useState(false);

    const uploadFile = async (file) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await axios.post(`${server.URL}/api/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true
            });

            if (res.data && res.data.success) {
                const newAttachment = {
                    field_name: name,
                    block_number: blockNumber,
                    file_name: res.data.file_name,
                    file_url: res.data.file_url,
                    file_type: file.type || '',
                    file_size: file.size || null
                };
                if (onAttachmentsChange) {
                    onAttachmentsChange([...attachments, newAttachment]);
                }
            }
        } catch (err) {
            console.error("Upload error:", err);
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
                    // Give pasted image a friendly name
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

    const getFullUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `${server.URL}${url}`;
    };

    return (
        <div style={{ marginBottom: 14 }}>
            <Form.Item name={name} label={label} rules={rules} style={{ marginBottom: 6 }}>
                <TextArea 
                    rows={rows} 
                    placeholder={placeholder || 'ระบุรายละเอียด (สามารถกด Ctrl+V เพื่อวางรูปภาพที่แคปไว้ได้ทันที)...'} 
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
                            แนบรูป / ไฟล์
                        </Button>
                    </Upload>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                        (หรือกด Ctrl+V ในช่องข้อความเพื่อวางรูป)
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
                    background: '#f9f9f9', 
                    borderRadius: 6, 
                    border: '1px solid #f0f0f0' 
                }}>
                    <Image.PreviewGroup>
                        {attachments.map((item, idx) => {
                            const isImg = isImageFile(item);
                            if (isImg) {
                                return (
                                    <div key={idx} style={{ position: 'relative', width: 68, height: 68 }}>
                                        <Image
                                            src={getFullUrl(item.file_url)}
                                            alt={item.file_name}
                                            width={68}
                                            height={68}
                                            style={{ objectFit: 'cover', borderRadius: 4, border: '1px solid #d9d9d9' }}
                                        />
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
                                            title="ลบรูปนี้"
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
                                    style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', fontSize: 12 }}
                                    icon={<FileOutlined />}
                                    color="blue"
                                >
                                    <Link href={getFullUrl(item.file_url)} target="_blank" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                                        {item.file_name}
                                    </Link>
                                </Tag>
                            );
                        })}
                    </Image.PreviewGroup>
                </div>
            )}
        </div>
    );
}
