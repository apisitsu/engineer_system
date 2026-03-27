import React, { useState, useEffect } from "react";
import { Form, Input, Modal, Checkbox, Spin, Button, Row, Col, DatePicker, Space, Upload, Radio, Divider } from "antd";
import { UploadOutlined } from '@ant-design/icons';
import Swal from "sweetalert2";
import moment from "moment";
import axios from "axios"; // 
import { server, key_constance } from '../../../../constance/constance';
import imageCompression from 'browser-image-compression';
import { useTheme } from '../../../../theme';

const ECRForm = ({ onCancel, OnOpen, initialData, onSuccess }) => {
    const { theme } = useTheme();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [objective, setObjective] = useState("");
    const [change, setChange] = useState([]);
    const [imgToolingBefore, setImgToolingBefore] = useState(null);
    const [imgToolingAfter, setImgToolingAfter] = useState(null);
    const [imgDrawingBefore, setImgDrawingBefore] = useState(null);
    const [imgDrawingAfter, setImgDrawingAfter] = useState(null);

    const isViewOnly = !!initialData;

    const resetAllStates = () => {
        setLoading(false);
        setObjective("");
        setChange([]);
    };

    useEffect(() => {
        if (OnOpen) {
            let userName = localStorage.getItem(key_constance.USER_NAME);
            let user_role = localStorage.getItem(key_constance.ROLE);

            let roleMap = {
                "AD": "Admin",
                "ENG": "Engineer",
                "MM": "Maintenance",
                "PC": "Production Control",
                "PROD": "Production",
                "QA": "Quality Assurance",
                "QC": "Quality Control",
                "PO": "Purchasing",
                "IT": "IT Support",
            };

            const fullRoleName = roleMap[user_role] || "User";
            if (initialData) {
                // --- กรณีแสดงข้อมูลเก่า (View Mode) ---

                // 1. แปลง Boolean จาก DB กลับเป็น Checkbox Array
                const changeList = [];
                if (initialData.is_drawing) changeList.push("Drawing");
                if (initialData.is_tooling) changeList.push("Tooling");
                if (initialData.is_program) changeList.push("Program");
                if (initialData.is_usage) changeList.push("Usage");

                // 2. ยัดข้อมูลลง Form
                form.setFieldsValue({
                    ...initialData,
                    require_date: initialData.require_date ? moment(initialData.require_date) : null,
                    due_date: initialData.due_date ? moment(initialData.due_date) : null,
                    change: changeList
                });

                // 3. อัปเดต UI State (เพื่อให้ช่องกรอกที่ซ่อนอยู่โผล่ออกมา)
                setObjective(initialData.objective);
                setChange(changeList);

                // 4. เก็บรูป Base64 ลง State ไว้แสดงผล
                setImgToolingBefore(initialData.upload_tooling_before);
                setImgToolingAfter(initialData.upload_tooling_after);
                setImgDrawingBefore(initialData.upload_drawing_before);
                setImgDrawingAfter(initialData.upload_drawing_after);

            } else {
                form.resetFields();
                setImgToolingBefore(null);
                setImgToolingAfter(null);
                setImgDrawingBefore(null);
                setImgDrawingAfter(null);
                form.setFieldsValue({

                    request_by: userName,
                    require_date: moment(),
                    department: fullRoleName,
                    ecr_no: "Auto Generate",
                });
            }
        }
    }, [OnOpen, initialData, form]);

    const normFile = (e) => {
        if (Array.isArray(e)) {
            return e;
        }
        return e?.fileList;
    };

    const getBase64 = async (file) => {
        // 1. Log ขนาดไฟล์ก่อนบีบอัด
        // const sizeBefore = (file.size / 1024 / 1024).toFixed(2);
        // console.log(`[Compression] Original: ${file.name} | Size: ${sizeBefore} MB`);

        const options = {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 1280,
            useWebWorker: true,
        };

        try {
            let fileToConvert = file;

            if (file.type.startsWith('image/')) {
                // 2. ทำการบีบอัด
                fileToConvert = await imageCompression(file, options);

                // 3. Log ขนาดไฟล์หลังบีบอัด
                // const sizeAfter = (fileToConvert.size / 1024 / 1024).toFixed(2);
                // const saved = (((file.size - fileToConvert.size) / file.size) * 100).toFixed(1);
                // console.log(`[Compression] Compressed: ${sizeAfter} MB | Reduced: ${saved}%`);
            }

            // 4. แปลงเป็น Base64
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(fileToConvert);
                reader.onload = () => resolve(reader.result);
                reader.onerror = (error) => reject(error);
            });
        } catch (error) {
            console.error("Compression Error:", error);
            throw error;
        }
    };

    const onSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            // 1. จัดการรูปแบบวันที่
            const requireDate = values.require_date
                ? values.require_date.format('YYYY-MM-DD HH:mm:ss')
                : null;

            const dueDate = values.due_date
                ? values.due_date.format('YYYY-MM-DD HH:mm:ss')
                : null;

            // 2. ตรวจสอบประเภทการเปลี่ยนแปลง
            const changeList = values.change || [];
            const isDrawing = changeList.includes("Drawing");
            const isTooling = changeList.includes("Tooling");
            const isProgram = changeList.includes("Program");
            const isUsage = changeList.includes("Usage");

            // 3. ฟังก์ชันช่วยแปลงไฟล์เป็น Base64 (กรณีมีหลายฟิลด์)
            const getFileBase64 = async (fileList) => {
                if (fileList && fileList.length > 0 && fileList[0].originFileObj) {
                    return await getBase64(fileList[0].originFileObj);
                }
                return "";
            };

            // 4. แปลงไฟล์ Upload ของทั้ง Tooling และ Drawing
            const [
                toolingBefore, toolingAfter,
                drawingBefore, drawingAfter
            ] = await Promise.all([
                getFileBase64(values.upload_tooling_before),
                getFileBase64(values.upload_tooling_after),
                getFileBase64(values.upload_drawing_before),
                getFileBase64(values.upload_drawing_after)
            ]);

            // 5. เตรียม Payload ส่งไปยัง Backend
            // รวมข้อมูลทั้งหมดและกำหนดค่าเริ่มต้นให้ฟิลด์ที่อาจจะว่าง (เพื่อป้องกัน error ใน SQLite)
            const payload = {
                ...values,
                require_date: requireDate,
                due_date: dueDate,
                is_drawing: isDrawing,
                is_tooling: isTooling,
                is_program: isProgram,
                is_usage: isUsage,

                // ใช้ชื่อคอลัมน์ตามที่เราคุยกันใน SQL (ก่อนหน้า)
                upload_tooling_before: toolingBefore,
                upload_tooling_after: toolingAfter,

                // ลบฟิลด์ที่ไม่จำเป็นต้องส่งเข้า Database แบบตรงๆ ออก
                change: undefined,
                upload_drawing_before: drawingBefore,
                upload_drawing_after: drawingAfter
            };

            console.log("Submitting Payload:", payload);
            await axios.post(`${server.ECR_REQUIRE_CREATE}`, payload);

            setLoading(false);
            Swal.fire({
                icon: "success",
                title: "Save Success",
                showConfirmButton: false,
                timer: 1500,
                customClass: "swal-style",
            }).then(() => {
                if (onSuccess) onSuccess();
                onclickCancel();
            });

        } catch (error) {
            setLoading(false);
            console.error("Submit Error:", error);

            if (error.errorFields) {
                Swal.fire({
                    icon: "warning",
                    title: "Some fields are missing",
                    text: "Please check your input in the required fields.",
                    customClass: "swal-style",
                });
                return;
            }

            Swal.fire({
                icon: "error",
                title: "Error",
                text: "Cannot save data to the system.",
                customClass: "swal-style",
            });
        }
    };

    const onclickCancel = () => {
        form.resetFields();
        resetAllStates();
        onCancel();
    };

    // Handlers
    const handlerObjective = (e) => {
        setObjective(e.target.value);
        if (e.target.value !== "Others") {
            form.setFieldValue("objective_others", undefined);
        }
    };

    const handlerChange = (checkedValues) => {
        setChange(checkedValues);

        const hasToolPro = checkedValues.some(val => ["Tooling", "Program", "Usage"].includes(val));
        const hasToolOnly = checkedValues.some(val => ["Tooling", "Usage"].includes(val));

        // ล้างค่าเมื่อ Uncheck
        if (!hasToolPro) {
            fieldsForToolProUsage.forEach(f => form.setFieldValue(f.name, undefined));
        }
        if (!hasToolOnly) {
            fieldsForToolUsage.forEach(f => form.setFieldValue(f.name, undefined));
            fieldsUploadOfTooling.forEach(f => form.setFieldValue(f.name, undefined));
        }
    };

    // Configuration Arrays
    const headerFields = [
        { name: "ecr_no", label: "ECR No.", span: 8, type: "input", required: true, disabled: false },
        { type: "empty", span: 8 },
        { name: "require_date", label: "Require Date", span: 8, type: "date", required: true, disabled: true },
        { name: "request_by", label: "REQUEST BY", span: 9, type: "input", required: true, disabled: false },
        { name: "department", label: "DEPARTMENT", span: 7, type: "input", required: true, disabled: false },
        { name: "due_date", label: "Due Date", span: 8, type: "date", required: true, disabled: false },
        {
            name: "status", label: "Status", span: 24, type: "radio", required: true,
            options: [{ label: "Permanent", value: "Permanent" }, { label: "Temporary", value: "Temporary" }]
        },
    ];

    const fieldsForToolProUsage = [
        { name: "setup_data_sheet_no", label: "Setup Data Sheet No.", span: 10, type: "input", required: true },
        { name: "part_no_tooling", label: "Part No.", span: 8, type: "input", required: true },
        { name: "cn_tooling", label: "C/N", span: 6, type: "input", required: true },
        { name: "process", label: "Process", span: 8, type: "input", required: true },
        { name: "program_no", label: "Program No.", span: 8, type: "input", required: true },
        { name: "machine_no", label: "M/C No.", span: 8, type: "input", required: true },
        { name: "cycle_time", label: "Cycle Time Before / After", span: 12, type: "input", required: true },
        { name: "title_of_change", label: "Title of Change", span: 24, type: "textarea", required: true },
        { name: "reason_of_tooling", label: "Reason of Change", span: 24, type: "textarea", required: true },
        { name: "tooling_before_change", label: "Before Change", span: 12, type: "textarea", required: true },
        { name: "tooling_after_change", label: "After Change", span: 12, type: "textarea", required: true },
    ];

    const fieldsForToolUsage = [
        { name: "current_tooling_no", label: "Current tooling No.", span: 12, type: "input", required: true },
        { name: "current_tooling_usage", label: "Current tooling Usage", span: 12, type: "input", required: true },
        { name: "new_tooling_no", label: "New tooling No.", span: 12, type: "input", required: true },
        { name: "new_tooling_usage", label: "New tooling Usage", span: 12, type: "input", required: true },
    ];

    const fieldsUploadOfTooling = [
        { name: "upload_tooling_before", label: "Upload Before Change", span: 12, type: "upload", required: false },
        { name: "upload_tooling_after", label: "Upload After Change", span: 12, type: "upload", required: false },
    ];

    const fieldsDrawingChange = [
        { name: "part_no_drawing", label: "Part No.", span: 10, type: "input", required: true },
        { name: "cn_drawing", label: "C/N", span: 8, type: "input", required: true },
        { name: "rev_drawing", label: "Revision", span: 6, type: "input", required: true },
        { name: "reason_of_drawing", label: "Reason of Change", span: 24, type: "textarea", required: true },
        { name: "drawing_before_change", label: "Before Change", span: 12, type: "textarea", required: true },
        { name: "drawing_after_change", label: "After Change", span: 12, type: "textarea", required: true },
    ]

    const fieldsUploadOfDrawing = [
        { name: "upload_drawing_before", label: "Upload Before Change", span: 12, type: "upload", required: false },
        { name: "upload_drawing_after", label: "Upload After Change", span: 12, type: "upload", required: false },
    ];

    const fieldsEngDepApprove = [

    ]

    const renderComponent = (field) => {
        switch (field.type) {
            case "textarea":
                return <Input.TextArea rows={1} />;
            case "checkbox":
                return <Checkbox.Group options={field.options} />;
            case "upload":
                return (
                    <Upload
                        beforeUpload={() => false}
                        listType="picture"
                        accept="image/*"
                        maxCount={1}
                    >
                        <Button icon={<UploadOutlined />}>Click to Upload</Button>
                    </Upload>
                );
            case "date":
                return (
                    <DatePicker
                        disabled={isViewOnly ? true : field.disabled}
                        style={{ width: '100%' }}
                        format="DD-MM-YYYY"
                    />
                );
            case "radio":
                return (
                    <Radio.Group>
                        {field.options.map(opt => (
                            <Radio key={opt.value} value={opt.value}>{opt.label}</Radio>
                        ))}
                    </Radio.Group>
                );
            case "input":
            default:
                return <Input disabled={isViewOnly ? true : field.disabled} />;
        }
    };

    return (
        <Spin tip="Loading..." size="large" spinning={loading}>
            <Modal
                title={isViewOnly ? "VIEW ECR DETAILS" : "ENGINEERING CHANGE REQUEST"}
                open={OnOpen}
                onCancel={onclickCancel}
                footer={null}
                width={1000}
                centered
            >
                <Form
                    form={form}
                    layout="horizontal"
                    style={{ marginTop: 24 }}
                    disabled={isViewOnly}
                >
                    <Row gutter={[16, 8]}>
                        {headerFields.map((field, index) => {
                            if (field.type === "empty") {
                                return <Col key={index} span={field.span}></Col>;
                            }

                            return (
                                <Col key={field.name} span={field.span}>
                                    <Form.Item
                                        label={field.label}
                                        name={field.name}
                                        style={{ marginBottom: 0 }}
                                        rules={field.required ? [{ required: true, message: 'Please input!' }] : []}
                                    >
                                        {renderComponent(field)}
                                    </Form.Item>
                                </Col>
                            );
                        })}

                        {/* Objective Section */}
                        <Col span={24}>
                            <Form.Item label="Objective" name="objective" rules={[{ required: true, message: 'Please select!' }]} style={{ marginBottom: 0 }}>
                                <Radio.Group onChange={handlerObjective}>
                                    <Radio value="Reduce Cycle">Reduce Cycle</Radio>
                                    <Radio value="Cost Reduction">Cost Reduction</Radio>
                                    <Radio value="Increase Usage Tooling">Increase Usage Tooling</Radio>
                                    <Radio value="Yield Improvement">Yield Improvement</Radio>
                                    <Radio value="Others">Others</Radio>
                                </Radio.Group>
                            </Form.Item>
                            {objective === "Others" && (
                                <Form.Item name="objective_others" label="Please specify" rules={[{ required: true, message: 'Please input reason!' }]}>
                                    <Input.TextArea rows={2} placeholder="Please input your reason" />
                                </Form.Item>
                            )}
                        </Col>

                        {/* Change Checkbox Section */}
                        <Col span={24}>
                            <Form.Item label="Change" name="change" rules={[{ required: true, message: 'Please select at least one!' }]}>
                                <Checkbox.Group onChange={handlerChange}>
                                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'nowrap' }}>
                                        <Checkbox value="Drawing">Product Drawing</Checkbox>
                                        <Checkbox value="Tooling">Tooling</Checkbox>
                                        <Checkbox value="Program">Program</Checkbox>
                                        <Checkbox value="Usage">Usage</Checkbox>
                                    </div>
                                </Checkbox.Group>
                            </Form.Item>

                            {/* Dynamic Fields for Drawing */}
                            {change?.some(val => ["Drawing"].includes(val)) && (
                                <div style={{ border: '1px solid #d9d9d9', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                                    <Divider orientation="left" style={{ margin: '0 0 10px 0' }}>Product/Process Drawing Details</Divider>
                                    <Row gutter={[16, 8]}>
                                        {fieldsDrawingChange.map((field) => (
                                            <Col span={field.span} key={field.name}>
                                                <Form.Item name={field.name} label={field.label} rules={[{ required: field.required, message: 'Please input!' }]} style={{ marginBottom: 0 }}>
                                                    {renderComponent(field)}
                                                </Form.Item>
                                            </Col>
                                        ))}

                                        {isViewOnly ? (
                                            <>
                                                <Col span={12} style={{ textAlign: 'center' }}>
                                                    <p><b>Before Change:</b></p>
                                                    {imgDrawingBefore ? (
                                                        <img src={imgDrawingBefore} alt="Before" style={{ maxWidth: '100%', maxHeight: '250px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                                    ) : (
                                                        <div style={{ padding: '20px', background: theme.colors.surfaceHover, color: '#999' }}>No Image</div>
                                                    )}
                                                </Col>
                                                <Col span={12} style={{ textAlign: 'center' }}>
                                                    <p><b>After Change:</b></p>
                                                    {imgDrawingAfter ? (
                                                        <img src={imgDrawingAfter} alt="After" style={{ maxWidth: '100%', maxHeight: '250px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                                    ) : (
                                                        <div style={{ padding: '20px', background: theme.colors.surfaceHover, color: '#999' }}>No Image</div>
                                                    )}
                                                </Col>
                                            </>
                                        ) : (
                                            fieldsUploadOfDrawing.map((field) => (
                                                <Col span={field.span} key={field.name}>
                                                    <Form.Item
                                                        name={field.name}
                                                        label={field.label}
                                                        rules={[{ required: field.required, message: 'Please input!' }]}
                                                        valuePropName="fileList"
                                                        getValueFromEvent={normFile}
                                                        style={{ marginBottom: 0 }}
                                                    >
                                                        {renderComponent(field)}
                                                    </Form.Item>
                                                </Col>
                                            ))
                                        )}
                                    </Row>
                                </div>
                            )}

                            {change?.some(val => ["Tooling", "Program", "Usage"].includes(val)) && (
                                <div style={{ border: '1px solid #d9d9d9', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                                    <Divider orientation="left" style={{ margin: '0 0 10px 0' }}>Tooling, Program, Usage Details</Divider>
                                    <Row gutter={[16, 8]}>
                                        {fieldsForToolProUsage.map((field) => (
                                            <Col span={field.span} key={field.name}>
                                                <Form.Item name={field.name} label={field.label} rules={[{ required: field.required, message: 'Please input!' }]} style={{ marginBottom: 0 }}>
                                                    {renderComponent(field)}
                                                </Form.Item>
                                            </Col>
                                        ))}
                                        {isViewOnly ? (
                                            <>
                                                <Col span={12} style={{ textAlign: 'center' }}>
                                                    <p><b>Before Change:</b></p>
                                                    {imgToolingBefore ? (
                                                        <img src={imgToolingBefore} alt="Before" style={{ maxWidth: '100%', maxHeight: '250px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                                    ) : (
                                                        <div style={{ padding: '20px', background: theme.colors.surfaceHover, color: '#999' }}>No Image</div>
                                                    )}
                                                </Col>
                                                <Col span={12} style={{ textAlign: 'center' }}>
                                                    <p><b>After Change:</b></p>
                                                    {imgToolingAfter ? (
                                                        <img src={imgToolingAfter} alt="After" style={{ maxWidth: '100%', maxHeight: '250px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                                    ) : (
                                                        <div style={{ padding: '20px', background: theme.colors.surfaceHover, color: '#999' }}>No Image</div>
                                                    )}
                                                </Col>
                                            </>
                                        ) : (
                                            fieldsUploadOfTooling.map((field) => (
                                                <Col span={field.span} key={field.name}>
                                                    <Form.Item
                                                        name={field.name}
                                                        label={field.label}
                                                        rules={[{ required: field.required, message: 'Please input!' }]}
                                                        valuePropName="fileList"
                                                        getValueFromEvent={normFile}
                                                        style={{ marginBottom: 0 }}
                                                    >
                                                        {renderComponent(field)}
                                                    </Form.Item>
                                                </Col>
                                            ))
                                        )}
                                    </Row>
                                </div>
                            )}
                            {/* Dynamic Fields for Tooling/Usage Only */}
                            {change?.some(val => ["Tooling", "Usage"].includes(val)) && (
                                <div style={{ border: '1px solid #d9d9d9', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                                    <Divider orientation="left" style={{ margin: '0 0 10px 0' }}>Tooling, Usage Details</Divider>
                                    <Row gutter={[16, 8]}>
                                        {fieldsForToolUsage.map((field) => (
                                            <Col span={field.span} key={field.name}>
                                                <Form.Item name={field.name} label={field.label} rules={[{ required: field.required, message: 'Please input!' }]} style={{ marginBottom: 0 }}>
                                                    {renderComponent(field)}
                                                </Form.Item>
                                            </Col>
                                        ))}
                                    </Row>
                                </div>
                            )}

                        </Col>
                    </Row>
                </Form>
                <div style={{ textAlign: 'center' }}>
                    <Space size="middle">
                        {!isViewOnly && (
                            <Button type="primary" onClick={onSubmit} style={{ width: 100 }}>
                                Submit
                            </Button>
                        )}
                        <Button
                            type={isViewOnly ? "primary" : "default"}
                            danger={!isViewOnly}
                            onClick={onclickCancel}
                            style={{ width: 100 }}
                        >
                            {isViewOnly ? "Close" : "Cancel"}
                        </Button>
                    </Space>
                </div>
            </Modal>
        </Spin>
    );
}

export default ECRForm;