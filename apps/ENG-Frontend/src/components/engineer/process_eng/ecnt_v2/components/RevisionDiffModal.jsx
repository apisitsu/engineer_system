import React, { useState } from 'react';
import { 
    Modal, Table, Tag, Typography, Space, Card, Row, Col, 
    Empty, Alert, Select 
} from 'antd';
import { 
    DiffOutlined, ExclamationCircleOutlined, UserOutlined 
} from '@ant-design/icons';
import moment from 'moment';

const { Text, Paragraph } = Typography;
const { Option } = Select;

// Human-friendly field labels mapping
const FIELD_LABELS = {
    title_of_change: 'Title of Change',
    reason_of_change: 'Reason of Change',
    objective: 'Objective',
    objective_other: 'Other Objective',
    customer_name: 'Customer Name',
    project_code: 'Project / Model',
    ref_coc_no: 'Ref COC No.',
    dwg_part_no: 'DWG Part No.',
    dwg_cn: 'DWG Control No. (CN)',
    dwg_revision: 'DWG Revision',
    dwg_reason_of_change: 'DWG Reason of Change',
    dwg_before_change: 'DWG Before Change',
    dwg_after_change: 'DWG After Change',
    tool_current_no: 'Current Tool No',
    tool_current_usage: 'Current Tool Usage',
    tool_new_no: 'New Tool No',
    tool_new_usage: 'New Tool Usage',
    prog_before_change: 'Program Before Change',
    prog_condition_before: 'Condition Before Change',
    prog_after_change: 'Program After Change',
    prog_condition_after: 'Condition After Change',
    usage_part_no: 'Usage Part No.',
    usage_cn: 'Usage CN',
    usage_setup_no: 'Usage Setup No.',
    usage_process: 'Usage Process',
    usage_program_no: 'Usage Program No.',
    usage_mc_no: 'Usage Machine No.',
    usage_cycle_time_before: 'Cycle Time Before Change',
    usage_cycle_time_after: 'Cycle Time After Change',
    usage_before_change: 'Usage Setup Before Change',
    usage_after_change: 'Usage Setup After Change',
    scope_of_implementation: 'Scope of Implementation',
    before_change: 'ECN Details Before Change',
    after_change: 'ECN Details After Change'
};

