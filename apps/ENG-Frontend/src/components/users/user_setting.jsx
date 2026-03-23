import React, { useState, useEffect, useRef } from "react";
import { Form, Select, Button, Upload, Modal, Typography, message, Tag, Space } from "antd";
import { SaveOutlined, CameraOutlined, EditOutlined, UserOutlined, SettingOutlined } from "@ant-design/icons";
import { useAuthStore } from "../../stores/authStore";
import { useTheme } from "../../theme";
import { orgRpgTheme } from "../engineer/overall_eng/orgTheme";
import { useNavigate } from "react-router-dom";
import { httpClient } from "../../utils/HttpClient";
import { server, key_constance } from "../../constance/constance";

const { Title, Text } = Typography;
const { Option } = Select;

const THEME_OPTIONS = [
    { label: "Minimal (Light)", value: "minimal" },
    { label: "Bright Pink", value: "brightPink" },
    { label: "Lavender Rose", value: "lavenderRose" },
    { label: "Mint Peach", value: "mintPeach" },
    { label: "Sky Coral", value: "skyCoral" },
    { label: "Pink Pastel", value: "pinkPastel" },
    { label: "Orange Pastel", value: "orangePastel" },
    { label: "Red Pastel", value: "redPastel" },
    { label: "RPG Mode", value: "rpg" }
];

