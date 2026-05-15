/**
 * CardTaskLists.jsx
 * 
 * Extracted from CardDetailDrawer (F3-05) — renders the Checklists section:
 *   - Each task list with editable name, delete, hide/show completed toggle
 *   - Progress bar per task list
 *   - Individual tasks: checkbox, inline edit, delete
 *   - "Add a task" input per list
 *   - "Add Checklist" button/form at the bottom
 *
 * Consumes all data via useCardDetailState() context — zero prop drilling.
 */

import React, { useState } from 'react';
import { Typography, Button, Input, Checkbox, Progress, Popconfirm, Space, Tooltip } from 'antd';
import { useCardDetailState } from './useCardDetailState';
import { useKanbanStore } from '../store/kanbanStore';
import ChecklistTemplateFormModal from '../Tabs/components/ChecklistTemplateFormModal';
import { IoSaveOutline } from 'react-icons/io5';

import { FaCheckSquare } from 'react-icons/fa';
import { AiOutlineDelete } from 'react-icons/ai';

const { Text, Title } = Typography;

// ─── Section Header (local copy to avoid circular dependency) ───────
const SectionHeader = ({ icon, title, theme, extra }) => (
    <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: theme.spacing.md
    }}>
        <Space align="center" size={8}>
            {React.cloneElement(icon, { size: 20, color: theme.colors.primary })}
            <Title level={5} style={{ margin: 0, fontSize: 14, color: theme.colors.textPrimary }}>{title}</Title>
        </Space>
        {extra}
    </div>
);

