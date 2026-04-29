import React, { useState } from 'react';
import { Typography, Tooltip, Tag } from 'antd';
import { IoSettingsOutline, IoLockClosedOutline, IoLayersOutline, IoCalendarOutline } from 'react-icons/io5';
import { AiFillStar, AiOutlineStar } from 'react-icons/ai';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useKanbanPermissions } from '../../hooks/useKanbanPermissions';
import { GRADIENTS, getProjectIcon, getPriorityColor } from '../../constants/kanbanConstants';

dayjs.extend(relativeTime);
const { Text } = Typography;

const ProjectGridCard = ({ project, onClick, onToggleFavorite, onOpenSettings, theme }) => {
    const [hovered, setHovered] = useState(false);
    const gradient = project.background_value || GRADIENTS[(project.id || 0) % GRADIENTS.length];
    const ProjectIcon = getProjectIcon(project.icon);

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
                background: theme.colors.surface,
                border: `1px solid ${hovered ? theme.colors.primary + '60' : theme.colors.border}`,
                borderRadius: theme.borderRadius.xl,
                overflow: 'hidden',
                cursor: 'pointer',
                boxShadow: hovered ? theme.shadows.lg : theme.shadows.sm,
                transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
                transition: 'all 0.2s ease',
            }}
        >
            <div style={{
                height: 80, background: gradient,
                position: 'relative', display: 'flex', alignItems: 'center', padding: theme.spacing.lg,
            }}>
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'radial-gradient(circle at 85% 20%, rgba(255,255,255,0.18) 0%, transparent 65%)',
                }} />
                <div style={{
                    width: 44, height: 44, borderRadius: theme.borderRadius.md,
                    background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 18, fontWeight: 800, flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.3)',
                }}>
                    {ProjectIcon ? <ProjectIcon size={22} /> : (project.name || 'P').slice(0, 2).toUpperCase()}
                </div>
                <Text strong style={{
                    fontSize: 16, color: '#fff',
                    display: 'block', margin: 4, marginLeft: 12,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {project.name}
                </Text>
                <div style={{
                    position: 'absolute', top: 8, right: 10,
                    display: 'flex', gap: 4,
                    opacity: hovered || project.is_favorite ? 1 : 0,
                    transition: 'all 0.15s ease',
                }}>
                    {canManageProject && (
                        <div
                            onClick={(e) => { e.stopPropagation(); onOpenSettings?.(project.id); }}
                            style={{
                                width: 24, height: 24, borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(0,0,0,0.2)', cursor: 'pointer',
                                opacity: hovered ? 1 : 0, transition: 'all 0.15s ease',
                            }}
                        >
                            <IoSettingsOutline size={14} color="#fff" />
                        </div>
                    )}
                    {project.is_private && (
                        <Tooltip title="Private Project">
                            <div
                                style={{
                                    width: 24, height: 24, borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'rgba(0,0,0,0.2)', cursor: 'pointer',
                                }}
                            >
                                <IoLockClosedOutline size={14} color="#fff" />
                            </div>
                        </Tooltip>
                    )}
                    <div
                        onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(project.id); }}
                        style={{
                            width: 24, height: 24, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.2)', cursor: 'pointer',
                        }}
                    >
                        {project.is_favorite
                            ? <AiFillStar size={16} color="#fbbf24" />
                            : <AiOutlineStar size={16} color="#fff" />
                        }
                    </div>
                </div>
            </div>
            <div style={{ padding: `${theme.spacing.md} ${theme.spacing.lg}` }}>
                <Text style={{
                    fontSize: 12, color: theme.colors.textSecondary,
                    display: 'block', marginBottom: theme.spacing.md,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    minHeight: 18,
                }}>
                    {project.description || 'No description'}
                </Text>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <IoLayersOutline size={13} color={theme.colors.textTertiary} />
                        <Text style={{ fontSize: 12, color: theme.colors.textTertiary }}>
                            {project.board_count || 0} board{project.board_count !== 1 ? 's' : ''}
                        </Text>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <IoCalendarOutline size={12} color={theme.colors.textTertiary} />
                        <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>
                            {dayjs(project.created_at).fromNow()}
                        </Text>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectGridCard;
