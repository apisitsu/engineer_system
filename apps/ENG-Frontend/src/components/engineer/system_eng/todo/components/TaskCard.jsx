import React from 'react';
import { Card, Tag, Typography, Button, Dropdown } from 'antd';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreOutlined, ClockCircleOutlined, WarningOutlined, ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { theme as todoTheme, getPriorityColor } from '../theme';
import { useTheme } from '../../../../../theme';

const { Text } = Typography;

const TaskCard = ({ task, onEdit, onDelete }) => {
    const { theme } = useTheme();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id, data: { ...task } });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        marginBottom: todoTheme.spacing.md,
        cursor: 'grab',
    };

    const menuItems = [
        { key: 'edit', label: 'Edit', onClick: () => onEdit(task) },
        { key: 'delete', label: 'Delete', danger: true, onClick: () => onDelete(task.id) }
    ];

    const isOverdue = task.due_date && dayjs().isAfter(dayjs(task.due_date));
    const isNearDue = task.due_date && dayjs(task.due_date).diff(dayjs(), 'hour') < 24 && !isOverdue;

    // Determine priority (default to 'low' if not set)
    const priority = task.priority || 'low';
    const priorityColor = getPriorityColor(priority);

    // Determine if task has a problem
    const hasProblem = task.problem && task.problem.trim().length > 0;

    const cardStyle = {
        borderRadius: '16px', // Rounder corners
        boxShadow: isDragging ? todoTheme.shadows.xl : '0 4px 20px rgba(0,0,0,0.04)', // Softer, more modern shadow
        border: `1px solid ${theme.colors.border}`, // Subtle border
        borderLeft: `6px solid ${priorityColor}`, // Thicker colorful accent
        backgroundColor: theme.colors.surface,
        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
        overflow: 'hidden', // Ensure content respects border radius
        position: 'relative',
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} onDoubleClick={() => onEdit(task)}>
            <div
                style={cardStyle}
                onMouseEnter={(e) => {
                    if (!isDragging) {
                        e.currentTarget.style.transform = 'translateY(-4px)'; // More pronounced lift
                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!isDragging) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.04)';
                    }
                }}
            >
                {/* Card Header & Content Container */}
                <div style={{ padding: '16px 20px' }}>

                    {/* Header: Title + Menu */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <Text
                            style={{
                                flex: 1,
                                fontSize: '15px',
                                fontWeight: 600,
                                color: theme.colors.textPrimary,
                                lineHeight: '1.4',
                                marginRight: '12px'
                            }}
                        >
                            {task.name}
                        </Text>
                        <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                            <Button
                                type="text"
                                size="small"
                                icon={<MoreOutlined style={{ fontSize: '18px', color: theme.colors.textTertiary }} />}
                                onPointerDown={e => e.stopPropagation()}
                                style={{ margin: '-4px -8px 0 0' }} // Adjust alignment
                            />
                        </Dropdown>
                    </div>

                    {/* Description */}
                    <div style={{ marginBottom: '16px', minHeight: '42px' }}>
                        <Text style={{
                            fontSize: '13px',
                            color: theme.colors.textSecondary,
                            lineHeight: '1.6',
                            display: '-webkit-box',
                            WebkitLineClamp: 3, // Show up to 3 lines
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}>
                            {task.description || <span style={{ color: theme.colors.textDisabled, fontStyle: 'italic' }}>No description provided...</span>}
                        </Text>
                    </div>

                    {/* Footer: Priority Badge + Meta Info */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>

                        {/* Priority Badge (New Design) */}
                        <div style={{
                            padding: '4px 10px',
                            borderRadius: '20px', // Fully rounded pill
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.5px',
                            background: priority === 'high' ? theme.colors.errorLight : priority === 'medium' ? theme.colors.warningLight : theme.colors.successLight,
                            color: priority === 'high' ? theme.colors.errorDark : priority === 'medium' ? theme.colors.warningDark : theme.colors.successDark,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            border: `1px solid ${priority === 'high' ? theme.colors.errorDark : priority === 'medium' ? theme.colors.warningDark : theme.colors.successDark}30`
                        }}>
                            {priority === 'high' ? <ArrowUpOutlined /> : priority === 'medium' ? <MinusOutlined /> : <ArrowDownOutlined />}
                            {priority.toUpperCase()}
                        </div>

                        {/* Meta Tags */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {task.due_date && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    fontSize: '12px',
                                    color: isOverdue ? theme.colors.error : isNearDue ? theme.colors.warning : theme.colors.textTertiary,
                                    fontWeight: isOverdue || isNearDue ? 600 : 400
                                }}>
                                    <ClockCircleOutlined />
                                    {dayjs(task.due_date).format('MMM D')}
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                {/* Optional Status/Indicator Bar at bottom if needed, currently using left border */}
            </div>
        </div>
    );
};

export default TaskCard;
