import React, { useState, useMemo } from 'react';
import { Button, InputNumber, Typography, Row, Col, Card, Collapse, Layout } from 'antd';
import { DownloadOutlined, CalculatorOutlined } from '@ant-design/icons';
import html2canvas from 'html2canvas';

import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';

const { Title, Text } = Typography;
const { Content } = Layout;

const s_groups = [
    { label: '1', val: 1 },
    { label: '2-3', val: 2 },
    { label: '4-6', val: 4 },
    { label: '7-8', val: 7 },
    { label: '9-10', val: 9 }
];

const o_groups = [
    { label: '1', val: 1 },
    { label: '2-3', val: 2 },
    { label: '4-5', val: 4 },
    { label: '6-7', val: 6 },
    { label: '8-10', val: 8 }
];

const d_groups = [
    { label: '1', val: 1 },
    { label: '2-4', val: 2 },
    { label: '5-6', val: 5 },
    { label: '7-10', val: 7 }
];

export function calculateActionPriority(s, o, d) {
    s = parseInt(s); o = parseInt(o); d = parseInt(d);
    if (isNaN(s) || isNaN(o) || isNaN(d)) return "";
    if (s < 1 || s > 10 || o < 1 || o > 10 || d < 1 || d > 10) return "";

    if (s === 1) return "L";
    if (s >= 2 && s <= 3) {
        if (o <= 7) return "L";
        if (o >= 8) {
            if (d <= 4) return "L";
            return "M";
        }
    }
    if (s >= 4 && s <= 6) {
        if (o <= 3) return "L";
        if (o >= 4 && o <= 5) {
            if (d <= 6) return "L";
            return "M";
        }
        if (o >= 6 && o <= 7) {
            if (d === 1) return "L";
            return "M";
        }
        if (o >= 8) {
            if (d <= 4) return "M";
            return "H";
        }
    }
    if (s >= 7 && s <= 8) {
        if (o === 1) return "L";
        if (o >= 2 && o <= 3) {
            if (d <= 4) return "L";
            return "M";
        }
        if (o >= 4 && o <= 5) {
            if (d <= 6) return "M";
            return "H";
        }
        if (o >= 6 && o <= 7) {
            if (d === 1) return "M";
            return "H";
        }
        if (o >= 8) return "H";
    }
    if (s >= 9 && s <= 10) {
        if (o === 1) return "L";
        if (o >= 2 && o <= 3) {
            if (d <= 4) return "L";
            if (d >= 5 && d <= 6) return "M";
            return "H";
        }
        if (o >= 4 && o <= 5) {
            if (d === 1) return "M";
            return "H";
        }
        if (o >= 6) return "H";
    }
    return "";
}

function getGroupLabel(val, type) {
    val = parseInt(val);
    if (type === 'S') {
        if (val === 1) return '1';
        if (val >= 2 && val <= 3) return '2-3';
        if (val >= 4 && val <= 6) return '4-6';
        if (val >= 7 && val <= 8) return '7-8';
        if (val >= 9 && val <= 10) return '9-10';
    }
    if (type === 'O') {
        if (val === 1) return '1';
        if (val >= 2 && val <= 3) return '2-3';
        if (val >= 4 && val <= 5) return '4-5';
        if (val >= 6 && val <= 7) return '6-7';
        if (val >= 8 && val <= 10) return '8-10';
    }
    if (type === 'D') {
        if (val === 1) return '1';
        if (val >= 2 && val <= 4) return '2-4';
        if (val >= 5 && val <= 6) return '5-6';
        if (val >= 7 && val <= 10) return '7-10';
    }
    return '';
}

