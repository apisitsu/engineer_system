import React, { useState } from 'react';
import { Typography, Tag, Space } from 'antd';
import { IoSettingsOutline, IoLockClosedOutline } from 'react-icons/io5';
import { AiFillStar, AiOutlineStar } from 'react-icons/ai';
import dayjs from 'dayjs';
import { useKanbanPermissions } from '../../hooks/useKanbanPermissions';
import { GRADIENTS, getProjectIcon, getPriorityColor } from '../../constants/kanbanConstants';

const { Text } = Typography;

const ProjectListRow = ({ project, onClick, onToggleFavorite, onOpenSettings, theme }) => {
    const gradient = project.background_value || GRADIENTS[(project.id || 0) % GRADIENTS.length];
    const ProjectIcon = getProjectIcon(project.icon);
    const [hovered, setHovered] = useState(false);

    const { canManageProject } = useKanbanPermissions({
        isPrivateProject: project.is_private,
        projectRole: project.role
    });

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', alignItems: 'center', gap: theme.spacing.md,
                padding: `${theme.spacing.md} ${theme.spacing.lg}`,
                background: hovered ? theme.colors.surfaceHover : theme.colors.surface,
                border: `1px solid ${hovered ? theme.colors.primary + '40' : theme.colors.border}`,
                borderRadius: theme.borderRadius.lg,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: hovered ? theme.shadows.sm : 'none',
            }}
        >
            <div style={{
                width: 40, height: 40, borderRadius: theme.borderRadius.md,
                background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 14, fontWeight: 800, flexShrink: 0,
            }}>
                {ProjectIcon ? <ProjectIcon size={20} /> : (project.name || 'P').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Text strong style={{ fontSize: 13, color: theme.colors.textPrimary }}>
                        {project.name}
                    </Text>
                    {project.is_private && (
                        <Tag color="default" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 5px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <IoLockClosedOutline size={10} /> Private
                        </Tag>
                    )}
                    {project.priority && project.priority.toLowerCase() !== 'medium' && (
                        <Tag color={getPriorityColor(project.priority)} style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 5px' }}>
                            {project.priority.toUpperCase()}
                        </Tag>
                    )}
                    {project.status && project.status.toLowerCase() === 'waiting' && (
                        <Tag color="warning" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 5px' }}>
                            POOL
                        </Tag>
                    )}
                </div>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {project.description || 'No description'}
                </Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.lg, flexShrink: 0 }}>
                <div style={{ textAlign: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: 700, color: theme.colors.primary, display: 'block', lineHeight: 1 }}>{project.board_count || 0}</Text>
                    <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>Boards</Text>
                </div>
                <Text style={{ fontSize: 12, color: theme.colors.textTertiary }}>
                    {dayjs(project.created_at).format('DD MMM YY')}
                </Text>
                {canManageProject && (
                    <div
                        onClick={(e) => { e.stopPropagation(); onOpenSettings?.(project.id); }}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                        <IoSettingsOutline size={15} color={theme.colors.textTertiary} />
                    </div>
                )}
                <div
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(project.id); }}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                    {project.is_favorite
                        ? <AiFillStar size={16} color="#fbbf24" />
                        : <AiOutlineStar size={16} color={theme.colors.textTertiary} />
                    }
                </div>
            </div>
        </div>
    );
};

export default ProjectListRow;
