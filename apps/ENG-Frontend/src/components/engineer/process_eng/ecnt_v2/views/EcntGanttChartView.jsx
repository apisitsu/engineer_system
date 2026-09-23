import React, { useState, useEffect } from 'react';
import { Card, Select, Typography, Space, Tag, Row, Col, Spin, Empty, Button, Tooltip } from 'antd';
import { ArrowLeftOutlined, EyeOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import { server } from '../../../../../constance/constance';
import { buildDocumentGanttData } from '../utils/ganttHelper';

const { Title, Text } = Typography;
const { Option } = Select;

export default function EcntGanttChartView({ 
    ecrData = [], 
    ecnData = [], 
    selectedDocInitial = null,
    onBackToDashboard,
    onOpenDoc 
}) {
    const [selectedKey, setSelectedKey] = useState(
        selectedDocInitial ? `${selectedDocInitial.type}_${selectedDocInitial.id}` : ''
    );
    const [loading, setLoading] = useState(false);
    const [docDetails, setDocDetails] = useState(null);
    const [stageHistory, setStageHistory] = useState([]);

    const combinedDocs = [
        ...ecrData.map(d => ({ ...d, doc_type: 'ECR', key: `ECR_${d.id}` })),
        ...ecnData.map(d => ({ ...d, doc_type: 'ECN', key: `ECN_${d.id}` }))
    ];

    useEffect(() => {
        if (!selectedKey && combinedDocs.length > 0) {
            setSelectedKey(combinedDocs[0].key);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [combinedDocs.length]);

    useEffect(() => {
        if (selectedKey) {
            const [type, id] = selectedKey.split('_');
            fetchDocumentData(type, id);
        }
    }, [selectedKey]);

    const fetchDocumentData = async (type, id) => {
        setLoading(true);
        try {
            const endpoint = type === 'ECR' ? `/api/ecnt/ecr/${id}` : `/api/ecnt/ecn/${id}`;
            const res = await axios.get(`${server.URL}${endpoint}`, { withCredentials: true });
            setDocDetails(res.data.data);
            setStageHistory(res.data.stageHistory || []);
        } catch (err) {
            console.error("Fetch Doc For Gantt Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const currentDoc = combinedDocs.find(d => d.key === selectedKey) || docDetails;
    const ganttData = buildDocumentGanttData(docDetails || currentDoc, stageHistory);

    // Calculate time bounds for horizontal scale
    const allStages = ganttData.stages || [];
    let minTime = allStages.length > 0 ? moment(allStages[0].start).valueOf() : Date.now();
    let maxTime = allStages.length > 0 ? moment(allStages[allStages.length - 1].end).valueOf() : Date.now() + 86400000 * 7;
    const totalTimeSpan = Math.max(86400000 * 2, maxTime - minTime);

    const getXPercent = (time) => {
        const val = moment(time).valueOf();
        return Math.max(0, Math.min(100, ((val - minTime) / totalTimeSpan) * 100));
    };

    const getWidthPercent = (start, end) => {
        const s = moment(start).valueOf();
        const e = moment(end).valueOf();
        return Math.max(1.5, ((e - s) / totalTimeSpan) * 100);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Top Navigation & Selector Bar */}
            <Card style={{ borderRadius: 12, border: '1px solid #e8e8e8', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <Space size="middle">
                        <Button icon={<ArrowLeftOutlined />} onClick={onBackToDashboard}>
                            Back to Dashboard
                        </Button>
                        <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                            📅 Workflow Gantt Chart & Stage Trajectory
                        </Title>
                    </Space>

                    <Space size="middle">
                        <Text strong>Select Document:</Text>
                        <Select
                            value={selectedKey}
                            onChange={setSelectedKey}
                            style={{ width: 340 }}
                            showSearch
                            optionFilterProp="children"
                        >
                            {combinedDocs.map(d => (
                                <Option key={d.key} value={d.key}>
                                    [{d.doc_type}] {d.doc_type === 'ECR' ? (d.ecr_no || `#${d.id}`) : (d.ecn_no || `#${d.id}`)} - {d.title_of_change?.slice(0, 30) || 'Untitled'}
                                </Option>
                            ))}
                        </Select>

                        {docDetails && (
                            <Button 
                                type="primary" 
                                icon={<EyeOutlined />} 
                                onClick={() => onOpenDoc(docDetails.id, selectedKey.split('_')[0])}
                            >
                                Open Workspace
                            </Button>
                        )}
                    </Space>
                </div>
            </Card>

            {/* Document Metric Summary Cards */}
            {docDetails && (
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={8}>
                        <Card size="small" style={{ borderRadius: 10, background: '#fafafa', border: '1px solid #f0f0f0' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>Workflow Number & Status</Text>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                <Text strong style={{ fontSize: 16 }}>{selectedKey.startsWith('ECR') ? (docDetails.ecr_no || `#${docDetails.id}`) : (docDetails.ecn_no || `#${docDetails.id}`)}</Text>
                                <Tag color="blue">{docDetails.process_status}</Tag>
                            </div>
                        </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Card size="small" style={{ borderRadius: 10, background: '#fafafa', border: '1px solid #f0f0f0' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>Total Lead Time (Actual + Projected)</Text>
                            <div style={{ marginTop: 4 }}>
                                <Text strong style={{ fontSize: 16, color: '#722ed1' }}>
                                    {ganttData.totalHours} hrs ({(ganttData.totalHours / 24).toFixed(1)} days)
                                </Text>
                            </div>
                        </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Card size="small" style={{ borderRadius: 10, background: '#fafafa', border: '1px solid #f0f0f0' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>Projected Effective Date</Text>
                            <div style={{ marginTop: 4 }}>
                                <Text strong style={{ fontSize: 16, color: '#52c41a' }}>
                                    {ganttData.projectedFinish ? moment(ganttData.projectedFinish).format('DD-MMM-YYYY HH:mm') : 'Completed'}
                                </Text>
                            </div>
                        </Card>
                    </Col>
                </Row>
            )}

            {/* Gantt Legend */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 16, 
                background: '#ffffff', 
                padding: '10px 18px', 
                borderRadius: 8, 
                border: '1px solid #f0f0f0',
                fontSize: 12 
            }}>
                <Text strong>Legend:</Text>
                <Space size={6}><span style={{ width: 14, height: 14, background: '#52c41a', borderRadius: 3, display: 'inline-block' }} /> <Text>Actual Completed</Text></Space>
                <Space size={6}><span style={{ width: 14, height: 14, background: '#1890ff', borderRadius: 3, display: 'inline-block' }} /> <Text>Active Stage</Text></Space>
                <Space size={6}><span style={{ width: 14, height: 14, background: '#fa8c16', borderRadius: 3, display: 'inline-block' }} /> <Text>Clarification / Return Loop</Text></Space>
                <Space size={6}><span style={{ width: 14, height: 14, background: '#8c8c8c', border: '1px dashed #595959', borderRadius: 3, display: 'inline-block' }} /> <Text>Projected Future Stage (SLA Target)</Text></Space>
            </div>

            {/* Gantt Chart Matrix */}
            <Card style={{ borderRadius: 12, border: '1px solid #e8e8e8', overflowX: 'auto' }}>
                <Spin spinning={loading}>
                    {allStages.length === 0 ? (
                        <Empty description="No stage trajectory data available for this document." />
                    ) : (
                        <div style={{ minWidth: 860, padding: '10px 0' }}>
                            {/* Time Axis Header */}
                            <div style={{ display: 'flex', borderBottom: '2px solid #d9d9d9', paddingBottom: 8, marginBottom: 12 }}>
                                <div style={{ width: 280, fontWeight: 600, color: '#595959' }}>Stage / Event Name</div>
                                <div style={{ flex: 1, position: 'relative', height: 20 }}>
                                    <span style={{ position: 'absolute', left: 0, fontSize: 11, color: '#8c8c8c' }}>
                                        {moment(minTime).format('DD-MMM HH:mm')}
                                    </span>
                                    <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: '#8c8c8c' }}>
                                        {moment((minTime + maxTime) / 2).format('DD-MMM')}
                                    </span>
                                    <span style={{ position: 'absolute', right: 0, fontSize: 11, color: '#8c8c8c' }}>
                                        {moment(maxTime).format('DD-MMM HH:mm')}
                                    </span>
                                </div>
                            </div>

                            {/* Stage Rows */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {allStages.map((st) => {
                                    const left = getXPercent(st.start);
                                    const width = getWidthPercent(st.start, st.end);

                                    return (
                                        <div 
                                            key={st.id}
                                            style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                padding: '6px 0',
                                                borderBottom: '1px solid #f0f0f0' 
                                            }}
                                        >
                                            {/* Stage Label */}
                                            <div style={{ width: 280, paddingRight: 16 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Text strong style={{ fontSize: 12, color: st.isReturnLoop ? '#fa8c16' : '#262626' }}>
                                                        {st.title}
                                                    </Text>
                                                    {st.isReturnLoop && <Tag color="orange" style={{ fontSize: 10, margin: 0 }}>REWORK</Tag>}
                                                    {st.isProjected && <Tag color="default" style={{ fontSize: 10, margin: 0 }}>PLANNED</Tag>}
                                                </div>
                                                <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                                                    PIC: {st.picName || st.picRole || 'Assigned Person'} | {st.durationHours} hrs
                                                </div>
                                            </div>

                                            {/* Timeline Track */}
                                            <div style={{ flex: 1, position: 'relative', height: 26, background: '#f5f5f5', borderRadius: 4 }}>
                                                <Tooltip 
                                                    title={
                                                        <div>
                                                            <div><strong>{st.title}</strong></div>
                                                            <div>Status: {st.status}</div>
                                                            <div>Start: {moment(st.start).format('DD-MMM-YYYY HH:mm')}</div>
                                                            <div>End: {moment(st.end).format('DD-MMM-YYYY HH:mm')}</div>
                                                            <div>Duration: {st.durationHours} hours</div>
                                                            {st.notes && <div>Notes: {st.notes}</div>}
                                                        </div>
                                                    }
                                                >
                                                    <div 
                                                        style={{
                                                            position: 'absolute',
                                                            left: `${left}%`,
                                                            width: `${width}%`,
                                                            height: '100%',
                                                            background: st.color,
                                                            borderRadius: 4,
                                                            border: st.isProjected ? '1px dashed #595959' : 'none',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            padding: '0 8px',
                                                            color: '#ffffff',
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            overflow: 'hidden',
                                                            whiteSpace: 'nowrap',
                                                            textOverflow: 'ellipsis',
                                                            cursor: 'pointer',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                        }}
                                                    >
                                                        {st.durationHours}h
                                                    </div>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </Spin>
            </Card>
        </div>
    );
}
