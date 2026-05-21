import React, { useEffect, useState } from 'react';
import { Modal, Card, Row, Col, Typography, Tag, InputNumber, Button, Space, App } from 'antd';
import {
    FileUnknownOutlined, SwapOutlined, ScissorOutlined, ExperimentOutlined,
    HighlightOutlined, ToolOutlined, PlusCircleOutlined, MinusCircleOutlined,
    EditOutlined, SafetyCertificateOutlined, CloseCircleOutlined,
    ThunderboltOutlined,
} from '@ant-design/icons';
import useEngRecordStore from '../../../../stores/engRecordStore';
import engRecordApi from '../../../../api/engRecordApi';

const { Text, Title } = Typography;

// Map icon name strings → actual components
const ICON_MAP = {
    FileUnknownOutlined: <FileUnknownOutlined />,
    SwapOutlined: <SwapOutlined />,
    ScissorOutlined: <ScissorOutlined />,
    ExperimentOutlined: <ExperimentOutlined />,
    HighlightOutlined: <HighlightOutlined />,
    ToolOutlined: <ToolOutlined />,
    PlusCircleOutlined: <PlusCircleOutlined />,
    MinusCircleOutlined: <MinusCircleOutlined />,
    EditOutlined: <EditOutlined />,
    SafetyCertificateOutlined: <SafetyCertificateOutlined />,
    CloseCircleOutlined: <CloseCircleOutlined />,
};

function EngRecordQuickCreate() {
    const { message: msgApi } = App.useApp();
    const {
        quickCreateOpen, closeQuickCreate, templates,
        fetchTemplates, applyTemplate,
    } = useEngRecordStore();

    // Calculator state for "No Cut-off Spec"
    const [calcOpen, setCalcOpen] = useState(false);
    const [calcTemplate, setCalcTemplate] = useState(null);
    const [headDia, setHeadDia] = useState(null);
    const [totalLength, setTotalLength] = useState(null);

    useEffect(() => {
        if (quickCreateOpen && templates.length === 0) {
            fetchTemplates();
        }
    }, [quickCreateOpen, templates.length, fetchTemplates]);

    const handleTemplateClick = (template) => {
        if (template.has_calculator) {
            setCalcTemplate(template);
            setCalcOpen(true);
            setHeadDia(null);
            setTotalLength(null);
            return;
        }
        applyTemplate(template);
    };

    const handleCalcSubmit = async () => {
        if (!headDia || !totalLength) {
            msgApi.warning('Please fill both Head Dia and Total Length');
            return;
        }

        try {
            const res = await engRecordApi.computeCutoff(headDia, totalLength);
            const enrichedTemplate = {
                ...calcTemplate,
                judge_revise: res.data.judge_revise,
            };
            setCalcOpen(false);
            applyTemplate(enrichedTemplate);
        } catch (err) {
            msgApi.error('Calculation failed: ' + (err.response?.data?.error || err.message));
        }
    };

    return (
        <>
            <Modal
                title={
                    <Space>
                        <ThunderboltOutlined style={{ color: '#fa8c16' }} />
                        <span>Quick Create — Select Template</span>
                    </Space>
                }
                open={quickCreateOpen}
                onCancel={closeQuickCreate}
                footer={null}
                width={800}
                destroyOnHidden
            >
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                    เลือก Template เพื่อกรอกข้อมูลอัตโนมัติ (เหมือน Macro เดิมใน Excel)
                </Text>

                <Row gutter={[12, 12]}>
                    {templates.map((t) => (
                        <Col xs={12} sm={8} md={6} key={t.id}>
                            <Card
                                hoverable
                                onClick={() => handleTemplateClick(t)}
                                style={{
                                    borderRadius: 12,
                                    textAlign: 'center',
                                    border: `2px solid ${t.color}22`,
                                    transition: 'all 0.2s ease',
                                    height: '100%',
                                }}
                                styles={{
                                    body: {
                                        padding: '16px 8px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 6,
                                    },
                                }}
                                className="engr-template-card"
                            >
                                <div style={{
                                    fontSize: 28,
                                    color: t.color,
                                    marginBottom: 4,
                                }}>
                                    {ICON_MAP[t.icon] || <ThunderboltOutlined />}
                                </div>
                                <Text strong style={{ fontSize: 12, lineHeight: 1.3 }}>
                                    {t.label}
                                </Text>
                                <Tag
                                    color={t.color}
                                    style={{ fontSize: 10, margin: 0, borderRadius: 4 }}
                                >
                                    {t.case_type.length > 18
                                        ? t.case_type.substring(0, 16) + '...'
                                        : t.case_type}
                                </Tag>
                                {t.needs_manual_input && (
                                    <Text type="secondary" style={{ fontSize: 9, marginTop: 2 }}>
                                        ต้องกรอกเพิ่ม
                                    </Text>
                                )}
                                {t.has_calculator && (
                                    <Text type="warning" style={{ fontSize: 9, marginTop: 2 }}>
                                        มีตัวคำนวณ
                                    </Text>
                                )}
                            </Card>
                        </Col>
                    ))}
                </Row>
            </Modal>

            {/* ─── Cut-off Calculator Modal ──────────────── */}
            <Modal
                title="Cut-off Spec Calculator"
                open={calcOpen}
                onCancel={() => setCalcOpen(false)}
                onOk={handleCalcSubmit}
                okText="Calculate & Create"
                width={400}
            >
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                    VBA Logic: ถ้า Head Dia × 3 {'>'} Total Length → D1 L = Total + 0.5 <br />
                    ไม่งั้น → D1 L = Total + 2
                </Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <Text>Head Dia of Body</Text>
                        <InputNumber
                            value={headDia}
                            onChange={setHeadDia}
                            style={{ width: '100%', marginTop: 4 }}
                            placeholder="e.g. 5"
                            min={0}
                        />
                    </div>
                    <div>
                        <Text>Total Length</Text>
                        <InputNumber
                            value={totalLength}
                            onChange={setTotalLength}
                            style={{ width: '100%', marginTop: 4 }}
                            placeholder="e.g. 20"
                            min={0}
                        />
                    </div>
                    {headDia && totalLength && (
                        <div style={{
                            padding: 12,
                            background: 'rgba(22,119,255,0.06)',
                            borderRadius: 8,
                            textAlign: 'center',
                        }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>Preview:</Text>
                            <br />
                            <Text strong style={{ color: '#1677ff' }}>
                                Revise by hand on D1 L=
                                {(headDia * 3) > totalLength
                                    ? (totalLength + 0.5)
                                    : (totalLength + 2)}
                            </Text>
                        </div>
                    )}
                </div>
            </Modal>
        </>
    );
}

export default EngRecordQuickCreate;
