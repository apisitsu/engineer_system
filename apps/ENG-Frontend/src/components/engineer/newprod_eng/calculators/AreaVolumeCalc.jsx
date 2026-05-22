import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Card, InputNumber, Button, Typography, Alert, Collapse, Table, Layout, Tag } from 'antd';
import { CalculatorOutlined, InfoCircleOutlined } from '@ant-design/icons';

import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';

const { Title, Text, Paragraph } = Typography;
const { Content } = Layout;

function lineIntegral(x1, y1, x2, y2) {
    return 0.5 * (x1 * y2 - x2 * y1);
}

function arcIntegral(cx, cy, r, th1, th2, isCCW) {
    let f = (th) => 0.5 * (r * cx * Math.sin(th) - r * cy * Math.cos(th) + r * r * th);
    if (isCCW) {
        while (th2 < th1) th2 += 2 * Math.PI;
        while (th2 - th1 > 2 * Math.PI) th2 -= 2 * Math.PI;
    } else {
        while (th2 > th1) th2 -= 2 * Math.PI;
        while (th1 - th2 > 2 * Math.PI) th2 += 2 * Math.PI;
    }
    return f(th2) - f(th1);
}

function lineVolumeIntegral(x1, y1, x2, y2) {
    return -Math.PI * ((x2 - x1) / 3.0) * (y1 ** 2 + y1 * y2 + y2 ** 2);
}

function arcVolumeIntegral(cx, cy, r, th1, th2, isCCW) {
    let f = (th) => {
        let term1 = -(cy ** 2) * Math.cos(th);
        let term2 = r * cy * (th - (Math.sin(2 * th) / 2.0));
        let term3 = r ** 2 * (-Math.cos(th) + (Math.pow(Math.cos(th), 3) / 3.0));
        return Math.PI * r * (term1 + term2 + term3);
    };

    if (isCCW) {
        while (th2 < th1) th2 += 2 * Math.PI;
        while (th2 - th1 > 2 * Math.PI) th2 -= 2 * Math.PI;
    } else {
        while (th2 > th1) th2 -= 2 * Math.PI;
        while (th1 - th2 > 2 * Math.PI) th2 += 2 * Math.PI;
    }
    return f(th2) - f(th1);
}

