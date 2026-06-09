import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, Row, Col, App } from 'antd';
import dayjs from 'dayjs';
import useEngRecordStore from '../../../../stores/engRecordStore';
import engRecordApi from '../../../../api/engRecordApi';

const { TextArea } = Input;

const CASE_OPTIONS = [
    { value: 'Request Drawing', label: 'Request Drawing' },
    { value: 'Judgment Spec', label: 'Judgment Spec' },
    { value: 'Request change DWG/Traveler', label: 'Request change DWG/Traveler' },
    { value: 'DWG/Traveler Problem', label: 'DWG/Traveler Problem' },
    { value: 'Special', label: 'Special' },
];

function EngRecordFormModal() {
    const [form] = Form.useForm();
    const { message } = App.useApp();
    const {
        formModalOpen, editingRecord, closeFormModal,
        createRecord, updateRecord, permissions, templateData,
    } = useEngRecordStore();

    const isEdit = !!editingRecord;
    const isSubmitter = permissions?.level === 'submitter';

    useEffect(() => {
        if (formModalOpen && editingRecord) {
            form.setFieldsValue({
                ...editingRecord,
                request_date: editingRecord.request_date ? dayjs(editingRecord.request_date) : null,
                finish_date: editingRecord.finish_date ? dayjs(editingRecord.finish_date) : null,
                plan_start_date: editingRecord.plan_start_date ? dayjs(editingRecord.plan_start_date) : null,
            });
        } else if (formModalOpen && templateData) {
            // Pre-fill from QuickCreate template
            form.resetFields();
            form.setFieldsValue({
                request_date: dayjs(),
                ...templateData,
            });
        } else if (formModalOpen) {
            form.resetFields();
            form.setFieldsValue({
                request_date: dayjs(),
                request_by: 'PC/MC',
            });
        }
    }, [formModalOpen, editingRecord, templateData, form]);

    const handleLotNoChange = async (e) => {
        const val = e.target.value?.trim();
        if (val && val.length === 7 && !isEdit) {
            try {
                const res = await engRecordApi.getMrpInfo(val);
                if (res.data?.cn || res.data?.pn || res.data?.plan) {
                    form.setFieldsValue({
                        cn: res.data.cn || form.getFieldValue('cn'),
                        pn: res.data.pn || form.getFieldValue('pn'),
                        plan_start_date: res.data.plan ? dayjs(res.data.plan) : form.getFieldValue('plan_start_date'),
                    });
                }
            } catch (err) {
                console.error('Failed to fetch MRP info:', err);
            }
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            // Convert dates
            const payload = {
                ...values,
                request_date: values.request_date?.format('YYYY-MM-DD'),
                finish_date: values.finish_date?.format('YYYY-MM-DD') || null,
                plan_start_date: values.plan_start_date?.format('YYYY-MM-DD') || null,
            };

            if (isEdit) {
                await updateRecord(editingRecord.id, payload);
                message.success('Record updated successfully');
            } else {
                await createRecord(payload);
                message.success('Record created successfully');
            }

            closeFormModal();
        } catch (err) {
            if (err.errorFields) return; // form validation error
            message.error('Operation failed: ' + (err.response?.data?.error || err.message));
        }
    };

    return (
        <Modal
            title={isEdit ? `Edit Record #${editingRecord?.record_no}` : 'New Engineering Record'}
            open={formModalOpen}
            onCancel={closeFormModal}
            onOk={handleSubmit}
            okText={isEdit ? 'Update' : 'Submit'}
            width={1200}
            destroyOnHidden
        >
            <Form
                form={form}
                layout="vertical"
                size="middle"
                style={{ marginTop: 16 }}
            >
                <Row gutter={16}>
                    <Col xs={24} sm={6}>
                        <Form.Item
                            name="request_date"
                            label="Request Date"
                            rules={[{ required: true, message: 'Required' }]}
                        >
                            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={6}>
                        <Form.Item name="request_by" label="Request By" initialValue="PC/MC">
                            <Input disabled={isSubmitter} />
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={6}>
                        <Form.Item
                            name="case_type"
                            label="Case Type"
                            rules={[{ required: true, message: 'Required' }]}
                        >
                            <Select options={CASE_OPTIONS} placeholder="Select case type" />
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={6}>
                        <Form.Item name="plant" label="Plant">
                            <Input placeholder="Plant code" />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col xs={24} sm={8}>
                        <Form.Item name="lot_no" label="Lot No.">
                            <Input placeholder="e.g. T1234T6" onChange={handleLotNoChange} />
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Form.Item name="cn" label="CN (Customer No.)">
                            <Input placeholder="e.g. 314096" />
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Form.Item name="pn" label="PN (Part No.)">
                            <Input placeholder="e.g. 3AMBM4-4056B" />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={24}>
                        <Form.Item name="spec_problem" label="Spec / Problem">
                            <TextArea rows={2} placeholder="Describe the specification or problem..." />
                        </Form.Item>
                    </Col>
                </Row>

                {/* ─── Engineer Fields (hidden for submitters) ── */}
                {!isSubmitter && (
                    <>
                        <Row gutter={16}>
                            <Col xs={24} sm={12}>
                                <Form.Item name="judge_revise" label="Judge / Revise">
                                    <TextArea rows={2} placeholder="Engineering judgment or revision..." />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Form.Item name="reason" label="Reason">
                                    <TextArea rows={2} placeholder="Root cause or reason..." />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col xs={24} sm={6}>
                                <Form.Item name="judgment_by" label="Judgment By">
                                    <Input placeholder="Engineer name" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={6}>
                                <Form.Item name="responsible" label="Responsible">
                                    <Input placeholder="Assigned person/group" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={6}>
                                <Form.Item name="confirm_codi" label="Confirm (Codi)">
                                    <Input placeholder="Coordinator confirmation" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={6}>
                                <Form.Item name="finish_date" label="Finish Date">
                                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col xs={24} sm={12}>
                                <Form.Item name="remark" label="Remark">
                                    <TextArea rows={2} placeholder="Additional notes..." />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Form.Item name="comment" label="Comment">
                                    <TextArea rows={2} placeholder="Comments..." />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col xs={24} sm={12}>
                                <Form.Item name="plan_start_date" label="Plan Start Production">
                                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Form.Item name="ts_flag" label="T/S Flag">
                                    <Input placeholder="Troubleshooting flag" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </>
                )}

                {/* ─── Plan start for submitters ────────────── */}
                {isSubmitter && (
                    <Form.Item name="plan_start_date" label="Plan Start Production">
                        <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                    </Form.Item>
                )}
            </Form>
        </Modal>
    );
}

export default EngRecordFormModal;