const UserSetting = () => {
    const navigate = useNavigate();
    const { userDepartment, userInfo } = useAuthStore();
    const { theme, switchTheme } = useTheme();

    const [form] = Form.useForm();
    const [previewData, setPreviewData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [editTheme, setEditTheme] = useState(false);
    const [isHoveringAvatar, setIsHoveringAvatar] = useState(false);

    // Crop State
    const [isCropModalVisible, setIsCropModalVisible] = useState(false);
    const [uploadedImage, setUploadedImage] = useState(null);
    const imageRef = useRef(null);
    const [crop, setCrop] = useState({ x: 0, y: 0, size: 200 });
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (userDepartment === "USER") {
            message.error("Access Denied: User role requires special permissions.");
            navigate("/home");
            return;
        }

        if (userInfo) {
            const initialData = {
                ...userInfo,
                u_nickname: userInfo.u_nickname || "",
                element: userInfo.element || "Light",
                theme: userInfo.theme || "minimal",
                profile_img_base64: userInfo.profile_img_base64 || null
            };
            setPreviewData(initialData);
            form.setFieldsValue(initialData);
        }
    }, [userDepartment, userInfo, form, navigate]);

    const handleValuesChange = (changedValues) => {
        setPreviewData(prev => ({ ...prev, ...changedValues }));
        if (changedValues.theme && switchTheme) {
            switchTheme(changedValues.theme, false);
        }
    };

    const getFullDepartment = (deptCode) => {
        const map = { "AD": "ADMIN", "ENG": "ENGINEER", "USER": "OTHER DEPARTMENT" };
        return map[deptCode] || deptCode;
    };

    const getThemeColors = (themeKey) => {
        const map = {
            minimal: ["#ffffff", "#f0f2f5"],
            brightPink: ["#ffadd2", "#fff0f6"],
            lavenderRose: ["#d3adf7", "#f9f0ff"],
            mintPeach: ["#b7eb8f", "#f6ffed"],
            skyCoral: ["#bae7ff", "#e6f7ff"],
            pinkPastel: ["#ffbb96", "#fff2e8"],
            orangePastel: ["#ffe7ba", "#fff7e6"],
            redPastel: ["#ffccc7", "#fff1f0"],
            rpg: ["#262626", "#141414"]
        };
        return map[themeKey] || ["#ccc", "#eee"];
    };

    // --- Image Handling ---
    const handleUpload = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            setUploadedImage(e.target.result);
            setIsCropModalVisible(true);
            setCrop({ x: 0, y: 0, size: 200 });
        };
        reader.readAsDataURL(file);
        return false;
    };

    const onCropSave = () => {
        if (!imageRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');

        const sourceImage = imageRef.current;
        const renderedWidth = sourceImage.width;
        const renderedHeight = sourceImage.height;

        const scaleX = sourceImage.naturalWidth / renderedWidth;
        const scaleY = sourceImage.naturalHeight / renderedHeight;

        ctx.drawImage(
            sourceImage,
            crop.x * scaleX, crop.y * scaleY, crop.size * scaleX, crop.size * scaleY,
            0, 0, 300, 300
        );

        const base64 = canvas.toDataURL('image/jpeg', 0.9);
        setPreviewData(prev => ({ ...prev, profile_img_base64: base64 }));
        form.setFieldsValue({ profile_img_base64: base64 });
        setIsCropModalVisible(false);
    };

    const handleMouseDown = (e) => {
        setDragging(true);
        setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y });
    };

    const handleMouseMove = (e) => {
        if (dragging) {
            const container = imageRef.current;
            if (!container) return;

            let newX = e.clientX - dragStart.x;
            let newY = e.clientY - dragStart.y;

            const maxRight = container.width - crop.size;
            const maxBottom = container.height - crop.size;

            if (newX < 0) newX = 0;
            if (newY < 0) newY = 0;
            if (newX > maxRight) newX = maxRight;
            if (newY > maxBottom) newY = maxBottom;

            setCrop(prev => ({ ...prev, x: newX, y: newY }));
        }
    };

    const handleMouseUp = () => setDragging(false);

    const handleWheel = (e) => {
        const container = imageRef.current;
        if (!container) return;

        const maxDimension = Math.min(container.width, container.height);

        setCrop(prev => {
            let newSize = prev.size;
            if (e.deltaY < 0) {
                newSize = Math.min(prev.size + 10, maxDimension);
            } else {
                newSize = Math.max(prev.size - 10, 50);
            }

            let newX = prev.x;
            let newY = prev.y;

            if (newX + newSize > container.width) newX = container.width - newSize;
            if (newY + newSize > container.height) newY = container.height - newSize;

            return { ...prev, size: newSize, x: Math.max(0, newX), y: Math.max(0, newY) };
        });
    };

    // --- API ---
    const refreshUserData = async (empno) => {
        try {
            const response = await httpClient.post(server.GET_USER_INFO, { empno });
            if (response.data.result === 'true') {
                const freshUserInfo = response.data.userInfo;
                localStorage.setItem(key_constance.USER_INFO, JSON.stringify(freshUserInfo));
                setPreviewData(prev => ({ ...prev, ...freshUserInfo }));
                form.setFieldsValue(freshUserInfo);
            }
        } catch (err) {
            console.error("Refresh Error:", err);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const payload = {
                empno: previewData.u_code,
                u_nickname: previewData.u_nickname || "",
                element: previewData.element || "Light",
                theme: previewData.theme || "minimal",
                profile_img_base64: previewData.profile_img_base64 || ""
            };

            const response = await httpClient.post(server.UPDATE_USER_PROFILE, payload);

            if (response.data.result === 'true') {
                message.success("Profile updated successfully!");
                await refreshUserData(previewData.u_code);
            } else {
                message.error("Update failed: " + response.data.message);
            }
        } catch (err) {
            console.error("Save Error:", err);
            message.error("Failed to save data.");
        } finally {
            setLoading(false);
        }
    };

    const filteredThemeOptions = THEME_OPTIONS.filter(opt => {
        if (opt.value === 'rpg') return userDepartment === 'AD';
        return true;
    });

    const isRpg = previewData?.theme === 'rpg';

    if (!previewData) return null;

    // --- ENTIRELY NEW STRUCTURAL HTML/CSS ---
    return (
        <>
            <div style={{
                width: '100%',
                // height: '100%', // Take full height of whatever parent provides
                height: 'calc(100vh-64px)',
                overflowY: 'auto', // ONLY scroll this specific container, not the body
                backgroundColor: theme.colors.background || '#f5f7fa',
                boxSizing: 'border-box',
                padding: '2rem 1rem', // Flexible padding
                fontFamily: "'Inter', sans-serif"
            }}>
                {/* Centered Content Wrapper */}
                <div style={{
                    maxWidth: '700px',
                    margin: '0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px'
                }}>

                    {/* 1. HERO HEADER (Avatar & Name) */}
                    <div style={{
                        backgroundColor: isRpg ? '#141414' : '#fff',
                        borderRadius: '24px',
                        boxShadow: isRpg ? '0 8px 24px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.05)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        border: isRpg ? '1px solid #333' : 'none'
                    }}>
                        {/* Gradient Top Half */}
                        <div style={{
                            height: '140px',
                            background: `linear-gradient(120deg, ${orgRpgTheme.elements[previewData.element]?.primary || theme.colors.primary} 0%, ${theme.colors.background} 100%)`,
                            opacity: isRpg ? 0.6 : 0.8
                        }} />

                        {/* Bottom Half & Avatar Overlap */}
                        <div style={{
                            padding: '0 32px 32px 32px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            position: 'relative'
                        }}>
                            {/* Avatar */}
                            <div style={{
                                marginTop: '-60px', /* Pulls avatar up into gradient */
                                marginBottom: '16px',
                                zIndex: 2
                            }}>
                                <Upload beforeUpload={handleUpload} showUploadList={false} accept="image/*">
                                    <div
                                        onMouseEnter={() => setIsHoveringAvatar(true)}
                                        onMouseLeave={() => setIsHoveringAvatar(false)}
                                        style={{
                                            width: '120px',
                                            height: '120px',
                                            borderRadius: '50%',
                                            backgroundColor: '#fff',
                                            padding: '4px',
                                            boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                                            cursor: 'pointer',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            transition: 'transform 0.2s'
                                        }}
                                    >
                                        <img
                                            src={previewData.profile_img_base64 || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + previewData.u_name}
                                            alt="Avatar"
                                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                        />
                                        {isHoveringAvatar && (
                                            <div style={{
                                                position: 'absolute',
                                                top: 4, left: 4, right: 4, bottom: 4,
                                                borderRadius: '50%',
                                                backgroundColor: 'rgba(0,0,0,0.5)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#fff'
                                            }}>
                                                <CameraOutlined style={{ fontSize: '24px' }} />
                                                <span style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '4px' }}>EDIT</span>
                                            </div>
                                        )}
                                    </div>
                                </Upload>
                            </div>

                            {/* Name Info */}
                            <Title level={2} style={{ margin: 0, color: isRpg ? '#fff' : '#1f1f1f' }}>
                                {previewData.u_name || previewData.u_nickname}
                            </Title>
                            <Text style={{ fontSize: '16px', color: isRpg ? '#aaa' : '#666', marginBottom: '16px' }}>
                                {previewData.position}
                            </Text>

                            <Tag color={orgRpgTheme.elements[previewData.element]?.primary || "blue"} style={{ borderRadius: '16px', padding: '4px 16px', fontSize: '14px', border: 'none', fontWeight: 600 }}>
                                {previewData.element} Core
                            </Tag>
                        </div>
                    </div>

                    {/* 2. FORM CONFIGURATION */}
                    <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>

                        {/* Identity Plate */}
                        <div style={{
                            backgroundColor: isRpg ? '#141414' : '#fff',
                            borderRadius: '24px',
                            padding: '32px',
                            boxShadow: isRpg ? '0 8px 24px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.05)',
                            border: isRpg ? '1px solid #333' : 'none',
                            marginBottom: '24px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                                <UserOutlined style={{ fontSize: '20px', color: theme.colors.primary }} />
                                <Title level={4} style={{ margin: 0, color: isRpg ? '#eee' : '#1f1f1f' }}>Identity Base</Title>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Nickname Row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: isRpg ? '1px solid #333' : '1px solid #f0f0f0' }}>
                                    <Text style={{ color: isRpg ? '#aaa' : '#666', fontSize: '15px' }}>Assigned Nickname</Text>
                                    <Text strong style={{ fontSize: '16px', color: isRpg ? '#fff' : '#1f1f1f' }}>{previewData.u_nickname || "Not Set"}</Text>
                                </div>

                                {/* Department Row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: isRpg ? '1px solid #333' : '1px solid #f0f0f0' }}>
                                    <Text style={{ color: isRpg ? '#aaa' : '#666', fontSize: '15px' }}>Department</Text>
                                    <Tag color={isRpg ? 'purple' : 'geekblue'} style={{ fontSize: '14px', padding: '2px 10px', borderRadius: '8px', margin: 0 }}>
                                        {getFullDepartment(previewData.u_department)}
                                    </Tag>
                                </div>

                                {/* Element Row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ color: isRpg ? '#aaa' : '#666', fontSize: '15px' }}>Elemental Affinity</Text>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: orgRpgTheme.elements[previewData.element]?.primary }}></div>
                                        <Text strong style={{ fontSize: '16px', color: isRpg ? '#fff' : '#1f1f1f' }}>{previewData.element}</Text>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* System Plate */}
                        <div style={{
                            backgroundColor: isRpg ? '#141414' : '#fff',
                            borderRadius: '24px',
                            padding: '32px',
                            boxShadow: isRpg ? '0 8px 24px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.05)',
                            border: isRpg ? '1px solid #333' : 'none',
                            marginBottom: '32px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                                <SettingOutlined style={{ fontSize: '20px', color: theme.colors.primary }} />
                                <Title level={4} style={{ margin: 0, color: isRpg ? '#eee' : '#1f1f1f' }}>Interface Config</Title>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <Text strong style={{ fontSize: '16px', display: 'block', color: isRpg ? '#fff' : '#1f1f1f' }}>Display Theme</Text>
                                    <Text style={{ color: isRpg ? '#888' : '#888', fontSize: '13px' }}>Adjust application colors</Text>
                                </div>

                                <div>
                                    {!editTheme ? (
                                        <Button
                                            type="default"
                                            onClick={() => setEditTheme(true)}
                                            style={{
                                                borderRadius: '12px',
                                                padding: '8px 20px',
                                                height: 'auto',
                                                backgroundColor: isRpg ? '#262626' : '#f5f7fa',
                                                borderColor: isRpg ? '#444' : '#e4e7eb',
                                                color: isRpg ? '#fff' : '#333'
                                            }}
                                        >
                                            <Space>
                                                {THEME_OPTIONS.find(o => o.value === previewData.theme)?.label || previewData.theme}
                                                <EditOutlined style={{ color: '#888' }} />
                                            </Space>
                                        </Button>
                                    ) : (
                                        <Space>
                                            <Form.Item name="theme" noStyle>
                                                <Select
                                                    style={{ width: 220 }}
                                                    size="large"
                                                    defaultOpen
                                                    onChange={(val) => {
                                                        form.setFieldsValue({ theme: val });
                                                        handleValuesChange({ theme: val });
                                                        setEditTheme(false);
                                                    }}
                                                >
                                                    {filteredThemeOptions.map(opt => {
                                                        const colors = getThemeColors(opt.value);
                                                        return (
                                                            <Option key={opt.value} value={opt.value} label={opt.label}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                    <div style={{ display: 'flex', gap: 2 }}>
                                                                        <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: colors[0], border: '1px solid rgba(0,0,0,0.1)' }} />
                                                                        <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: colors[1], border: '1px solid rgba(0,0,0,0.1)' }} />
                                                                    </div>
                                                                    <span style={{ fontWeight: 500 }}>{opt.label}</span>
                                                                </div>
                                                            </Option>
                                                        );
                                                    })}
                                                </Select>
                                            </Form.Item>
                                            <Form.Item shouldUpdate={(prev, curr) => prev.theme !== curr.theme} noStyle>{() => null}</Form.Item>
                                        </Space>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Action */}
                        <Button
                            type="primary"
                            size="large"
                            onClick={handleSave}
                            loading={loading}
                            icon={<SaveOutlined />}
                            style={{
                                width: '100%',
                                height: '56px',
                                borderRadius: '16px',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                boxShadow: isRpg ? '0 4px 12px rgba(0,0,0,0.8)' : `0 8px 16px ${theme.colors.primary}40`,
                            }}
                        >
                            Save Configuration
                        </Button>
                    </Form>
                </div>

                {/* Crop Modal */}
                <Modal
                    title="Reposition Avatar"
                    open={isCropModalVisible}
                    onOk={onCropSave}
                    onCancel={() => setIsCropModalVisible(false)}
                    width={600}
                    centered
                    okText="Crop Image"
                    bodyStyle={{ padding: 0 }}
                >
                    <div
                        style={{
                            width: '100%',
                            height: '400px',
                            background: '#111',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            overflow: 'hidden',
                            position: 'relative',
                            userSelect: 'none'
                        }}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        {uploadedImage && (
                            <div style={{ position: 'relative' }}>
                                <img ref={imageRef} src={uploadedImage} alt="Crop" style={{ maxHeight: '400px', maxWidth: '100%', opacity: 0.7 }} draggable={false} />
                                {/* Circle Mask */}
                                <div
                                    onMouseDown={handleMouseDown}
                                    onWheel={handleWheel}
                                    style={{
                                        position: 'absolute',
                                        top: crop.y,
                                        left: crop.x,
                                        width: crop.size,
                                        height: crop.size,
                                        border: '2px solid #fff',
                                        borderRadius: '50%',
                                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)',
                                        cursor: 'move',
                                        zIndex: 10
                                    }}
                                >
                                    <div style={{
                                        position: 'absolute', bottom: -24, left: '50%', transform: 'translateX(-50%)',
                                        color: '#fff', fontSize: '12px', background: 'rgba(0,0,0,0.8)', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap'
                                    }}>
                                        Scroll to Zoom
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            </div>
        </>
    );
};

export default UserSetting;
