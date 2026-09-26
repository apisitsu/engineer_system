import React, { useState, useEffect, useCallback } from 'react';
import {
    Layout, Card, Row, Col, Typography, Table, Tag, Button, Input, Select,
    Space, Modal, Form, Tooltip, Popconfirm, message, Badge, Statistic, Switch,
    Divider, Alert
} from 'antd';
import {
    FileTextOutlined,
    PlusOutlined,
    SettingOutlined,
    ExportOutlined,
    ReloadOutlined,
    SearchOutlined,
    CopyOutlined,
    EditOutlined,
    DeleteOutlined,
    LinkOutlined,
    ShareAltOutlined,
    CheckCircleOutlined,
    CheckCircleFilled,
    WarningOutlined,
    FolderOpenOutlined,
    UserOutlined,
    ClockCircleOutlined,
    InfoCircleOutlined,
    SaveOutlined
} from '@ant-design/icons';
import * as xlsx from 'xlsx';
import axios from 'axios';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';
import { server } from '../../../../constance/constance';
import { useAuthStore } from '../../../../stores/authStore';

const { Title, Text } = Typography;
const { Content } = Layout;
const { Option } = Select;

// Color mapping by prefix
const PREFIX_COLORS = {
    PID: { bg: '#fff2e8', border: '#ffbb96', text: '#d4380d', tag: 'volcano' },
    PDR: { bg: '#fff0f6', border: '#ffadd2', text: '#c41d7f', tag: 'magenta' },
    PFD: { bg: '#e6f7ff', border: '#91d5ff', text: '#096dd9', tag: 'blue' },
    PFMEA: { bg: '#f9f0ff', border: '#d3adf7', text: '#531dab', tag: 'purple' },
    CP: { bg: '#f6ffed', border: '#b7eb8f', text: '#389e0d', tag: 'green' },
    DEFAULT: { bg: '#f5f5f5', border: '#d9d9d9', text: '#595959', tag: 'default' }
};

const PART_COLORS = {
    'Comp.': 'cyan',
    'Assy.': 'geekblue',
    'Finish': 'gold'
};

