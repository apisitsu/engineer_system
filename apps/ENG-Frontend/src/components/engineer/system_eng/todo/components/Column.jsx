import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, Typography, Badge } from 'antd';
import TaskCard from './TaskCard';
import { useTheme } from '../../../../../theme';
import { getStatusColor } from '../theme';

const { Title } = Typography;

const Column = ({ id, title, tasks, onEdit, onDelete }) => {
    const { setNodeRef } = useDroppable({ id });
    const { theme: mainTheme } = useTheme();

    const statusColor = getStatusColor(id);

    // Dynamic styles for the column container
    const columnStyle = {
        '--scrollbar-thumb': mainTheme.colors.primary,
        '--scrollbar-thumb-hover': mainTheme.colors.primaryDark,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px',
        overflow: 'hidden',
        // Remove shadow from container, move to body/border logic if needed, or keep it subtle
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        backgroundColor: 'transparent', // Transparent container to let header/body shapes show
    };

    return (
        <div style={{
            flex: 1,
            margin: `0 ${mainTheme.spacing.sm}`,
            height: '100%',
            minWidth: '260px',
            ...columnStyle
        }}>
            {/* Colored Header */}
            <div style={{
                padding: '12px 16px',
                background: mainTheme.colors.primary, // Use Theme Primary Color
                color: '#ffffff', // White text for contrast
                display: 'flex',
                alignItems: 'center',
                gap: mainTheme.spacing.sm,
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                zIndex: 1
            }}>
                <div style={{
                    width: '4px',
                    height: '18px',
                    background: '#ffffff', // White indicator on colored bg
                    borderRadius: '2px',
                    opacity: 0.8
                }} />

                <Title level={5} style={{ margin: 0, flex: 1, color: 'inherit', fontSize: '15px' }}>
                    {title}
                </Title>

                <Badge
                    count={tasks.length}
                    style={{
                        backgroundColor: '#ffffff', // White badge
                        color: mainTheme.colors.primary, // Primary text
                        boxShadow: 'none',
                        fontWeight: 700
                    }}
                />
            </div>

            {/* Scrollable Body - White Background */}
            <div
                ref={setNodeRef}
                className="kanban-scrollbar"
                style={{
                    flex: 1,
                    padding: `${mainTheme.spacing.sm}`,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    background: mainTheme.colors.surface, // White background
                    border: `1px solid ${mainTheme.colors.border}`, // Border to define shape
                    borderTop: 'none', // Remove top border to merge with header
                    borderBottomLeftRadius: '16px',
                    borderBottomRightRadius: '16px',
                    maxHeight: 'calc(100vh - 260px)' // Force max height to ensure scrolling
                }}
            >
                <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {tasks.map((task) => (
                        <TaskCard key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} />
                    ))}
                </SortableContext>
            </div>
        </div>
    );
};

export default Column;
