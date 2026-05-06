/**
 * CardSidebar.jsx
 * 
 * Extracted from CardDetailDrawer (F3-05) — renders the right sidebar:
 *   - Membership (Join/Leave/Members list)
 *   - Add to Card (Labels, Members, Due Date, Priority, Est Hours, Checklist, Issue, Memo, Attach)
 *   - Visibility (Private toggle)
 *   - Actions (Dependency, Move, Duplicate, Archive, Delete)
 *   - Suspend toggle
 */

import React from 'react';
import { Typography, Space, Divider, Button, Input, Select, DatePicker, Avatar, Popconfirm, Tooltip, Switch, message } from 'antd';
import { useCardDetailState } from './useCardDetailState';
import { useKanbanStore } from '../store/kanbanStore';
import Swal from 'sweetalert2';
import dayjs from 'dayjs';

import { MdOutlinePeople, MdOutlineOutput, MdAccessTime, MdLowPriority, MdOutlineTimer, MdOutlineSubtitles, MdOutlineDescription } from 'react-icons/md';
import { FaCheckSquare } from 'react-icons/fa';
import { FiUpload } from 'react-icons/fi';
import { IoSearchOutline, IoArchiveOutline } from 'react-icons/io5';
import { AiOutlineDelete, AiOutlineTags, AiOutlineCopy, AiOutlineCheck } from 'react-icons/ai';
import { BiMove, BiLinkExternal } from 'react-icons/bi';
import { BsCheckSquare } from 'react-icons/bs';
import ChecklistTemplateSelectorModal from './ChecklistTemplateSelectorModal';
import LabelTemplateSelectorModal from '../Board/LabelTemplateSelectorModal';
import CardTemplateFormModal from '../Tabs/components/CardTemplateFormModal';
import { IoSaveOutline } from 'react-icons/io5';

const { Text } = Typography;

const LABEL_COLORS = [
    '#ef5350', '#ec407a', '#ab47bc', '#7e57c2', '#5c6bc0',
    '#42a5f5', '#29b6f6', '#26c6da', '#26a69a', '#66bb6a',
    '#9ccc65', '#d4e157', '#ffee58', '#ffca28', '#ffa726',
    '#ff7043', '#8d6e63', '#78909c', '#546e7a', '#37474f',
];

const SidebarButton = ({ icon, label, onClick, active, theme, customColor }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const baseColor = customColor || theme.colors.primary;
    return (
        <Button block onClick={onClick}
            onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
            style={{
                textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                height: 36, borderRadius: theme.borderRadius.sm,
                background: active ? `${baseColor}25` : (isHovered ? theme.colors.surfaceHover : 'transparent'),
                border: `1px solid ${active ? `${baseColor}40` : (isHovered ? `${baseColor}20` : 'transparent')}`,
                color: (active || isHovered) ? baseColor : theme.colors.textPrimary,
                fontWeight: theme.typography.fontWeight.normal, fontSize: theme.typography.fontSize.sm,
                transition: `all ${theme.transitions.fast}`, cursor: 'pointer'
            }}>
            {icon}{label}
        </Button>
    );
};