export default function RevisionDiffModal({
    open,
    onClose,
    docData,
    fieldAudits = [],
    stageHistory = []
}) {
    const [selectedStageCode, setSelectedStageCode] = useState('ALL');

    // Extract return loop history entries (Clarification requests)
    const reworkStages = stageHistory.filter(h => 
        h.action_taken === 'REQUEST_MORE_DETAIL' || 
        (h.stage_code && h.stage_code.includes('_R'))
    );

    const latestRework = reworkStages[reworkStages.length - 1];

    // Filter audits by stage if selected
    const availableStages = Array.from(new Set(fieldAudits.map(a => a.stage_code).filter(Boolean)));
    const filteredAudits = selectedStageCode === 'ALL' 
        ? fieldAudits 
        : fieldAudits.filter(a => a.stage_code === selectedStageCode);

    const columns = [
        {
            title: 'Field / Modified Attribute',
            dataIndex: 'field_name',
            key: 'field_name',
            width: 220,
            render: (field) => (
                <div>
                    <Text strong style={{ color: '#1890ff', fontSize: 13 }}>
                        {FIELD_LABELS[field] || field}
                    </Text>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>{field}</div>
                </div>
            )
        },
        {
            title: 'Previous Baseline (Before Revision)',
            dataIndex: 'old_value',
            key: 'old_value',
            render: (text) => (
                <div style={{ 
                    background: '#fff1f0', 
                    border: '1px solid #ffa39e', 
                    borderRadius: 6, 
                    padding: '6px 10px',
                    color: '#cf1322',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 180,
                    overflowY: 'auto'
                }}>
                    {text !== null && text !== undefined && text !== '' ? text : <Text type="secondary" italic>(Empty / No Value)</Text>}
                </div>
            )
        },
        {
            title: 'Revised / Latest Value',
            dataIndex: 'new_value',
            key: 'new_value',
            render: (text) => (
                <div style={{ 
                    background: '#f6ffed', 
                    border: '1px solid #b7eb8f', 
                    borderRadius: 6, 
                    padding: '6px 10px',
                    color: '#389e0d',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 180,
                    overflowY: 'auto'
                }}>
                    {text !== null && text !== undefined && text !== '' ? text : <Text type="secondary" italic>(Empty / No Value)</Text>}
                </div>
            )
        },
        {
            title: 'Author & Timestamp',
            key: 'author',
            width: 180,
            render: (_, r) => (
                <div style={{ fontSize: 12 }}>
                    <div><UserOutlined style={{ marginRight: 4 }} />{r.modified_by_name || r.modified_by || 'Requester'}</div>
                    <div style={{ color: '#8c8c8c', fontSize: 11 }}>
                        {moment(r.modified_at).format('DD-MMM-YYYY HH:mm')}
                    </div>
                    {r.stage_code && (
                        <Tag color="orange" style={{ fontSize: 10, marginTop: 2 }}>{r.stage_code}</Tag>
                    )}
                </div>
            )
        }
    ];

    return (
        <Modal
            title={
                <Space>
                    <DiffOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                    <span>Revision History & Field Diff Comparison</span>
                </Space>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width={1000}
            style={{ top: 20 }}
            destroyOnClose
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {/* Header Summary */}
                <Card size="small" style={{ background: '#fafafa', borderRadius: 8, border: '1px solid #e8e8e8' }}>
                    <Row gutter={[16, 8]}>
                        <Col span={6}>
                            <Text type="secondary">Document:</Text>{' '}
                            <Text strong>{(docData?.doc_type === 'ECN' || docData?.ecn_no) ? (docData?.ecn_no || `#${docData?.id}`) : (docData?.ecr_no || `#${docData?.id}`)}</Text>
                        </Col>
                        <Col span={6}>
                            <Text type="secondary">Revision Cycle:</Text>{' '}
                            <Tag color="volcano" style={{ fontWeight: 600 }}>
                                Rev {docData?.revision_count || 1}
                            </Tag>
                        </Col>
                        <Col span={6}>
                            <Text type="secondary">Current Status:</Text>{' '}
                            <Tag color="blue">{docData?.process_status}</Tag>
                        </Col>
                        <Col span={6}>
                            <Text type="secondary">Modified Fields:</Text>{' '}
                            <Text strong style={{ color: '#52c41a' }}>{fieldAudits.length} field(s)</Text>
                        </Col>
                    </Row>
                </Card>

                {/* Clarification Request Note from Manager */}
                {latestRework && (
                    <Alert
                        message={
                            <Space>
                                <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />
                                <Text strong>Clarification / Return Loop Request Note:</Text>
                            </Space>
                        }
                        description={
                            <div style={{ marginTop: 4 }}>
                                <Paragraph style={{ margin: 0, background: '#ffffff', padding: '8px 12px', borderRadius: 6, border: '1px solid #ffd591' }}>
                                    "{latestRework.notes || 'Please review and provide additional technical details as discussed.'}"
                                </Paragraph>
                                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4, textAlign: 'right' }}>
                                    Requested by: {latestRework.action_by_name || latestRework.action_by || 'Department Manager'} ({moment(latestRework.completed_at || latestRework.started_at).format('DD-MMM-YYYY HH:mm')})
                                </div>
                            </div>
                        }
                        type="warning"
                        showIcon={false}
                        style={{ borderRadius: 8 }}
                    />
                )}

                {/* Filter Toolbar */}
                {availableStages.length > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
                        <Text style={{ fontSize: 12 }}>Filter by Stage:</Text>
                        <Select
                            value={selectedStageCode}
                            onChange={setSelectedStageCode}
                            size="small"
                            style={{ width: 180 }}
                        >
                            <Option value="ALL">All Stages ({fieldAudits.length})</Option>
                            {availableStages.map(st => (
                                <Option key={st} value={st}>{st}</Option>
                            ))}
                        </Select>
                    </div>
                )}

                {/* Side-by-Side Comparison Table */}
                {filteredAudits.length > 0 ? (
                    <Table
                        dataSource={filteredAudits}
                        columns={columns}
                        rowKey="id"
                        pagination={{ pageSize: 8 }}
                        size="middle"
                        bordered
                    />
                ) : (
                    <Card style={{ borderRadius: 8, textAlign: 'center', padding: '30px 20px' }}>
                        <Empty 
                            description="No field modifications recorded yet or no return loop (Request More Detail) has occurred."
                        />
                    </Card>
                )}

                <div style={{ fontSize: 12, color: '#8c8c8c', textAlign: 'center' }}>
                    💡 The main workspace always displays the latest revised data (Current) by default.
                </div>
            </div>
        </Modal>
    );
}
