import React, { useState } from 'react';
import { Modal, Button, Space, Typography, Image, Tooltip } from 'antd';
import { MdZoomIn, MdZoomOut, MdOpenInNew, MdClose, MdFileDownload } from 'react-icons/md';
import { FiPaperclip } from 'react-icons/fi';
import { server } from '../../../../constance/constance';

const { Text } = Typography;

/**
 * Detect file type based on extension and URL patterns
 */
export const getFileType = (url, name) => {
    if (!url && !name) return 'other';

    // Normalize URL and Name
    const cleanUrl = url?.split('?')[0].split('#')[0].toLowerCase() || '';
    const cleanName = name?.toLowerCase() || '';

    // Helper to check extension
    const hasExt = (exts) => {
        return exts.some(ext => cleanUrl.endsWith(`.${ext}`) || cleanName.endsWith(`.${ext}`));
    };

    // Microsoft Office (including Google Docs Office editing mode)
    const msOfficeExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
    if (hasExt(msOfficeExtensions) || (url?.includes('docs.google.com') && url?.includes('rtpof=true'))) {
        return 'microsoft';
    }

    // Images
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    if (hasExt(imageExtensions)) {
        return 'image';
    }

    // PDF
    const pdfExtensions = ['pdf'];
    if (hasExt(pdfExtensions)) {
        return 'pdf';
    }

    // Google Drive Files (Stored binary files like images, PDFs, etc. that aren't native G-Docs)
    if (url?.includes('drive.google.com/file/d/') || url?.includes('drive.google.com/open?id=')) {
        return 'google_file';
    }

    // Google Native Services (Docs, Sheets, Slides, etc.)
    const googleDocsExtensions = ['gdoc', 'gsheet', 'gslides', 'gdraw', 'gtable', 'gform', 'gshortcuts'];
    if (googleDocsExtensions.some(ext => cleanName.endsWith(`.${ext}`)) ||
        url?.includes('docs.google.com') ||
        url?.includes('drive.google.com')) {
        return 'google';
    }

    // Folders (Local path without extension OR Google Drive folder)
    const isLocalPath = /^[a-zA-Z]:[\\\/]|^\\\\[^\/\\]+/.test(url);
    const hasExtension = /\.[a-zA-Z0-9]{2,5}$/.test(cleanName) || /\.[a-zA-Z0-9]{2,5}$/.test(cleanUrl);
    
    if ((isLocalPath && !hasExtension) || url?.includes('drive.google.com/drive/folders/')) {
        return 'folder';
    }

    return 'other';
};

/**
 * Get the full URL for an attachment
 */
