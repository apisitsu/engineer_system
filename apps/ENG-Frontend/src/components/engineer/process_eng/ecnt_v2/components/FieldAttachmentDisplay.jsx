import React, { useState } from 'react';
import { Tag, Tooltip } from 'antd';
import { FileOutlined, EyeOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { AttachmentPreviewModal, getFileType, getFileUrl } from '../../../kanban/CardDetail/AttachmentViewManager';
import { server } from '../../../../../constance/constance';


export default function FieldAttachmentDisplay({ attachments = [], fieldName }) {
    const [previewTarget, setPreviewTarget] = useState(null);

    if (!attachments || attachments.length === 0) return null;

    const filtered = fieldName ? attachments.filter(a => a.field_name === fieldName) : attachments;
    if (filtered.length === 0) return null;

    const resolveItemUrl = (item) => {
        const rawUrl = item.file_url || item.url || item.file_path || '';
        if (!rawUrl) return '';
        if (rawUrl.startsWith('http')) return rawUrl;
        const base = (server.URL || server.API_URL || '').replace(/\/$/, '');
        return `${base}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
    };

    const handleItemClick = (item) => {
        const fullUrl = resolveItemUrl(item);
        setPreviewTarget({
            ...item,
            file_name: item.file_name || item.name || 'Attachment',
            file_path: fullUrl,
            file_url: fullUrl
        });
    };

    const imageFallback = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'%3E%3Crect width='72' height='72' fill='%23f5f5f5' stroke='%23d9d9d9' rx='4'/%3E%3Cpath d='M20 48l10-12 8 9 10-14 12 17H20z' fill='%23bfbfbf'/%3E%3Ccircle cx='28' cy='24' r='4' fill='%23bfbfbf'/%3E%3Ctext x='36' y='64' font-size='8' text-anchor='middle' fill='%238c8c8c' font-family='sans-serif'%3EUnavailable%3C/text%3E%3C/svg%3E";

    return (
        <div style={{ marginTop: 8, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📎 Attached Files & Inspection Media ({filtered.length}):</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                {filtered.map((item, idx) => {
                    const fullUrl = resolveItemUrl(item);
                    const fileName = item.file_name || item.name || `Attachment_${idx + 1}`;
                    const type = getFileType(fullUrl, fileName);
                    const isImg = type === 'image';
                    const isFolder = type === 'folder' || fullUrl.includes('drive.google.com/drive/folders/');

                    if (isFolder) {
                        return (
                            <Tooltip title="Open Google Drive Folder" key={item.id || idx}>
                                <Tag
                                    icon={<FolderOpenOutlined />}
                                    color="gold"
                                    onClick={() => window.open(fullUrl, '_blank', 'noreferrer')}
                                    style={{
                                        cursor: 'pointer',
                                        padding: '5px 10px',
                                        fontSize: 12,
                                        borderRadius: 6,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4
                                    }}
                                >
                                    📁 {fileName}
                                </Tag>
                            </Tooltip>
                        );
                    }

                    if (isImg) {
                        return (
                            <Tooltip title={`Click to zoom & inspect: ${fileName}`} key={item.id || idx}>
                                <div
                                    onClick={() => handleItemClick(item)}
                                    style={{
                                        position: 'relative',
                                        width: 72,
                                        height: 72,
                                        borderRadius: 6,
                                        overflow: 'hidden',
                                        border: '1px solid #cbd5e1',
                                        cursor: 'pointer',
                                        background: '#fff',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                        transition: 'transform 0.15s, box-shadow 0.15s'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.12)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
                                >
                                    <img
                                        src={getFileUrl({ ...item, file_path: fullUrl })}
                                        alt={fileName}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={(e) => { e.currentTarget.src = imageFallback; }}
                                    />
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        background: 'rgba(0,0,0,0.5)',
                                        color: '#fff',
                                        fontSize: 9,
                                        textAlign: 'center',
                                        padding: '1px 2px',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        🔍 Zoom
                                    </div>
                                </div>
                            </Tooltip>
                        );
                    }

                    return (
                        <Tooltip title="Click to view & inspect document" key={item.id || idx}>
                            <Tag
                                icon={type === 'pdf' ? <EyeOutlined /> : <FileOutlined />}
                                color={type === 'pdf' ? 'volcano' : 'blue'}
                                onClick={() => handleItemClick(item)}
                                style={{
                                    cursor: 'pointer',
                                    padding: '5px 10px',
                                    fontSize: 12,
                                    borderRadius: 6,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                }}
                            >
                                <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {fileName}
                                </span>
                                {item.file_size ? (
                                    <span style={{ fontSize: 10, opacity: 0.85, marginLeft: 2 }}>
                                        ({(item.file_size / 1024).toFixed(1)} KB)
                                    </span>
                                ) : null}
                            </Tag>
                        </Tooltip>
                    );
                })}
            </div>

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