const CardTaskLists = () => {
    const {
        card, theme,
        isReadOnly, checkCanEdit,
        taskLists,
        updateTaskList, deleteTaskList, deleteTask,
        editingTaskListId, setEditingTaskListId,
        editTaskListName, setEditTaskListName,
        handleSaveTaskListName,
        editingTaskId, setEditingTaskId,
        editTaskName, setEditTaskName,
        handleToggleTask, handleEditTaskSave,
        newTaskNames, setNewTaskNames,
        handleAddTask,
        showAddTaskList, setShowAddTaskList,
        newTaskListName, setNewTaskListName,
        handleAddTaskList,
    } = useCardDetailState();

    const canManageTemplates = useKanbanStore(state => state.canManageTemplates);
    const [saveChecklistData, setSaveChecklistData] = useState(null);

    if (!card) return null;
    if (taskLists.length === 0 && isReadOnly) return null;

    return (
        <>
            {/* ─── Task Lists ─── */}
            {taskLists.length > 0 && taskLists.map(tl => {
                const tasks = tl.tasks || [];
                const visibleTasks = tl.hide_completed_tasks
                    ? tasks.filter(t => !t.is_completed)
                    : tasks;
                const completed = tasks.filter(t => t.is_completed).length;
                const total = tasks.length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

                return (
                    <div key={tl.id} style={{ marginBottom: theme.spacing.xl }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            {editingTaskListId === tl.id ? (
                                <Input
                                    value={editTaskListName}
                                    onChange={(e) => setEditTaskListName(e.target.value)}
                                    onPressEnter={() => handleSaveTaskListName(tl.id)}
                                    onBlur={() => handleSaveTaskListName(tl.id)}
                                    autoFocus
                                    size="small"
                                    style={{ fontWeight: 600, fontSize: 14, borderRadius: theme.borderRadius.sm, marginBottom: 8, flex: 1 }}
                                />
                            ) : (
                                <SectionHeader
                                    icon={<FaCheckSquare />}
                                    title={<span style={{ cursor: isReadOnly ? 'default' : 'pointer' }} onClick={() => !isReadOnly && (setEditingTaskListId(tl.id), setEditTaskListName(tl.name))}>{tl.name}</span>}
                                    theme={theme}
                                    extra={!isReadOnly && (
                                        <Space size={2}>
                                            {canManageTemplates && (
                                                <Tooltip title="Save as Template">
                                                    <Button type="text" size="small" icon={<IoSaveOutline size={14} />} onClick={() => setSaveChecklistData([tl])} />
                                                </Tooltip>
                                            )}
                                            <Popconfirm title="Delete checklist?" onConfirm={() => deleteTaskList(tl.id, card.id)}>
                                                <Button type="text" size="small" danger icon={<AiOutlineDelete size={14} />} />
                                            </Popconfirm>
                                        </Space>
                                    )}
                                />
                            )}
                            {!isReadOnly && editingTaskListId !== tl.id && (
                                <Button
                                    type="text" size="small"
                                    style={{ color: tl.hide_completed_tasks ? theme.colors.primary : theme.colors.textTertiary, fontSize: 12 }}
                                    onClick={() => updateTaskList(tl.id, { hide_completed_tasks: !tl.hide_completed_tasks }, card.id)}
                                >
                                    {tl.hide_completed_tasks ? `Show completed (${completed})` : 'Hide completed'}
                                </Button>
                            )}
                        </div>
                        <div style={{ marginLeft: 28 }}>
                            <Progress
                                percent={pct}
                                size="small"
                                strokeColor={theme.colors.primary}
                                style={{ marginBottom: 8 }}
                            />
                            {visibleTasks.map(task => (
                                <div key={task.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '4px 0',
                                    borderBottom: `1px solid ${theme.colors.border}30`
                                }}>
                                    <Checkbox
                                        checked={task.is_completed}
                                        onChange={async (e) => {
                                            if (await checkCanEdit()) {
                                                handleToggleTask(task);
                                            } else {
                                                e.preventDefault();
                                            }
                                        }}
                                    />
                                    {editingTaskId === task.id ? (
                                        <Input
                                            value={editTaskName}
                                            onChange={(e) => setEditTaskName(e.target.value)}
                                            onPressEnter={() => handleEditTaskSave(task.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Escape') {
                                                    setEditingTaskId(null);
                                                }
                                            }}
                                            onBlur={() => handleEditTaskSave(task.id)}
                                            autoFocus
                                            size="small"
                                            style={{ flex: 1, borderRadius: theme.borderRadius.sm, fontSize: 13 }}
                                        />
                                    ) : (
                                        <Text
                                            delete={task.is_completed}
                                            style={{
                                                flex: 1,
                                                color: task.is_completed ? theme.colors.textTertiary : theme.colors.textPrimary,
                                                fontSize: 13,
                                                cursor: 'pointer'
                                            }}
                                            onClick={async () => {
                                                if (await checkCanEdit()) {
                                                    setEditingTaskId(task.id);
                                                    setEditTaskName(task.name);
                                                }
                                            }}
                                        >
                                            {task.name}
                                        </Text>
                                    )}
                                    {!isReadOnly && (
                                        <Button
                                            type="text" size="small" danger
                                            icon={<AiOutlineDelete size={12} />}
                                            onClick={() => deleteTask(task.id, card.id)}
                                        />
                                    )}
                                </div>
                            ))}
                            {!isReadOnly && (
                                <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                                    <Input
                                        placeholder="Add a task..."
                                        size="small"
                                        value={newTaskNames[tl.id] || ''}
                                        onChange={(e) => setNewTaskNames(prev => ({ ...prev, [tl.id]: e.target.value }))}
                                        onPressEnter={() => handleAddTask(tl.id)}
                                        style={{ borderRadius: theme.borderRadius.sm }}
                                    />
                                    <Button size="small" type="primary" onClick={() => handleAddTask(tl.id)}
                                        style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}
                                    >Add</Button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Add Task List Button */}
            {!isReadOnly && (
                showAddTaskList ? (
                    <div style={{ marginTop: theme.spacing.md }}>
                        <div style={{ display: 'flex', gap: 4, marginLeft: 28 }}>
                            <Input
                                placeholder="Checklist name"
                                size="small"
                                value={newTaskListName}
                                onChange={(e) => setNewTaskListName(e.target.value)}
                                onPressEnter={handleAddTaskList}
                                style={{ borderRadius: theme.borderRadius.sm }}
                            />
                            <Button size="small" type="primary" onClick={handleAddTaskList}
                                style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}
                            >Add</Button>
                        </div>
                    </div>
                ) : (
                    <div style={{ marginBottom: theme.spacing.xl, marginLeft: 28 }}>
                        <Button type="dashed" block onClick={() => setShowAddTaskList(true)} style={{ borderRadius: theme.borderRadius.sm }}>
                            Add Checklist
                        </Button>
                    </div>
                )
            )}

            {/* Save Checklist Template Modal */}
            {saveChecklistData && (
                <ChecklistTemplateFormModal
                    open={!!saveChecklistData}
                    onCancel={() => setSaveChecklistData(null)}
                    template={null}
                    theme={theme}
                    onSuccess={() => setSaveChecklistData(null)}
                    importSourceChecklists={saveChecklistData}
                />
            )}
        </>
    );
};

export default CardTaskLists;
