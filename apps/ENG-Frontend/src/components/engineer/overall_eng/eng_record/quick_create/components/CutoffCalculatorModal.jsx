import React from 'react';
import { Modal, Typography, InputNumber } from 'antd';

const { Text } = Typography;

export function CutoffCalculatorModal({
    open,
    onCancel,
    onSubmit,
    headDia,
    setHeadDia,
    totalLength,
    setTotalLength,
}) {
    return (
        <Modal
            title="Cut-off Spec Calculator"
            open={open}
            onCancel={onCancel}
            onOk={onSubmit}
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
                    <div
                        style={{
                            padding: 12,
                            background: 'rgba(22,119,255,0.06)',
                            borderRadius: 8,
                            textAlign: 'center',
                        }}
                    >
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Preview:
                        </Text>
                        <br />
                        <Text strong style={{ color: '#1677ff' }}>
                            Revise by hand on D1 L=
                            {headDia * 3 > totalLength
                                ? totalLength + 0.5
                                : totalLength + 2}
                        </Text>
                    </div>
                )}
            </div>
        </Modal>
    );
}

export default CutoffCalculatorModal;
