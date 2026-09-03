import React, { useState, useEffect } from 'react';
import { Modal, Spin, Button, Card, Typography, Divider, Row, Col, Alert, Checkbox } from 'antd';
import { App } from 'antd';
import axios from 'axios';
import moment from 'moment';
import { server } from '../../../../constance/constance';
import WorkflowActionCard from './components/WorkflowActionCard';
import AttachmentManager from './components/AttachmentManager';
import { generateEcnPdf } from './utils/pdfGenerator';
import { FilePdfOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function ECNDetailModal({ open, documentId, documentType, onClose }) {
    const { message: antdMessage } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [docData, setDocData] = useState(null);
    const [logs, setLogs] = useState([]);

    const [impactData, setImpactData] = useState(null);
    const [qcData, setQcData] = useState([]);
    const [tasksData, setTasksData] = useState([]);

    useEffect(() => {
        if (open && documentId) {
            fetchDetail();
        }
    }, [open, documentId, documentType]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const endpoint = documentType === 'ECR' ? `/api/ecnt/ecr/${documentId}` : `/api/ecnt/ecn/${documentId}`;
            const response = await axios.get(`${server.URL}${endpoint}`, { withCredentials: true });
            
            setDocData(response.data.data);
            setLogs(response.data.logs || []);
            
            if (documentType === 'ECN') {
                setImpactData(response.data.impact);
                setQcData(response.data.qc || []);
                setTasksData(response.data.tasks || []);
            }
        } catch (error) {
            console.error("Fetch Detail Error:", error);
            antdMessage.error("Failed to load document details");
        } finally {
            setLoading(false);
        }
    };

    const renderActionHistory = () => (
        <Card title="Approval History" size="small" style={{ marginTop: 16 }}>
            {logs.length === 0 ? <Text type="secondary">No actions taken yet.</Text> : (
                logs.map(log => (
                    <div key={log.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
                        <Text strong>{log.step_label}</Text> — 
                        <Text type={log.action === 'APPROVE' ? 'success' : log.action === 'DENY' ? 'danger' : 'warning'}> {log.action}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                            By {log.action_by_name} ({log.action_role}) on {moment(log.created_at).format('DD-MMM-YYYY HH:mm')}
                        </Text>
                        {log.comment && <div><Text italic>"{log.comment}"</Text></div>}
                        {log.deny_reason && <div><Text type="danger">Reason: {log.deny_reason}</Text></div>}
                    </div>
                ))
            )}
        </Card>
    );

    const renderEcrDetail = () => (
        <div style={{ padding: 16 }}>
            <Row gutter={[16, 16]}>
                <Col span={12}><Text type="secondary">ECR No:</Text> <Text strong>{docData?.ecr_no || 'Pending'}</Text></Col>
                <Col span={12}><Text type="secondary">Status:</Text> <Text strong>{docData?.process_status}</Text></Col>
                <Col span={12}><Text type="secondary">Requester:</Text> <Text>{docData?.request_by_name}</Text></Col>
                <Col span={12}><Text type="secondary">Objective:</Text> <Text>{docData?.objective}</Text></Col>
                <Col span={12}><Text type="secondary">Customer Name:</Text> <Text strong>{docData?.customer_name || 'N/A'}</Text></Col>
                <Col span={12}><Text type="secondary">Project Code:</Text> <Text strong>{docData?.project_code || 'N/A'}</Text></Col>
                <Col span={24}><Text type="secondary">Title:</Text> <div dangerouslySetInnerHTML={{ __html: docData?.title_of_change }} /></Col>
                <Col span={24}><Text type="secondary">Reason:</Text> <div dangerouslySetInnerHTML={{ __html: docData?.reason_of_change }} /></Col>
            </Row>

            <Divider orientation="left">Attachments</Divider>
            <AttachmentManager documentId={docData?.id} documentType="ECR" />

            {docData?.is_drawing && (
                <Card size="small" title="A. Drawing Change" style={{ marginTop: 16, background: '#fafafa' }}>
                    <Text type="secondary">Part No:</Text> {docData.dwg_part_no} | <Text type="secondary">C/N:</Text> {docData.dwg_cn}
                </Card>
            )}
            
            <WorkflowActionCard 
                documentId={docData?.id} 
                documentType="ECR" 
                currentBlock={docData?.current_block} 
                processStatus={docData?.process_status} 
                onSuccess={fetchDetail} 
            />
        </div>
    );

    const handleDownloadPdf = async () => {
        try {
            await generateEcnPdf(docData, { ecr_no: 'ECR-MOCK-REF' }); // In real app, fetch ECR ref
            antdMessage.success("PDF Downloaded");
        } catch (error) {
            antdMessage.error("Failed to generate PDF");
        }
    };

    const renderEcnDetail = () => (
        <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Alert message={`ECN No: ${docData?.ecn_no || 'Pending'}`} type="info" showIcon style={{ flex: 1, marginRight: 16 }} />
                {docData?.process_status === 'ECN Effective' && (
                    <Button type="primary" icon={<FilePdfOutlined />} onClick={handleDownloadPdf}>
                        Download PDF
                    </Button>
                )}
            </div>
            
            <Row gutter={[16, 16]}>
                <Col span={24}><Text type="secondary">Scope of Implementation:</Text> <Text>{docData?.scope_of_implementation}</Text></Col>
                <Col span={24}><Text type="secondary">Before Change:</Text> <div dangerouslySetInnerHTML={{ __html: docData?.before_change }} /></Col>
                <Col span={24}><Text type="secondary">After Change:</Text> <div dangerouslySetInnerHTML={{ __html: docData?.after_change }} /></Col>
            </Row>

            <Divider orientation="left">Attachments</Divider>
            <AttachmentManager documentId={docData?.id} documentType="ECN" />

            <Divider orientation="left">Impact Assessment</Divider>
            {impactData ? (
                <Row gutter={[16, 8]}>
                    <Col span={12}><Checkbox checked={impactData.has_customer_impact}>Customer Impact</Checkbox></Col>
                    <Col span={12}><Checkbox checked={impactData.has_kzw_fjsw_impact}>KZW/FJSW Impact</Checkbox></Col>
                    <Col span={12}><Checkbox checked={impactData.has_sale_drawing_impact}>Sale Drawing</Checkbox></Col>
                    <Col span={12}><Checkbox checked={impactData.has_manufacturing}>Manufacturing</Checkbox></Col>
                </Row>
            ) : <Text type="secondary">No impact data available.</Text>}

            <Divider orientation="left">QC Decisions</Divider>
            {qcData.length > 0 ? qcData.map(qc => (
                <Alert key={qc.id} type="success" message={`${qc.decision_type}: ${qc.decision}`} description={`By ${qc.confirmed_by_name}`} style={{ marginBottom: 8 }}/>
            )) : <Text type="secondary">Pending QC Decisions.</Text>}

            <WorkflowActionCard 
                documentId={docData?.id} 
                documentType="ECN" 
                currentBlock={docData?.current_block} 
                processStatus={docData?.process_status} 
                tasksData={tasksData}
                onSuccess={fetchDetail} 
            />
        </div>
    );

    return (
        <Modal
            title={<span style={{ fontSize: '20px', fontWeight: 600 }}>{documentType} Details</span>}
            open={open}
            onCancel={onClose}
            footer={[<Button key="close" onClick={onClose}>Close</Button>]}
            width={1000}
            bodyStyle={{ padding: 0 }}
        >
            <Spin spinning={loading}>
                {docData && (
                    <Row>
                        <Col span={16} style={{ borderRight: '1px solid #f0f0f0', minHeight: '500px' }}>
                            {documentType === 'ECR' ? renderEcrDetail() : renderEcnDetail()}
                        </Col>
                        <Col span={8} style={{ padding: 16, background: '#fcfcfc' }}>
                            {renderActionHistory()}
                        </Col>
                    </Row>
                )}
            </Spin>
        </Modal>
    );
}