export const getFileUrl = (att) => {
    if (!att) return '';

    let rawUrl = '';
    // If it's already a full URL
    if (att.file_path?.startsWith('http')) {
        rawUrl = att.file_path;
    } else if (att.link_data) {
        // Handle linkData for link attachments (some might be JSON)
        try {
            const linkData = typeof att.link_data === 'string' ? JSON.parse(att.link_data) : att.link_data;
            if (linkData?.url) rawUrl = linkData.url;
        } catch (e) {
            // parsing failed
        }
    }

    if (!rawUrl && att.file_path) {
        // Fix relative paths for files stored on server
        const cleanPath = att.file_path.replace(/^public[\/\\]/, '').replace(/\\/g, '/');
        rawUrl = `${server.API_URL}${cleanPath}`;
    }

    if (!rawUrl) return '';

    // Transform Google Drive links for better previewing
    if (rawUrl.includes('drive.google.com')) {
        // Extract File ID from typical Drive URL patterns
        const fileIdMatch = rawUrl.match(/\/d\/([^\/?#]+)/) || rawUrl.match(/[?&]id=([^\/&?#]+)/);
        if (fileIdMatch && fileIdMatch[1]) {
            const fileId = fileIdMatch[1];
            const type = getFileType(rawUrl, att.file_name || att.name);

            if (type === 'image') {
                // Direct link for <img> tags
                return `https://drive.google.com/uc?id=${fileId}&export=view`;
            }
            // PDF and other documents work best with /preview URL in an iframe
            return `https://drive.google.com/file/d/${fileId}/preview`;
        }
    }

    // Transform Google Docs "Office Mode" links to direct exports
    if (rawUrl.includes('docs.google.com') && rawUrl.includes('rtpof=true')) {
        const fileIdMatch = rawUrl.match(/\/d\/([^\/?#]+)/);
        if (fileIdMatch && fileIdMatch[1]) {
            const fileId = fileIdMatch[1];
            if (rawUrl.includes('/document/')) return `https://docs.google.com/document/d/${fileId}/export?format=docx`;
            if (rawUrl.includes('/spreadsheets/')) return `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`;
            if (rawUrl.includes('/presentation/')) return `https://docs.google.com/presentation/d/${fileId}/export?format=pptx`;
        }
    }

    // Detect local/UNC paths (e.g., H:\... or \\server\...)
    const isLocalPath = /^[a-zA-Z]:[\\\/]|^\\\\[^\/\\]+/.test(rawUrl);
    if (isLocalPath) return rawUrl;

    return rawUrl;
};

/**
 * Helper to get the Microsoft Office URI scheme for a given URL
 */
const getOfficeScheme = (url) => {
    const lowerUrl = url.toLowerCase();
    const isLocal = /^[a-zA-Z]:[\\\/]|^\\\\[^\/\\]+/.test(url);

    // For local paths (mapped by Google Drive for Desktop), we use a custom protocol
    // that we will register on the local machine to open files immediately.
    if (isLocal) return 'eng-open:';

    // For web URLs, we use standard Office 'ofe|u|' protocols
    if (lowerUrl.includes('.doc') || lowerUrl.includes('format=docx')) return 'ms-word:ofe|u|';
    if (lowerUrl.includes('.xls') || lowerUrl.includes('format=xlsx')) return 'ms-excel:ofe|u|';
    if (lowerUrl.includes('.ppt') || lowerUrl.includes('format=pptx')) return 'ms-powerpoint:ofe|u|';
    return null;
};

/**
 * Component for the attachment link itself
 */
export const AttachmentLink = ({ attachment, theme, onClick }) => {
    // Get the preview-optimized URL
    const url = getFileUrl(attachment);

    // Get the raw/original name and path for accurate type detection
    const name = attachment.file_name || attachment.name || '';
    const rawPath = attachment.file_path || url;
    const type = getFileType(rawPath, name);

    const handleClick = (e) => {
        // According to requirements:
        // 1. Image, PDF, and general Google Drive files -> Show the popup modal
        // 2. Microsoft Link -> Open in new tab (triggers download for exported Google docs)
        // 3. Google Link (native) -> Open with Google service (default <a> behavior)

        if (type === 'image' || type === 'pdf' || type === 'google_file') {
            e.preventDefault();
            onClick(attachment);
        } else if (type === 'microsoft' || type === 'folder') {
            // Check if it's a local/mapped drive path (e.g., H:\) or a UNC path
            const isLocalPath = /^[a-zA-Z]:[\\\/]|^\\\\[^\/\\]+/.test(url);

            if (isLocalPath) {
                const scheme = getOfficeScheme(url);
                if (scheme) {
                    e.preventDefault();
                    // Using URI schemes for local/network paths is the best way to bypass browser security
                    window.location.href = `${scheme}${url}`;
                }
            }
        }
        // For others, let the default behavior happen
    };

    if (type === 'folder') {
        return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={handleClick}
                    style={{
                        color: theme.colors.primary,
                        fontSize: 13,
                        fontWeight: 600,
                        textDecoration: 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer'
                    }}
                >
                    📁 {name || 'Open Folder'}
                </a>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {url}
                </Text>
            </div>
        );
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={handleClick}
            style={{
                flex: 1,
                color: theme.colors.primary,
                fontSize: 13,
                textDecoration: 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'pointer'
            }}
        >
            {name || url}
        </a>
    );
};

/**
 * Modal component for Image and PDF previews
 */
export const AttachmentPreviewModal = ({ visible, onClose, attachment, theme }) => {
    const [zoom, setZoom] = useState(100);

    if (!attachment) return null;

    const fileUrl = getFileUrl(attachment);
    const fileName = attachment.file_name || attachment.name || 'Attachment';
    const type = getFileType(attachment.file_path || fileUrl, fileName);

    const handleOpenNewTab = () => {
        window.open(fileUrl, '_blank', 'noreferrer');
    };

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 400));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25));
    const handleResetZoom = () => setZoom(100);

    return (
        <Modal
            open={visible}
            onCancel={onClose}
            title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
                    <Text strong ellipsis style={{ maxWidth: '80%', fontSize: 16 }}>{fileName}</Text>
                </div>
            }
            width={type === 'image' ? 'auto' : '90%'}
            centered
            footer={null}
            styles={{ body: { padding: 0, overflow: 'hidden' } }}
            closeIcon={<MdClose size={24} style={{ color: theme.colors.textTertiary }} />}
        >
            <div style={{
                height: type === 'image' ? 'auto' : '85vh',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                background: '#141414',
                position: 'relative'
            }}>
                {/* Control Bar */}
                <div style={{
                    padding: '8px 24px',
                    background: '#1f1f1f',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #303030',
                    zIndex: 10
                }}>
                    <Space size="middle">
                        <Space>
                            <Button size="small" type="text" icon={<MdZoomOut color="white" />} onClick={handleZoomOut} />
                            <Text style={{ color: '#fff', fontSize: 13, minWidth: 45, textAlign: 'center' }}>{zoom}%</Text>
                            <Button size="small" type="text" icon={<MdZoomIn color="white" />} onClick={handleZoomIn} />
                            <Button size="small" ghost onClick={handleResetZoom} style={{ fontSize: 11, height: 24 }}>Reset</Button>
                        </Space>
                    </Space>

                    <Space>
                        <Tooltip title="Download File">
                            <Button
                                size="small"
                                ghost
                                icon={<MdFileDownload size={18} />}
                                onClick={() => {
                                    let downloadUrl = fileUrl;
                                    
                                    // If it's a Google Drive file, use the direct download URL
                                    if (fileUrl.includes('drive.google.com') && !fileUrl.includes('export=download')) {
                                        const fileIdMatch = fileUrl.match(/\/d\/([^\/?#]+)/) || fileUrl.match(/[?&]id=([^\/&?#]+)/);
                                        if (fileIdMatch && fileIdMatch[1]) {
                                            downloadUrl = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
                                        }
                                    }

                                    const link = document.createElement('a');
                                    link.href = downloadUrl;
                                    link.download = fileName;
                                    if (downloadUrl !== fileUrl) {
                                        link.target = '_blank';
                                    }
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}
                            />
                        </Tooltip>
                        <Button
                            type="primary"
                            size="small"
                            icon={<MdOpenInNew size={14} />}
                            onClick={handleOpenNewTab}
                            style={{ background: theme.colors.primary, borderColor: theme.colors.primary }}
                        >
                            Open Original
                        </Button>
                    </Space>
                </div>

                {/* Content Area */}
                <div style={{
                    flex: 1,
                    overflow: 'auto',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: type === 'image' ? 'center' : 'stretch',
                    padding: type === 'image' ? 24 : 0,
                    position: 'relative'
                }}>
                    {type === 'image' ? (
                        <div style={{
                            transform: `scale(${zoom / 100})`,
                            transition: 'transform 0.2s ease-out',
                            display: 'inline-block'
                        }}>
                            <Image
                                src={fileUrl}
                                preview={false}
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '75vh',
                                    objectFit: 'contain',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                                }}
                            />
                        </div>
                    ) : (type === 'pdf' || type === 'google_file') ? (
                        <iframe
                            src={zoom === 100 ? fileUrl : `${fileUrl}#view=FitH&zoom=${zoom}`}
                            width="100%"
                            height="100%"
                            style={{ border: 'none' }}
                            title="File Preview"
                        />
                    ) : (
                        <div style={{ padding: 60, textAlign: 'center' }}>
                            <FiPaperclip size={64} color="#595959" />
                            <div style={{ marginTop: 16, color: '#8c8c8c', fontSize: 16 }}>Preview not available for this file type.</div>
                            <Button type="link" onClick={handleOpenNewTab} style={{ marginTop: 8 }}>
                                Open in new tab instead
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
