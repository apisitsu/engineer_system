import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Tag, Avatar, Space, Typography, Upload, Image, Empty, Spin } from 'antd';
import { App } from 'antd';
import { SendOutlined, PictureOutlined, PaperClipOutlined, UserOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import { server } from '../../../../../constance/constance';
import { useAuthStore } from '../../../../../stores/authStore';
import { DISCUSSION_CATEGORIES } from '../utils/ecntConstants';
import { uploadEcntFileToDrive } from '../../../../../utils/uploadFileToDrive';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

export default function DiscussionThread({ documentType, documentId, activeStageCode, ecrNo = '', ecnNo = '' }) {
    const { message: antdMessage } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [discussions, setDiscussions] = useState([]);
    
    // Form state
    const [messageText, setMessageText] = useState('');
    const [category, setCategory] = useState('GENERAL');
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);

    const { userName, empNo, userDepartment, userRole } = useAuthStore();

    const fetchDiscussions = async () => {
        if (!documentId) return;
        setLoading(true);
        try {
            const res = await axios.get(`${server.URL}/api/ecnt/discussions/${documentType}/${documentId}`, { withCredentials: true });
            setDiscussions(res.data.data || []);
        } catch (err) {
            console.error("Fetch Discussions Error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDiscussions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [documentType, documentId]);

    const handleUploadFile = async (file) => {
        // Open helper popup synchronously within user click/interaction gesture
        let popup = null;
        try {
            popup = window.open('about:blank', 'gas_upload', 'width=460,height=420,left=350,top=150');
        } catch (e) {
            popup = null;
        }

        setUploading(true);
        const msgKey = `disc_up_${Date.now()}`;
        antdMessage.loading({ content: `กำลังอัปโหลด ${file.name} ไปยัง Google Drive...`, key: msgKey, duration: 0 });
        try {
            const targetEcr = ecrNo || (documentType === 'ECR' ? `ECR_${documentId}` : '') || 'ECNT_General';
            const targetEcn = ecnNo || (documentType === 'ECN' ? `ECN_${documentId}` : '');

            const gasRes = await uploadEcntFileToDrive(file, {
                ecrNo: targetEcr,
                ecnNo: targetEcn,
                fieldName: 'discussion'
            }, { popup });

            if (gasRes && gasRes.success) {
                const newAtt = {
                    file_name: gasRes.fileName || file.name,
                    file_url: gasRes.webViewLink,
                    file_type: gasRes.mimeType || file.type || '',
                    file_size: gasRes.fileSize || file.size || null,
                    drive_file_id: gasRes.fileId,
                    drive_folder_url: gasRes.folderUrl
                };
                setAttachments(prev => [...prev, newAtt]);
                antdMessage.success({ content: `แนบไฟล์ ${file.name} จาก Google Drive สำเร็จ`, key: msgKey, duration: 3 });
            } else {
                throw new Error(gasRes?.error || "Failed to upload to Google Drive");
            }
        } catch (err) {
            console.error("[DiscussionThread] Upload error:", err);
            antdMessage.error({ content: `ไม่สามารถอัปโหลดไปยัง Google Drive ได้: ${err.message}`, key: msgKey, duration: 4 });
        } finally {
            setUploading(false);
        }
    };

    // Clipboard Paste Listener for Ctrl+V screenshots
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
                    handleUploadFile(namedFile);
                }
            }
        }
    };

    const handlePost = async () => {
        if (!messageText.trim()) {
            antdMessage.warning("Please enter a message before sending.");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                document_type: documentType,
                document_id: documentId,
                stage_key: activeStageCode || 'GENERAL',
                category,
                message: messageText.trim(),
                attachments,
                author_empno: empNo || 'EMP123',
                author_name: userName || 'User',
                author_dept: userDepartment || 'ENG',
                author_role: userRole || 'Staff'
            };

            await axios.post(`${server.URL}/api/ecnt/discussions`, payload, { withCredentials: true });
            antdMessage.success("Comment posted");
            setMessageText('');
            setAttachments([]);
            fetchDiscussions();
        } catch (err) {
            console.error("Post Discussion Error:", err);
            antdMessage.error("Failed to post comment");
        } finally {
            setSubmitting(false);
        }
    };

    const getFullUrl = (url) => {
        if (!url) return '';
        if (url.includes('drive.google.com')) {
            const fileIdMatch = url.match(/\/d\/([^/?#]+)/) || url.match(/[?&]id=([^/&?#]+)/);
            if (fileIdMatch && fileIdMatch[1]) {
                return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w800`;
            }
        }
        if (url.startsWith('http')) return url;
        return `${server.URL}${url}`;
    };

    const getCategoryMeta = (catKey) => {
        return DISCUSSION_CATEGORIES.find(c => c.key === catKey) || { label: catKey, color: 'default' };
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 1. Comment Composer */}
            <Card 
                size="small" 
                title={<Text strong style={{ fontSize: 13, color: '#1890ff' }}>💬 Post Clarification, Query or Response</Text>}
                style={{ borderRadius: 10, border: '1px solid #d9d9d9', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}
            >
                <div style={{ marginBottom: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Tag Category:</Text>
                    {DISCUSSION_CATEGORIES.map(cat => (
                        <Tag.CheckableTag
                            key={cat.key}
                            checked={category === cat.key}
                            onChange={() => setCategory(cat.key)}
                            style={{ borderRadius: 12, padding: '2px 10px' }}
                        >
                            {cat.label}
                        </Tag.CheckableTag>
                    ))}
                </div>

                <TextArea
                    rows={3}
                    placeholder="Type your clarification, question, or response (Press Ctrl+V to paste captured screenshots directly)..."
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    onPaste={handlePaste}
                    style={{ borderRadius: 6, marginBottom: 8 }}
                />

                {/* Attached Files / Screenshots Preview */}
                {attachments.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, padding: 8, background: '#fafafa', borderRadius: 6 }}>
                        <Image.PreviewGroup>
                            {attachments.map((att, idx) => (
                                <div key={idx} style={{ position: 'relative', border: '1px solid #e8e8e8', borderRadius: 6, padding: 4, background: '#fff' }}>
                                    {att.file_type && att.file_type.startsWith('image/') ? (
                                        <Image src={getFullUrl(att.file_url)} width={60} height={60} style={{ objectFit: 'cover', borderRadius: 4 }} />
                                    ) : (
                                        <div style={{ width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, textAlign: 'center' }}>
                                            {att.file_name.slice(-8)}
                                        </div>
                                    )}
                                    <Button
                                        type="text"
                                        danger
                                        size="small"
                                        icon={<DeleteOutlined />}
                                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                                        style={{ position: 'absolute', top: -6, right: -6, background: '#fff', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
                                    />
                                </div>
                            ))}
                        </Image.PreviewGroup>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Upload
                        showUploadList={false}
                        beforeUpload={(file) => {
                            handleUploadFile(file);
                            return false;
                        }}
                    >
                        <Button icon={<PictureOutlined />} size="small" loading={uploading}>
                            Attach Image / File
                        </Button>
                    </Upload>

                    <Button 
                        type="primary" 
                        icon={<SendOutlined />} 
                        size="small" 
                        onClick={handlePost} 
                        loading={submitting}
                    >
                        Post Message
                    </Button>
                </div>
            </Card>

            {/* 2. Threaded Messages List */}
            <Spin spinning={loading}>
                {discussions.length === 0 ? (
                    <Empty description="No discussions or problem logs yet. Post a question or clarification above." />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {discussions.map(disc => {
                            const catMeta = getCategoryMeta(disc.category);
                            const parsedAtts = typeof disc.attachments === 'string' ? JSON.parse(disc.attachments || '[]') : (disc.attachments || []);

                            return (
                                <Card 
                                    key={disc.id} 
                                    size="small"
                                    style={{ 
                                        borderRadius: 8, 
                                        border: disc.category === 'CLARIFICATION' ? '1px solid #ffd591' : '1px solid #f0f0f0',
                                        background: disc.category === 'CLARIFICATION' ? '#fffbe6' : '#ffffff' 
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <Space>
                                            <Avatar size="small" icon={<UserOutlined />} style={{ background: '#1890ff' }} />
                                            <Text strong style={{ fontSize: 13 }}>{disc.author_name}</Text>
                                            <Tag color="cyan" style={{ fontSize: 11 }}>{disc.author_dept} / {disc.author_role}</Tag>
                                            <Tag color={catMeta.color} style={{ fontSize: 11 }}>{catMeta.label}</Tag>
                                        </Space>
                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                            {moment(disc.created_at).format('DD-MMM-YYYY HH:mm')}
                                        </Text>
                                    </div>

                                    <Paragraph style={{ margin: '6px 0', whiteSpace: 'pre-wrap', color: '#262626' }}>
                                        {disc.message}
                                    </Paragraph>

                                    {/* Attachments */}
                                    {parsedAtts.length > 0 && (
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                                            <Image.PreviewGroup>
                                                {parsedAtts.map((att, aIdx) => (
                                                    <div key={aIdx}>
                                                        {att.file_type && att.file_type.startsWith('image/') ? (
                                                            <Image 
                                                                src={getFullUrl(att.file_url)} 
                                                                width={90} 
                                                                height={90} 
                                                                style={{ objectFit: 'cover', borderRadius: 6, border: '1px solid #d9d9d9' }} 
                                                            />
                                                        ) : (
                                                            <a href={getFullUrl(att.file_url)} target="_blank" rel="noreferrer">
                                                                <Tag icon={<PaperClipOutlined />} color="blue">
                                                                    {att.file_name}
                                                                </Tag>
                                                            </a>
                                                        )}
                                                    </div>
                                                ))}
                                            </Image.PreviewGroup>
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                )}
            </Spin>
        </div>
    );
}
