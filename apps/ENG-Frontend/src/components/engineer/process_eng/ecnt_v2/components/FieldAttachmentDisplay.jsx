import React from 'react';
import { Image, Tag, Typography, Space } from 'antd';
import { FileOutlined, DownloadOutlined } from '@ant-design/icons';
import { server } from '../../../../../constance/constance';

const { Link, Text } = Typography;

const isImageFile = (file) => {
    if (!file) return false;
    const type = file.file_type || file.type || '';
    const name = file.file_name || file.name || '';
    return type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name);
};

export default function FieldAttachmentDisplay({ attachments = [], fieldName }) {
    if (!attachments || attachments.length === 0) return null;

    const filtered = attachments.filter(a => a.field_name === fieldName);
    if (filtered.length === 0) return null;

    const getFullUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `${server.URL}${url}`;
    };

    return (
        <div style={{ marginTop: 8, padding: '8px 10px', background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 6, fontWeight: 500 }}>
                📎 แนบไฟล์/รูปภาพสำหรับรายการนี้ ({filtered.length}):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <Image.PreviewGroup>
                    {filtered.map((item, idx) => {
                        const isImg = isImageFile(item);
                        if (isImg) {
                            return (
                                <Image
                                    key={item.id || idx}
                                    src={getFullUrl(item.file_url)}
                                    alt={item.file_name}
                                    width={72}
                                    height={72}
                                    style={{ objectFit: 'cover', borderRadius: 4, border: '1px solid #d9d9d9', cursor: 'pointer' }}
                                />
                            );
                        }
                        return (
                            <Tag 
                                key={item.id || idx} 
                                icon={<FileOutlined />} 
                                color="blue" 
                                style={{ padding: '4px 8px', fontSize: 12 }}
                            >
                                <Link href={getFullUrl(item.file_url)} target="_blank">
                                    <DownloadOutlined style={{ marginRight: 4 }} />
                                    {item.file_name} {item.file_size ? `(${(item.file_size / 1024).toFixed(1)} KB)` : ''}
                                </Link>
                            </Tag>
                        );
                    })}
                </Image.PreviewGroup>
            </div>
        </div>
    );
}
