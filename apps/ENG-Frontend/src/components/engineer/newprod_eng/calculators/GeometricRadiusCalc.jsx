import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Card, InputNumber, Typography, Collapse, Layout } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';

import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';

const { Title, Text, Paragraph } = Typography;
const { Content } = Layout;

export default function GeometricRadiusCalc() {
    const [params, setParams] = useState({
        D: 26.04,
        Angle: 35,
        R2: 3.2,
        H: 4.455
    });

    const [results, setResults] = useState({
        R_target: 0,
        R1: 0,
        alphaDeg: 0,
        cosA: 0,
        sinA: 0,
        Yc: 0,
        Xc: 0,
        dy: 0
    });

    const canvasRef = useRef(null);

    const handleParamChange = (key, val) => {
        setParams(p => ({ ...p, [key]: val }));
    };

    const drawDimArrow = (ctx, fromX, fromY, toX, toY, color) => {
        const headlen = 10;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const angle = Math.atan2(dy, dx);

        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 7), toY - headlen * Math.sin(angle - Math.PI / 7));
        ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 7), toY - headlen * Math.sin(angle + Math.PI / 7));
        ctx.lineTo(toX, toY);
        ctx.fillStyle = color;
        ctx.fill();
    };

    const drawTangencyPoint = (ctx, x, y) => {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#ef4444';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    };

    const calculateAndDraw = () => {
        const D = params.D || 0;
        const AngleDeg = params.Angle || 0;
        const R2 = params.R2 || 0;
        const H = params.H || 0;

        const R1 = D / 2;
        const alphaDeg = 90 - AngleDeg;
        const alphaRad = alphaDeg * Math.PI / 180;
        const cosA = Math.cos(alphaRad);
        const sinA = Math.sin(alphaRad);

        const Yc = H + R2;
        const Xc = (R1 + R2 - Yc * sinA) / cosA;

        const dy = R1 - H;
        let R_target = 0;
        if (dy > 0) {
            R_target = (Math.pow(Xc, 2) + Math.pow(dy, 2)) / (2 * dy);
        }

        setResults({ R_target, R1, alphaDeg, cosA, sinA, Yc, Xc, dy });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        const safeXInt = (Math.abs(cosA) > 0.01) ? (R1 / cosA) : (Xc + R2);

        const padding = 15;
        const minX = -R1 - padding;
        const maxX = Math.max(Xc + R2, safeXInt) + padding;
        const minY = -R1 - padding;
        const maxY = Math.max(R1, Yc + R2) + padding;

        const rangeX = maxX - minX;
        const rangeY = maxY - minY;

        const scale = Math.min(width / rangeX, height / rangeY) * 0.95;

        const midX = (maxX + minX) / 2;
        const midY = (maxY + minY) / 2;

        const originX = width / 2 - midX * scale;
        const originY = height / 2 + midY * scale;

        const colorGeo = '#4ade80';
        const colorDim = '#38bdf8';
        const colorTarget = '#fde047';
        const colorText = '#f8fafc';
        const colorGrid = '#3f4e63';
        const colorConst = '#64748b';

        const sX = (x) => originX + x * scale;
        const sY = (y) => originY - y * scale;

        // Draw Background
        ctx.fillStyle = '#2d3748';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = colorGrid;
        ctx.lineWidth = 1;
        for (let i = -150; i <= 150; i += 10) {
            ctx.beginPath(); ctx.moveTo(sX(i), 0); ctx.lineTo(sX(i), height); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, sY(i)); ctx.lineTo(width, sY(i)); ctx.stroke();
        }

        ctx.strokeStyle = colorConst;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, sY(0)); ctx.lineTo(width, sY(0)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sX(0), 0); ctx.lineTo(sX(0), height); ctx.stroke();

        ctx.fillStyle = '#9ca3af';
        ctx.font = '12px Arial';
        ctx.fillText('0,0', sX(3), sY(-3));

        // Geometry
        ctx.beginPath();
        ctx.moveTo(0, sY(H));
        ctx.lineTo(width, sY(H));
        ctx.strokeStyle = colorGeo;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(sX(0), sY(0), R1 * scale, 0, 2 * Math.PI);
        ctx.strokeStyle = colorGeo;
        ctx.lineWidth = 2;
        ctx.stroke();

        let x1, y1, x2, y2;
        if (Math.abs(sinA) < 0.001) {
            x1 = R1; y1 = minY - 20;
            x2 = R1; y2 = maxY + 20;
        } else {
            x1 = minX - 20;
            y1 = (R1 - x1 * cosA) / sinA;
            x2 = maxX + 20;
            y2 = (R1 - x2 * cosA) / sinA;
        }

        ctx.beginPath();
        ctx.moveTo(sX(x1), sY(y1));
        ctx.lineTo(sX(x2), sY(y2));
        ctx.strokeStyle = colorGeo;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const t1x = R1 * cosA;
        const t1y = R1 * sinA;
        drawTangencyPoint(ctx, sX(t1x), sY(t1y));

        ctx.beginPath();
        ctx.arc(sX(Xc), sY(Yc), R2 * scale, 0, 2 * Math.PI);
        ctx.strokeStyle = colorGeo;
        ctx.stroke();

        drawTangencyPoint(ctx, sX(Xc - R2 * cosA), sY(Yc - R2 * sinA));
        drawTangencyPoint(ctx, sX(Xc), sY(H));

        ctx.beginPath();
        ctx.moveTo(sX(Xc) - 5, sY(Yc)); ctx.lineTo(sX(Xc) + 5, sY(Yc));
        ctx.moveTo(sX(Xc), sY(Yc) - 5); ctx.lineTo(sX(Xc), sY(Yc) + 5);
        ctx.strokeStyle = colorGeo;
        ctx.stroke();

        const cRx = 0;
        const cRy = R1 - R_target;
        ctx.beginPath();
        const a1 = Math.atan2(H - cRy, Xc - cRx);
        const a2 = Math.PI / 2;
        ctx.arc(sX(cRx), sY(cRy), R_target * scale, a1 - 0.25, a2 + 0.25, true);
        ctx.strokeStyle = colorGeo;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath(); ctx.arc(sX(Xc), sY(H), 4, 0, 2 * Math.PI); ctx.fillStyle = '#ef4444'; ctx.fill();
        ctx.beginPath(); ctx.arc(sX(0), sY(R1), 4, 0, 2 * Math.PI); ctx.fill();
        ctx.beginPath(); ctx.arc(sX(cRx), sY(cRy), 4, 0, 2 * Math.PI); ctx.fillStyle = colorTarget; ctx.fill();

        // Dimensions
        ctx.font = '13px Arial';

        ctx.beginPath();
        ctx.moveTo(sX(0), sY(0)); ctx.lineTo(sX(minX + 5), sY(0));
        ctx.moveTo(sX(0), sY(H)); ctx.lineTo(sX(minX + 5), sY(H));
        ctx.strokeStyle = colorConst; ctx.lineWidth = 1; ctx.stroke();

        const hLineX = minX + 10;
        drawDimArrow(ctx, sX(hLineX), sY(H / 2), sX(hLineX), sY(H), colorDim);
        drawDimArrow(ctx, sX(hLineX), sY(H / 2), sX(hLineX), sY(0), colorDim);
        ctx.fillStyle = colorText;
        ctx.fillText(`${H.toFixed(3)}`, sX(hLineX + 2), sY(H / 2) + 4);

        const dAngle = Math.PI * 1.35;
        drawDimArrow(ctx, sX(0), sY(0), sX(R1 * Math.cos(dAngle)), sY(R1 * Math.sin(dAngle)), colorDim);
        ctx.fillStyle = colorText;
        ctx.fillText(`D ${D.toFixed(2)}`, sX(R1 * Math.cos(dAngle)) - 40, sY(R1 * Math.sin(dAngle)) + 15);

        const r2Angle = Math.PI * 0.25;
        drawDimArrow(ctx, sX(Xc), sY(Yc), sX(Xc + R2 * Math.cos(r2Angle)), sY(Yc + R2 * Math.sin(r2Angle)), colorDim);
        ctx.fillText(`R ${R2.toFixed(1)}`, sX(Xc + R2 * Math.cos(r2Angle)) + 8, sY(Yc + R2 * Math.sin(r2Angle)) - 5);

        const xInt = safeXInt;
        ctx.beginPath();
        ctx.moveTo(sX(xInt), sY(0)); ctx.lineTo(sX(xInt - 15), sY(0));
        ctx.strokeStyle = colorConst; ctx.stroke();

        const radStart = Math.PI;
        const radEnd = Math.PI - (AngleDeg * Math.PI / 180);
        ctx.beginPath();
        ctx.arc(sX(xInt), sY(0), 10 * scale, radEnd, radStart);
        ctx.strokeStyle = colorDim;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = colorText;
        ctx.fillText(`${AngleDeg}°`, sX(xInt - 12), sY(3.5));

        const rTargetAngle = Math.PI * 0.4;
        const edgeRx = cRx + R_target * Math.cos(rTargetAngle);
        const edgeRy = cRy + R_target * Math.sin(rTargetAngle);

        drawDimArrow(ctx, sX(cRx), sY(cRy), sX(edgeRx), sY(edgeRy), colorTarget);

        ctx.fillStyle = colorTarget;
        ctx.font = 'bold 15px Arial';
        const textPosX = cRx + (R_target / 2) * Math.cos(rTargetAngle);
        const textPosY = cRy + (R_target / 2) * Math.sin(rTargetAngle);
        ctx.fillText(`R ${R_target.toFixed(4)}`, sX(textPosX) + 5, sY(textPosY) - 5);
    };

    useEffect(() => {
        calculateAndDraw();
        // eslint-disable-next-line
    }, [params]);

    const { theme } = useTheme();

    return (
        <Layout style={{
            height: 'calc(100vh - 64px)',
            display: 'flex'
        }}>
            <MenuTemplate type={"NewProd"} defaultSelectedKeys={"1"} />
            <Layout style={{ backgroundColor: theme.colors.background }}>
                <ScrollbarStyle primary={theme.colors.primary} />
                <Content className="kb-vscroll" style={{
                    height: 'calc(100vh - 64px)',
                    overflowY: 'auto',
                    padding: '24px',
                    position: 'relative'
                }}>
                    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                        <div style={{
                            marginBottom: '24px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '24px',
                            padding: '24px',
                            background: theme.colors.surface,
                            borderRadius: '16px',
                            boxShadow: theme.shadows.sm
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    background: theme.colors.primary,
                                    color: 'white',
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <CalculatorOutlined style={{ fontSize: '24px' }} />
                                </div>
                                <div>
                                    <Title level={3} style={{ margin: 0, color: theme.colors.textPrimary }}>Geometric Radius Calculator</Title>
                                    <Text style={{ color: theme.colors.textSecondary }}>Calculate target radius from complex geometric dimensions</Text>
                                </div>
                            </div>
                        </div>

                        <Row gutter={[24, 24]}>
                            <Col xs={24} lg={8}>
                                <Card title="Parameters" size="small" style={{ borderRadius: '12px', marginBottom: '16px', border: `1px solid ${theme.colors.border}`, boxShadow: theme.shadows.sm }}>
                                    {Object.keys(params).map(k => (
                                        <div key={k} style={{ marginBottom: 16 }}>
                                            <Text style={{ display: 'block', fontSize: 13, fontWeight: 600, color: theme.colors.textSecondary, marginBottom: 4 }}>
                                                {k === 'D' ? 'D (วงกลมหลัก)' : k === 'Angle' ? 'Angle (องศา)' : k === 'R2' ? 'R (วงกลมเล็ก)' : 'H (ความสูง)'}
                                            </Text>
                                            <InputNumber value={params[k]} onChange={v => handleParamChange(k, v)} style={{ width: '100%', borderRadius: '6px' }} />
                                        </div>
                                    ))}
                                </Card>
                                <Card style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderRadius: '12px', boxShadow: theme.shadows.sm }}>
                                    <Text style={{ color: '#1e40af', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Target Radius (R)</Text>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                        <span style={{ fontSize: '32px', fontWeight: 900, color: '#1d4ed8' }}>{results.R_target.toFixed(4)}</span>
                                    </div>
                                </Card>
                            </Col>
                            <Col xs={24} lg={16}>
                                <Card title="CAD View" size="small" style={{ borderRadius: '12px', border: `1px solid ${theme.colors.border}`, boxShadow: theme.shadows.sm, marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', backgroundColor: '#2d3748', borderRadius: '8px', overflow: 'hidden' }}>
                                        <canvas ref={canvasRef} width={600} height={400} style={{ width: '100%', maxWidth: '600px', height: 'auto', aspectRatio: '3/2' }} />
                                    </div>
                                </Card>
                            </Col>
                        </Row>

                        <Collapse style={{ marginTop: '8px', backgroundColor: theme.colors.surface, borderRadius: '12px', border: `1px solid ${theme.colors.border}` }}>
                            <Collapse.Panel header={<span style={{ fontWeight: 600, color: theme.colors.textPrimary }}><CalculatorOutlined style={{ marginRight: '8px' }} />แสดงวิธีทำและสูตรคำนวณ (Math & Explanation)</span>} key="1">
                                <div style={{ fontSize: '14px', color: theme.colors.textPrimary, lineHeight: 1.6 }}>
                                    <div style={{ marginBottom: '24px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '15px', borderBottom: `1px solid ${theme.colors.border}`, paddingBottom: '4px', marginBottom: '12px', color: theme.colors.textPrimary }}>ขั้นตอนที่ 1: หาสมการเส้นสัมผัส</div>
                                        <Paragraph style={{ marginBottom: '8px' }}>เส้นสัมผัสทำมุม <Text strong style={{ color: '#2563eb' }}>{params.Angle}</Text>° ลาดลง เวกเตอร์ตั้งฉาก (Normal Vector) จะทำมุม α = 90° - {params.Angle}° = <Text strong>{results.alphaDeg}</Text>°</Paragraph>
                                        <Paragraph style={{ marginBottom: '8px' }}>สมการเส้นตรงที่สัมผัสวงกลม D (รัศมี R₁ = {results.R1.toFixed(2)}) คือ:</Paragraph>
                                        <div style={{ backgroundColor: '#f8fafc', borderLeft: '4px solid #3b82f6', padding: '16px', fontFamily: 'monospace', borderRadius: '0 8px 8px 0', overflowX: 'auto' }}>
                                            <div>x·cos(α) + y·sin(α) = R₁</div>
                                            <div>x({results.cosA.toFixed(4)}) + y({results.sinA.toFixed(4)}) = {results.R1.toFixed(2)}</div>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '24px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '15px', borderBottom: `1px solid ${theme.colors.border}`, paddingBottom: '4px', marginBottom: '12px', color: theme.colors.textPrimary }}>ขั้นตอนที่ 2: หาจุดศูนย์กลางวงกลมเล็ก (Xc, Yc)</div>
                                        <Paragraph style={{ marginBottom: '8px' }}>วงกลมเล็ก (R₂ = {params.R2}) สัมผัสเส้นระดับ H = {params.H}<br />ดังนั้น Yc = H + R₂ = {results.Yc.toFixed(3)}</Paragraph>
                                        <Paragraph style={{ marginBottom: '8px' }}>ระยะห่างจาก (Xc, Yc) ถึงเส้นสัมผัสในข้อ 1 ต้องเท่ากับ R₂:</Paragraph>
                                        <div style={{ backgroundColor: '#f8fafc', borderLeft: '4px solid #3b82f6', padding: '16px', fontFamily: 'monospace', borderRadius: '0 8px 8px 0', overflowX: 'auto' }}>
                                            <div>Xc·cos(α) + Yc·sin(α) - R₁ = R₂</div>
                                            <div>Xc = [R₁ + R₂ - Yc·sin(α)] / cos(α)</div>
                                            <div>Xc = [{results.R1.toFixed(2)} + {params.R2} - ({results.Yc.toFixed(3)} × {results.sinA.toFixed(4)})] / {results.cosA.toFixed(4)}</div>
                                            <div>Xc = <Text strong style={{ color: '#2563eb' }}>{results.Xc.toFixed(3)}</Text></div>
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '15px', borderBottom: `1px solid ${theme.colors.border}`, paddingBottom: '4px', marginBottom: '12px', color: theme.colors.textPrimary }}>ขั้นตอนที่ 3: คำนวณรัศมีเป้าหมาย (R)</div>
                                        <Paragraph style={{ marginBottom: '8px' }}>วงกลม R สัมผัสวงกลม D ที่ยอดสุด พิกัดศูนย์กลางคือ C(0, R₁ - R)<br />และเส้นรอบวงต้องลากผ่านจุดสัมผัสระหว่างวงกลมเล็กกับเส้น H ที่พิกัด P(Xc, H)</Paragraph>
                                        <Paragraph style={{ marginBottom: '8px' }}>ตั้งสมการระยะทางจาก C ถึง P:</Paragraph>
                                        <div style={{ backgroundColor: '#f8fafc', borderLeft: '4px solid #3b82f6', padding: '16px', fontFamily: 'monospace', borderRadius: '0 8px 8px 0', overflowX: 'auto', marginBottom: '12px' }}>
                                            <div>R² = (Xc - 0)² + [H - (R₁ - R)]²</div>
                                            <div>ให้ระยะ Δy = R₁ - H = {results.dy.toFixed(3)}</div>
                                            <div>R² = Xc² + (R - Δy)²</div>
                                            <div>R² = Xc² + R² - 2R(Δy) + Δy²</div>
                                            <div>2R(Δy) = Xc² + Δy²</div>
                                            <div>R = (Xc² + Δy²) / (2 × Δy)</div>
                                        </div>
                                        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #93c5fd', borderLeft: '4px solid #3b82f6', padding: '16px', fontFamily: 'monospace', borderRadius: '8px', overflowX: 'auto', fontWeight: 600, color: '#1e40af' }}>
                                            <div>R = ({results.Xc.toFixed(3)}² + {results.dy.toFixed(3)}²) / (2 × {results.dy.toFixed(3)})</div>
                                            <div style={{ marginTop: '8px', fontSize: '16px' }}>R = {results.R_target.toFixed(4)}</div>
                                        </div>
                                    </div>
                                </div>
                            </Collapse.Panel>
                        </Collapse>
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
}
