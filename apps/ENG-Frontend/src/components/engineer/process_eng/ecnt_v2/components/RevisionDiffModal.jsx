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
    title_of_change: 'หัวข้อการเปลี่ยนแปลง (Title of Change)',
    reason_of_change: 'เหตุผลการเปลี่ยนแปลง (Reason of Change)',
    objective: 'วัตถุประสงค์ (Objective)',
    objective_other: 'วัตถุประสงค์อื่นๆ (Other Objective)',
    customer_name: 'ชื่อลูกค้า (Customer)',
    project_code: 'รหัสโครงการ / โมเดล (Project / Model)',
    ref_coc_no: 'Ref COC No.',
    dwg_part_no: 'DWG Part No.',
    dwg_cn: 'DWG Control No. (CN)',
    dwg_revision: 'DWG Revision',
    dwg_reason_of_change: 'DWG เหตุผลการเปลี่ยนแปลง',
    dwg_before_change: 'DWG สภาพก่อนการเปลี่ยนแปลง',
    dwg_after_change: 'DWG สภาพหลังการเปลี่ยนแปลง',
    tool_current_no: 'Tooling เบอร์เดิม (Current Tool No)',
    tool_current_usage: 'Tooling อายุการใช้งานเดิม (Current Usage)',
    tool_new_no: 'Tooling เบอร์ใหม่ (New Tool No)',
    tool_new_usage: 'Tooling อายุการใช้งานใหม่ (New Usage)',
    prog_before_change: 'Program สภาพก่อนเปลี่ยนแปลง',
    prog_condition_before: 'Program เงื่อนไขก่อนเปลี่ยนแปลง',
    prog_after_change: 'Program สภาพหลังเปลี่ยนแปลง',
    prog_condition_after: 'Program เงื่อนไขหลังเปลี่ยนแปลง',
    usage_part_no: 'Usage Part No.',
    usage_cn: 'Usage CN',
    usage_setup_no: 'Usage Setup No.',
    usage_process: 'Usage Process',
    usage_program_no: 'Usage Program No.',
    usage_mc_no: 'Usage Machine No.',
    usage_cycle_time_before: 'Cycle Time ก่อนเปลี่ยนแปลง',
    usage_cycle_time_after: 'Cycle Time หลังเปลี่ยนแปลง',
    usage_before_change: 'Usage สภาพก่อนเปลี่ยนแปลง',
    usage_after_change: 'Usage สภาพหลังเปลี่ยนแปลง',
    scope_of_implementation: 'ขอบเขตการบังคับใช้ (Scope of Implementation)',
    before_change: 'รายละเอียดก่อนการเปลี่ยนแปลง (ECN Before)',
    after_change: 'รายละเอียดหลังการเปลี่ยนแปลง (ECN After)'
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
            title: 'หัวข้อ / ข้อมูลที่เปลี่ยนแปลง',
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
            title: 'ข้อมูลก่อนการแก้ไข (Previous Value)',
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
                    {text !== null && text !== undefined && text !== '' ? text : <Text type="secondary" italic>(ว่าง / ไม่มีข้อมูล)</Text>}
                </div>
            )
        },
        {
            title: 'ข้อมูลรอบล่าสุด (Revised / Latest Value)',
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
                    {text !== null && text !== undefined && text !== '' ? text : <Text type="secondary" italic>(ว่าง / ไม่มีข้อมูล)</Text>}
                </div>
            )
        },
        {
            title: 'ผู้แก้ไข & วันเวลา',
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
                    <span>ประวัติการแก้ไขและเปรียบเทียบข้อมูลก่อน-หลัง (Revision & Diff Comparison)</span>
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
                            <Text type="secondary">เอกสาร:</Text>{' '}
                            <Text strong>{docData?.ecr_no || docData?.ecn_no || `#${docData?.id}`}</Text>
                        </Col>
                        <Col span={6}>
                            <Text type="secondary">จำนวนรอบแก้ไข:</Text>{' '}
                            <Tag color="volcano" style={{ fontWeight: 600 }}>
                                Rev {docData?.revision_count || 1}
                            </Tag>
                        </Col>
                        <Col span={6}>
                            <Text type="secondary">สถานะปัจจุบัน:</Text>{' '}
                            <Tag color="blue">{docData?.process_status}</Tag>
                        </Col>
                        <Col span={6}>
                            <Text type="secondary">ฟิลด์ที่มีการปรับปรุง:</Text>{' '}
                            <Text strong style={{ color: '#52c41a' }}>{fieldAudits.length} รายการ</Text>
                        </Col>
                    </Row>
                </Card>

                {/* Clarification Request Note from Manager */}
                {latestRework && (
                    <Alert
                        message={
                            <Space>
                                <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />
                                <Text strong>เหตุผลที่ผู้จัดการขอให้แก้ไขข้อมูลเพิ่มเติม (Clarification Request):</Text>
                            </Space>
                        }
                        description={
                            <div style={{ marginTop: 4 }}>
                                <Paragraph style={{ margin: 0, background: '#ffffff', padding: '8px 12px', borderRadius: 6, border: '1px solid #ffd591' }}>
                                    "{latestRework.notes || 'กรุณาตรวจสอบและเพิ่มเติมรายละเอียดเชิงเทคนิคตามที่ได้หารือ'}"
                                </Paragraph>
                                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4, textAlign: 'right' }}>
                                    ร้องขอโดย: {latestRework.action_by_name || latestRework.action_by || 'Department Manager'} ({moment(latestRework.completed_at || latestRework.started_at).format('DD-MMM-YYYY HH:mm')})
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
                        <Text style={{ fontSize: 12 }}>กรองตามสเตจที่แก้ไข:</Text>
                        <Select
                            value={selectedStageCode}
                            onChange={setSelectedStageCode}
                            size="small"
                            style={{ width: 180 }}
                        >
                            <Option value="ALL">แสดงทุกสเตจ ({fieldAudits.length})</Option>
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
                            description="ยังไม่มีประวัติการเปลี่ยนแปลงฟิลด์ข้อมูลในรอบนี้ หรือยังไม่มีการกดขอข้อมูลเพิ่มเติม (Request More Detail)"
                        />
                    </Card>
                )}

                <div style={{ fontSize: 12, color: '#8c8c8c', textAlign: 'center' }}>
                    💡 ข้อมูลในหน้าทำงานหลักจะแสดงค่ารอบล่าสุด (Current) เป็นค่าเริ่มต้นเสมอ
                </div>
            </div>
        </Modal>
    );
}
