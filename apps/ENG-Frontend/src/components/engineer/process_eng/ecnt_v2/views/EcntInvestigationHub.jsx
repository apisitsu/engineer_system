import React, { useState, useEffect } from 'react';
import { Card, Tabs, Typography, Button, Space, Tag, Empty, Spin, Row, Col, Image } from 'antd';
import { 
    MessageOutlined, HistoryOutlined, PaperClipOutlined, 
    ArrowLeftOutlined, EyeOutlined, DownloadOutlined 
} from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../../constance/constance';
import DiscussionThread from '../components/DiscussionThread';
import AuditTimeline from '../components/AuditTimeline';

const { Title, Text } = Typography;

export default function EcntInvestigationHub({ 
    documentType, 
    documentId, 
    docData,
    onBack, 
    onOpenWorkspace 
}) {
    const [activeTab, setActiveTab] = useState('discussion');
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState([]);
    const [fieldAudits, setFieldAudits] = useState([]);
    const [attachments, setAttachments] = useState([]);

    const fetchAuditAndAttachments = async () => {
        if (!documentId) return;
        setLoading(true);
        try {
            const [resAudit, resAtt] = await Promise.all([
                axios.get(`${server.URL}/api/ecnt/audit-trail/${documentType}/${documentId}`, { withCredentials: true }),
                axios.get(`${server.URL}/api/ecnt/attachment/${documentType}/${documentId}`, { withCredentials: true })
            ]);
            setLogs(resAudit.data.logs || []);
            setFieldAudits(resAudit.data.fieldAudits || []);
            setAttachments(resAtt.data.data || []);
        } catch (err) {
            console.error("Fetch Audit/Att error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAuditAndAttachments();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [documentType, documentId]);

    const getFullUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `${server.URL}${url}`;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header Bar */}
            <Card style={{ borderRadius: 12, border: '1px solid #e8e8e8', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <Space size="middle">
                        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
                            Back
                        </Button>
                        <div>
                            <Space>
                                <Tag color={documentType === 'ECR' ? 'blue' : 'purple'}>{documentType}</Tag>
                                <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                                    {documentType === 'ECR' ? (docData?.ecr_no || `#${documentId}`) : (docData?.ecn_no || `#${documentId}`)} - Problem Investigation & Traceability Hub
                                </Title>
                            </Space>
                            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                                Title: {docData?.title_of_change || 'N/A'} | Requester: {docData?.request_by_name} ({docData?.department})
                            </div>
                        </div>
                    </Space>

                    <Button type="primary" icon={<EyeOutlined />} onClick={onOpenWorkspace}>
                        Open Document Workspace
                    </Button>
                </div>
            </Card>

            {/* Main Tabs */}
            <Card style={{ borderRadius: 12, border: '1px solid #e8e8e8' }}>
                <Tabs 
                    activeKey={activeTab} 
                    onChange={setActiveTab}
                    items={[
                        {
                            key: 'discussion',
                            label: (
                                <Space>
                                    <MessageOutlined />
                                    <span>Clarification & Discussion Thread</span>
                                </Space>
                            ),
                            children: (
                                <DiscussionThread 
                                    documentType={documentType} 
                                    documentId={documentId} 
                                    activeStageCode={docData?.current_stage_code} 
                                />
                            )
                        },
                        {
                            key: 'timeline',
                            label: (
                                <Space>
                                    <HistoryOutlined />
                                    <span>Immutable Audit Trail & Diffs</span>
                                    <Tag color="cyan">{logs.length + fieldAudits.length}</Tag>
                                </Space>
                            ),
                            children: (
                                <Spin spinning={loading}>
                                    <AuditTimeline logs={logs} fieldAudits={fieldAudits} />
                                </Spin>
                            )
                        },
                        {
                            key: 'attachments',
                            label: (
                                <Space>
                                    <PaperClipOutlined />
                                    <span>Document Evidence & Gallery</span>
                                    <Tag color="geekblue">{attachments.length}</Tag>
                                </Space>
                            ),
                            children: (
                                <Spin spinning={loading}>
                                    {attachments.length === 0 ? (
                                        <Empty description="No files attached to this document." />
                                    ) : (
                                        <Row gutter={[16, 16]}>
                                            <Image.PreviewGroup>
                                                {attachments.map(att => {
                                                    const isImg = att.file_type && att.file_type.startsWith('image/');

                                                    return (
                                                        <Col xs={24} sm={12} md={8} lg={6} key={att.id}>
                                                            <Card 
                                                                size="small" 
                                                                style={{ borderRadius: 8, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                                                            >
                                                                {isImg ? (
                                                                    <Image 
                                                                        src={getFullUrl(att.file_url)} 
                                                                        height={140} 
                                                                        style={{ objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} 
                                                                    />
                                                                ) : (
                                                                    <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', borderRadius: 6, marginBottom: 8 }}>
                                                                        <PaperClipOutlined style={{ fontSize: 36, color: '#1890ff' }} />
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <Text strong ellipsis style={{ width: '100%', display: 'block', fontSize: 12 }}>
                                                                        {att.file_name}
                                                                    </Text>
                                                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                                                        Field: {att.field_name || 'General'} | Block {att.block_number || '-'}
                                                                    </Text>
                                                                    <div style={{ marginTop: 8 }}>
                                                                        <a href={getFullUrl(att.file_url)} target="_blank" rel="noreferrer">
                                                                            <Button size="small" icon={<DownloadOutlined />} style={{ width: '100%' }}>
                                                                                View / Download
                                                                            </Button>
                                                                        </a>
                                                                    </div>
                                                                </div>
                                                            </Card>
                                                        </Col>
                                                    );
                                                })}
                                            </Image.PreviewGroup>
                                        </Row>
                                    )}
                                </Spin>
                            )
                        }
                    ]}
                />
            </Card>
        </div>
    );
}
