import React, { useMemo } from 'react';
import { Typography, Button, Spin } from 'antd';
import { BsKanban } from 'react-icons/bs';
import { IoLayersOutline, IoTimeOutline } from 'react-icons/io5';
import { MdOutlineDashboard, MdOutlinePeople } from 'react-icons/md';
import { AiFillStar } from 'react-icons/ai';
import StatCard from './components/StatCard';
import ProjectListRow from './components/ProjectListRow';
import { GRADIENTS } from '../constants/kanbanConstants';

const { Text } = Typography;

const DashboardTab = ({ 
    projects, 
    isLoading, 
    onSelectProject, 
    onToggleFavorite, 
    onOpenProjectSettings, 
    onShowCreateModal,
    theme 
}) => {
    // Computed stats for dashboard
    const stats = useMemo(() => {
        const activeProjects = projects.filter(p => (p.status || 'active').toLowerCase() === 'active');
        return {
            total: activeProjects.length,
            totalBoards: activeProjects.reduce((s, p) => s + (parseInt(p.board_count) || 0), 0),
            owned: activeProjects.filter(p => p.role === 'owner').length,
            favorites: activeProjects.filter(p => p.is_favorite).length,
            recent: [...activeProjects].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
            activeProjects
        };
    }, [projects]);

    if (isLoading && projects.length === 0) {
        return <div style={{ textAlign: 'center', padding: '80px 0' }}><Spin size="large" /></div>;
    }

    return (
        <div>
            {/* Stat Row */}
            <div style={{ display: 'flex', gap: theme.spacing.lg, flexWrap: 'wrap', marginBottom: theme.spacing['2xl'] }}>
                <StatCard icon={<BsKanban />} label="Total Projects" value={stats.total} color={theme.colors.primary} theme={theme} />
                <StatCard icon={<IoLayersOutline />} label="Total Boards" value={stats.totalBoards} color="#10b981" theme={theme} />
                <StatCard icon={<MdOutlinePeople />} label="Owned by Me" value={stats.owned} color="#f59e0b" theme={theme} />
                <StatCard icon={<AiFillStar />} label="Favorites" value={stats.favorites} color="#ef4444" theme={theme} />
            </div>

            {/* Recent Projects */}
            <div>
                <Text strong style={{ fontSize: 13, color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: theme.spacing.md }}>
                    Recent Projects
                </Text>
                {stats.recent.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: theme.colors.textTertiary }}>
                        <BsKanban size={40} style={{ opacity: 0.3 }} />
                        <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>No projects yet. Create your first project!</Text>
                        <Button type="primary" style={{ marginTop: 12, background: theme.colors.primary, borderColor: theme.colors.primary }}
                            onClick={onShowCreateModal}>
                            Create Project
                        </Button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                        {stats.recent.map(p => (
                            <ProjectListRow 
                                key={p.id} 
                                project={p} 
                                onClick={() => onSelectProject(p)} 
                                onToggleFavorite={onToggleFavorite} 
                                onOpenSettings={onOpenProjectSettings} 
                                theme={theme} 
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Board distribution */}
            {stats.activeProjects.length > 0 && (
                <div style={{ marginTop: theme.spacing['2xl'] }}>
                    <Text strong style={{ fontSize: 13, color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: theme.spacing.md }}>
                        Board Distribution
                    </Text>
                    <div style={{
                        background: theme.colors.surface,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.lg,
                        padding: theme.spacing.lg,
                    }}>
                        {stats.activeProjects.filter(p => parseInt(p.board_count) > 0).slice(0, 8).map(p => {
                            const pct = stats.totalBoards > 0 ? Math.round((parseInt(p.board_count) / stats.totalBoards) * 100) : 0;
                            const gradient = p.background_value || GRADIENTS[(p.id || 0) % GRADIENTS.length];
                            return (
                                <div key={p.id} style={{ marginBottom: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <Text style={{ fontSize: 13, color: theme.colors.textPrimary }}>{p.name}</Text>
                                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>{p.board_count} boards</Text>
                                    </div>
                                    <div style={{ height: 6, background: theme.colors.surfaceHover, borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', width: `${pct}%`,
                                            background: gradient, borderRadius: 3,
                                            transition: 'width 0.6s ease',
                                        }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardTab;
