/**
 * CardBody.jsx
 * 
 * Extracted from CardDetailDrawer (F3-05) — renders left column body sections:
 *   - Description, Issues (Problem & Solution), Memo
 *   - Attachments (file + link), Custom Fields, Parent/Child
 */

import React from 'react';
import { Typography, Row, Col, Space, Divider, Tag, Button, Input, Popconfirm, Progress, Tooltip } from 'antd';
import { useCardDetailState } from './useCardDetailState';
import { server } from '../../../../constance/constance';
import { useKanbanStore } from '../store/kanbanStore';

import { MdOutlineSubtitles, MdOutlineDescription, MdOutlineAttachFile, MdFamilyRestroom } from 'react-icons/md';
import { FaCheckSquare } from 'react-icons/fa';
import { CiMemoPad } from 'react-icons/ci';
import { FiPaperclip, FiUpload } from 'react-icons/fi';
import { AiOutlineDelete, AiOutlineEdit } from 'react-icons/ai';
import { BiLinkExternal } from 'react-icons/bi';
import { RiInputField } from 'react-icons/ri';

import { AttachmentLink } from './AttachmentViewManager';

const { Text, Paragraph, Title } = Typography;
const { TextArea } = Input;

const SectionHeader = ({ icon, title, theme, extra }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
        <Space align="center" size={8}>
            {React.cloneElement(icon, { size: 20, color: theme.colors.primary })}
            <Title level={5} style={{ margin: 0, fontSize: 14, color: theme.colors.textPrimary }}>{title}</Title>
        </Space>
        {extra}
    </div>
);

