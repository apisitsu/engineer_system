import React, { useEffect, useState } from 'react';
import { Modal, Row, Col, Typography, Space, App } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import useEngRecordStore from '../../../../../stores/engRecordStore';
import engRecordApi from '../../../../../api/engRecordApi';
import { TemplateCard } from './components/TemplateCard';
import { CutoffCalculatorModal } from './components/CutoffCalculatorModal';

const { Text } = Typography;

export function EngRecordQuickCreate() {
    const { message: msgApi } = App.useApp();
    const {
        quickCreateOpen,
        closeQuickCreate,
        templates,
        fetchTemplates,
        applyTemplate,
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
            msgApi.error(
                'Calculation failed: ' + (err.response?.data?.error || err.message)
            );
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
                            <TemplateCard template={t} onClick={handleTemplateClick} />
                        </Col>
                    ))}
                </Row>
            </Modal>

            {/* Cut-off Calculator Modal */}
            <CutoffCalculatorModal
                open={calcOpen}
                onCancel={() => setCalcOpen(false)}
                onSubmit={handleCalcSubmit}
                headDia={headDia}
                setHeadDia={setHeadDia}
                totalLength={totalLength}
                setTotalLength={setTotalLength}
            />
        </>
    );
}

export default EngRecordQuickCreate;
