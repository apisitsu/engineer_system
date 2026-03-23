import React, { useState, useEffect, use } from "react";
import { Form, Input, Modal, Checkbox, Spin, Button, Row, Col, DatePicker, Space, Upload, Radio, Divider } from "antd";
import { key_constance } from "../../../../constance/constance";
import moment from "moment";
import Swal from "sweetalert2";
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import imageCompression from 'browser-image-compression';
import axios from "axios";
import { server } from '../../../../constance/constance';
import { Header } from "antd/es/layout/layout";

const { RangePicker } = DatePicker;

const ECRFrom = ({ onCancel, OnOpen, staus }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [fileListBefore, setFileListBefore] = useState([]);
    const [fileListAfter, setFileListAfter] = useState([]);
    const [fileListToolingBefore, setFileListToolingBefore] = useState([]);
    const [fileListToolingAfter, setFileListToolingAfter] = useState([]);
    const [base64Before, setBase64Before] = useState("");
    const [base64After, setBase64After] = useState("");
    const [objective, setObjective] = useState("");
    const [change, setChange] = useState([]);

    const resetAllStates = () => {
        setLoading(false);
        setFileListBefore([]);
        setFileListAfter([]);
        setBase64Before("");
        setBase64After("");
        setObjective("");
        setChange("");
    };

    const changeFlieUpload = (fileListName, newFileList) => {
        switch (fileListName) {
            case "fileListBefore":
                setFileListBefore(newFileList);
                break;
            case "fileListAfter":
                setFileListAfter(newFileList);
                break;
            case "fileListToolingBefore":
                setFileListToolingBefore(newFileList);
                break;
            case "fileListToolingAfter":
                setFileListToolingAfter(newFileList);
                break;
            default:
                break;
        }
    };


    useEffect(() => {
        if (OnOpen) {
            let userName = localStorage.getItem(key_constance.USER_NAME);
            let user_role = localStorage.getItem(key_constance.ROLE);
            // console.log("user_role", user_role);

            let roleMap = {
                "AD": "Admin",
                "ENG": "Engineer",
                "MM": "Mentenance",
                "PC": "Production Control",
                "PROD": "Production",
                "QA": "Quality Assurance",
                "QC": "Quality Control",
                "PO": "Purchasing",
                "IT": "IT Support",
            }

            const fullRoleName = roleMap[user_role] || "user";

            form.setFieldsValue({
                request_by: userName,
                require_date: moment(),
                department: fullRoleName,
            });
        }
    }, [OnOpen, form]);

    const normFile = e => {
        if (Array.isArray(e)) {
            return e;
        }
        return e?.fileList;
    };

    const onSubmit = () => {
        setLoading(true);
        form.validateFields()
            .then((values) => {
                console.log("Success:", values);
                Swal.fire({
                    icon: "success",
                    title: `Save Success`,
                    showConfirmButton: false,
                    customClass: "swal-style",
                });
                setTimeout(() => {
                    onclickCancel();
                }, 1000);
            })
            .catch((error) => {
                console.log("Validate Failed:", error);
                const status = error?.response?.status;
                const msg = error?.response?.data?.error;
                if (status === 409) {
                    Swal.fire({
                        icon: "warning",
                        title: `Duplicate lot`,
                        customClass: "swal-style",
                    });
                } else {
                    Swal.fire({
                        icon: "error",
                        title: `Please try again`,
                        customClass: "swal-style",
                    });
                }
            });
        setLoading(false);
    };

    const handleUploadToDrive = async (fileInfo) => {
        const rawFile = fileInfo?.originFileObj || fileInfo;

        if (!(rawFile instanceof Blob)) {
            Swal.fire("Warning", "กรุณาเลือกไฟล์ก่อน", "warning");
            return;
        }

        const options = {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 1024,
            useWebWorker: true,
        };

        try {
            setLoading(true);

            console.log(`ขนาดไฟล์ก่อนบีบอัด: ${rawFile.size / 1024 / 1024} MB`);
            const compressedFile = await imageCompression(rawFile, options);
            console.log(`ขนาดไฟล์หลังบีบอัด: ${compressedFile.size / 1024 / 1024} MB`);

            const reader = new FileReader();
            reader.readAsDataURL(compressedFile);

            reader.onload = () => {
                const base64Data = reader.result;

                console.log("--- Compressed Image Base64 ---");
                // console.log("Base64 String:", base64Data);

                setLoading(false);
                Swal.fire({
                    icon: "success",
                    title: "Compressed & Converted",
                    text: `บีบอัดเหลือ ${Math.round(compressedFile.size / 1024)} KB แล้ว`,
                });

                // นำไปใส่ใน Form หรือส่ง API ต่อได้เลย
                setBase64Before(base64Data);
                console.log("Base64 Before Change set in state.", base64Before);
            };

        } catch (error) {
            console.error("Compression Error:", error);
            setLoading(false);
            Swal.fire("Error", "เกิดข้อผิดพลาดในการบีบอัดรูปภาพ", "error");
        }
    };

    const heandlerObjective = (e) => {
        if (e.target.value !== "Others") {
            clearMultipleFields(["objective_others"]);
            // console.log("heandlerStatus Clear :" , e.target.value);
        }
    }

    const fieldsForToolProUsage = [
        { name: "setup_data_sheet_no", label: "Setup Data Sheet No.", span: 10, type: "input" },
        { name: "part_no", label: "Part No.", span: 8, type: "input" },
        { name: "cn", label: "C/N", span: 6, type: "input" },
        { name: "process", label: "Process", span: 8, type: "input" },
        { name: "program_no", label: "Program No.", span: 8, type: "input" },
        { name: "machine_no", label: "M/C No.", span: 8, type: "input" },
        { name: "cycle_time", label: "Cycle Time Before / After", span: 12, type: "input" },
        { name: "title_of_change", label: "Title of Change", span: 24, type: "textarea" },
        { name: "reason_of_change", label: "Reason of Change", span: 24, type: "textarea" },
    ];

    const fieldsForToolUsage = [
        { name: "current_tooling_no", label: "Current tooling No.", span: 12, type: "input" },
        { name: "current_tooling_usage", label: "Current tooling Usage", span: 12, type: "input" },
        { name: "new_tooling_no", label: "New tooling No.", span: 12, type: "input" },
        { name: "new_tooling_usage", label: "New tooling Usage", span: 12, type: "input" },
    ];

    const fieldsUploadOfTooling = [
        { name: "upload_tooling_before", label: "Upload Setup data sheet Before Change", span: 12, type: "upload", fileList: "fileListToolingBefore" },
        { name: "upload_tooling_after", label: "Upload Setup data sheet After Change", span: 12, type: "upload", fileList: "fileListToolingAfter"},
    ];

    const renderComponent = (field) => {
        switch (field.type) {
            case "textarea":
                return <Input.TextArea rows={1} />;

            case "checkbox":
                return <Checkbox.Group options={field.options} placeholder="Select..." />;

            case "upload":
                return (
                    <Upload
                        beforeUpload={() => false}
                        listType="picture"
                        fileList={field.fileList}
                        onChange={changeFlieUpload.bind(this, field.fileList)}
                        accept="image/*"
                        maxCount={1}
                    >
                        {field.fileList.length < 1 && (
                        <Button icon={<UploadOutlined />}>Click to Upload</Button>
                        )}
                    </Upload>
                );

            case "input":
            default:
                return <Input />;
        }
    };

    const heandlerChange = (values) => {
        console.log("Selected Values:", values);
        const hasDrawing = values.includes("Drawing");

        const hasToolPro = values.some(val => ["Tooling", "Program", "Usage"].includes(val));
        const hasToolOnly = values.some(val => ["Tooling", "Usage"].includes(val));

        if (!hasToolPro) {
            clearMultipleFields(fieldsForToolProUsage.map(f => f.name));
        }
        if (!hasToolOnly) {
            clearMultipleFields(fieldsForToolUsage.map(f => f.name));
        }

        if (!hasDrawing) {
            console.log("ล้างค่าข้อมูลที่เกี่ยวกับ Drawing...");
        }
    };

    const clearMultipleFields = (fieldsToClear) => {
        const resetObj = {};
        fieldsToClear.forEach(field => {
            resetObj[field] = undefined;
        });
        form.setFieldsValue(resetObj);
    };

    const onclickCancel = () => {
        form.resetFields();
        resetAllStates();
        window.location.reload(false);
        return onCancel();
    };


    return (
        <Spin tip="Loading" size="large" spinning={loading}>
            <Modal
                title="ENGINEERING CHANGE REQUEST"
                // style={{ top: 40 }}
                open={OnOpen}
                onCancel={onclickCancel}
                footer={null}
                width={1000}
                centered={true}
            >
                <Form form={form} layout="horizontal" style={{ marginTop: 24 }}>
                    <Row gutter={[16, 8]}>
                        <Col span={8}>
                            <Form.Item label="ECR No." name="ecr_no" rules={[{ required: true, message: 'Please input!' }]} style={{ marginBottom: 0 }}>
                                <Input placeholder="Will be input auto" />
                            </Form.Item>
                        </Col>
                        <Col span={8}></Col>
                        <Col span={8}>
                            <Form.Item
                                label="Require Date"
                                name="require_date"
                                rules={[{ required: true, message: 'Please input!' }]}
                                style={{ marginBottom: 0 }}
                            >
                                <DatePicker disabled style={{ width: '100%' }} format="DD-MM-YYYY" />
                            </Form.Item>
                        </Col>
                        <Col span={9}>
                            <Form.Item
                                label="REQUEST BY"
                                name="request_by"
                                rules={[{ required: true, message: 'Please input!' }]}
                                style={{ marginBottom: 0 }}>
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={7}>
                            <Form.Item
                                label="DEPARTMENT"
                                name="department"
                                rules={[{ required: true, message: 'Please input!' }]}
                                style={{ marginBottom: 0 }}>
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="Due Date" name="due_date" rules={[{ required: true, message: 'Please input!' }]} style={{ marginBottom: 0 }}>
                                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item
                                label="Status"
                                name="status"
                                rules={[{ required: true, message: 'Please input!' }]}
                                style={{ marginBottom: 0 }}
                            >
                                <Radio.Group>
                                    <Radio value="Permanent">Permanent</Radio>
                                    <Radio value="Temporary">Temporary</Radio>
                                </Radio.Group>
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item
                                labelAlign="left"
                                label="Objective"
                                name="objective"
                                rules={[{ required: true, message: 'Please input!' }]}
                                style={{ marginBottom: 0 }}>
                                <Radio.Group
                                    onChange={(e) => {
                                        setObjective(e.target.value);
                                        heandlerObjective(e);
                                    }}
                                >
                                    <Radio value="Reduce Cycle">Reduce Cycle</Radio>
                                    <Radio value="Cost Reduction">Cost Reduction</Radio>
                                    <Radio value="Increase UsAge Tooling">Increase UsAge Tooling</Radio>
                                    <Radio value="Yield Improvement">Yield Improvement</Radio>
                                    <Radio value="Others">Others</Radio>
                                </Radio.Group>
                            </Form.Item>
                            {objective === "Others" && (
                                <Form.Item
                                    name="objective_others"
                                    label="Please specify"
                                    rules={[{ required: true, message: 'Please input your reason!' }]}
                                >
                                    <Input.TextArea rows={2} placeholder="Please input your reason" />
                                </Form.Item>
                            )}
                        </Col>
                        <Col span={24}>
                            <Form.Item
                                labelAlign="left"
                                label="Change"
                                name="change"
                                rules={[{ required: true, message: 'Please select at least one!' }]}
                            >
                                <Checkbox.Group
                                    onChange={(checkedValues) => {
                                        setChange(checkedValues);
                                        heandlerChange(checkedValues);
                                    }}
                                >
                                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'nowrap' }}>
                                        <Checkbox value="Drawing">Product Drawing</Checkbox>
                                        <Checkbox value="Tooling">Tooling</Checkbox>
                                        <Checkbox value="Program">Program</Checkbox>
                                        <Checkbox value="Usage">Usage</Checkbox>
                                    </div>
                                </Checkbox.Group>
                            </Form.Item>
                            {change?.some(val => ["Tooling", "Program", "Usage"].includes(val)) && (
                                <Row gutter={[16, 8]} style={
                                    {
                                        border: '1px solid #d9d9d9',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        marginBottom: '16px'
                                    }
                                }>
                                    <Divider orientation="left" style={{ margin: '0 0 10px 0' }}>
                                        Tooling, Program, Usage Details
                                    </Divider>
                                    {fieldsForToolProUsage.map((field) => (
                                        <Col span={field.span} key={field.name}>
                                            <Form.Item
                                                name={field.name}
                                                label={field.label}
                                                rules={[{ required: true, message: 'Please input!' }]}
                                                style={{ marginBottom: 0 }}
                                            >
                                                {field.isTextArea ? <Input.TextArea rows={1} /> : <Input />}
                                            </Form.Item>
                                        </Col>
                                    ))}
                                </Row>
                            )}
                            {change?.some(val => ["Tooling", "Usage"].includes(val)) && (
                                <Row gutter={[16, 8]} style={
                                    {
                                        border: '1px solid #d9d9d9',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        marginBottom: '16px'
                                    }
                                }>
                                    <Divider orientation="left" style={{ margin: '0 0 10px 0' }}>
                                        Tooling, Usage Details
                                    </Divider>
                                    {fieldsForToolUsage.map((field) => (
                                        <Col span={field.span} key={field.name}>
                                            <Form.Item
                                                name={field.name}
                                                label={field.label}
                                                rules={[{ required: true, message: 'Please input!' }]}
                                                style={{ marginBottom: 0 }}
                                            >
                                                {field.isTextArea ? <Input.TextArea rows={1} /> : <Input />}
                                            </Form.Item>
                                        </Col>
                                    ))}
                                </Row>
                            )}
                            {change?.some(val => ["Tooling", "Program", "Usage"].includes(val)) && (
                                <Row gutter={[16, 8]} style={
                                    {
                                        border: '1px solid #d9d9d9',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        marginBottom: '16px'
                                    }
                                }>
                                    <Divider orientation="left" style={{ margin: '0 0 10px 0' }}>
                                        Tooling, Program, Usage Details
                                    </Divider>
                                    {fieldsUploadOfTooling.map((field) => (
                                        <Col span={field.span} key={field.name}>
                                            <Form.Item
                                                name={field.name}
                                                label={field.label}
                                                style={{ marginBottom: 12 }}
                                                // เพิ่ม 2 บรรทัดนี้
                                                valuePropName={field.type === "upload" ? "fileList" : "value"}
                                                getValueFromEvent={field.type === "upload" ? normFile : undefined}
                                            >
                                                {renderComponent(field)}
                                            </Form.Item>
                                        </Col>
                                    ))}
                                </Row>
                            )}
                        </Col>
                        {/* <Col span={24}>
                            <Form.Item labelAlign="left" label="Reason of change" name="reason_of_change" rules={[{ required: true, message: 'Please input!' }]} style={{ marginBottom: 0 }}>
                                <Input.TextArea rows={1} style={{ width: '100%' }} format="DD-MM-YYYY" />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item labelAlign="left" label="Description of change" name="description_of_change" rules={[{ required: true, message: 'Please input!' }]} style={{ marginBottom: 0 }}>
                                <Input.TextArea rows={1} style={{ width: '100%' }} format="DD-MM-YYYY" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Before Change"
                                name="before_change"
                                extra="Maximum Upload 1 Picture"
                            >
                                <Upload
                                    listType="picture-card"
                                    fileList={fileListBefore}
                                    onChange={onChangeBefore}
                                    accept="image/*"
                                    maxCount={1}
                                    beforeUpload={(file) => {
                                        const isImage = file.type.startsWith('image/');
                                        if (!isImage) {
                                            Swal.fire("Error", "Please select only image files", "error");
                                        }
                                        return isImage || Upload.LIST_IGNORE;
                                    }}
                                    customRequest={({ onSuccess }) => {
                                        setTimeout(() => onSuccess("ok"), 0);
                                    }}
                                >
                                    {fileListBefore.length < 1 && (
                                        <button style={{ border: 0, background: 'none' }} type="button">
                                            <PlusOutlined />
                                            <div style={{ marginTop: 8 }}>Upload</div>
                                        </button>
                                    )}
                                </Upload>
                            </Form.Item>
                            <Button
                                type="primary"
                                onClick={() => handleUploadToDrive(fileListBefore[0])}
                                disabled={fileListBefore.length === 0}
                                style={{ width: 100 }}>
                                Upload
                            </Button>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="After Change"
                                name="after_change"
                                extra="Maximum Upload 1 Picture"
                            >
                                <Upload
                                    listType="picture-card"
                                    fileList={fileListAfter}
                                    onChange={onChangeAfter}
                                    accept="image/*"
                                    maxCount={1}
                                    beforeUpload={(file) => {
                                        const isImage = file.type.startsWith('image/');
                                        if (!isImage) {
                                            Swal.fire("Error", "Please select only image files", "error");
                                        }
                                        return isImage || Upload.LIST_IGNORE;
                                    }}
                                    customRequest={({ onSuccess }) => {
                                        setTimeout(() => onSuccess("ok"), 0);
                                    }}
                                >
                                    {fileListAfter.length < 1 && (
                                        <button style={{ border: 0, background: 'none' }} type="button">
                                            <PlusOutlined />
                                            <div style={{ marginTop: 8 }}>Upload</div>
                                        </button>
                                    )}
                                </Upload>
                            </Form.Item>
                        </Col> */}
                    </Row>
                    <Form.Item wrapperCol={{ span: 24 }} style={{ marginBottom: 0, marginTop: 24 }}>
                        <div style={{ textAlign: 'center' }}>
                            <Space size="middle">
                                <Button type="primary" onClick={onSubmit} style={{ width: 100 }}>
                                    Submit
                                </Button>
                                <Button type="primary" danger onClick={onclickCancel} style={{ width: 100 }}>
                                    Cancel
                                </Button>
                            </Space>
                        </div>
                    </Form.Item>
                </Form>
            </Modal>
        </Spin >
    )
}

export default ECRFrom;