export default function AreaVolumeCalc() {
    const [params, setParams] = useState({
        d_outer: 23.83,
        d_inner: 18.5,
        d_large: 15.8,
        w_base: 13.1559,
        y_base: 3.13,
        y_top: 6.55,
        y_mid: 5.705,
        w_top: 7,
        angle: 15,
        cy_small: 7.217,
        c_dist: 3.5,
        r_small: 2.05
    });

    const [results, setResults] = useState({
        area1: 0, vol1: 0,
        area2: 0, vol2: 0,
        area3: 0, vol3: 0,
        area_half: 0, vol_half: 0,
        area_base: 0, vol_base: 0,
        y_edge: 0, th_in: 0, r_in: 0
    });
    const [nodes, setNodes] = useState([]);
    const [stepDetails, setStepDetails] = useState([]);
    const [errorMsg, setErrorMsg] = useState(null);
    const canvasRef = useRef(null);

    const handleParamChange = (key, val) => {
        setParams(p => ({ ...p, [key]: val }));
    };

    const calculate = () => {
        setErrorMsg(null);
        try {
            const R_large = params.d_large / 2;
            const angleRad = params.angle * Math.PI / 180;
            let l_w_top = Math.tan(angleRad) * (params.y_top - params.y_mid);
            const w_top = params.w_top + (2 * l_w_top);
            const cx_small = params.c_dist / 2;

            const P0 = { x: 0, y: params.y_base, type: 'start', desc: "จุดกึ่งกลางฐานล่าง (Origin Axis)" };
            const P1 = { x: params.w_base / 2, y: params.y_base, type: 'line', desc: "มุมขวาฐาน (จบเส้น H แนวนอน)" };

            const y_p2 = Math.sqrt(R_large ** 2 - P1.x ** 2);
            if (isNaN(y_p2)) throw new Error("Base width is wider than large circle radius.");
            const P2 = { x: P1.x, y: y_p2, type: 'line', desc: "จุดชนวงกลมใหญ่ D" + (R_large * 2) };

            const x_p3 = Math.sqrt(R_large ** 2 - params.y_top ** 2);
            if (isNaN(x_p3)) throw new Error("Top Y is higher than large circle border.");
            const P3 = { x: x_p3, y: params.y_top, type: 'arc', c: { x: 0, y: 0 }, r: R_large, ccw: true, desc: "ขอบบนสุดที่ตัดกับวงกลมใหญ่" };

            const P4 = { x: w_top / 2, y: params.y_top, type: 'line', desc: "จุดเริ่มหักมุมรอยบาก" };

            const dx_slope = (params.y_top - params.y_mid) * Math.tan(angleRad);
            const P5 = { x: P4.x - dx_slope, y: params.y_mid, type: 'line', desc: `ปลายมุมบาก ${params.angle}°` };

            const dy_small = params.y_mid - params.cy_small;
            const dx_small = Math.sqrt(params.r_small ** 2 - dy_small ** 2);
            if (isNaN(dx_small)) throw new Error("Mid Y does not intersect inner small circle.");
            const P6 = { x: cx_small + dx_small, y: params.y_mid, type: 'line', desc: "จุดชนวงกลมเล็กฝั่งขวา" };

            const P7 = { x: cx_small - dx_small, y: params.y_mid, type: 'arc', c: { x: cx_small, y: params.cy_small }, r: params.r_small, ccw: false, desc: "จุดออกจากโค้งวงกลมเล็ก" };
            const P8 = { x: 0, y: params.y_mid, type: 'line', desc: "จุดตัดราบกึ่งกลางแกน Y" };

            const currentNodes = [P0, P1, P2, P3, P4, P5, P6, P7, P8];
            setNodes(currentNodes);

            let area_half = 0;
            let vol_half = 0;
            let currentSteps = [];

            for (let i = 0; i < currentNodes.length - 1; i++) {
                let n1 = currentNodes[i], n2 = currentNodes[i + 1];
                let stepArea = 0, stepVol = 0;
                let method = '';
                let eqArea = '';
                let eqVol = '';

                if (n2.type === 'line') {
                    stepArea = lineIntegral(n1.x, n1.y, n2.x, n2.y);
                    stepVol = lineVolumeIntegral(n1.x, n1.y, n2.x, n2.y);
                    method = 'Line';
                    eqArea = `1/2 * ((${n1.x.toFixed(4)})(${n2.y.toFixed(4)}) - (${n2.x.toFixed(4)})(${n1.y.toFixed(4)}))`;
                    eqVol = `-pi * (${n2.x.toFixed(4)} - ${n1.x.toFixed(4)})/3 * (${n1.y.toFixed(4)}² + (${n1.y.toFixed(4)})(${n2.y.toFixed(4)}) + ${n2.y.toFixed(4)}²)`;
                } else if (n2.type === 'arc') {
                    let th1 = Math.atan2(n1.y - n2.c.y, n1.x - n2.c.x);
                    let th2 = Math.atan2(n2.y - n2.c.y, n2.x - n2.c.x);
                    stepArea = arcIntegral(n2.c.x, n2.c.y, n2.r, th1, th2, n2.ccw);
                    stepVol = arcVolumeIntegral(n2.c.x, n2.c.y, n2.r, th1, th2, n2.ccw);
                    method = `Arc R=${n2.r}`;
                    eqArea = `[ f_A(theta) ] from ${(th1 * 180 / Math.PI).toFixed(1)}° to ${(th2 * 180 / Math.PI).toFixed(1)}°`;
                    eqVol = `[ f_V(theta) ] from ${(th1 * 180 / Math.PI).toFixed(1)}° to ${(th2 * 180 / Math.PI).toFixed(1)}°`;
                }

                area_half += stepArea;
                vol_half += stepVol;

                currentSteps.push({ n1, n2, idx1: i, idx2: i + 1, stepArea, stepVol, method, eqArea, eqVol });
            }

            // Closing loop
            let n_last = P8, n_first = P0;
            let stepAreaLast = lineIntegral(n_last.x, n_last.y, n_first.x, n_first.y);
            let stepVolLast = lineVolumeIntegral(n_last.x, n_last.y, n_first.x, n_first.y);
            area_half += stepAreaLast;
            vol_half += stepVolLast;
            currentSteps.push({
                n1: n_last, n2: n_first, idx1: currentNodes.length - 1, idx2: 0,
                stepArea: stepAreaLast, stepVol: stepVolLast, method: 'Line',
                eqArea: `1/2 * ((${n_last.x.toFixed(4)})(${n_first.y.toFixed(4)}) - (${n_first.x.toFixed(4)})(${n_last.y.toFixed(4)}))`,
                eqVol: `-pi * (${n_first.x.toFixed(4)} - ${n_last.x.toFixed(4)})/3 * (${n_last.y.toFixed(4)}² + (${n_last.y.toFixed(4)})(${n_first.y.toFixed(4)}) + ${n_first.y.toFixed(4)}²)`
            });

            setStepDetails(currentSteps);

            const area1 = Math.abs(area_half * 2);
            const vol1 = Math.abs(vol_half * 2);

            const r_in = params.d_inner / 2;
            let a2_half = 0, v2_half = 0;
            let th_in = 0, y_edge = 0;
            if (r_in > params.w_base / 2) {
                th_in = Math.asin((params.w_base / 2) / r_in);
                y_edge = r_in * Math.cos(th_in);
                a2_half = (r_in ** 2 * th_in) + ((params.w_base / 2) * y_edge);
                v2_half = Math.PI * (params.w_base / 2) * (r_in ** 2 - Math.pow(params.w_base / 2, 2) / 3.0);
            }
            const area2 = a2_half * 2;
            const vol2 = v2_half * 2;

            const area_base = params.w_base * params.y_base;
            const vol_base = Math.PI * Math.pow(params.y_base, 2) * params.w_base;

            const area3 = area2 - area1 - area_base;
            const vol3 = vol2 - vol1 - vol_base;

            setResults({
                area1: area1.toFixed(4), vol1: vol1.toFixed(4),
                area2: area2.toFixed(4), vol2: vol2.toFixed(4),
                area3: area3.toFixed(4), vol3: vol3.toFixed(4),
                area_half, vol_half,
                area_base, vol_base,
                th_in, y_edge, r_in
            });

            drawCanvas(currentNodes, params.y_base, params.d_outer / 2, params.w_base, params.d_outer, params.d_inner);
        } catch (err) {
            setErrorMsg(err.message);
        }
    };

    const drawCanvas = (nodes_bottom, y_base, maxR, w_base, D_outer, D_inner) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const w_half = w_base / 2;
        const R_inner = D_inner / 2;
        const R_outer = D_outer / 2;
        const y_edge_in = Math.sqrt(R_inner ** 2 - w_half ** 2);
        const y_edge_out = Math.sqrt(R_outer ** 2 - w_half ** 2);

        let bounds = { minX: -maxR * 1.15, maxX: maxR * 1.15, minY: 0, maxY: R_outer * 1.1 };
        const scale = Math.min(canvas.width / (bounds.maxX - bounds.minX), canvas.height / (bounds.maxY - bounds.minY));
        const offsetX = canvas.width / 2;
        const offsetY = canvas.height - 20;

        const SX = (x) => offsetX + x * scale;
        const SY = (y) => offsetY - y * scale;

        // 1. วาดแกน
        ctx.beginPath();
        ctx.moveTo(SX(bounds.minX), SY(0)); ctx.lineTo(SX(bounds.maxX), SY(0));
        ctx.moveTo(SX(0), SY(-2)); ctx.lineTo(SX(0), SY(bounds.maxY));
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1; ctx.stroke();

        // 2. วาดพื้นที่สี่เหลี่ยมด้านล่าง Area Base
        ctx.beginPath();
        ctx.rect(SX(-w_half), SY(y_base), w_half * 2 * scale, y_base * scale);
        ctx.fillStyle = '#f8fafc';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(SX(-w_half), SY(y_base)); ctx.lineTo(SX(-w_half), SY(0));
        ctx.lineTo(SX(w_half), SY(0)); ctx.lineTo(SX(w_half), SY(y_base));
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.setLineDash([]);

        // 3. ถมสีพื้นที่วงกลม (Area 2 - พื้นหลังส้มอ่อนเพื่อให้กลายเป็นสี Gap)
        ctx.beginPath();
        ctx.moveTo(SX(-w_half), SY(y_edge_in));
        ctx.lineTo(SX(-w_half), SY(0));
        ctx.lineTo(SX(w_half), SY(0));
        ctx.lineTo(SX(w_half), SY(y_edge_in));
        let th_start = Math.atan2(y_edge_in, w_half);
        let th_end = Math.atan2(y_edge_in, -w_half);
        ctx.arc(SX(0), SY(0), R_inner * scale, -th_start, -th_end, true);
        ctx.fillStyle = 'rgba(251, 146, 60, 0.2)';
        ctx.fill();

        // 4. วาดรูปล่าง (Area 1) ทับลงไป
        ctx.beginPath();
        ctx.moveTo(SX(nodes_bottom[0].x), SY(nodes_bottom[0].y));
        for (let i = 1; i < nodes_bottom.length; i++) {
            if (nodes_bottom[i].type === 'line') ctx.lineTo(SX(nodes_bottom[i].x), SY(nodes_bottom[i].y));
            else if (nodes_bottom[i].type === 'arc') {
                let t1 = Math.atan2(nodes_bottom[i - 1].y - nodes_bottom[i].c.y, nodes_bottom[i - 1].x - nodes_bottom[i].c.x);
                let t2 = Math.atan2(nodes_bottom[i].y - nodes_bottom[i].c.y, nodes_bottom[i].x - nodes_bottom[i].c.x);
                ctx.arc(SX(nodes_bottom[i].c.x), SY(nodes_bottom[i].c.y), nodes_bottom[i].r * scale, -t1, -t2, nodes_bottom[i].ccw);
            }
        }
        for (let i = nodes_bottom.length - 1; i >= 1; i--) {
            let n0_mir = { ...nodes_bottom[i - 1], x: -nodes_bottom[i - 1].x };
            let n1_mir = { ...nodes_bottom[i], x: -nodes_bottom[i].x };
            if (nodes_bottom[i].type === 'line') ctx.lineTo(SX(n0_mir.x), SY(n0_mir.y));
            else if (nodes_bottom[i].type === 'arc') {
                let cx_mir = -nodes_bottom[i].c.x, cy_mir = nodes_bottom[i].c.y;
                let t_st = Math.atan2(n1_mir.y - cy_mir, n1_mir.x - cx_mir);
                let t_en = Math.atan2(n0_mir.y - cy_mir, n0_mir.x - cx_mir);
                ctx.arc(SX(cx_mir), SY(cy_mir), nodes_bottom[i].r * scale, -t_st, -t_en, nodes_bottom[i].ccw);
            }
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(216, 180, 255, 0.95)';
        ctx.fill();
        ctx.strokeStyle = '#9333ea';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 5. วาดรูปร่างด้านบน (Top Shape)
        ctx.beginPath();
        ctx.moveTo(SX(w_half), SY(y_edge_in));
        ctx.lineTo(SX(w_half), SY(y_edge_out));
        let th1_out = Math.atan2(y_edge_out, w_half);
        let th2_out = Math.atan2(y_edge_out, -w_half);
        ctx.arc(SX(0), SY(0), R_outer * scale, -th1_out, -th2_out, true);
        ctx.lineTo(SX(-w_half), SY(y_edge_in));
        let th2_in = Math.atan2(y_edge_in, -w_half);
        let th1_in = Math.atan2(y_edge_in, w_half);
        ctx.arc(SX(0), SY(0), R_inner * scale, -th2_in, -th1_in, false);
        ctx.closePath();
        ctx.fillStyle = 'rgba(186, 230, 253, 0.8)';
        ctx.fill();
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 6. วาดเส้นประวงกลมเต็มวง D_inner
        ctx.beginPath();
        ctx.arc(SX(0), SY(0), R_inner * scale, 0, Math.PI, true);
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
    };

    useEffect(() => {
        calculate();
        // eslint-disable-next-line
    }, []);

    const { theme } = useTheme();

    const nodeColumns = [
        { title: 'Node', dataIndex: 'node', key: 'node', render: (_, __, i) => <Text strong style={{ color: theme.colors.primary }}>P{i}</Text> },
        { title: 'X Coordinate', dataIndex: 'x', key: 'x', render: v => <Text code>{v.toFixed(4)}</Text> },
        { title: 'Y Coordinate', dataIndex: 'y', key: 'y', render: v => <Text code>{v.toFixed(4)}</Text> },
        { title: 'Description', dataIndex: 'desc', key: 'desc', render: v => <Text type="secondary">{v}</Text> }
    ];

    return (
        <Layout style={{
            height: 'calc(100vh - 64px)',
            display: 'flex'
        }}>
            <MenuTemplate type={"NewProd"} defaultSelectedKeys={"1"} />
            <Layout style={{ backgroundColor: theme.colors.background }}>
                <ScrollbarStyle primary={theme.colors.primary} />
                <Content className="kb-vscroll" style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '24px', position: 'relative' }}>
                    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px', padding: '24px', background: theme.colors.surface, borderRadius: '16px', boxShadow: theme.shadows.sm }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ background: theme.colors.primary, color: 'white', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CalculatorOutlined style={{ fontSize: '24px' }} />
                                </div>
                                <div>
                                    <Title level={3} style={{ margin: 0, color: theme.colors.textPrimary }}>Area & Volume Calculator</Title>
                                    <Text style={{ color: theme.colors.textSecondary }}>Exact Math Logic Structure Verification and Substitution</Text>
                                </div>
                            </div>
                        </div>

                        <Row gutter={[24, 24]}>
                            <Col xs={24} lg={8}>
                                <Card title="พารามิเตอร์โครงสร้าง" size="small" style={{ borderRadius: '12px', marginBottom: '16px', border: `1px solid ${theme.colors.border}`, boxShadow: theme.shadows.sm }}>
                                    {/* กลุ่ม 1: รูปร่างด้านบน (Top Shape) */}
                                    <div style={{ borderLeft: '4px solid #14b8a6', paddingLeft: 12, marginBottom: 16 }}>
                                        <Text strong style={{ color: '#0f766e', fontSize: 13, display: 'block', marginBottom: 8 }}>รูปร่างด้านบน (Top Shape)</Text>
                                        <Row gutter={8}>
                                            <Col span={12}>
                                                <Text style={{ display: 'block', fontSize: 11, color: theme.colors.textSecondary }}>Diameter วงนอก</Text>
                                                <InputNumber value={params.d_outer} onChange={v => handleParamChange('d_outer', v)} style={{ width: '100%' }} step={0.01} />
                                            </Col>
                                            <Col span={12}>
                                                <Text style={{ display: 'block', fontSize: 11, color: theme.colors.textSecondary }}>Diameter วงใน (D)</Text>
                                                <InputNumber value={params.d_inner} onChange={v => handleParamChange('d_inner', v)} style={{ width: '100%' }} step={0.01} />
                                            </Col>
                                        </Row>
                                    </div>

                                    {/* กลุ่ม 2: ส่วนฐานและวงกลมใหญ่ (Bottom) */}
                                    <div style={{ borderLeft: '4px solid #3b82f6', paddingLeft: 12, marginBottom: 16 }}>
                                        <Text strong style={{ color: '#1d4ed8', fontSize: 13, display: 'block', marginBottom: 8 }}>ส่วนฐานและวงกลมใหญ่ (Bottom)</Text>
                                        <Row gutter={8} style={{ marginBottom: 8 }}>
                                            <Col span={12}>
                                                <Text style={{ display: 'block', fontSize: 11, color: theme.colors.textSecondary }}>Diameter ใหญ่ (D)</Text>
                                                <InputNumber value={params.d_large} onChange={v => handleParamChange('d_large', v)} style={{ width: '100%' }} step={0.1} />
                                            </Col>
                                            <Col span={12}>
                                                <Text style={{ display: 'block', fontSize: 11, color: theme.colors.textSecondary }}>ความกว้างฐานล่าง</Text>
                                                <InputNumber value={params.w_base} onChange={v => handleParamChange('w_base', v)} style={{ width: '100%' }} step={0.0001} />
                                            </Col>
                                        </Row>
                                        <div>
                                            <Text style={{ display: 'block', fontSize: 11, color: theme.colors.textSecondary }}>Y ฐานล่าง (เส้น H)</Text>
                                            <InputNumber value={params.y_base} onChange={v => handleParamChange('y_base', v)} style={{ width: '100%' }} step={0.01} />
                                        </div>
                                    </div>

                                    {/* กลุ่ม 3: ส่วนขอบบนและรอยบากเอียง */}
                                    <div style={{ borderLeft: '4px solid #f59e0b', paddingLeft: 12, marginBottom: 16 }}>
                                        <Text strong style={{ color: '#b45309', fontSize: 13, display: 'block', marginBottom: 8 }}>ส่วนขอบบนและรอยบากเอียง</Text>
                                        <Row gutter={8} style={{ marginBottom: 8 }}>
                                            <Col span={12}>
                                                <Text style={{ display: 'block', fontSize: 11, color: theme.colors.textSecondary }}>Y สูงสุดขอบนอก</Text>
                                                <InputNumber value={params.y_top} onChange={v => handleParamChange('y_top', v)} style={{ width: '100%' }} step={0.01} />
                                            </Col>
                                            <Col span={12}>
                                                <Text style={{ display: 'block', fontSize: 11, color: theme.colors.textSecondary }}>Y เส้นประบากลึก</Text>
                                                <InputNumber value={params.y_mid} onChange={v => handleParamChange('y_mid', v)} style={{ width: '100%' }} step={0.001} />
                                            </Col>
                                        </Row>
                                        <Row gutter={8}>
                                            <Col span={12}>
                                                <Text style={{ display: 'block', fontSize: 11, color: theme.colors.textSecondary }}>ระยะห่างจุดหักมุมบน</Text>
                                                <InputNumber value={params.w_top} onChange={v => handleParamChange('w_top', v)} style={{ width: '100%' }} step={0.1} />
                                            </Col>
                                            <Col span={12}>
                                                <Text style={{ display: 'block', fontSize: 11, color: theme.colors.textSecondary }}>มุมเอียงบาก (องศา)</Text>
                                                <InputNumber value={params.angle} onChange={v => handleParamChange('angle', v)} style={{ width: '100%' }} step={0.1} />
                                            </Col>
                                        </Row>
                                    </div>

                                    {/* กลุ่ม 4: ส่วนหัว (วงกลมเล็กคู่) */}
                                    <div style={{ borderLeft: '4px solid #ef4444', paddingLeft: 12, marginBottom: 16 }}>
                                        <Text strong style={{ color: '#b91c1c', fontSize: 13, display: 'block', marginBottom: 8 }}>ส่วนหัว (วงกลมเล็กคู่)</Text>
                                        <Row gutter={8} style={{ marginBottom: 8 }}>
                                            <Col span={12}>
                                                <Text style={{ display: 'block', fontSize: 11, color: theme.colors.textSecondary }}>Y ศูนย์กลาง</Text>
                                                <InputNumber value={params.cy_small} onChange={v => handleParamChange('cy_small', v)} style={{ width: '100%' }} step={0.001} />
                                            </Col>
                                            <Col span={12}>
                                                <Text style={{ display: 'block', fontSize: 11, color: theme.colors.textSecondary }}>ระยะห่างศูนย์กลาง</Text>
                                                <InputNumber value={params.c_dist} onChange={v => handleParamChange('c_dist', v)} style={{ width: '100%' }} step={0.1} />
                                            </Col>
                                        </Row>
                                        <div>
                                            <Text style={{ display: 'block', fontSize: 11, color: theme.colors.textSecondary }}>รัศมีวงกลม (r)</Text>
                                            <InputNumber value={params.r_small} onChange={v => handleParamChange('r_small', v)} style={{ width: '100%' }} step={0.01} />
                                        </div>
                                    </div>

                                    <Button type="primary" block onClick={calculate} style={{ marginTop: 8, borderRadius: '8px', fontWeight: 600, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>ประมวลผลและคำนวณใหม่</Button>
                                    {errorMsg && <Alert message={errorMsg} type="error" showIcon style={{ marginTop: 16, borderRadius: '8px' }} />}
                                </Card>
                            </Col>
                            <Col xs={24} lg={16}>
                                <Card title="Structure Visualization" size="small" style={{ borderRadius: '12px', marginBottom: '16px', border: `1px solid ${theme.colors.border}`, boxShadow: theme.shadows.sm }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', backgroundColor: '#f8fafc', padding: 16, borderRadius: '8px', border: '1px dashed #ccc' }}>
                                        <canvas ref={canvasRef} width={600} height={380} style={{ backgroundColor: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', width: '100%', maxWidth: '600px' }} />
                                    </div>
                                </Card>

                                <Row gutter={[16, 16]}>
                                    <Col span={8}>
                                        <Card size="small" style={{ backgroundColor: '#f5f3ff', borderColor: '#ddd6fe', textAlign: 'center', borderRadius: '12px' }}>
                                            <Text strong style={{ color: '#5b21b6' }}>1: Original Shape</Text>
                                            <div style={{ marginTop: 8 }}><Text type="secondary" style={{ fontSize: 12 }}>Area</Text></div>
                                            <Title level={4} style={{ color: '#7e22ce', margin: 0 }}>{results.area1}</Title>
                                            <div style={{ marginTop: 8 }}><Text type="secondary" style={{ fontSize: 12 }}>Volume</Text></div>
                                            <Title level={5} style={{ color: '#9333ea', margin: 0 }}>{results.vol1}</Title>
                                        </Card>
                                    </Col>
                                    <Col span={8}>
                                        <Card size="small" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', textAlign: 'center', borderRadius: '12px' }}>
                                            <Text strong style={{ color: '#1e40af' }}>2: Circle Cut</Text>
                                            <div style={{ marginTop: 8 }}><Text type="secondary" style={{ fontSize: 12 }}>Area</Text></div>
                                            <Title level={4} style={{ color: '#1d4ed8', margin: 0 }}>{results.area2}</Title>
                                            <div style={{ marginTop: 8 }}><Text type="secondary" style={{ fontSize: 12 }}>Volume</Text></div>
                                            <Title level={5} style={{ color: '#2563eb', margin: 0 }}>{results.vol2}</Title>
                                        </Card>
                                    </Col>
                                    <Col span={8}>
                                        <Card size="small" style={{ backgroundColor: '#fff7ed', borderColor: '#fed7aa', textAlign: 'center', borderRadius: '12px' }}>
                                            <Text strong style={{ color: '#9a3412' }}>3: Gap</Text>
                                            <div style={{ marginTop: 8 }}><Text type="secondary" style={{ fontSize: 12 }}>Area</Text></div>
                                            <Title level={4} style={{ color: '#c2410c', margin: 0 }}>{results.area3}</Title>
                                            <div style={{ marginTop: 8 }}><Text type="secondary" style={{ fontSize: 12 }}>Volume</Text></div>
                                            <Title level={5} style={{ color: '#ea580c', margin: 0 }}>{results.vol3}</Title>
                                        </Card>
                                    </Col>
                                </Row>
                            </Col>
                        </Row>

                        <Collapse style={{ marginTop: '24px', backgroundColor: theme.colors.surface, borderRadius: '12px', border: `1px solid ${theme.colors.border}` }}>
                            <Collapse.Panel header={<span style={{ fontWeight: 600 }}><InfoCircleOutlined style={{ marginRight: '8px' }} />ตารางพิกัดจุดยอด (Coordinate Debugger)</span>} key="1">
                                <Table
                                    dataSource={nodes}
                                    columns={nodeColumns}
                                    pagination={false}
                                    rowKey={(r, i) => i}
                                    size="small"
                                    bordered
                                />
                            </Collapse.Panel>
                        </Collapse>

                        <Collapse style={{ marginTop: '16px', backgroundColor: theme.colors.surface, borderRadius: '12px', border: `1px solid ${theme.colors.border}` }}>
                            <Collapse.Panel header={<span style={{ fontWeight: 600 }}><CalculatorOutlined style={{ marginRight: '8px' }} />การแทนค่าสมการทีละขั้นตอน (Step-by-Step Substitution)</span>} key="1">
                                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                                    <Title level={5} style={{ color: '#4338ca', marginBottom: '16px' }}>ขั้นตอนที่ 1: คำนวณ Integral และแทนค่าทีละเส้นทาง (เฉพาะซีกขวา)</Title>
                                    {stepDetails.map((step, idx) => (
                                        <Card size="small" key={idx} style={{ marginBottom: '12px', borderRadius: '8px', borderColor: '#e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <Tag color="geekblue" style={{ fontSize: '13px', padding: '4px 8px', borderRadius: '4px' }}>
                                                    Path: P{step.idx1}({step.n1.x.toFixed(2)}, {step.n1.y.toFixed(2)}) → P{step.idx2}({step.n2.x.toFixed(2)}, {step.n2.y.toFixed(2)})
                                                </Tag>
                                                <Tag color="cyan">{step.method}</Tag>
                                            </div>
                                            <Row gutter={[16, 16]}>
                                                <Col span={12}>
                                                    <div style={{ padding: '8px 12px', background: '#f5f3ff', borderLeft: '4px solid #8b5cf6', borderRadius: '4px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                            <Text strong type="secondary">Δ Area</Text>
                                                            <Text strong style={{ color: '#6d28d9' }}>{step.stepArea >= 0 ? '+' : ''}{step.stepArea.toFixed(6)}</Text>
                                                        </div>
                                                        <Text code style={{ display: 'block', background: 'transparent', border: 'none', padding: 0 }}>= {step.eqArea}</Text>
                                                    </div>
                                                </Col>
                                                <Col span={12}>
                                                    <div style={{ padding: '8px 12px', background: '#eff6ff', borderLeft: '4px solid #3b82f6', borderRadius: '4px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                            <Text strong type="secondary">Δ Volume</Text>
                                                            <Text strong style={{ color: '#1d4ed8' }}>{step.stepVol >= 0 ? '+' : ''}{step.stepVol.toFixed(6)}</Text>
                                                        </div>
                                                        <Text code style={{ display: 'block', background: 'transparent', border: 'none', padding: 0 }}>= {step.eqVol}</Text>
                                                    </div>
                                                </Col>
                                            </Row>
                                        </Card>
                                    ))}

                                    <Card size="small" style={{ backgroundColor: '#eef2ff', borderColor: '#c7d2fe', marginTop: '16px', borderRadius: '8px' }}>
                                        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                                            <Text strong style={{ color: '#4338ca' }}>→ ทำการคูณ 2 (สมมาตรซ้าย-ขวา) จะได้สมการผลลัพธ์ Part 1</Text>
                                        </div>
                                        <Row gutter={16}>
                                            <Col span={12}>
                                                <div style={{ background: 'white', padding: '12px', borderRadius: '6px', textAlign: 'center', border: '1px solid #e0e7ff' }}>
                                                    <Text code style={{ display: 'block', marginBottom: '8px' }}>A_1 = 2 × |{results.area_half.toFixed(5)}|</Text>
                                                    <Title level={4} style={{ color: '#5b21b6', margin: 0 }}>{results.area1}</Title>
                                                </div>
                                            </Col>
                                            <Col span={12}>
                                                <div style={{ background: 'white', padding: '12px', borderRadius: '6px', textAlign: 'center', border: '1px solid #e0e7ff' }}>
                                                    <Text code style={{ display: 'block', marginBottom: '8px' }}>V_1 = 2 × |{results.vol_half.toFixed(5)}|</Text>
                                                    <Title level={4} style={{ color: '#1e40af', margin: 0 }}>{results.vol1}</Title>
                                                </div>
                                            </Col>
                                        </Row>
                                    </Card>
                                </div>

                                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                                    <Title level={5} style={{ color: '#0369a1', marginBottom: '16px' }}>ขั้นตอนที่ 2: แทนค่าสมการวงกลมถูกตัด (Part 2)</Title>
                                    <Card size="small" style={{ borderColor: '#bae6fd', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
                                        <Row gutter={[16, 16]} style={{ marginBottom: '12px' }}>
                                            <Col span={8}><Text code style={{ width: '100%', textAlign: 'center', display: 'block' }}>R_in = {results.r_in.toFixed(3)}</Text></Col>
                                            <Col span={8}><Text code style={{ width: '100%', textAlign: 'center', display: 'block' }}>w_base = {params.w_base.toFixed(3)}</Text></Col>
                                            <Col span={8}><Text code style={{ width: '100%', textAlign: 'center', display: 'block' }}>theta_in = {results.th_in.toFixed(4)} rad</Text></Col>
                                        </Row>
                                        <div style={{ padding: '12px', background: 'white', borderRadius: '6px', border: '1px solid #e0f2fe', marginBottom: '8px' }}>
                                            <Text strong style={{ display: 'block', marginBottom: '4px' }}>แทนค่าหา Area 2:</Text>
                                            <Text code style={{ color: '#6d28d9' }}>A_2 = ({results.r_in.toFixed(2)}² × {results.th_in.toFixed(4)}) + ({(params.w_base / 2).toFixed(3)} × {results.y_edge.toFixed(3)}) = {results.area2}</Text>
                                        </div>
                                        <div style={{ padding: '12px', background: 'white', borderRadius: '6px', border: '1px solid #e0f2fe' }}>
                                            <Text strong style={{ display: 'block', marginBottom: '4px' }}>แทนค่าหา Volume 2:</Text>
                                            <Text code style={{ color: '#1d4ed8' }}>V_2 = pi × {params.w_base.toFixed(3)} ( {results.r_in.toFixed(2)}² - {params.w_base.toFixed(3)}²/12 ) = {results.vol2}</Text>
                                        </div>
                                    </Card>
                                </div>

                                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <Title level={5} style={{ color: '#b45309', marginBottom: '16px' }}>ขั้นตอนที่ 3: แทนค่าสมการหาช่องว่าง (Gap Part 3)</Title>
                                    <Card size="small" style={{ borderColor: '#fed7aa', backgroundColor: '#fff7ed', borderRadius: '8px' }}>
                                        <div style={{ padding: '12px', background: 'white', borderRadius: '6px', border: '1px solid #ffedd5', marginBottom: '12px' }}>
                                            <Text strong style={{ display: 'block', marginBottom: '4px' }}>คำนวณส่วนฐานสี่เหลี่ยมด้านล่าง (Base):</Text>
                                            <Text code style={{ display: 'block' }}>A_base = {params.w_base.toFixed(3)} × {params.y_base.toFixed(3)} = {results.area_base.toFixed(5)}</Text>
                                            <Text code style={{ display: 'block', marginTop: '4px' }}>V_base = pi × {params.y_base.toFixed(3)}² × {params.w_base.toFixed(3)} = {results.vol_base.toFixed(5)}</Text>
                                        </div>
                                        <div style={{ padding: '12px', background: 'white', borderRadius: '6px', borderLeft: '4px solid #f97316' }}>
                                            <Text strong style={{ display: 'block', marginBottom: '4px' }}>แทนค่าสมการ Gap Area (Area 3):</Text>
                                            <Text code style={{ color: '#c2410c', fontWeight: 'bold' }}>A_3 = {results.area2} - {results.area1} - {results.area_base.toFixed(4)} = {results.area3}</Text>
                                            <Text strong style={{ display: 'block', marginTop: '12px', marginBottom: '4px' }}>แทนค่าสมการ Gap Volume (Volume 3):</Text>
                                            <Text code style={{ color: '#ea580c', fontWeight: 'bold' }}>V_3 = {results.vol2} - {results.vol1} - {results.vol_base.toFixed(4)} = {results.vol3}</Text>
                                        </div>
                                    </Card>
                                </div>
                            </Collapse.Panel>
                        </Collapse>
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
}
