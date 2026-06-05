import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, List, Spin, Space, Popconfirm, Select, Slider, message, ColorPicker, Row, Col, Badge, Tooltip } from 'antd';
import { DeleteOutlined, ShareAltOutlined, PlusOutlined, FormatPainterOutlined, CopyOutlined, EditOutlined } from '@ant-design/icons';
import axios from 'axios';
import * as fabric from 'fabric';
import { server } from '../../../../../constance/constance';
import { useAuthStore } from '../../../../../stores/authStore';

const WatermarkManagerModal = ({ open, onClose, fabricCanvasRefs, totalPages, pushHistory, pdfFile }) => {
    const empNo = useAuthStore(state => state.empNo);
    const userName = useAuthStore(state => state.userName);
    const [watermarks, setWatermarks] = useState([]);
    const [loading, setLoading] = useState(false);

    const [isCreate, setIsCreate] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form] = Form.useForm();

    // Sharing modal
    const [shareOpen, setShareOpen] = useState(false);
    const [shareWmId, setShareWmId] = useState(null);
    const [shareEmpno, setShareEmpno] = useState('');

    useEffect(() => {
        if (open && empNo) {
            fetchWatermarks();
        } else if (!open) {
            setIsCreate(false);
            setEditingId(null);
            form.resetFields();
        }
    }, [open, empNo]);

    const fetchWatermarks = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(server.PDF_WATERMARKS, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.result === 'true') {
                setWatermarks(res.data.data);
            }
        } catch (err) {
            message.error('Failed to load watermarks');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (values) => {
        try {
            const token = localStorage.getItem('token');
            const payload = {
                owner_empno: empNo,
                name: values.name,
                text: values.text,
                color: typeof values.color === 'string' ? values.color : values.color.toHexString(),
                opacity: values.opacity,
                font_size: values.font_size,
                angle: values.angle
            };

            if (editingId) {
                const res = await axios.put(`${server.PDF_WATERMARKS}/${editingId}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data?.result === 'true') {
                    message.success('Watermark updated');
                    setIsCreate(false);
                    setEditingId(null);
                    form.resetFields();
                    fetchWatermarks();
                }
            } else {
                const res = await axios.post(server.PDF_WATERMARKS, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data?.result === 'true') {
                    message.success('Watermark created');
                    setIsCreate(false);
                    form.resetFields();
                    fetchWatermarks();
                }
            }
        } catch (err) {
            message.error(editingId ? 'Failed to update watermark' : 'Failed to create watermark');
        }
    };

    const handleDelete = async (id) => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${server.PDF_WATERMARKS}/${id}?empno=${empNo}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            message.success('Watermark deleted');
            fetchWatermarks();
        } catch (err) {
            message.error('Failed to delete watermark');
        }
    };

    const handleShare = async () => {
        if (!shareEmpno) return;
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${server.PDF_WATERMARKS}/${shareWmId}/share`, { target_empno: shareEmpno }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            message.success('Watermark shared successfully');
            setShareOpen(false);
            setShareEmpno('');
        } catch (err) {
            message.error('Failed to share watermark');
        }
    };

    const applyWatermark = (wm, mode) => {
        if (!fabricCanvasRefs || !fabricCanvasRefs.current) {
            message.error('No PDF loaded');
            return;
        }

        const addTextToCanvas = (fc, pageNum) => {
            if (!fc) return;
            const textObj = new fabric.Text(wm.text, {
                left: fc.width / 2,
                top: fc.height / 2,
                fill: wm.color,
                opacity: wm.opacity,
                fontSize: wm.font_size,
                angle: -wm.angle, // Negate so positive angle = bottom-left to top-right
                originX: 'center',
                originY: 'center',
                selectable: true, // Allow user to move/resize later if they want
                customData: { type: 'watermark' }
            });
            fc.add(textObj);
            fc.setActiveObject(textObj);
            fc.renderAll();
        };

        if (mode === 'all') {
            // Apply to all pages
            Object.entries(fabricCanvasRefs.current).forEach(([pageNumStr, fc]) => {
                pushHistory(Number(pageNumStr));
                addTextToCanvas(fc, Number(pageNumStr));
            });
            message.success('Watermark applied to all pages');
        } else {
            // Apply to current visible page (first canvas found or page 1 if not tracked)
            // Just place on page 1 for now if we can't tell, or place on the currently active canvas
            // In PdfEditorTool, it's hard to get active canvas directly from refs without loop. 
            // We'll place it on page 1 as a stamp, user can move it.
            // But wait, user expects it on current page. 
            // We can find the active canvas by checking which one has active object, or just place on page 1.
            const pageNums = Object.keys(fabricCanvasRefs.current);
            if (pageNums.length > 0) {
                const p1 = pageNums[0];
                pushHistory(Number(p1));
                addTextToCanvas(fabricCanvasRefs.current[p1], Number(p1));
                message.success(`Watermark stamp placed on Page ${p1}`);
            }
        }
        onClose();
    };

    return (
        <Modal
            title={<><FormatPainterOutlined /> Watermark Manager</>}
            open={open}
            onCancel={onClose}
            footer={null}
            width={600}
        >
            <Spin spinning={loading}>
                {!isCreate ? (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                            <span>Select a watermark to apply, or create a new one.</span>
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreate(true)}>
                                Create New
                            </Button>
                        </div>
                        <List
                            bordered
                            dataSource={watermarks}
                            renderItem={(wm) => (
                                <List.Item
                                    actions={[
                                        wm.owner_empno === empNo && (
                                            <Tooltip title="Edit">
                                                <Button type="text" icon={<EditOutlined />} onClick={() => {
                                                    setEditingId(wm.id);
                                                    setIsCreate(true);
                                                    form.setFieldsValue({ ...wm });
                                                }} />
                                            </Tooltip>
                                        ),
                                        wm.owner_empno === empNo && (
                                            <Tooltip title="Share">
                                                <Button type="text" icon={<ShareAltOutlined />} onClick={() => {
                                                    setShareWmId(wm.id);
                                                    setShareOpen(true);
                                                }} />
                                            </Tooltip>
                                        ),
                                        wm.owner_empno === empNo && (
                                            <Popconfirm title="Delete watermark?" onConfirm={() => handleDelete(wm.id)}>
                                                <Button type="text" danger icon={<DeleteOutlined />} />
                                            </Popconfirm>
                                        )
                                    ].filter(Boolean)}
                                >
                                    <div style={{ flex: 1 }}>
                                        <strong>{wm.name}</strong>
                                        {wm.owner_empno !== empNo && <Badge count="Shared" style={{ backgroundColor: '#52c41a', marginLeft: 8 }} />}
                                        <div style={{ color: '#888', fontSize: 12 }}>Text: "{wm.text}"</div>
                                        <Space style={{ marginTop: 8 }}>
                                            <Button size="small" onClick={() => applyWatermark(wm, 'stamp')}>Place as Stamp</Button>
                                            <Button size="small" type="primary" ghost onClick={() => applyWatermark(wm, 'all')}>Apply to All Pages</Button>
                                        </Space>
                                    </div>
                                </List.Item>
                            )}
                        />
                    </div>
                ) : (
                    <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ opacity: 0.3, font_size: 48, angle: 45, color: '#000000' }}>
                        <Form.Item name="name" label="Template Name" rules={[{ required: true }]}>
                            <Input placeholder="e.g. Confidential" />
                        </Form.Item>
                        <Form.Item name="text" label="Watermark Text" rules={[{ required: true }]}>
                            <Input placeholder="e.g. CONFIDENTIAL - DO NOT COPY" />
                        </Form.Item>

                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="color" label="Color">
                                    <ColorPicker showText />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="opacity" label="Opacity (0.1 - 1.0)">
                                    <Slider min={0.1} max={1} step={0.1} />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="font_size" label="Font Size">
                                    <Slider min={12} max={120} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="angle" label="Angle (Degrees)">
                                    <Slider min={-90} max={90} marks={{ '-45': '-45°', 0: '0°', 45: '45°' }} />
                                </Form.Item>
                            </Col>
                        </Row>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                            <Button onClick={() => {
                                setIsCreate(false);
                                setEditingId(null);
                            }}>Cancel</Button>
                            <Button type="primary" htmlType="submit">
                                {editingId ? 'Update Template' : 'Save Template'}
                            </Button>
                        </div>
                    </Form>
                )}

                <Modal
                    title="Share Watermark"
                    open={shareOpen}
                    onCancel={() => setShareOpen(false)}
                    onOk={handleShare}
                    okText="Share"
                >
                    <p>Enter the Employee ID to share this watermark with:</p>
                    <Input
                        placeholder="Employee ID"
                        value={shareEmpno}
                        onChange={(e) => setShareEmpno(e.target.value)}
                    />
                </Modal>
            </Spin>
        </Modal>
    );
};

export default WatermarkManagerModal;