const CardSidebar = () => {
    const ctx = useCardDetailState();
    const {
        card, theme, empNo, currentUserCode, closeCardDetail,
        isReadOnly, baseIsReadOnly, isEffectivelySuspended,
        canManageCard, canEditCard, isCardMember, canEditBoard,
        canEditEstimatedHours,
        cardMembers, activeBoardMembers, users, labels,
        cardLabelIds, handleToggleLabel,
        showLabelPicker, setShowLabelPicker,
        isCreatingLabel, setIsCreatingLabel, newLabelName, setNewLabelName, newLabelColor, setNewLabelColor, createLabel,
        showMemberPicker, setShowMemberPicker, memberSearch, setMemberSearch,
        addCardMember, removeCardMember,
        showDueDatePicker, setShowDueDatePicker, handleSetDueDate,
        showPrioritySelect, setShowPrioritySelect,
        showEstimatedHours, setShowEstimatedHours, editEstimatedHours, setEditEstimatedHours, handleSaveEstimatedHours,
        showAddTaskList, setShowAddTaskList, newTaskListName, setNewTaskListName, handleAddTaskList,
        showProblemSection, setShowProblemSection, setEditingIssueId,
        showMemoSection, setShowMemoSection, setIsEditingMemo,
        fileInputRef, isUploadingFile, handleFileUpload,
        showLinkAttach, setShowLinkAttach, linkUrl, setLinkUrl, linkName, setLinkName,
        addLinkAttachment,
        showDependencySelect, setShowDependencySelect,
        showMoveSelect, setShowMoveSelect, visibleLists, handleMoveCard, cards,
        editSuspendReason, setEditSuspendReason, updateCard,
    } = ctx;

    const [showChecklistTemplateModal, setShowChecklistTemplateModal] = React.useState(false);
    const [showLabelTemplateModal, setShowLabelTemplateModal] = React.useState(false);
    const [showSaveCardTemplate, setShowSaveCardTemplate] = React.useState(false);

    if (!card) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md, }}>
            {/* ─── Membership ─── */}
            <div style={{ marginBottom: theme.spacing.lg }}>
                <Text
                    strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: theme.colors.textTertiary, display: 'block', marginBottom: 8 }}>
                    Membership {isCardMember ? "(Joined)" : ""}
                </Text>
                <SidebarButton
                    icon={isCardMember ? <MdOutlineOutput size={16} /> : <MdOutlinePeople size={16} />}
                    label={isCardMember ? "Leave" : "Join"}
                    onClick={async () => {
                        try {
                            if (isCardMember) {
                                await removeCardMember(card.id, currentUserCode);
                            } else {
                                await addCardMember(card.id, currentUserCode, empNo);
                                message.success('You have joined this card');
                            }
                        } catch (err) {
                            console.error('[CardSidebar] Membership toggle failed:', err);
                        }
                    }}
                    theme={theme}
                    active={true}
                    customColor={isCardMember ? theme.colors.error : theme.colors.success}
                />
            </div>

            {/* ─── Add To Card ─── */}
            {!isReadOnly && (
                <div style={{ marginBottom: theme.spacing.lg }}>
                    <Text strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: theme.colors.textTertiary, display: 'block', marginBottom: 8 }}>
                        Add To Card
                    </Text>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {/* Labels */}
                        <SidebarButton icon={<AiOutlineTags size={16} />} label="Labels" active={showLabelPicker}
                            onClick={() => setShowLabelPicker(!showLabelPicker)} theme={theme} />
                        {showLabelPicker && (
                            <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, padding: theme.spacing.sm }}>
                                {(labels || []).map(label => {
                                    const isSelected = cardLabelIds.includes(String(label.id));
                                    return (
                                        <div key={label.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer', borderRadius: theme.borderRadius.sm, background: isSelected ? `${theme.colors.primary}10` : 'transparent', transition: 'background 0.2s' }}
                                            onClick={() => handleToggleLabel(label.id)}
                                            onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.background = theme.colors.surfaceHover; }}
                                            onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
                                            <div style={{
                                                width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                                                border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
                                                background: isSelected ? theme.colors.primary : 'transparent',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                {isSelected && <AiOutlineCheck size={12} color="#fff" strokeWidth={1} />}
                                            </div>
                                            <span style={{
                                                fontSize: 12, fontWeight: 500, color: '#fff',
                                                background: label.color, borderRadius: 12,
                                                padding: '2px 10px', display: 'inline-block'
                                            }}>
                                                {label.name || 'Unnamed'}
                                            </span>
                                        </div>
                                    );
                                })}
                                <Divider style={{ margin: '8px 0' }} />
                                {isCreatingLabel ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <Input placeholder="Label name" size="small" value={newLabelName}
                                            onChange={(e) => setNewLabelName(e.target.value)} style={{ borderRadius: theme.borderRadius.sm }} />
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {LABEL_COLORS.map(c => (
                                                <div key={c} onClick={() => setNewLabelColor(c)}
                                                    style={{ width: 20, height: 20, borderRadius: 4, background: c, cursor: 'pointer', border: newLabelColor === c ? '2px solid #333' : '2px solid transparent' }} />
                                            ))}
                                        </div>
                                        <Button size="small" type="primary" disabled={!newLabelName.trim()}
                                            onClick={async () => { try { await createLabel({ name: newLabelName.trim(), color: newLabelColor }); } catch (err) { console.error('[CardSidebar] Create label failed:', err); } setIsCreatingLabel(false); setNewLabelName(''); }}
                                            style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}>Create</Button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <Button size="small" type="dashed" block onClick={() => setIsCreatingLabel(true)}
                                            style={{ borderRadius: theme.borderRadius.sm }}>Create New Label</Button>
                                        <Button size="small" type="dashed" block icon={<AiOutlineTags size={12} />}
                                            onClick={() => setShowLabelTemplateModal(true)}
                                            style={{ borderRadius: theme.borderRadius.sm, fontSize: 12 }}>
                                            From Label Template
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Members */}
                        <SidebarButton icon={<MdOutlinePeople size={16} />} label="Members" active={showMemberPicker}
                            onClick={() => setShowMemberPicker(!showMemberPicker)} theme={theme} />
                        {showMemberPicker && (
                            <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, padding: theme.spacing.sm }}>
                                <Input prefix={<IoSearchOutline size={14} />} placeholder="Search members..." size="small" value={memberSearch}
                                    onChange={(e) => setMemberSearch(e.target.value)} style={{ marginBottom: 8, borderRadius: theme.borderRadius.sm }} />
                                <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                                    {(activeBoardMembers || [])
                                        .filter(m => {
                                            const u = users.find(u2 => u2.u_code === m.u_code);
                                            const name = u?.u_name || u?.u_nickname || m.u_code || '';
                                            return name.toLowerCase().includes(memberSearch.toLowerCase());
                                        })
                                        .map(m => {
                                            const u = users.find(u2 => u2.u_code === m.u_code);
                                            const alreadyMember = cardMembers.some(cm => cm.u_code === m.u_code);
                                            return (
                                                <div key={m.u_code} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}
                                                    onClick={() => alreadyMember ? removeCardMember(card.id, m.u_code) : addCardMember(card.id, m.u_code, empNo)}>
                                                    {u?.profile_img_b64 ? (
                                                        <Avatar size={24} src={u.profile_img_b64} style={{ border: `1px solid ${theme.colors.border}` }} />
                                                    ) : (
                                                        <Avatar size={24} style={{ background: theme.colors.primary, fontSize: 10, fontWeight: 700 }}>
                                                            {(u?.u_name || m.u_code || '?').charAt(0).toUpperCase()}
                                                        </Avatar>
                                                    )}
                                                    <Text style={{ fontSize: 13, flex: 1 }}>{u?.u_name || u?.u_nickname || m.u_code}</Text>
                                                    {alreadyMember && <AiOutlineCheck size={14} color={theme.colors.primary} />}
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {/* Due Date */}
                        <SidebarButton icon={<MdAccessTime size={16} />} label="Due Date" active={showDueDatePicker}
                            onClick={() => setShowDueDatePicker(!showDueDatePicker)} theme={theme} />
                        {showDueDatePicker && (
                            <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, padding: theme.spacing.sm, marginTop: 4 }}>
                                <DatePicker style={{ width: '100%', borderRadius: theme.borderRadius.sm }} size="small"
                                    value={card.due_date ? dayjs(card.due_date) : null}
                                    onChange={handleSetDueDate} />
                                {card.due_date && (<Button size="small" type="text" danger style={{ marginTop: 4, fontSize: 12 }}
                                    onClick={() => handleSetDueDate(null)}>Remove Due Date</Button>)}
                            </div>
                        )}

                        {/* Priority */}
                        <SidebarButton icon={<MdLowPriority size={16} />} label="Priority" active={showPrioritySelect}
                            onClick={() => setShowPrioritySelect(!showPrioritySelect)} theme={theme} />
                        {showPrioritySelect && (
                            <Select value={card.priority || 'medium'} size="small" style={{ width: '100%' }}
                                onChange={(val) => updateCard(card.id, { priority: val })} disabled={isEffectivelySuspended}
                                options={[{ label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' }, { label: 'High', value: 'high' }]} />
                        )}

                        {/* Estimated Hours */}
                        {canEditEstimatedHours && (
                            <>
                                <SidebarButton icon={<MdOutlineTimer size={14} />} label="Estimated Hours" active={showEstimatedHours}
                                    onClick={() => setShowEstimatedHours(!showEstimatedHours)} theme={theme} />
                                {showEstimatedHours && (
                                    <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, padding: theme.spacing.sm, marginTop: 4 }}>
                                        <Input type="number" placeholder="0.0" step="0.5" min="0" value={editEstimatedHours}
                                            onChange={(e) => setEditEstimatedHours(e.target.value)} onBlur={handleSaveEstimatedHours} onPressEnter={handleSaveEstimatedHours}
                                            prefix={<MdOutlineTimer size={14} color={theme.colors.textTertiary} />}
                                            style={{ borderRadius: theme.borderRadius.sm, width: '100%' }} size="small" disabled={isReadOnly} />
                                    </div>
                                )}
                            </>
                        )}

                        {/* Checklist */}
                        <SidebarButton icon={<FaCheckSquare size={14} />} label="Checklist" active={showAddTaskList}
                            onClick={() => setShowAddTaskList(!showAddTaskList)} theme={theme} />
                        {showAddTaskList && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <Input placeholder="Checklist name" size="small" value={newTaskListName}
                                        onChange={(e) => setNewTaskListName(e.target.value)} onPressEnter={handleAddTaskList}
                                        style={{ borderRadius: theme.borderRadius.sm }} />
                                    <Button size="small" type="primary" onClick={handleAddTaskList}
                                        style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}>Add</Button>
                                </div>
                                <Button size="small" type="dashed" icon={<BsCheckSquare size={12} />}
                                    onClick={() => setShowChecklistTemplateModal(true)}
                                    style={{ borderRadius: theme.borderRadius.sm, fontSize: 12 }}>
                                    From Template
                                </Button>
                            </div>
                        )}

                        {/* Add Issue */}
                        {!showProblemSection && (
                            <SidebarButton icon={<MdOutlineSubtitles size={16} />} label="Add Issue" active={false}
                                onClick={() => { setShowProblemSection(true); setEditingIssueId('new'); }} theme={theme} />
                        )}

                        {/* Memo */}
                        {!showMemoSection && (
                            <SidebarButton icon={<MdOutlineDescription size={16} />} label="Memo" active={false}
                                onClick={() => { setShowMemoSection(true); setIsEditingMemo(true); }} theme={theme} />
                        )}

                        {/* Attach File */}
                        <SidebarButton icon={<FiUpload size={16} />} label="Attach File" active={false}
                            onClick={() => fileInputRef.current?.click()} theme={theme} />
                        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
                        {isUploadingFile && (<Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>Uploading...</Text>)}

                        {/* Attach Link */}
                        <SidebarButton icon={<BiLinkExternal size={16} />} label="Attach Link" active={showLinkAttach}
                            onClick={() => setShowLinkAttach(!showLinkAttach)} theme={theme} />
                        {showLinkAttach && (
                            <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, padding: theme.spacing.sm, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <Input placeholder="https://..." size="small" value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)} style={{ borderRadius: theme.borderRadius.sm }} />
                                <Input placeholder="Link name (optional)" size="small" value={linkName}
                                    onChange={(e) => setLinkName(e.target.value)} style={{ borderRadius: theme.borderRadius.sm }} />
                                <Button size="small" type="primary" disabled={!linkUrl.trim()}
                                    onClick={async () => {
                                        let url = linkUrl.trim(); if (!url) return;
                                        if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'")))
                                            url = url.substring(1, url.length - 1).trim();
                                        const urlPattern = /^(?:https?:\/\/[\w\d-]+(?:\.[\w\d-]+)*(?::\d+)?(?:\/.*)?|(?:[\w\d-]+\.)+[\w\d]{2,}(?::\d+)?(?:\/.*)?|[\w\d-]+:\d+(?:\/.*)?)$/i;
                                        const localPathPattern = /^[a-zA-Z]:[\\\/]|^\\\\[^\/\\]+/;
                                        if (!urlPattern.test(url) && !localPathPattern.test(url)) {
                                            Swal.fire('Error', 'Invalid link format. Must be a URL or a direct file path (e.g. H:\\...)', 'error'); return;
                                        }
                                        let finalUrl = url;
                                        if (urlPattern.test(url) && !/^https?:\/\//i.test(finalUrl) && !localPathPattern.test(finalUrl))
                                            finalUrl = 'http://' + finalUrl;
                                        await addLinkAttachment(card.id, finalUrl, linkName.trim());
                                        setLinkUrl(''); setLinkName(''); setShowLinkAttach(false);
                                    }}
                                    style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}>
                                    Attach
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Visibility ─── */}
            {canManageCard && (
                <div style={{ marginBottom: theme.spacing.lg }}>
                    <Text strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: theme.colors.textTertiary, display: 'block', marginBottom: 8 }}>Visibility</Text>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, padding: '8px 12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <Text strong style={{ fontSize: 13, lineHeight: '1.2' }}>Private Card</Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>Only explicit members</Text>
                        </div>
                        <Switch size="small" checked={card.is_private} onChange={(val) => updateCard(card.id, { is_private: val })} />
                    </div>
                </div>
            )}

            <Divider style={{ margin: `${theme.spacing.sm} 0` }} />

            {/* ─── Actions ─── */}
            {!baseIsReadOnly && (
                <div style={{ marginBottom: theme.spacing.lg }}>
                    <Text strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: theme.colors.textTertiary, display: 'block', marginBottom: 8 }}>Actions</Text>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {/* Dependency */}
                        <SidebarButton icon={<BiLinkExternal size={16} />} label="Dependency" active={showDependencySelect}
                            onClick={() => setShowDependencySelect(!showDependencySelect)} theme={theme} />
                        {showDependencySelect && (
                            <div style={{ marginTop: 4, marginBottom: 8, background: theme.colors.surface, padding: theme.spacing.sm, borderRadius: theme.borderRadius.md, border: `1px solid ${theme.colors.border}` }}>
                                <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginBottom: 4, display: 'block' }}>Select Parent Card</Text>
                                <Select allowClear showSearch placeholder="Search for a parent..." style={{ width: '100%' }}
                                    value={card.parent_id ? String(card.parent_id) : null}
                                    onChange={async (val) => { try { await updateCard(card.id, { parent_id: val || null }); message.success('Dependency updated'); } catch (err) { console.error('[CardSidebar] Dependency update failed:', err); } }}
                                    filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                    options={Object.values(cards || {}).flat().filter(c => String(c.id) !== String(card.id)).map(c => ({ label: c.name, value: String(c.id) }))}
                                    disabled={isEffectivelySuspended} />
                            </div>
                        )}

                        {/* Move */}
                        <SidebarButton icon={<BiMove size={16} />} label="Move" active={showMoveSelect}
                            onClick={() => setShowMoveSelect(!showMoveSelect)} theme={theme} />
                        {showMoveSelect && (
                            <Select placeholder="Move to list..." style={{ width: '100%' }} onChange={handleMoveCard}
                                options={visibleLists.filter(l => String(l.id) !== String(card.list_id)).map(l => ({ label: l.name, value: l.id }))} />
                        )}

                        {/* Duplicate */}
                        {canEditBoard && (
                            <SidebarButton icon={<AiOutlineCopy size={16} />} label="Duplicate"
                                onClick={async () => { try { await useKanbanStore.getState().duplicateCard(card.id, card.list_id); closeCardDetail(); } catch (err) { console.error('[CardSidebar] Duplicate failed:', err); } }} theme={theme} />
                        )}

                        {canManageCard && ctx.canManageTemplates && (
                            <SidebarButton 
                                icon={<IoSaveOutline size={16} />} 
                                label="Save as Template" 
                                onClick={() => setShowSaveCardTemplate(true)} 
                                theme={theme} 
                            />
                        )}

                        <SidebarButton icon={<BiLinkExternal size={16} />} label="Copy Link"
                            onClick={() => { 
                                const link = `${window.location.origin}/eng/kanban?board=${card.board_id}&card=${card.id}`;
                                if (navigator.clipboard && navigator.clipboard.writeText) {
                                    navigator.clipboard.writeText(link).then(() => message.success('Link copied!'));
                                } else {
                                    const textArea = document.createElement("textarea");
                                    textArea.value = link;
                                    document.body.appendChild(textArea);
                                    textArea.focus();
                                    textArea.select();
                                    try {
                                        document.execCommand('copy');
                                        message.success('Link copied!');
                                    } catch (err) {
                                        console.error('Fallback: Oops, unable to copy', err);
                                        message.error('Failed to copy link');
                                    }
                                    document.body.removeChild(textArea);
                                }
                            }}
                            theme={theme} />

                        {/* Archive */}
                        <Popconfirm title="Archive this card?" description="Card will be hidden from the board."
                            onConfirm={async () => { try { await useKanbanStore.getState().archiveCard(card.id); closeCardDetail(); } catch (err) { console.error('[CardSidebar] Archive failed:', err); } }}
                            okText="Archive" cancelText="Cancel">
                            {/* <Button block style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, height: 36, borderRadius: theme.borderRadius.sm, background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, color: theme.colors.textPrimary }}> */}
                            <Button block style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, height: 36, borderRadius: theme.borderRadius.sm }}>
                                <IoArchiveOutline size={16} />Archive
                            </Button>
                        </Popconfirm>

                        {/* Delete */}
                        {canManageCard && (
                            <Popconfirm title="Delete this card?" description="This action cannot be undone."
                                onConfirm={async () => { await ctx.handleDeleteCard(); closeCardDetail(); }}
                                okText="Delete" okType="danger" cancelText="Cancel">
                                <Button block danger style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, height: 36, borderRadius: theme.borderRadius.sm }}>
                                    <AiOutlineDelete size={16} />Delete Card
                                </Button>
                            </Popconfirm>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Suspend ─── */}
            {canManageCard && (
                <div style={{ marginBottom: theme.spacing.lg }}>
                    <Text strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: theme.colors.textTertiary, display: 'block', marginBottom: 8 }}>Card Status</Text>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: card.is_suspended ? '#fff1f0' : theme.colors.surface, border: `1px solid ${card.is_suspended ? '#ffa39e' : theme.colors.border}`, borderRadius: theme.borderRadius.md, padding: '8px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <Text strong style={{ fontSize: 13, lineHeight: '1.2', color: card.is_suspended ? '#cf1322' : 'inherit' }}>Suspend Card</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>Lock card & block actions</Text>
                            </div>
                            <Switch size="small" checked={card.is_suspended}
                                onChange={async (val) => {
                                    if (!val) { await updateCard(card.id, { is_suspended: false, suspended_reason: null }); ctx.setEditSuspendReason(''); }
                                    else { await updateCard(card.id, { is_suspended: true, suspended_reason: editSuspendReason }); }
                                }} />
                        </div>
                        {card.is_suspended && (
                            <div style={{ display: 'flex', gap: 4 }}>
                                <Input size="small" placeholder="Reason for suspension..." value={editSuspendReason}
                                    onChange={e => setEditSuspendReason(e.target.value)}
                                    onPressEnter={() => updateCard(card.id, { suspended_reason: editSuspendReason })}
                                    onBlur={() => updateCard(card.id, { suspended_reason: editSuspendReason })}
                                    style={{ borderRadius: theme.borderRadius.sm }} />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Checklist Template Selector Modal */}
            <ChecklistTemplateSelectorModal
                open={showChecklistTemplateModal}
                onCancel={() => setShowChecklistTemplateModal(false)}
                cardId={card?.id}
                theme={theme}
                onSuccess={() => {
                    // Refetch card data to show new task lists
                    useKanbanStore.getState().fetchCardDetail(card.id);
                }}
            />

            {/* Label Template Selector Modal */}
            <LabelTemplateSelectorModal
                open={showLabelTemplateModal}
                onCancel={() => setShowLabelTemplateModal(false)}
                boardId={card?.board_id}
                theme={theme}
                onSuccess={() => {
                    // Refetch board data to show new labels
                    useKanbanStore.getState().fetchBoardDetails(card?.board_id);
                }}
            />

            {/* Save Card Template Modal */}
            {showSaveCardTemplate && (
                <CardTemplateFormModal
                    open={showSaveCardTemplate}
                    onCancel={() => setShowSaveCardTemplate(false)}
                    template={null}
                    theme={theme}
                    onSuccess={() => setShowSaveCardTemplate(false)}
                    importSourceCard={{...card, taskLists: ctx.taskLists}}
                />
            )}
        </div>
    );
};

export default CardSidebar;
