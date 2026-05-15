import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Card, InputNumber, Button, Typography, Alert } from 'antd';

const { Title, Text } = Typography;

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
    return -Math.PI * ((x2 - x1) / 3.0) * (y1**2 + y1*y2 + y2**2);
}

function arcVolumeIntegral(cx, cy, r, th1, th2, isCCW) {
    let f = (th) => {
        let term1 = -(cy**2) * Math.cos(th); 
        let term2 = r * cy * (th - (Math.sin(2 * th) / 2.0));
        let term3 = r**2 * (-Math.cos(th) + (Math.pow(Math.cos(th), 3) / 3.0));
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
        area3: 0, vol3: 0
    });
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

            const P0 = { x: 0, y: params.y_base, type: 'start' };
            const P1 = { x: params.w_base / 2, y: params.y_base, type: 'line' };
            
            const y_p2 = Math.sqrt(R_large**2 - P1.x**2);
            if(isNaN(y_p2)) throw new Error("Base width is wider than large circle radius.");
            const P2 = { x: P1.x, y: y_p2, type: 'line' };
            
            const x_p3 = Math.sqrt(R_large**2 - params.y_top**2);
            if(isNaN(x_p3)) throw new Error("Top Y is higher than large circle border.");
            const P3 = { x: x_p3, y: params.y_top, type: 'arc', c: {x:0, y:0}, r: R_large, ccw: true };
            
            const P4 = { x: w_top / 2, y: params.y_top, type: 'line' };
            
            const dx_slope = (params.y_top - params.y_mid) * Math.tan(angleRad);
            const P5 = { x: P4.x - dx_slope, y: params.y_mid, type: 'line' };
            
            const dy_small = params.y_mid - params.cy_small;
            const dx_small = Math.sqrt(params.r_small**2 - dy_small**2);
            if(isNaN(dx_small)) throw new Error("Mid Y does not intersect inner small circle.");
            const P6 = { x: cx_small + dx_small, y: params.y_mid, type: 'line' };
            
            const P7 = { x: cx_small - dx_small, y: params.y_mid, type: 'arc', c: {x:cx_small, y:params.cy_small}, r: params.r_small, ccw: false };
            const P8 = { x: 0, y: params.y_mid, type: 'line' };

            const nodes = [P0, P1, P2, P3, P4, P5, P6, P7, P8];

            let area_half = 0;
            let vol_half = 0;

            for (let i = 0; i < nodes.length - 1; i++) {
                let n1 = nodes[i], n2 = nodes[i+1];
                if (n2.type === 'line') {
                    area_half += lineIntegral(n1.x, n1.y, n2.x, n2.y);
                    vol_half += lineVolumeIntegral(n1.x, n1.y, n2.x, n2.y);
                } else if (n2.type === 'arc') {
                    let th1 = Math.atan2(n1.y - n2.c.y, n1.x - n2.c.x);
                    let th2 = Math.atan2(n2.y - n2.c.y, n2.x - n2.c.x);
                    area_half += arcIntegral(n2.c.x, n2.c.y, n2.r, th1, th2, n2.ccw);
                    vol_half += arcVolumeIntegral(n2.c.x, n2.c.y, n2.r, th1, th2, n2.ccw);
                }
            }
            area_half += lineIntegral(P8.x, P8.y, P0.x, P0.y);
            vol_half += lineVolumeIntegral(P8.x, P8.y, P0.x, P0.y);

            const area1 = area_half * 2;
            const vol1 = vol_half * 2;

            const r_in = params.d_inner / 2;
            let a2_half = 0, v2_half = 0;
            if (r_in > params.w_base / 2) {
                let th_in = Math.asin((params.w_base / 2) / r_in);
                let y_edge = r_in * Math.cos(th_in);
                a2_half = (r_in**2 * th_in) + ((params.w_base / 2) * y_edge);
                v2_half = Math.PI * (params.w_base / 2) * (r_in**2 - Math.pow(params.w_base / 2, 2) / 3.0);
            }
            const area2 = a2_half * 2;
            const vol2 = v2_half * 2;

            const area3 = area2 - area1 - (params.w_base * params.y_base);
            const vol3 = vol2 - vol1 - (Math.PI * Math.pow(params.y_base, 2) * params.w_base);

            setResults({
                area1: area1.toFixed(4), vol1: vol1.toFixed(4),
                area2: area2.toFixed(4), vol2: vol2.toFixed(4),
                area3: area3.toFixed(4), vol3: vol3.toFixed(4)
            });

            drawCanvas(nodes, r_in, R_large);
        } catch (err) {
            setErrorMsg(err.message);
        }
    };

    const drawCanvas = (nodes, r_in, r_large) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2 + 50;
        const scale = 15;

        const tx = (x) => cx + x * scale;
        const ty = (y) => cy - y * scale;

        // Draw axes
        ctx.beginPath();
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy);
        ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height);
        ctx.stroke();

        // Draw shape
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        
        ctx.moveTo(tx(nodes[0].x), ty(nodes[0].y));
        for (let i = 1; i < nodes.length; i++) {
            let n = nodes[i];
            if (n.type === 'line') {
                ctx.lineTo(tx(n.x), ty(n.y));
            } else if (n.type === 'arc') {
                let prev = nodes[i-1];
                let th1 = Math.atan2(prev.y - n.c.y, prev.x - n.c.x);
                let th2 = Math.atan2(n.y - n.c.y, n.x - n.c.x);
                ctx.arc(tx(n.c.x), ty(n.c.y), n.r * scale, -th1, -th2, n.ccw);
            }
        }
        ctx.lineTo(tx(nodes[0].x), ty(nodes[0].y));
        ctx.fill();
        ctx.stroke();

        // Draw mirror (left side)
        ctx.beginPath();
        ctx.moveTo(tx(-nodes[0].x), ty(nodes[0].y));
        for (let i = 1; i < nodes.length; i++) {
            let n = nodes[i];
            if (n.type === 'line') {
                ctx.lineTo(tx(-n.x), ty(n.y));
            } else if (n.type === 'arc') {
                let prev = nodes[i-1];
                let th1 = Math.atan2(prev.y - n.c.y, prev.x - n.c.x);
                let th2 = Math.atan2(n.y - n.c.y, n.x - n.c.x);
                let th1_mirror = Math.PI - th1;
                let th2_mirror = Math.PI - th2;
                ctx.arc(tx(-n.c.x), ty(n.c.y), n.r * scale, -th1_mirror, -th2_mirror, !n.ccw);
            }
        }
        ctx.lineTo(tx(-nodes[0].x), ty(nodes[0].y));
        ctx.fill();
        ctx.stroke();

        // Draw inner circle
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.setLineDash([5, 5]);
        ctx.arc(tx(0), ty(0), r_in * scale, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
    };

    useEffect(() => {
        calculate();
        // eslint-disable-next-line
    }, []);

    return (
        <div style={{ padding: 24, backgroundColor: '#f3f4f6', minHeight: '100%', borderRadius: 8 }}>
            <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>Area & Volume Calculator (Exact Math)</Title>
            
            <Row gutter={24}>
                <Col span={8}>
                    <Card title="Parameters" size="small">
                        {Object.keys(params).map(k => (
                            <div key={k} style={{ marginBottom: 12 }}>
                                <Text style={{ display: 'block', fontSize: 12, color: '#666' }}>{k}</Text>
                                <InputNumber value={params[k]} onChange={v => handleParamChange(k, v)} style={{ width: '100%' }} />
                            </div>
                        ))}
                        <Button type="primary" block onClick={calculate} style={{ marginTop: 16 }}>Calculate</Button>
                        {errorMsg && <Alert message={errorMsg} type="error" showIcon style={{ marginTop: 16 }} />}
                    </Card>
                </Col>
                <Col span={16}>
                    <Card title="Structure Visualization" size="small" style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'center', backgroundColor: '#f8fafc', padding: 16, border: '1px dashed #ccc' }}>
                            <canvas ref={canvasRef} width={600} height={380} style={{ backgroundColor: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
                        </div>
                    </Card>

                    <Row gutter={16}>
                        <Col span={8}>
                            <Card size="small" style={{ backgroundColor: '#f5f3ff', borderColor: '#ddd6fe', textAlign: 'center' }}>
                                <Text strong>1: Original Shape</Text>
                                <div><Text type="secondary" style={{ fontSize: 12 }}>Area</Text></div>
                                <Title level={4} style={{ color: '#7e22ce', margin: 0 }}>{results.area1}</Title>
                                <div style={{ marginTop: 8 }}><Text type="secondary" style={{ fontSize: 12 }}>Volume</Text></div>
                                <Title level={5} style={{ color: '#9333ea', margin: 0 }}>{results.vol1}</Title>
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card size="small" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', textAlign: 'center' }}>
                                <Text strong>2: Circle Cut</Text>
                                <div><Text type="secondary" style={{ fontSize: 12 }}>Area</Text></div>
                                <Title level={4} style={{ color: '#1d4ed8', margin: 0 }}>{results.area2}</Title>
                                <div style={{ marginTop: 8 }}><Text type="secondary" style={{ fontSize: 12 }}>Volume</Text></div>
                                <Title level={5} style={{ color: '#2563eb', margin: 0 }}>{results.vol2}</Title>
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card size="small" style={{ backgroundColor: '#fff7ed', borderColor: '#fed7aa', textAlign: 'center' }}>
                                <Text strong>3: Gap</Text>
                                <div><Text type="secondary" style={{ fontSize: 12 }}>Area</Text></div>
                                <Title level={4} style={{ color: '#c2410c', margin: 0 }}>{results.area3}</Title>
                                <div style={{ marginTop: 8 }}><Text type="secondary" style={{ fontSize: 12 }}>Volume</Text></div>
                                <Title level={5} style={{ color: '#ea580c', margin: 0 }}>{results.vol3}</Title>
                            </Card>
                        </Col>
                    </Row>
                </Col>
            </Row>
        </div>
    );
}
