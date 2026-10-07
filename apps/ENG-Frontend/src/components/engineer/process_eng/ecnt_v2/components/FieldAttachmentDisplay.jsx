import React from 'react';
import { Image, Tag, Typography } from 'antd';
import { FileOutlined, DownloadOutlined } from '@ant-design/icons';
import { server } from '../../../../../constance/constance';

const { Link } = Typography;

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
        const base = (server.URL || server.API_URL || '').replace(/\/$/, '');
        return `${base}${url}`;
    };

    const imageFallback = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'%3E%3Crect width='72' height='72' fill='%23f5f5f5' stroke='%23d9d9d9' rx='4'/%3E%3Cpath d='M20 48l10-12 8 9 10-14 12 17H20z' fill='%23bfbfbf'/%3E%3Ccircle cx='28' cy='24' r='4' fill='%23bfbfbf'/%3E%3Ctext x='36' y='64' font-size='8' text-anchor='middle' fill='%238c8c8c' font-family='sans-serif'%3EUnavailable%3C/text%3E%3C/svg%3E";

    return (
        <div style={{ marginTop: 8, padding: '8px 10px', background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 6, fontWeight: 500 }}>
                📎 Attached Files / Images ({filtered.length}):
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
                                    fallback={imageFallback}
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