const DocumentManagementDashboard = () => {
    const { theme } = useTheme();
    const { userName, userEmpNo } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [documents, setDocuments] = useState([]);
    const [types, setTypes] = useState([]);
    const [stats, setStats] = useState(null);
    const [total, setTotal] = useState(0);

    // Filters & Pagination
    const [search, setSearch] = useState('');
    const [selectedType, setSelectedType] = useState('ALL');
    const [selectedPart, setSelectedPart] = useState('ALL');
    const [linkFilter, setLinkFilter] = useState('ALL');
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

    // Modals
    const [issueModalVisible, setIssueModalVisible] = useState(false);
    const [typesModalVisible, setTypesModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [currentEditDoc, setCurrentEditDoc] = useState(null);
    const [isNewlyIssued, setIsNewlyIssued] = useState(false);

    // Open Document Details Modal helper
    const openDocumentDetails = (doc, isNew = false) => {
        if (!doc) return;
        setCurrentEditDoc(doc);
        setIsNewlyIssued(Boolean(isNew));
        editForm.setFieldsValue({
            title: doc.title || '',
            part: doc.part || undefined,
            document_link: doc.document_link || '',
            link_innovator: doc.link_innovator || '',
            seq_no: doc.seq_no || '',
            note: doc.note || ''
        });
        setEditModalVisible(true);
    };

    // Issue form preview
    const [issueForm] = Form.useForm();
    const [editForm] = Form.useForm();
    const [typeForm] = Form.useForm();
    const [previewNumber, setPreviewNumber] = useState('');
    const [issuing, setIssuing] = useState(false);

    // Headers with Auth Token
    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    // 1. Fetch Document Types
    const fetchTypes = useCallback(async () => {
        try {
            const res = await axios.get(server.DMS_DOCUMENT_TYPES, { headers: getAuthHeaders() });
            if (res.data?.result === 'true') {
                setTypes(res.data.data || []);
            }
        } catch (err) {
            console.error('Fetch types error:', err);
        }
    }, []);

    // 2. Fetch Stats
    const fetchStats = useCallback(async () => {
        try {
            const res = await axios.get(server.DMS_STATS, { headers: getAuthHeaders() });
            if (res.data?.result === 'true') {
                setStats(res.data.data);
            }
        } catch (err) {
            console.error('Fetch stats error:', err);
        }
    }, []);

    // 3. Fetch Documents
    const fetchDocuments = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page: pagination.current,
                pageSize: pagination.pageSize,
                search: search.trim() || undefined
            };

            if (selectedType !== 'ALL') {
                const foundType = types.find(t => t.prefix === selectedType);
                if (foundType) params.type_id = foundType.id;
            }
            if (selectedPart !== 'ALL') {
                params.part = selectedPart;
            }
            if (linkFilter === 'HAS_LINK') {
                params.link_filter = 'has_link';
            } else if (linkFilter === 'NO_LINK') {
                params.link_filter = 'no_link';
            }

            const res = await axios.get(server.DMS_DOCUMENTS, {
                params,
                headers: getAuthHeaders()
            });

            if (res.data?.result === 'true') {
                setDocuments(res.data.data.items || []);
                setTotal(res.data.data.total || 0);
            }
        } catch (err) {
            console.error('Fetch documents error:', err);
            message.error('Failed to load documents list');
        } finally {
            setLoading(false);
        }
    }, [pagination, search, selectedType, selectedPart, linkFilter, types]);

    useEffect(() => {
        fetchTypes();
        fetchStats();
    }, [fetchTypes, fetchStats]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    // Handle Type Selection in Issue Form for Preview
    const handleIssueTypeChange = async (typeId) => {
        try {
            const res = await axios.get(`${server.DMS_DOCUMENT_TYPES}/${typeId}/preview`, { headers: getAuthHeaders() });
            if (res.data?.result === 'true') {
                setPreviewNumber(res.data.data.formatted_preview);
            }
        } catch (err) {
            console.error('Preview error:', err);
            setPreviewNumber('');
        }
    };

    // Submit Issue New Document
    const handleIssueSubmit = async (values) => {
        setIssuing(true);
        try {
            const payload = {
                ...values,
                created_by: userName || userEmpNo || 'Engineer'
            };
            const res = await axios.post(server.DMS_ISSUE, payload, { headers: getAuthHeaders() });
            if (res.data?.result === 'true') {
                const issuedDoc = res.data.data;
                message.success({
                    content: (
                        <span>
                            Issued Document <b>{issuedDoc.document_no}</b> successfully!
                        </span>
                    ),
                    duration: 4
                });
                setIssueModalVisible(false);
                issueForm.resetFields();
                setPreviewNumber('');

                // Immediately open the Document Details modal so user sees the issued number & metadata
                openDocumentDetails(issuedDoc, true);

                fetchDocuments();
                fetchTypes();
                fetchStats();
            }
        } catch (err) {
            message.error(err.response?.data?.message || 'Failed to issue document number');
        } finally {
            setIssuing(false);
        }
    };

    // Submit Edit Document
    const handleEditSubmit = async (values) => {
        if (!currentEditDoc) return;
        try {
            const payload = {
                ...values,
                updated_by: userName || userEmpNo || 'admin'
            };
            const res = await axios.put(`${server.DMS_DOCUMENTS}/${currentEditDoc.id}`, payload, { headers: getAuthHeaders() });
            if (res.data?.result === 'true') {
                message.success('Document details updated successfully');
                setEditModalVisible(false);
                setCurrentEditDoc(null);
                setIsNewlyIssued(false);
                fetchDocuments();
                fetchStats();
            }
        } catch (err) {
            message.error(err.response?.data?.message || 'Failed to update document');
        }
    };

    // Submit Delete Document
    const handleDeleteDocument = async (id, docNo) => {
        try {
            const res = await axios.delete(`${server.DMS_DOCUMENTS}/${id}`, { headers: getAuthHeaders() });
            if (res.data?.result === 'true') {
                message.success(`Document ${docNo} deleted`);
                fetchDocuments();
                fetchTypes();
                fetchStats();
            }
        } catch (err) {
            message.error(err.response?.data?.message || 'Failed to delete document');
        }
    };

    // Submit New Document Type
    const handleCreateTypeSubmit = async (values) => {
        try {
            const res = await axios.post(server.DMS_DOCUMENT_TYPES, values, { headers: getAuthHeaders() });
            if (res.data?.result === 'true') {
                message.success(`Created Document Type ${res.data.data.prefix} successfully`);
                typeForm.resetFields();
                fetchTypes();
            }
        } catch (err) {
            message.error(err.response?.data?.message || 'Failed to create document type');
        }
    };

    // Copy to clipboard helper (Supports both Secure HTTPS and Insecure HTTP intranet)
    const copyToClipboard = async (text, label) => {
        if (!text) return;
        const targetLabel = label || 'text';
        let copied = false;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                copied = true;
            } catch (clipErr) {
                console.warn('navigator.clipboard.writeText failed, using fallback:', clipErr);
            }
        }

        if (!copied) {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                ta.style.top = '-9999px';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                ta.setSelectionRange(0, 99999);
                copied = document.execCommand('copy');
                document.body.removeChild(ta);
            } catch (fallbackErr) {
                console.error('execCommand copy fallback failed:', fallbackErr);
            }
        }

        if (copied) {
            message.success(`Copied ${targetLabel} to clipboard!`);
        } else {
            message.info(`${targetLabel}: ${text}`);
        }
    };

    // Export to Excel
    const handleExportExcel = () => {
        try {
            const exportData = documents.map(d => ({
                'DOC No.': d.document_no,
                'Prefix': d.prefix,
                'Title': d.title,
                'Category': d.category,
                'Part': d.part || '',
                'Link': d.document_link || '',
                'Link_Innovator': d.link_innovator || '',
                'Seq No.': d.seq_no || '',
                'Note': d.note || '',
                'Created By': d.created_by || '',
                'Created At': d.created_at ? new Date(d.created_at).toLocaleString('en-GB') : '',
                'Updated By': d.updated_by || '',
                'Updated At': d.updated_at ? new Date(d.updated_at).toLocaleString('en-GB') : ''
            }));

            const ws = xlsx.utils.json_to_sheet(exportData);
            const wb = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(wb, ws, 'Documents');
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            xlsx.writeFile(wb, `DMS_Documents_${dateStr}.xlsx`);
            message.success('Exported documents to Excel successfully');
        } catch (err) {
            console.error('Export error:', err);
            message.error('Failed to export Excel');
        }
    };

    // Table Columns
    const columns = [
        {
            title: 'Doc No. / Type',
            dataIndex: 'document_no',
            key: 'document_no',
            width: 170,
            render: (text, record) => {
                const colorConfig = PREFIX_COLORS[record.prefix] || PREFIX_COLORS.DEFAULT;
                return (
                    <Space direction="vertical" size={2}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Tag color={colorConfig.tag} style={{ margin: 0, fontWeight: 700, borderRadius: 4 }}>
                                {record.prefix}
                            </Tag>
                            <Text strong style={{ fontSize: 13, color: theme.colors.textPrimary }}>
                                {text}
                            </Text>
                            <Tooltip title="Copy Document No">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<CopyOutlined style={{ fontSize: 12, color: theme.colors.textSecondary }} />}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        copyToClipboard(text, 'Document No');
                                    }}
                                />
                            </Tooltip>
                        </div>
                    </Space>
                );
            }
        },
        {
            title: 'Document Title & Engineering Remarks',
            dataIndex: 'title',
            key: 'title',
            render: (text, record) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong style={{ color: theme.colors.textPrimary, fontSize: 13 }}>
                            {text}
                        </Text>
                        {record.seq_no && (
                            <Tag color="blue" style={{ borderRadius: 10, fontSize: 11, margin: 0 }}>
                                {record.seq_no}
                            </Tag>
                        )}
                    </div>
                    {record.note && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Tag style={{ background: `${theme.colors.primary}11`, borderColor: `${theme.colors.primary}44`, color: theme.colors.primary, fontSize: 11, borderRadius: 4, margin: 0 }}>
                                📌 {record.note}
                            </Tag>
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Category',
            dataIndex: 'category',
            key: 'category',
            width: 130,
            render: (cat) => (
                <Tag color="geekblue" style={{ borderRadius: 12, padding: '0 8px', fontSize: 11 }}>
                    {cat}
                </Tag>
            )
        },
        {
            title: 'Part',
            dataIndex: 'part',
            key: 'part',
            width: 100,
            render: (part) => {
                if (!part) return <Text type="secondary" style={{ fontSize: 12 }}>-</Text>;
                const color = PART_COLORS[part] || 'default';
                return (
                    <Tag color={color} style={{ fontWeight: 600, borderRadius: 4, margin: 0 }}>
                        {part}
                    </Tag>
                );
            }
        },
        {
            title: 'File & Access Links',
            key: 'links',
            width: 240,
            render: (_, record) => {
                const hasLink = Boolean(record.document_link);
                const hasInnovator = Boolean(record.link_innovator);

                if (!hasLink && !hasInnovator) {
                    return (
                        <Tag icon={<WarningOutlined />} color="warning" style={{ borderRadius: 12, fontSize: 11 }}>
                            No Link
                        </Tag>
                    );
                }

                return (
                    <Space size={6} wrap>
                        {hasLink && (
                            <Tooltip title={record.document_link}>
                                <Button
                                    size="small"
                                    type="primary"
                                    ghost
                                    icon={<LinkOutlined />}
                                    style={{ borderRadius: 6, fontSize: 12, height: 26 }}
                                    onClick={() => window.open(record.document_link, '_blank')}
                                >
                                    Open Link
                                </Button>
                            </Tooltip>
                        )}
                        {hasInnovator && (
                            <Tooltip title={record.link_innovator}>
                                <Button
                                    size="small"
                                    icon={<ShareAltOutlined style={{ color: '#722ed1' }} />}
                                    style={{ borderRadius: 6, fontSize: 12, height: 26, borderColor: '#d3adf7' }}
                                    onClick={() => window.open(record.link_innovator, '_blank')}
                                >
                                    Innovator
                                </Button>
                            </Tooltip>
                        )}
                    </Space>
                );
            }
        },
        {
            title: 'Registered By & Audit',
            dataIndex: 'created_by',
            key: 'created_by',
            width: 170,
            render: (creator, record) => (
                <div style={{ display: 'flex', flexDirection: 'column', fontSize: 12, gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Tag color="cyan" style={{ margin: 0, fontSize: 10, borderRadius: 4, padding: '0 4px', fontWeight: 600 }}>
                            Reg
                        </Tag>
                        <Text strong style={{ color: theme.colors.textPrimary, fontSize: 12 }}>
                            {creator || 'admin'}
                        </Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 11, marginLeft: 2 }}>
                        {record.created_at ? new Date(record.created_at).toLocaleDateString('en-GB') : '-'}
                    </Text>
                    {record.updated_by && (
                        <Tooltip title={`Last updated: ${record.updated_at ? new Date(record.updated_at).toLocaleString('en-GB') : '-'}`}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <Tag color="orange" style={{ margin: 0, fontSize: 9, borderRadius: 4, padding: '0 4px', fontWeight: 600 }}>
                                    Edit
                                </Tag>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    {record.updated_by}
                                </Text>
                            </div>
                        </Tooltip>
                    )}
                </div>
            )
        },
        {
            title: 'Action',
            key: 'action',
            width: 110,
            align: 'center',
            render: (_, record) => (
                <Space size={4} onClick={(e) => e.stopPropagation()}>
                    <Tooltip title="View / Edit Document Details (Double-click row to open)">
                        <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined style={{ color: theme.colors.primary }} />}
                            onClick={() => openDocumentDetails(record, false)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Delete Document"
                        description={`Are you sure you want to delete ${record.document_no}?`}
                        okText="Yes, Delete"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => handleDeleteDocument(record.id, record.document_no)}
                    >
                        <Tooltip title="Delete Document">
                            <Button
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                            />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <Layout hasSider style={{ display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden' }}>
            <MenuTemplate type="NewProd" defaultSelectedKeys="/eng/newprod_eng/documents" />
            <Layout style={{
                backgroundColor: theme.colors.background,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden'
            }}>
                <ScrollbarStyle primary={theme.colors.primary} />
                <style>{`
                    .dms-table-card .ant-table-pagination {
                        margin: 20px 24px 18px 24px !important;
                        padding-right: 6px;
                    }
                    .dms-table-card .ant-table-pagination-total-text {
                        margin-right: auto;
                        font-weight: 500;
                        color: #666;
                    }
                    .dms-table-card .ant-table-tbody > tr {
                        cursor: pointer;
                        transition: background-color 0.18s ease;
                    }
                    .dms-table-card .ant-table-tbody > tr:hover > td {
                        background-color: rgba(24, 144, 255, 0.05) !important;
                    }
                    .dms-doc-details-modal .ant-modal-content {
                        border-radius: 16px;
                        overflow: hidden;
                        padding: 0;
                    }
                    .dms-doc-details-modal .ant-modal-header {
                        padding: 18px 24px;
                        margin: 0;
                        border-bottom: 1px solid #f0f0f0;
                    }
                    .dms-doc-details-modal .ant-modal-body {
                        padding: 22px 24px;
                    }
                `}</style>
                <Content className="kb-vscroll" style={{
                    padding: '24px 24px 80px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    overflowY: 'auto'
                }}>
                    <div style={{ maxWidth: 1440, width: '100%', margin: '0 auto' }}>
                        {/* Header Banner */}
                        <div style={{
                            marginBottom: 20,
                            padding: '20px 24px',
                            background: theme.colors.surface,
                            borderRadius: 16,
                            boxShadow: theme.shadows.sm,
                            border: `1px solid ${theme.colors.border}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 16
                        }}>
                            <div>
                                <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12, color: theme.colors.textPrimary }}>
                                    <div style={{
                                        background: `${theme.colors.primary}15`,
                                        color: theme.colors.primary,
                                        width: 44,
                                        height: 44,
                                        borderRadius: 12,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <FileTextOutlined style={{ fontSize: 24 }} />
                                    </div>
                                    Document Control & Auto-Numbering
                                </Title>
                                <Text type="secondary" style={{ marginLeft: 56, display: 'block', marginTop: -4 }}>
                                    Centralized Engineering Document Register (PID, PDR, PFD, PFMEA, Control Plan) with Auto-Running Numbers
                                </Text>
                            </div>

                            <Space wrap size={10}>
                                <Button
                                    icon={<ReloadOutlined />}
                                    onClick={() => {
                                        fetchDocuments();
                                        fetchTypes();
                                        fetchStats();
                                    }}
                                >
                                    Refresh
                                </Button>
                                <Button
                                    icon={<ExportOutlined />}
                                    onClick={handleExportExcel}
                                >
                                    Export Excel
                                </Button>
                                <Button
                                    icon={<SettingOutlined />}
                                    onClick={() => setTypesModalVisible(true)}
                                >
                                    Document Types
                                </Button>
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    style={{
                                        background: theme.colors.primary,
                                        borderColor: theme.colors.primary,
                                        fontWeight: 600,
                                        height: 38,
                                        padding: '0 18px',
                                        borderRadius: 8
                                    }}
                                    onClick={() => {
                                        issueForm.resetFields();
                                        setPreviewNumber('');
                                        setIssueModalVisible(true);
                                    }}
                                >
                                    Issue Document Number
                                </Button>
                            </Space>
                        </div>

                        {/* KPI Stat Cards */}
                        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                            <Col xs={12} sm={8} lg={4}>
                                <Card size="small" style={{ borderRadius: 12, border: `1px solid ${theme.colors.border}`, background: theme.colors.surface }}>
                                    <Statistic
                                        title={<Text type="secondary" style={{ fontSize: 12 }}>Total Documents</Text>}
                                        value={stats?.summary?.total || total}
                                        prefix={<FolderOpenOutlined style={{ color: theme.colors.primary }} />}
                                        valueStyle={{ fontWeight: 700, fontSize: 22, color: theme.colors.textPrimary }}
                                    />
                                </Card>
                            </Col>
                            {types.map(t => {
                                const pCol = PREFIX_COLORS[t.prefix] || PREFIX_COLORS.DEFAULT;
                                return (
                                    <Col xs={12} sm={8} lg={4} key={t.id}>
                                        <Card
                                            size="small"
                                            hoverable
                                            style={{
                                                borderRadius: 12,
                                                border: `1px solid ${selectedType === t.prefix ? theme.colors.primary : theme.colors.border}`,
                                                background: selectedType === t.prefix ? `${theme.colors.primary}0a` : theme.colors.surface,
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => {
                                                setSelectedType(selectedType === t.prefix ? 'ALL' : t.prefix);
                                                setPagination(prev => ({ ...prev, current: 1 }));
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text style={{ fontSize: 12, fontWeight: 600, color: pCol.text }}>
                                                    {t.prefix}
                                                </Text>
                                                <Tag color={pCol.tag} style={{ margin: 0, fontSize: 10, borderRadius: 4 }}>
                                                    {t.digit_length}d
                                                </Tag>
                                            </div>
                                            <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                                <span style={{ fontSize: 20, fontWeight: 700, color: theme.colors.textPrimary }}>
                                                    {t.total_documents || 0}
                                                </span>
                                                <Text type="secondary" style={{ fontSize: 11 }}>
                                                    (#{t.current_number})
                                                </Text>
                                            </div>
                                        </Card>
                                    </Col>
                                );
                            })}
                        </Row>

                        {/* Search & Filter Toolbar */}
                        <Card
                            size="small"
                            style={{
                                marginBottom: 16,
                                borderRadius: 12,
                                border: `1px solid ${theme.colors.border}`,
                                background: theme.colors.surface
                            }}
                        >
                            <Row gutter={[12, 12]} align="middle">
                                <Col xs={24} md={8}>
                                    <Input
                                        placeholder="Search Doc No, Title, Note, Seq No..."
                                        prefix={<SearchOutlined style={{ color: theme.colors.textSecondary }} />}
                                        value={search}
                                        allowClear
                                        onChange={(e) => {
                                            setSearch(e.target.value);
                                            setPagination(prev => ({ ...prev, current: 1 }));
                                        }}
                                        style={{ width: '100%', borderRadius: 8 }}
                                    />
                                </Col>
                                <Col xs={12} sm={6} md={4}>
                                    <Select
                                        value={selectedType}
                                        onChange={(val) => {
                                            setSelectedType(val);
                                            setPagination(prev => ({ ...prev, current: 1 }));
                                        }}
                                        style={{ width: '100%' }}
                                    >
                                        <Option value="ALL">All Document Types</Option>
                                        {types.map(t => (
                                            <Option key={t.id} value={t.prefix}>{t.prefix} ({t.name})</Option>
                                        ))}
                                    </Select>
                                </Col>
                                <Col xs={12} sm={6} md={4}>
                                    <Select
                                        value={selectedPart}
                                        onChange={(val) => {
                                            setSelectedPart(val);
                                            setPagination(prev => ({ ...prev, current: 1 }));
                                        }}
                                        style={{ width: '100%' }}
                                    >
                                        <Option value="ALL">All Part Types</Option>
                                        <Option value="Comp.">Comp.</Option>
                                        <Option value="Assy.">Assy.</Option>
                                        <Option value="Finish">Finish</Option>
                                    </Select>
                                </Col>
                                <Col xs={12} sm={6} md={4}>
                                    <Select
                                        value={linkFilter}
                                        onChange={(val) => {
                                            setLinkFilter(val);
                                            setPagination(prev => ({ ...prev, current: 1 }));
                                        }}
                                        style={{ width: '100%' }}
                                    >
                                        <Option value="ALL">All Link Status</Option>
                                        <Option value="HAS_LINK">Has File Link</Option>
                                        <Option value="NO_LINK">Missing File Link</Option>
                                    </Select>
                                </Col>
                                <Col xs={12} sm={6} md={4} style={{ textAlign: 'right' }}>
                                    <Text type="secondary" style={{ fontSize: 13 }}>
                                        Showing <b>{documents.length}</b> of <b>{total}</b>
                                    </Text>
                                </Col>
                            </Row>
                        </Card>

                        {/* Documents Table */}
                        <Card
                            className="dms-table-card"
                            style={{
                                borderRadius: 12,
                                border: `1px solid ${theme.colors.border}`,
                                background: theme.colors.surface,
                                boxShadow: theme.shadows.sm,
                                marginBottom: 48
                            }}
                            styles={{ body: { padding: '0 0 12px 0' } }}
                        >
                            <Table
                                rowKey="id"
                                loading={loading}
                                columns={columns}
                                dataSource={documents}
                                onRow={(record) => ({
                                    onDoubleClick: () => {
                                        openDocumentDetails(record, false);
                                    }
                                })}
                                pagination={{
                                    current: pagination.current,
                                    pageSize: pagination.pageSize,
                                    total,
                                    showSizeChanger: true,
                                    pageSizeOptions: ['10', '20', '50', '100'],
                                    showTotal: (totalCount) => `Total ${totalCount} documents`,
                                    onChange: (page, pageSize) => {
                                        setPagination({ current: page, pageSize });
                                    }
                                }}
                                size="middle"
                            />
                        </Card>
                    </div>

                    {/* MODAL: Issue New Document Number */}
                    <Modal
                        title={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <PlusOutlined style={{ color: theme.colors.primary }} />
                                <span>Issue New Document Number</span>
                            </div>
                        }
                        open={issueModalVisible}
                        onCancel={() => {
                            setIssueModalVisible(false);
                            issueForm.resetFields();
                            setPreviewNumber('');
                        }}
                        footer={null}
                        width={650}
                        destroyOnClose
                    >
                        <Form
                            form={issueForm}
                            layout="vertical"
                            onFinish={handleIssueSubmit}
                            style={{ marginTop: 16 }}
                        >
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item
                                        name="type_id"
                                        label="Document Type"
                                        rules={[{ required: true, message: 'Please select document type' }]}
                                    >
                                        <Select
                                            placeholder="Select Document Type"
                                            onChange={handleIssueTypeChange}
                                        >
                                            {types.filter(t => t.is_active).map(t => (
                                                <Option key={t.id} value={t.id}>
                                                    {t.prefix} - {t.name}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="part"
                                        label="Part Classification"
                                    >
                                        <Select placeholder="Select or type part" allowClear>
                                            <Option value="Comp.">Comp.</Option>
                                            <Option value="Assy.">Assy.</Option>
                                            <Option value="Finish">Finish</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>

                            {/* Real-time preview callout */}
                            {previewNumber && (
                                <Alert
                                    type="info"
                                    showIcon
                                    message={
                                        <span style={{ fontSize: 13 }}>
                                            Next Document Number to be issued: <b style={{ color: theme.colors.primary, fontSize: 15 }}>{previewNumber}</b> (Auto-Running Number)
                                        </span>
                                    }
                                    style={{ marginBottom: 16, borderRadius: 8 }}
                                />
                            )}

                            <Form.Item
                                name="title"
                                label="Document Title / Part Code / Description"
                                rules={[{ required: true, message: 'Please input document title' }]}
                            >
                                <Input placeholder="e.g. Control Plan_Sleeve-210926 or PFMEA_BACB10GD" />
                            </Form.Item>

                            <Form.Item
                                name="document_link"
                                label="Document Link (Google Drive / Sheets / SharePoint URL)"
                            >
                                <Input
                                    prefix={<LinkOutlined />}
                                    placeholder="https://docs.google.com/spreadsheets/d/..."
                                />
                            </Form.Item>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item
                                        name="link_innovator"
                                        label="Aras Innovator PLM Link (Optional)"
                                    >
                                        <Input
                                            prefix={<ShareAltOutlined />}
                                            placeholder="http://wk10.kz.minebea.local/InnovatorServer/..."
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="seq_no"
                                        label="Sequence No. / Aras Doc No. (Optional)"
                                    >
                                        <Input placeholder="e.g. DOC-0061933" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item
                                name="note"
                                label="Note / Engineering Remarks"
                            >
                                <Input placeholder="e.g. AS9100_activity, NCR_CAR2508-02, PB_Ring_HW#3" />
                            </Form.Item>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
                                <Button onClick={() => setIssueModalVisible(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    loading={issuing}
                                    icon={<CheckCircleOutlined />}
                                    style={{ background: theme.colors.primary, fontWeight: 600 }}
                                >
                                    Issue Document Number
                                </Button>
                            </div>
                        </Form>
                    </Modal>

                    {/* MODAL: Document Details & Metadata */}
                    <Modal
                        className="dms-doc-details-modal"
                        title={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    background: isNewlyIssued ? '#f6ffed' : `${theme.colors.primary}15`,
                                    border: `1px solid ${isNewlyIssued ? '#b7eb8f' : `${theme.colors.primary}33`}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: isNewlyIssued ? '#52c41a' : theme.colors.primary
                                }}>
                                    {isNewlyIssued ? <CheckCircleFilled style={{ fontSize: 20 }} /> : <FileTextOutlined style={{ fontSize: 20 }} />}
                                </div>
                                <div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: theme.colors.textPrimary, lineHeight: 1.2 }}>
                                        {isNewlyIssued ? 'Document Issued Successfully' : 'Document Details & Metadata'}
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        {isNewlyIssued ? 'New document number registered and stored in the central database.' : 'Engineering document register and system metadata reference.'}
                                    </Text>
                                </div>
                            </div>
                        }
                        open={editModalVisible}
                        onCancel={() => {
                            setEditModalVisible(false);
                            setCurrentEditDoc(null);
                            setIsNewlyIssued(false);
                        }}
                        footer={null}
                        width={720}
                        destroyOnClose
                    >
                        {currentEditDoc && (() => {
                            const colorConfig = PREFIX_COLORS[currentEditDoc.prefix] || PREFIX_COLORS.DEFAULT;
                            return (
                                <div>
                                    {/* Newly Issued Celebration Banner */}
                                    {isNewlyIssued && (
                                        <Alert
                                            type="success"
                                            showIcon
                                            icon={<CheckCircleFilled style={{ fontSize: 20, color: '#52c41a' }} />}
                                            message={
                                                <div style={{ fontWeight: 700, fontSize: 14 }}>
                                                    New Document Number Issued Successfully!
                                                </div>
                                            }
                                            description={
                                                <div style={{ fontSize: 12, marginTop: 2 }}>
                                                    Document number <b>{currentEditDoc.document_no}</b> has been registered in the database. You can copy the document number or review details below.
                                                </div>
                                            }
                                            style={{
                                                marginBottom: 18,
                                                borderRadius: 10,
                                                border: '1px solid #b7eb8f',
                                                background: '#f6ffed'
                                            }}
                                        />
                                    )}

                                    {/* Hero Header Box with Monospace Document Number */}
                                    <div style={{
                                        background: `linear-gradient(135deg, ${colorConfig.bg} 0%, #ffffff 100%)`,
                                        border: `1.5px solid ${colorConfig.border}`,
                                        borderRadius: 12,
                                        padding: '16px 20px',
                                        marginBottom: 18,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: 12
                                    }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <Tag color={colorConfig.tag} style={{ fontWeight: 800, fontSize: 12, borderRadius: 4, padding: '1px 8px', margin: 0 }}>
                                                    {currentEditDoc.prefix}
                                                </Tag>
                                                <span style={{ fontSize: 12, color: '#8c8c8c' }}>Document Number</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <span style={{
                                                    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace",
                                                    fontSize: 26,
                                                    fontWeight: 800,
                                                    letterSpacing: 1.2,
                                                    color: colorConfig.text
                                                }}>
                                                    {currentEditDoc.document_no}
                                                </span>
                                                <Tooltip title="Copy Document Number">
                                                    <Button
                                                        size="small"
                                                        icon={<CopyOutlined />}
                                                        style={{ borderRadius: 6, fontWeight: 500 }}
                                                        onClick={() => copyToClipboard(currentEditDoc.document_no, 'Document No')}
                                                    >
                                                        Copy
                                                    </Button>
                                                </Tooltip>
                                            </div>
                                        </div>

                                        <Space wrap size={6}>
                                            {currentEditDoc.category && (
                                                <Tag color="geekblue" style={{ borderRadius: 6, padding: '2px 8px', fontSize: 12, margin: 0 }}>
                                                    {currentEditDoc.category}
                                                </Tag>
                                            )}
                                            {currentEditDoc.part && (
                                                <Tag color={PART_COLORS[currentEditDoc.part] || 'default'} style={{ borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600, margin: 0 }}>
                                                    {currentEditDoc.part}
                                                </Tag>
                                            )}
                                            {currentEditDoc.seq_no && (
                                                <Tag color="purple" style={{ borderRadius: 6, padding: '2px 8px', fontSize: 12, margin: 0 }}>
                                                    Seq: {currentEditDoc.seq_no}
                                                </Tag>
                                            )}
                                        </Space>
                                    </div>

                                    {/* Audit & Registration Info Grid */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                        gap: 12,
                                        marginBottom: 18
                                    }}>
                                        <div style={{
                                            background: '#fafafa',
                                            border: '1px solid #f0f0f0',
                                            borderRadius: 8,
                                            padding: '10px 14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10
                                        }}>
                                            <div style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: '50%',
                                                background: '#e6f7ff',
                                                color: '#1890ff',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 15
                                            }}>
                                                <UserOutlined />
                                            </div>
                                            <div>
                                                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Registered By</Text>
                                                <Text strong style={{ fontSize: 13 }}>{currentEditDoc.created_by || 'admin'}</Text>
                                                <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                                                    {currentEditDoc.created_at ? new Date(currentEditDoc.created_at).toLocaleString('en-GB') : '-'}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{
                                            background: '#fafafa',
                                            border: '1px solid #f0f0f0',
                                            borderRadius: 8,
                                            padding: '10px 14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10
                                        }}>
                                            <div style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: '50%',
                                                background: '#fff7e6',
                                                color: '#fa8c16',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 15
                                            }}>
                                                <ClockCircleOutlined />
                                            </div>
                                            <div>
                                                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Last Updated</Text>
                                                <Text strong style={{ fontSize: 13 }}>{currentEditDoc.updated_by || 'No edits yet'}</Text>
                                                <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                                                    {currentEditDoc.updated_at ? new Date(currentEditDoc.updated_at).toLocaleString('en-GB') : '-'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Form for Editing */}
                                    <Form
                                        form={editForm}
                                        layout="vertical"
                                        onFinish={handleEditSubmit}
                                    >
                                        {/* General Information Card */}
                                        <div style={{
                                            background: '#fff',
                                            border: '1px solid #f0f0f0',
                                            borderRadius: 10,
                                            padding: '16px 18px',
                                            marginBottom: 14
                                        }}>
                                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: theme.colors.textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <InfoCircleOutlined style={{ color: theme.colors.primary }} /> General Information
                                            </div>

                                            <Form.Item
                                                name="title"
                                                label="Document Title / Part Code / Description"
                                                rules={[{ required: true, message: 'Please input title' }]}
                                                style={{ marginBottom: 12 }}
                                            >
                                                <Input placeholder="e.g. Control Plan_Sleeve-210926" style={{ borderRadius: 6 }} />
                                            </Form.Item>

                                            <Row gutter={14}>
                                                <Col span={12}>
                                                    <Form.Item
                                                        name="part"
                                                        label="Part Classification"
                                                        style={{ marginBottom: 12 }}
                                                    >
                                                        <Select placeholder="Select part classification" allowClear style={{ borderRadius: 6 }}>
                                                            <Option value="Comp.">Comp.</Option>
                                                            <Option value="Assy.">Assy.</Option>
                                                            <Option value="Finish">Finish</Option>
                                                        </Select>
                                                    </Form.Item>
                                                </Col>
                                                <Col span={12}>
                                                    <Form.Item
                                                        name="seq_no"
                                                        label="Sequence No. / Aras Doc No."
                                                        style={{ marginBottom: 12 }}
                                                    >
                                                        <Input placeholder="e.g. DOC-0061933" style={{ borderRadius: 6 }} />
                                                    </Form.Item>
                                                </Col>
                                            </Row>

                                            <Form.Item
                                                name="note"
                                                label="Note / Engineering Remarks"
                                                style={{ marginBottom: 0 }}
                                            >
                                                <Input placeholder="e.g. AS9100_activity, NCR_CAR2508-02, PB_Ring_HW#3" style={{ borderRadius: 6 }} />
                                            </Form.Item>
                                        </div>

                                        {/* Links Card */}
                                        <div style={{
                                            background: '#fff',
                                            border: '1px solid #f0f0f0',
                                            borderRadius: 10,
                                            padding: '16px 18px',
                                            marginBottom: 18
                                        }}>
                                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: theme.colors.textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <LinkOutlined style={{ color: theme.colors.primary }} /> External Links & Cloud Storage
                                            </div>

                                            <Form.Item
                                                name="document_link"
                                                label={
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                                        <span>Document Link (Google Drive / Sheets / SharePoint)</span>
                                                        {currentEditDoc.document_link && (
                                                            <a
                                                                href={currentEditDoc.document_link}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                                            >
                                                                <ExportOutlined /> Open Link
                                                            </a>
                                                        )}
                                                    </div>
                                                }
                                                style={{ marginBottom: 12 }}
                                            >
                                                <Input
                                                    prefix={<LinkOutlined style={{ color: '#1890ff' }} />}
                                                    placeholder="https://docs.google.com/spreadsheets/d/..."
                                                    style={{ borderRadius: 6 }}
                                                />
                                            </Form.Item>

                                            <Form.Item
                                                name="link_innovator"
                                                label={
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                                        <span>Aras Innovator PLM Link</span>
                                                        {currentEditDoc.link_innovator && (
                                                            <a
                                                                href={currentEditDoc.link_innovator}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                style={{ fontSize: 12, color: '#722ed1', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                                            >
                                                                <ExportOutlined /> Open Innovator
                                                            </a>
                                                        )}
                                                    </div>
                                                }
                                                style={{ marginBottom: 0 }}
                                            >
                                                <Input
                                                    prefix={<ShareAltOutlined style={{ color: '#722ed1' }} />}
                                                    placeholder="http://wk10.kz.minebea.local/InnovatorServer/..."
                                                    style={{ borderRadius: 6 }}
                                                />
                                            </Form.Item>
                                        </div>

                                        {/* Footer Actions */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            paddingTop: 12,
                                            borderTop: '1px solid #f0f0f0'
                                        }}>
                                            <Space size={8}>
                                                {currentEditDoc.document_link && (
                                                    <Button
                                                        icon={<LinkOutlined />}
                                                        size="middle"
                                                        onClick={() => window.open(currentEditDoc.document_link, '_blank')}
                                                    >
                                                        Open Document
                                                    </Button>
                                                )}
                                                {currentEditDoc.link_innovator && (
                                                    <Button
                                                        icon={<ShareAltOutlined style={{ color: '#722ed1' }} />}
                                                        size="middle"
                                                        onClick={() => window.open(currentEditDoc.link_innovator, '_blank')}
                                                    >
                                                        Open Innovator
                                                    </Button>
                                                )}
                                            </Space>

                                            <Space size={10}>
                                                <Button
                                                    size="middle"
                                                    onClick={() => {
                                                        setEditModalVisible(false);
                                                        setCurrentEditDoc(null);
                                                        setIsNewlyIssued(false);
                                                    }}
                                                >
                                                    {isNewlyIssued ? 'Close' : 'Cancel'}
                                                </Button>
                                                <Button
                                                    type="primary"
                                                    htmlType="submit"
                                                    size="middle"
                                                    icon={<SaveOutlined />}
                                                    style={{
                                                        background: theme.colors.primary,
                                                        borderColor: theme.colors.primary,
                                                        fontWeight: 600,
                                                        borderRadius: 6
                                                    }}
                                                >
                                                    Save Changes
                                                </Button>
                                            </Space>
                                        </div>
                                    </Form>
                                </div>
                            );
                        })()}
                    </Modal>

                    {/* MODAL: Manage Document Types */}
                    <Modal
                        title="Document Types Configuration"
                        open={typesModalVisible}
                        onCancel={() => setTypesModalVisible(false)}
                        footer={null}
                        width={750}
                    >
                        <Table
                            rowKey="id"
                            dataSource={types}
                            pagination={false}
                            size="small"
                            columns={[
                                {
                                    title: 'Prefix',
                                    dataIndex: 'prefix',
                                    key: 'prefix',
                                    render: (p) => <Tag color="blue" style={{ fontWeight: 700 }}>{p}</Tag>
                                },
                                {
                                    title: 'Full Name',
                                    dataIndex: 'name',
                                    key: 'name'
                                },
                                {
                                    title: 'Digits',
                                    dataIndex: 'digit_length',
                                    key: 'digit_length',
                                    align: 'center',
                                    render: (d) => <Tag>{d} digits</Tag>
                                },
                                {
                                    title: 'Current Number',
                                    dataIndex: 'current_number',
                                    key: 'current_number',
                                    align: 'center',
                                    render: (n) => <b>#{n}</b>
                                },
                                {
                                    title: 'Docs Count',
                                    dataIndex: 'total_documents',
                                    key: 'total_documents',
                                    align: 'center',
                                    render: (c) => <Badge count={c || 0} showZero style={{ backgroundColor: '#108ee9' }} />
                                },
                                {
                                    title: 'Active',
                                    dataIndex: 'is_active',
                                    key: 'is_active',
                                    align: 'center',
                                    render: (active, record) => (
                                        <Switch
                                            checked={active}
                                            size="small"
                                            onChange={async (checked) => {
                                                try {
                                                    await axios.put(`${server.DMS_DOCUMENT_TYPES}/${record.id}`, { is_active: checked }, { headers: getAuthHeaders() });
                                                    message.success(`Status updated for ${record.prefix}`);
                                                    fetchTypes();
                                                } catch (err) {
                                                    message.error('Failed to update status');
                                                }
                                            }}
                                        />
                                    )
                                }
                            ]}
                            style={{ marginBottom: 24 }}
                        />

                        <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600 }}>
                            Add New Document Type
                        </Divider>

                        <Form
                            form={typeForm}
                            layout="inline"
                            onFinish={handleCreateTypeSubmit}
                            style={{ gap: 8, alignItems: 'flex-start' }}
                        >
                            <Form.Item
                                name="prefix"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <Input placeholder="Prefix (e.g. MEMO)" style={{ width: 140 }} />
                            </Form.Item>
                            <Form.Item
                                name="name"
                                rules={[{ required: true, message: 'Required' }]}
                            >
                                <Input placeholder="Full Name (e.g. Internal Memo)" style={{ width: 220 }} />
                            </Form.Item>
                            <Form.Item
                                name="category"
                            >
                                <Input placeholder="Category" style={{ width: 130 }} />
                            </Form.Item>
                            <Form.Item>
                                <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
                                    Add Type
                                </Button>
                            </Form.Item>
                        </Form>
                    </Modal>
                </Content>
            </Layout>
        </Layout>
    );
};

export default DocumentManagementDashboard;