export default function RPNLookupCalc() {
    const [s, setS] = useState(7);
    const [o, setO] = useState(4);
    const [d, setD] = useState(5);
    const [isExporting, setIsExporting] = useState(false);

    const ap = calculateActionPriority(s, o, d);
    const sLabel = getGroupLabel(s, 'S');
    const oLabel = getGroupLabel(o, 'O');
    const dLabel = getGroupLabel(d, 'D');
    const highlightedCellId = `cell-s${sLabel}-o${oLabel}-d${dLabel}`;

    const handleDownload = () => {
        const captureArea = document.getElementById('capture-area-rpn');
        if (!captureArea) return;
        setIsExporting(true);
        setTimeout(() => {
            html2canvas(captureArea, { scale: 2, backgroundColor: "#ffffff" })
                .then(canvas => {
                    const link = document.createElement('a');
                    link.download = 'FMEA_Action_Priority_Table.jpg';
                    link.href = canvas.toDataURL('image/jpeg', 1.0);
                    link.click();
                })
                .catch(err => console.error("Error capturing table:", err))
                .finally(() => setIsExporting(false));
        }, 100);
    };

    const getBgColor = (val) => {
        if (val === 'L') return '#00b050';
        if (val === 'M') return '#ffff00';
        if (val === 'H') return '#ff0000';
        return '#fff';
    };

    const renderTable = () => {
        let rows = [];
        for (let i = 0; i < s_groups.length; i++) {
            const sG = s_groups[i];
            for (let j = 0; j < d_groups.length; j++) {
                const dG = d_groups[j];
                let cells = [];

                if (i === 0 && j === 0) {
                    cells.push(<td key="th-s" rowSpan={20} style={{ backgroundColor: '#e7e6e6', fontWeight: 'bold', width: 90, textAlign: 'center', border: '1px solid black' }}>Severity</td>);
                }

                if (j === 0) {
                    cells.push(<td key={`th-s-${sG.label}`} rowSpan={4} style={{ backgroundColor: '#e7e6e6', fontWeight: 'bold', textAlign: 'center', border: '1px solid black' }}>{sG.label}</td>);
                }

                for (let k = 0; k < o_groups.length; k++) {
                    const oG = o_groups[k];
                    const val = calculateActionPriority(sG.val, oG.val, dG.val);
                    const cellId = `cell-s${sG.label}-o${oG.label}-d${dG.label}`;
                    const isHighlighted = cellId === highlightedCellId;

                    let style = {
                        backgroundColor: getBgColor(val),
                        color: 'black',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        border: '1px solid black',
                        width: 65,
                        height: 35,
                        transition: 'transform 0.1s'
                    };

                    if (isHighlighted && !isExporting) {
                        style = { ...style, border: '3px solid #3b82f6', zIndex: 20, position: 'relative', boxShadow: '0 0 10px rgba(59, 130, 246, 0.8)', transform: 'scale(1.1)' };
                    } else if (isHighlighted && isExporting) {
                        style = { ...style, border: '3px solid #3b82f6' };
                    }

                    cells.push(
                        <td key={cellId} id={cellId} style={style} title={`S: ${sG.label}, O: ${oG.label}, D: ${dG.label} => AP: ${val}`}>
                            {val}
                        </td>
                    );
                }

                cells.push(<td key={`th-d-${dG.label}`} style={{ backgroundColor: '#e7e6e6', fontWeight: 'bold', textAlign: 'center', width: 65, border: '1px solid black' }}>{dG.label}</td>);

                if (i === 0 && j === 0) {
                    cells.push(<td key="th-d" rowSpan={20} style={{ backgroundColor: '#e7e6e6', fontWeight: 'bold', width: 90, textAlign: 'center', border: '1px solid black' }}>Detection</td>);
                }

                rows.push(<tr key={`row-${i}-${j}`}>{cells}</tr>);
            }
        }
        return rows;
    };

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
                                    <Title level={3} style={{ margin: 0, color: theme.colors.textPrimary }}>FMEA Action Priority (AP) Generator</Title>
                                    <Text style={{ color: theme.colors.textSecondary }}>FMEA Action Priority Matrix Calculator and Lookup Tool</Text>
                                </div>
                            </div>
                        </div>

                        <Collapse defaultActiveKey={['1']} style={{ marginBottom: '24px', backgroundColor: theme.colors.surface, borderRadius: '12px', border: `1px solid ${theme.colors.border}` }}>
                            <Collapse.Panel header={<span style={{ fontWeight: 600, color: theme.colors.textPrimary }}><CalculatorOutlined style={{ marginRight: '8px' }} />Calculate & Lookup AP Matrix</span>} key="1">
                                <Card style={{ marginBottom: 24, maxWidth: 600, margin: '0 auto 24px auto', border: `1px solid ${theme.colors.border}`, borderRadius: '12px', boxShadow: theme.shadows.sm }}>
                                    <Title level={5} style={{ textAlign: 'center', color: theme.colors.textPrimary }}>Calculate Individual AP (S, O, D: 1-10)</Title>
                                    <Row gutter={16} justify="center" align="middle" style={{ marginBottom: 16 }}>
                                        <Col>
                                            <div><Text strong style={{ color: theme.colors.textSecondary }}>Severity (S)</Text></div>
                                            <InputNumber min={1} max={10} value={s} onChange={setS} style={{ width: 80, borderRadius: '6px' }} />
                                        </Col>
                                        <Col>
                                            <div><Text strong style={{ color: theme.colors.textSecondary }}>Occurrence (O)</Text></div>
                                            <InputNumber min={1} max={10} value={o} onChange={setO} style={{ width: 80, borderRadius: '6px' }} />
                                        </Col>
                                        <Col>
                                            <div><Text strong style={{ color: theme.colors.textSecondary }}>Detection (D)</Text></div>
                                            <InputNumber min={1} max={10} value={d} onChange={setD} style={{ width: 80, borderRadius: '6px' }} />
                                        </Col>
                                    </Row>
                                    <div style={{ textAlign: 'center' }}>
                                        <Text style={{ fontSize: 18, color: theme.colors.textPrimary, marginRight: '8px' }}>Action Priority Result: </Text>
                                        <Text strong style={{ fontSize: 20, padding: '4px 16px', borderRadius: 16, backgroundColor: getBgColor(ap), border: '2px solid black', color: 'black' }}>{ap || '-'}</Text>
                                    </div>
                                </Card>

                                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                                    <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload} loading={isExporting} style={{ backgroundColor: '#16a34a', borderRadius: '8px', fontWeight: 600 }}>
                                        Download Table as JPG
                                    </Button>
                                </div>

                                <div style={{ overflowX: 'auto', paddingBottom: 40, display: 'flex', justifyContent: 'center' }}>
                                    <div id="capture-area-rpn" style={{ backgroundColor: 'white', padding: 16, borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                                        <table style={{ borderCollapse: 'collapse', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
                                            <thead>
                                                <tr>
                                                    <td colSpan={2} rowSpan={2} style={{ border: 'none' }}></td>
                                                    <th colSpan={5} style={{ backgroundColor: '#e7e6e6', border: '1px solid black', padding: '8px 0', fontWeight: 'bold' }}>Occurrence</th>
                                                    <td colSpan={2} rowSpan={2} style={{ border: 'none' }}></td>
                                                </tr>
                                                <tr>
                                                    <th style={{ backgroundColor: '#e7e6e6', width: 65, border: '1px solid black', padding: '4px', fontWeight: 'bold' }}>1</th>
                                                    <th style={{ backgroundColor: '#e7e6e6', width: 65, border: '1px solid black', padding: '4px', fontWeight: 'bold' }}>2-3</th>
                                                    <th style={{ backgroundColor: '#e7e6e6', width: 65, border: '1px solid black', padding: '4px', fontWeight: 'bold' }}>4-5</th>
                                                    <th style={{ backgroundColor: '#e7e6e6', width: 65, border: '1px solid black', padding: '4px', fontWeight: 'bold' }}>6-7</th>
                                                    <th style={{ backgroundColor: '#e7e6e6', width: 65, border: '1px solid black', padding: '4px', fontWeight: 'bold' }}>8-10</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {renderTable()}
                                            </tbody>
                                        </table>
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