const CardBody = () => {
    const ctx = useCardDetailState();
    const {
        card, theme, isReadOnly, checkCanEdit,
        isEditingDesc, setIsEditingDesc, editDesc, setEditDesc, handleSaveDesc,
        showProblemSection, setShowProblemSection,
        editingIssueId, setEditingIssueId, editProblem, setEditProblem, editSolution, setEditSolution,
        handleSaveIssue, handleCancelIssue, deleteCardIssue,
        isEditingMemo, setIsEditingMemo, editMemo, setEditMemo, handleSaveMemo, showMemoSection,
        attachments, handleAttachmentClick,
        editingLinkId, setEditingLinkId, editLinkName, setEditLinkName, editLinkUrl, setEditLinkUrl,
        handleEditLinkSave, deleteAttachment,
        customFieldValues, upsertCustomFieldValue,
        baseCustomFieldGroups, customFields, cfGroupPreferences, activeProject,
        parentCard, childCards, lists, cards, closeCardDetail,
    } = ctx;

    if (!card) return null;

    const cardIssues = card?.issues || [];
    const fileAttachments = attachments.filter(a => a.attachment_type === 'file');
    const linkAttachments = attachments.filter(a => a.attachment_type === 'link');

    return (
        <>
            {/* ─── Description ─── */}
            <div style={{ marginBottom: theme.spacing.xl }}>
                <SectionHeader icon={<MdOutlineDescription />} title="Description" theme={theme} />
                <div style={{ marginLeft: 28 }}>
                    {isEditingDesc ? (
                        <div>
                            <TextArea value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                                autoSize={{ minRows: 3, maxRows: 10 }} autoFocus
                                placeholder="Add a more detailed description..."
                                style={{ borderRadius: theme.borderRadius.sm }} />
                            <Space style={{ marginTop: 8 }}>
                                <Button type="primary" size="small" onClick={handleSaveDesc}
                                    style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}>Save</Button>
                                <Button size="small" onClick={() => { setIsEditingDesc(false); setEditDesc(card.description || ''); }}
                                    style={{ borderRadius: theme.borderRadius.sm }}>Cancel</Button>
                            </Space>
                        </div>
                    ) : (
                        <div style={{ padding: theme.spacing.sm, borderRadius: theme.borderRadius.md, cursor: 'pointer', minHeight: 50, transition: `background ${theme.transitions.fast}` }}
                            onClick={async () => { if (await checkCanEdit()) setIsEditingDesc(true); }}
                            onMouseOver={(e) => e.currentTarget.style.background = `${theme.colors.surfaceHover}CC`}
                            onMouseOut={(e) => e.currentTarget.style.background = theme.colors.surfaceHover}>
                            <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', color: theme.colors.textPrimary, cursor: 'pointer', minHeight: 40 }}>
                                {card.description || <span style={{ color: theme.colors.textTertiary }}>Add a more detailed description...</span>}
                            </Paragraph>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Issues (Problem & Solution) ─── */}
            {showProblemSection && (
                <div style={{ marginBottom: theme.spacing.xl }}>
                    <SectionHeader icon={<MdOutlineSubtitles />} title="Issues (Problem & Solution)" theme={theme} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md, marginLeft: 28 }}>
                        {cardIssues.map((issue, idx) => (
                            <div key={issue.id} style={{ background: theme.colors.surfaceHover, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, border: `1px solid ${theme.colors.border}` }}>
                                {editingIssueId === issue.id ? (
                                    <div>
                                        <Text strong style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>Problem / Issue</Text>
                                        <TextArea value={editProblem} onChange={(e) => setEditProblem(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} placeholder="Detail the problem encountered..." style={{ borderRadius: theme.borderRadius.sm, marginBottom: 12 }} />
                                        <Text strong style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>Solution / Fix</Text>
                                        <TextArea value={editSolution} onChange={(e) => setEditSolution(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} placeholder="Describe the solution applied..." style={{ borderRadius: theme.borderRadius.sm }} />
                                        <Space style={{ marginTop: 12 }}>
                                            <Button type="primary" size="small" onClick={handleSaveIssue} style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}>Save</Button>
                                            <Button size="small" onClick={handleCancelIssue} style={{ borderRadius: theme.borderRadius.sm }}>Cancel</Button>
                                        </Space>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <Text strong style={{ color: theme.colors.primary, fontSize: 13 }}>Issue #{idx + 1}</Text>
                                            {!isReadOnly && (
                                                <Space size={4}>
                                                    <Button type="text" size="small" icon={<MdOutlineSubtitles size={14} />} onClick={() => { setEditingIssueId(issue.id); setEditProblem(issue.problem_detail || ''); setEditSolution(issue.solution_detail || ''); }} />
                                                    <Popconfirm title="Delete issue?" onConfirm={() => deleteCardIssue(issue.id, card.id)}>
                                                        <Button type="text" size="small" danger icon={<AiOutlineDelete size={14} />} />
                                                    </Popconfirm>
                                                </Space>
                                            )}
                                        </div>
                                        <Row gutter={16}>
                                            <Col span={12}>
                                                <Text strong style={{ fontSize: 12, color: theme.colors.textTertiary }}>Problem</Text>
                                                <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', color: theme.colors.textPrimary, fontSize: 13 }}>{issue.problem_detail || '-'}</Paragraph>
                                            </Col>
                                            <Col span={12}>
                                                <Text strong style={{ fontSize: 12, color: theme.colors.textTertiary }}>Solution</Text>
                                                <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', color: theme.colors.textPrimary, fontSize: 13 }}>{issue.solution_detail || '-'}</Paragraph>
                                            </Col>
                                        </Row>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Legacy single issue */}
                        {cardIssues.length === 0 && (card.problem_detail || card.solution_detail) && (
                            <div style={{ background: theme.colors.surfaceHover, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, border: `1px dashed ${theme.colors.border}` }}>
                                <Text type="warning" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>Unmigrated Legacy Issue</Text>
                                <Row gutter={16}>
                                    <Col span={12}><Text strong style={{ fontSize: 12, color: theme.colors.textTertiary }}>Problem</Text><Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', color: theme.colors.textPrimary, fontSize: 13 }}>{card.problem_detail || '-'}</Paragraph></Col>
                                    <Col span={12}><Text strong style={{ fontSize: 12, color: theme.colors.textTertiary }}>Solution</Text><Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', color: theme.colors.textPrimary, fontSize: 13 }}>{card.solution_detail || '-'}</Paragraph></Col>
                                </Row>
                            </div>
                        )}

                        {/* Create new issue form */}
                        {editingIssueId === 'new' ? (
                            <div style={{ background: `${theme.colors.primary}10`, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, border: `1px solid ${theme.colors.primary}50` }}>
                                <Text strong style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>New Problem / Issue</Text>
                                <TextArea value={editProblem} onChange={(e) => setEditProblem(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} placeholder="Detail the problem encountered..." style={{ borderRadius: theme.borderRadius.sm, marginBottom: 12 }} autoFocus />
                                <Text strong style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>New Solution / Fix</Text>
                                <TextArea value={editSolution} onChange={(e) => setEditSolution(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} placeholder="Describe the solution applied..." style={{ borderRadius: theme.borderRadius.sm }} />
                                <Space style={{ marginTop: 12 }}>
                                    <Button type="primary" size="small" onClick={handleSaveIssue} style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}>Save Issue</Button>
                                    <Button size="small" onClick={handleCancelIssue} style={{ borderRadius: theme.borderRadius.sm }}>Cancel</Button>
                                </Space>
                            </div>
                        ) : (
                            !isReadOnly && (
                                <Button type="dashed" onClick={() => { setEditingIssueId('new'); setEditProblem(''); setEditSolution(''); setShowProblemSection(true); }} style={{ borderRadius: theme.borderRadius.sm }}>
                                    + Add Issue
                                </Button>
                            )
                        )}
                    </div>
                </div>
            )}

            {/* ─── Memo ─── */}
            {showMemoSection && (
                <div style={{ marginBottom: theme.spacing.xl }}>
                    <SectionHeader icon={<CiMemoPad />} title="Memo" theme={theme} />
                    <div style={{ marginLeft: 28 }}>
                        {isEditingMemo ? (
                            <div>
                                <TextArea value={editMemo} onChange={(e) => setEditMemo(e.target.value)} autoSize={{ minRows: 3, maxRows: 10 }} autoFocus placeholder="Add any additional notes or comments..." style={{ borderRadius: theme.borderRadius.sm }} />
                                <Space style={{ marginTop: 8 }}>
                                    <Button type="primary" size="small" onClick={handleSaveMemo} style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}>Save</Button>
                                    <Button size="small" onClick={() => { setIsEditingMemo(false); setEditMemo(card.memo || ''); }} style={{ borderRadius: theme.borderRadius.sm }}>Cancel</Button>
                                </Space>
                            </div>
                        ) : (
                            <div style={{ background: theme.colors.surfaceHover, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, border: `1px solid ${theme.colors.border}`, cursor: isReadOnly ? 'default' : 'pointer', minHeight: 50, transition: `background ${theme.transitions.fast}` }}
                                onClick={() => !isReadOnly && setIsEditingMemo(true)}
                                onMouseOver={(e) => e.currentTarget.style.background = `${theme.colors.surfaceHover}CC`}
                                onMouseOut={(e) => e.currentTarget.style.background = theme.colors.surfaceHover}>
                                <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', color: theme.colors.textPrimary, cursor: isReadOnly ? 'default' : 'pointer', minHeight: 40 }} onClick={() => !isReadOnly && setIsEditingMemo(true)}>
                                    {card.memo || <span style={{ color: theme.colors.textTertiary }}>Add any additional notes or comments...</span>}
                                </Paragraph>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Attachments ─── */}
            {attachments.length > 0 && (
                <div style={{ marginBottom: theme.spacing.xl }}>
                    <SectionHeader icon={<MdOutlineAttachFile />} title="Attachments" theme={theme} />
                    <div style={{ marginLeft: 28, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {fileAttachments.map(att => {
                            const cleanPath = att.file_path?.replace(/^public[\/\\]/, '')?.replace(/\\/g, '/');
                            const fileUrl = att.file_path?.startsWith('http') ? att.file_path : `${server.API_URL}${cleanPath}`;
                            return (
                                <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: `${theme.spacing.xs} ${theme.spacing.sm}`, background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.sm, border: `1px solid ${theme.colors.border}` }}>
                                    {att.is_image ? (
                                        <div style={{ width: 40, height: 40, borderRadius: 4, background: `url(${fileUrl}) center/cover`, flexShrink: 0, cursor: 'pointer' }} onClick={() => handleAttachmentClick(att)} />
                                    ) : (<FiPaperclip size={16} color={theme.colors.primary} />)}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <AttachmentLink attachment={att} theme={theme} onClick={handleAttachmentClick} />
                                        {att.file_size && (<Text type="secondary" style={{ fontSize: 11 }}>{(att.file_size / 1024).toFixed(1)} KB</Text>)}
                                    </div>
                                    <Tooltip title="Open in new tab">
                                        <Button type="text" size="small" icon={<FiUpload size={14} style={{ transform: 'rotate(180deg)' }} />} onClick={() => window.open(fileUrl, '_blank', 'noreferrer')} />
                                    </Tooltip>
                                    {!isReadOnly && (
                                        <Popconfirm title="Delete attachment?" onConfirm={() => deleteAttachment(att.id, card.id)}>
                                            <Button type="text" size="small" danger icon={<AiOutlineDelete size={14} />} />
                                        </Popconfirm>
                                    )}
                                </div>
                            );
                        })}
                        {linkAttachments.map(att => {
                            const linkData = typeof att.link_data === 'string' ? JSON.parse(att.link_data) : att.link_data;
                            const isEditing = editingLinkId === att.id;
                            return (
                                <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: `${theme.spacing.xs} ${theme.spacing.sm}`, background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.sm, border: `1px solid ${theme.colors.border}` }}>
                                    <BiLinkExternal size={16} color={theme.colors.primary} />
                                    {isEditing ? (
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <Input size="small" placeholder="Link Title (optional)" value={editLinkName} onChange={e => setEditLinkName(e.target.value)} />
                                            <Input size="small" placeholder="URL (required)" value={editLinkUrl} onChange={e => setEditLinkUrl(e.target.value)} onPressEnter={() => handleEditLinkSave(att.id)} />
                                            <Space><Button size="small" type="primary" onClick={() => handleEditLinkSave(att.id)}>Save</Button><Button size="small" onClick={() => setEditingLinkId(null)}>Cancel</Button></Space>
                                        </div>
                                    ) : (
                                        <>
                                            <AttachmentLink attachment={att} theme={theme} onClick={handleAttachmentClick} />
                                            {!isReadOnly && (
                                                <Space size={4}>
                                                    <Button type="text" size="small" onClick={() => { setEditingLinkId(att.id); setEditLinkName(att.file_name || linkData?.name || ''); setEditLinkUrl(linkData?.url || att.file_path || ''); }}><AiOutlineEdit size={14} /></Button>
                                                    <Popconfirm title="Delete attachment?" onConfirm={() => deleteAttachment(att.id, card.id)}>
                                                        <Button type="text" size="small" danger icon={<AiOutlineDelete size={14} />} />
                                                    </Popconfirm>
                                                </Space>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ─── Custom Fields ─── */}
            {customFieldValues.length > 0 && (() => {
                const cfPrefs = activeProject ? (cfGroupPreferences?.[activeProject.id] || { order: [], hidden: [] }) : { order: [], hidden: [] };
                const orderedCfGroups = (baseCustomFieldGroups || []).slice().sort((a, b) => {
                    const order = cfPrefs.order || [];
                    const idxA = order.indexOf(a.id); const idxB = order.indexOf(b.id);
                    if (idxA === -1 && idxB === -1) return 0; if (idxA === -1) return 1; if (idxB === -1) return -1;
                    return idxA - idxB;
                }).filter(g => !(cfPrefs.hidden || []).includes(g.id));

                const groupedValues = {}; const unassignedValues = [];
                customFieldValues.forEach(cfv => {
                    let foundGroupId = null;
                    if (customFields) { for (const [gId, fields] of Object.entries(customFields)) { if (fields.some(f => String(f.id) === String(cfv.custom_field_id))) { foundGroupId = gId; break; } } }
                    if (foundGroupId) { if (!groupedValues[foundGroupId]) groupedValues[foundGroupId] = []; groupedValues[foundGroupId].push(cfv); } else { unassignedValues.push(cfv); }
                });

                const hasVisibleGroups = orderedCfGroups.some(g => groupedValues[g.id]?.length > 0);
                if (!hasVisibleGroups && unassignedValues.length === 0) return null;

                const renderCfInput = (cfv) => (
                    <div key={cfv.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong style={{ minWidth: 100, fontSize: 13 }}>{cfv.field_name}:</Text>
                        <Input size="small" defaultValue={cfv.content || ''} disabled={isReadOnly}
                            onBlur={(e) => { if (e.target.value !== (cfv.content || '')) { upsertCustomFieldValue(card.id, { custom_field_id: cfv.custom_field_id, content: e.target.value }); } }}
                            onPressEnter={(e) => e.target.blur()} style={{ borderRadius: theme.borderRadius.sm }} />
                    </div>
                );

                return (
                    <div style={{ marginBottom: theme.spacing.xl }}>
                        <SectionHeader icon={<RiInputField />} title="Custom Fields" theme={theme} />
                        <div style={{ marginLeft: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {orderedCfGroups.map(g => {
                                const gv = groupedValues[g.id]; if (!gv || gv.length === 0) return null;
                                return (<div key={g.id}><Text type="secondary" strong style={{ fontSize: 12, textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>{g.name}</Text><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{gv.map(renderCfInput)}</div></div>);
                            })}
                            {unassignedValues.length > 0 && (
                                <div><Text type="secondary" strong style={{ fontSize: 12, textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Other Fields</Text><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{unassignedValues.map(renderCfInput)}</div></div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* ─── Parent/Child ─── */}
            {(parentCard || parseInt(card.total_children_count) > 0) && (
                <div style={{ marginBottom: theme.spacing.xl }}>
                    <SectionHeader icon={<MdFamilyRestroom />} title="Parent/Child" theme={theme} />
                    <div style={{ marginLeft: 28 }}>
                        {parentCard && (
                            <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, padding: '12px 16px', marginBottom: parseInt(card.total_children_count) > 0 ? 12 : 0, cursor: 'pointer', transition: 'all 0.2s ease' }}
                                onClick={() => { closeCardDetail(); setTimeout(() => { useKanbanStore.getState().openCardDetail(parentCard.id); }, 100); }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = theme.colors.primary}
                                onMouseLeave={e => e.currentTarget.style.borderColor = theme.colors.border}>
                                <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Parent Card</Text>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FaCheckSquare style={{ color: parentCard.is_closed ? theme.colors.success : theme.colors.textTertiary }} />
                                    <Text strong style={{ fontSize: 14 }}>{parentCard.name}</Text>
                                </div>
                            </div>
                        )}
                        {parseInt(card.total_children_count) > 0 && (
                            <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, padding: '12px 16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Child Progress</Text>
                                    <Text strong style={{ fontSize: 12 }}>{card.completed_children_count || 0} / {card.total_children_count} Completed</Text>
                                </div>
                                <Progress percent={Math.round((parseInt(card.completed_children_count || 0) / parseInt(card.total_children_count)) * 100)} size="small" strokeColor={theme.colors.success}
                                    status={parseInt(card.completed_children_count || 0) === parseInt(card.total_children_count) ? 'success' : 'active'} style={{ marginBottom: 12 }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {childCards.map(child => {
                                        const list = lists.find(l => String(l.id) === String(child.list_id));
                                        const ln = (list?.name || '').toLowerCase();
                                        const isDone = ln.includes('done') || ln.includes('completed') || ln.includes('finish') || ln.includes('เสร็จ');
                                        return (
                                            <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: isDone ? theme.colors.success : theme.colors.textTertiary }} />
                                                <Text delete={isDone} type={isDone ? 'secondary' : 'default'} style={{ fontSize: 13, cursor: 'pointer', flex: 1 }}
                                                    onClick={() => { closeCardDetail(); setTimeout(() => { useKanbanStore.getState().openCardDetail(child.id); }, 100); }}>
                                                    {child.name}
                                                </Text>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default CardBody;
