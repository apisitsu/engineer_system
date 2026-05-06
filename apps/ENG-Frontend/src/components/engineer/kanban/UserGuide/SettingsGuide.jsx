/**
 * SettingsGuide.jsx — Guide for Board & Project Settings drawers.
 */
import React, { useState } from 'react';
import { Typography, Input, Select, Switch, Button, Tag, Avatar, Divider, Space, InputNumber } from 'antd';
import { IoSettingsOutline, IoArchiveOutline, IoTrashOutline } from 'react-icons/io5';
import { AiOutlineEdit, AiOutlineDelete, AiOutlineBgColors } from 'react-icons/ai';
import { FiEdit2 } from 'react-icons/fi';
import { MdOutlinePeople, MdOutlineLabel } from 'react-icons/md';
import { getSectionCardStyle, getSandboxStyle, SandboxDot, SectionTitle, SectionLabel, StepRow, Callout, LabeledDivider } from './guideStyles';
import { MOCK_LABELS, MOCK_BOARD_MEMBERS, MOCK_PROJECT_MANAGERS, MOCK_USERS, LABEL_PALETTE } from './mockData';

const { Text } = Typography;

const SettingsGuide = ({ theme }) => {
    const [boardName, setBoardName] = useState('Phase 1: Design & FEA');
    const [boardBg, setBoardBg] = useState('#0079bf');
    const [boardPrivate, setBoardPrivate] = useState(false);
    const [allowAddCard, setAllowAddCard] = useState(true);
    const [allowAddList, setAllowAddList] = useState(true);
    const [labels, setLabels] = useState(MOCK_LABELS.slice(0, 4).map(l => ({ ...l })));
    const [newLabelName, setNewLabelName] = useState('');
    const [newLabelColor, setNewLabelColor] = useState('#ef5350');
    const [projectName, setProjectName] = useState('Swage Tool Redesign');
    const [projectStatus, setProjectStatus] = useState('active');
    const [enableLimit, setEnableLimit] = useState(true);
    const [limitCount, setLimitCount] = useState(10);

    const SOLID_BGS = ['#0079bf', '#d29034', '#519839', '#b04632', '#89609e', '#cd5a91', '#4bbf6b', '#00aecc'];

    const addLabel = () => {
        if (!newLabelName.trim()) return;
        setLabels(prev => [...prev, { id: Date.now(), name: newLabelName.trim(), color: newLabelColor }]);
        setNewLabelName('');
    };

    const removeLabel = (id) => setLabels(prev => prev.filter(l => l.id !== id));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* ═══ Board Settings ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<IoSettingsOutline />} title="Board Settings Drawer" subtitle="Opened via the ⚙️ gear icon on the Board Toolbar. Contains all board-level configuration." theme={theme} />

                {/* Board Info */}
                <LabeledDivider label="Board Information" theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 400 }}>
                        <div>
                            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Board Name</Text>
                            <Input value={boardName} onChange={e => setBoardName(e.target.value)} style={{ borderRadius: 6 }} />
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ flex: 1 }}>
                                <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Status</Text>
                                <Select value="active" style={{ width: '100%' }}
                                    options={[{ label: 'Pool', value: 'pool' }, { label: 'Active', value: 'active' }, { label: 'Finished', value: 'finished' }]} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Priority</Text>
                                <Select value="HIGH" style={{ width: '100%' }}
                                    options={[{ label: 'Low', value: 'LOW' }, { label: 'Medium', value: 'MEDIUM' }, { label: 'High', value: 'HIGH' }]} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Background */}
                <LabeledDivider label="Background" theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <Text style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>Select a solid color for the board background:</Text>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {SOLID_BGS.map(c => (
                            <div key={c} onClick={() => setBoardBg(c)} style={{
                                width: 40, height: 28, borderRadius: 6, background: c, cursor: 'pointer',
                                border: boardBg === c ? '2px solid #333' : '2px solid transparent',
                            }} />
                        ))}
                    </div>
                    <div style={{ height: 40, borderRadius: 8, background: boardBg, marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600 }}>
                        Preview: {boardName}
                    </div>
                </div>

                {/* Labels Manager */}
                <LabeledDivider label="Labels" theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    {labels.map(l => (
                        <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <div style={{ flex: 1, height: 30, background: l.color, borderRadius: 6, display: 'flex', alignItems: 'center', padding: '0 10px', color: '#fff', fontSize: 12, fontWeight: 600 }}>{l.name}</div>
                            <Button type="text" size="small" icon={<AiOutlineEdit size={13} />} />
                            <Button type="text" size="small" danger icon={<AiOutlineDelete size={13} />} onClick={() => removeLabel(l.id)} />
                        </div>
                    ))}
                    <Divider style={{ margin: '10px 0' }} />
                    <div style={{ padding: 12, background: theme.colors.surfaceHover, borderRadius: 8 }}>
                        <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>Create Label</Text>
                        <Input placeholder="Label name" size="small" value={newLabelName} onChange={e => setNewLabelName(e.target.value)} style={{ marginBottom: 8, borderRadius: 4 }} />
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                            {LABEL_PALETTE.slice(0, 10).map(c => (
                                <div key={c} onClick={() => setNewLabelColor(c)} style={{ width: 20, height: 20, borderRadius: 4, background: c, cursor: 'pointer', border: newLabelColor === c ? '2px solid #333' : '2px solid transparent' }} />
                            ))}
                        </div>
                        <Button type="primary" size="small" block onClick={addLabel} disabled={!newLabelName.trim()}
                            style={{ background: theme.colors.primary, borderRadius: 4 }}>Add Label</Button>
                    </div>
                </div>

                {/* Permissions */}
                <LabeledDivider label="Permissions" theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    {[
                        { title: 'Allow Adding Cards', desc: 'Members can create new task cards', checked: allowAddCard, onChange: setAllowAddCard },
                        { title: 'Allow Adding Lists', desc: 'Members can create new columns', checked: allowAddList, onChange: setAllowAddList },
                        { title: 'Private Board', desc: 'Only assigned board members can view', checked: boardPrivate, onChange: setBoardPrivate },
                    ].map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 2 ? `1px solid ${theme.colors.border}22` : 'none' }}>
                            <div>
                                <Text strong style={{ fontSize: 13 }}>{item.title}</Text>
                                <br /><Text type="secondary" style={{ fontSize: 11 }}>{item.desc}</Text>
                            </div>
                            <Switch checked={item.checked} onChange={item.onChange} />
                        </div>
                    ))}
                </div>

                {/* Archived Items */}
                <LabeledDivider label="Archived Items" theme={theme} />
                <Callout type="info" theme={theme}>
                    View and restore archived cards and lists. Archived items are hidden from the board but preserved for reporting.
                    Click "Restore" to bring an item back to its original list.
                </Callout>

                {/* Danger Zone */}
                <LabeledDivider label="Danger Zone" theme={theme} />
                <Callout type="danger" title="Delete Board" theme={theme}>
                    Permanently removes the board and ALL its lists and cards. This action cannot be undone. Only project Owners can perform this.
                </Callout>
            </div>

            {/* ═══ Project Settings ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<FiEdit2 />} title="Project Settings Drawer" subtitle="Opened via the ✏️ pencil icon next to the project name. Available to project Owners only." theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{ maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Project Name</Text>
                            <Input value={projectName} onChange={e => setProjectName(e.target.value)} style={{ borderRadius: 6 }} />
                        </div>
                        <div>
                            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Status</Text>
                            <Select value={projectStatus} onChange={setProjectStatus} style={{ width: '100%' }}
                                options={[{ label: 'Active', value: 'active' }, { label: 'Waiting', value: 'waiting' }, { label: 'Suspended', value: 'suspended' }, { label: 'Completed', value: 'completed' }]} />
                        </div>
                    </div>
                </div>
                <StepRow number={1} title="Name & Description" description="Edit the project title and add a detailed description." theme={theme} />
                <StepRow number={2} title="Icon & Gradient" description="Customize the visual identity with an icon and color gradient." theme={theme} />
                <StepRow number={3} title="Privacy" description="Toggle between Public (visible to all) and Private (members-only)." theme={theme} />
                <StepRow number={4} title="Status Management" description="Change lifecycle status: Active → Waiting → Suspended → Completed." theme={theme} />
                <StepRow number={5} title="Member Management" description="Add/remove project members and assign roles (Owner, Editor, Viewer)." theme={theme} />
            </div>

            {/* ═══ Admin Settings ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon="🛡️" title="System Admin Settings" subtitle="Global settings managed by system administrators." theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div>
                            <Text strong style={{ fontSize: 13 }}>Enable List Card Limit</Text>
                            <br /><Text type="secondary" style={{ fontSize: 11 }}>Cap the number of visible cards per list</Text>
                        </div>
                        <Switch checked={enableLimit} onChange={setEnableLimit} />
                    </div>
                    {enableLimit && (
                        <div>
                            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Default Card Limit</Text>
                            <InputNumber min={5} max={50} value={limitCount} onChange={setLimitCount} style={{ width: '100%' }} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsGuide;
