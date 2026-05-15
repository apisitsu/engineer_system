import React, { useMemo, useState, useEffect } from 'react';
import { Input, Select, Tooltip, Button, Row, Col, Typography, Tabs, Collapse, Segmented } from 'antd';
import { IoSearchOutline, IoLayersOutline } from 'react-icons/io5';
import { FiPlus } from 'react-icons/fi';
import { BsKanban, BsGrid3X3Gap, BsListUl } from 'react-icons/bs';
import { MdOutlinePeople } from 'react-icons/md';
import { AiFillStar } from 'react-icons/ai';
import ProjectGridCard from './components/ProjectGridCard';
import ProjectListRow from './components/ProjectListRow';
import StatCard from './components/StatCard';
import { GRADIENTS } from '../constants/kanbanConstants';

const { Text } = Typography;

// ─── localStorage helper for view mode ───────────────────────────
const VIEW_MODE_KEY = 'kanban_project_view_mode';
const getStoredViewMode = () => {
    try { return localStorage.getItem(VIEW_MODE_KEY) || 'card'; }
    catch { return 'card'; }
};
const setStoredViewMode = (mode) => {
    try { localStorage.setItem(VIEW_MODE_KEY, mode); }
    catch { /* ignore */ }
};

// ─── Section Header ──────────────────────────────────────────────
const SectionHeader = ({ icon, title, count, theme }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: theme.spacing.md, marginTop: theme.spacing.lg,
    }}>
        <span style={{ fontSize: 15, color: theme.colors.primary }}>{icon}</span>
        <Text strong style={{
            fontSize: 13, color: theme.colors.textSecondary,
            textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
            {title}
        </Text>
        <span style={{
            background: theme.colors.surfaceHover,
            color: theme.colors.textSecondary,
            fontSize: 11, fontWeight: 600,
            padding: '1px 8px', borderRadius: 10,
        }}>
            {count}
        </span>
    </div>
);

// ─── Empty Section ───────────────────────────────────────────────
const EmptySection = ({ message, theme }) => (
    <div style={{
        textAlign: 'center', padding: '24px 0',
        color: theme.colors.textTertiary, fontSize: 13,
    }}>
        {message}
    </div>
);

// ─── Sub-label (Public / Private) ────────────────────────────────
const SubLabel = ({ label, theme }) => (
    <Text style={{
        fontSize: 11, color: theme.colors.textTertiary,
        textTransform: 'uppercase', letterSpacing: '0.8px',
        display: 'block', marginBottom: theme.spacing.sm,
        marginTop: theme.spacing.sm,
        paddingLeft: 4,
    }}>
        {label}
    </Text>
);


const ProjectsTab = ({
    projects,
    isLoading,
    onSelectProject,
    onToggleFavorite,
    onOpenProjectSettings,
    onShowCreateModal,
    onShowBlueprintModal,
    theme
}) => {
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('recent');
    const [viewMode, setViewMode] = useState(getStoredViewMode);
    const [projectStatusFilter, setProjectStatusFilter] = useState('active');

    // Persist view mode to localStorage
    const handleViewModeChange = (mode) => {
        setViewMode(mode);
        setStoredViewMode(mode);
    };

    // ─── Status counts (over all projects, pre-filter) ───────────
    const statusCounts = useMemo(() => ({
        active: projects.filter(p => (p.status || 'active').toLowerCase() === 'active').length,
        waiting: projects.filter(p => (p.status || '').toLowerCase() === 'waiting').length,
        suspended: projects.filter(p => (p.status || '').toLowerCase() === 'suspended').length,
        completed: projects.filter(p => (p.status || '').toLowerCase() === 'completed').length,
    }), [projects]);

    // ─── Filtered list (status + search + sort) ──────────────────
    const filtered = useMemo(() => {
        let list = projects.filter(p =>
            (p.status || 'active').toLowerCase() === projectStatusFilter
        );
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(p =>
                p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
            );
        }
        if (sortBy === 'recent') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        else if (sortBy === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        else if (sortBy === 'boards') list.sort((a, b) => (b.board_count || 0) - (a.board_count || 0));
        return list;
    }, [projects, search, sortBy, projectStatusFilter]);

    // ─── Category split ──────────────────────────────────────────
    const { favoriteProjects, ownerProjects, teamPublic, teamPrivate } = useMemo(() => ({
        favoriteProjects: filtered.filter(p => p.is_favorite),
        ownerProjects: filtered.filter(p => p.role === 'owner'),
        teamPublic: filtered.filter(p => p.role !== 'owner' && !p.is_private),
        teamPrivate: filtered.filter(p => p.role !== 'owner' && p.is_private),
    }), [filtered]);

    // ─── Stats (scoped to current status tab) ────────────────────
    const stats = useMemo(() => {
        const scoped = projects.filter(p =>
            (p.status || 'active').toLowerCase() === projectStatusFilter
        );
        return {
            total: scoped.length,
            totalBoards: scoped.reduce((s, p) => s + (parseInt(p.board_count) || 0), 0),
            owned: scoped.filter(p => p.role === 'owner').length,
            favorites: scoped.filter(p => p.is_favorite).length,
        };
    }, [projects, projectStatusFilter]);

    // ─── Board Distribution data ─────────────────────────────────
    const boardDistribution = useMemo(() => {
        const scoped = projects.filter(p =>
            (p.status || 'active').toLowerCase() === projectStatusFilter
        );
        const totalBoards = scoped.reduce((s, p) => s + (parseInt(p.board_count) || 0), 0);
        return { scoped, totalBoards };
    }, [projects, projectStatusFilter]);

    // ─── Render project items ────────────────────────────────────
    const renderProjects = (list) => {
        if (list.length === 0) return null;
        if (viewMode === 'card') {
            return (
                <Row gutter={[20, 20]}>
                    {list.map(p => (
                        <Col xs={24} sm={12} md={8} lg={6} key={p.id}>
                            <ProjectGridCard
                                project={p}
                                onClick={() => onSelectProject(p)}
                                onToggleFavorite={onToggleFavorite}
                                onOpenSettings={onOpenProjectSettings}
                                theme={theme}
                            />
                        </Col>
                    ))}
                </Row>
            );
        }
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                {list.map(p => (
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
        );
    };

    return (
        <div>
            {/* ─── Stats Row ──────────────────────────────────── */}
            <div style={{
                display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap',
                marginBottom: theme.spacing.xl,
            }}>
                <StatCard icon={<BsKanban />} label="Total Projects" value={stats.total} color={theme.colors.primary} theme={theme} />
                <StatCard icon={<IoLayersOutline />} label="Total Boards" value={stats.totalBoards} color="#10b981" theme={theme} />
                <StatCard icon={<MdOutlinePeople />} label="Owned by Me" value={stats.owned} color="#f59e0b" theme={theme} />
                <StatCard icon={<AiFillStar />} label="Favorites" value={stats.favorites} color="#ef4444" theme={theme} />
            </div>

            {/* ─── Filter Bar ─────────────────────────────────── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: theme.spacing.md,
                flexWrap: 'wrap', marginBottom: theme.spacing.md,
                padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                background: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.lg,
            }}>
                <Input
                    placeholder="Search projects..."
                    prefix={<IoSearchOutline color={theme.colors.textTertiary} />}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    allowClear
                    style={{ width: 240, borderRadius: theme.borderRadius.sm }}
                />
                <Select
                    value={sortBy}
                    onChange={setSortBy}
                    style={{ width: 150 }}
                    options={[
                        { value: 'recent', label: '🕒 Most Recent' },
                        { value: 'name', label: '🔤 Name A→Z' },
                        { value: 'boards', label: '📋 Most Boards' },
                    ]}
                />
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                        style={{
                            display: 'inline-flex',
                            // ปรับสีพื้นหลังให้เป็นสีเขียวอ่อนตามรูป หรือใช้ theme.colors.surfaceHover ของคุณ
                            background: theme.colors.surfaceHover,
                            borderRadius: 8,
                            padding: 4,
                            gap: 2 // เพิ่มช่องว่างระหว่างปุ่มเล็กน้อย
                        }}
                    >
                        <Tooltip title="Card View">
                            <Button
                                type="text"
                                size="small"
                                icon={<BsGrid3X3Gap size={16} />}
                                onClick={() => handleViewModeChange('card')}
                                style={{
                                    borderRadius: 6,
                                    // ตั้งค่าสไตล์ตอนที่ถูกเลือกให้เป็นปุ่มสีขาวมีเงา (ตามรูป)
                                    ...(viewMode === 'card'
                                        ? { background: '#ffffff', color: '#000', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
                                        : { color: '#666' })
                                }}
                            />
                        </Tooltip>
                        <Tooltip title="List View">
                            <Button
                                type="text"
                                size="small"
                                icon={<BsListUl size={16} />}
                                onClick={() => handleViewModeChange('list')}
                                style={{
                                    borderRadius: 6,
                                    ...(viewMode === 'list'
                                        ? { background: '#ffffff', color: '#000', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
                                        : { color: '#666' })
                                }}
                            />
                        </Tooltip>
                    </div>
                    <Tooltip title="Create Project from Template">
                        <Button
                            type="text"
                            icon={<IoLayersOutline size={16} />}
                            onClick={onShowBlueprintModal}
                            style={{ color: theme.colors.textSecondary }}
                        />
                    </Tooltip>
                    <Tooltip title="Create Project">
                        <Button
                            type="text"
                            icon={<FiPlus size={16} />}
                            onClick={onShowCreateModal}
                            style={{ color: theme.colors.textSecondary }}
                        />
                    </Tooltip>
                </div>
            </div>

            {/* ─── Status Sub-tabs ────────────────────────────── */}
            <Tabs
                activeKey={projectStatusFilter}
                onChange={setProjectStatusFilter}
                items={[
                    { key: 'active', label: `Active (${statusCounts.active})` },
                    { key: 'waiting', label: `Waiting (Pool) (${statusCounts.waiting})` },
                    { key: 'suspended', label: `Suspended (${statusCounts.suspended})` },
                    { key: 'completed', label: `Completed (${statusCounts.completed})` },
                ]}
                style={{ marginBottom: theme.spacing.sm }}
            />

            {/* ─── No projects at all ─────────────────────────── */}
            {filtered.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '60px 0',
                    background: theme.colors.surface,
                    borderRadius: theme.borderRadius.lg,
                    border: `1px dashed ${theme.colors.border}`,
                }}>
                    <BsKanban size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
                    <Text type="secondary" style={{ display: 'block' }}>
                        No projects found matching your criteria.
                    </Text>
                    {projectStatusFilter === 'active' && (
                        <Button
                            type="primary"
                            size="small"
                            style={{
                                marginTop: 12,
                                background: theme.colors.primary,
                                borderColor: theme.colors.primary,
                            }}
                            onClick={onShowCreateModal}
                        >
                            Create Project
                        </Button>
                    )}
                </div>
            ) : (
                <>
                    {/* ── ⭐ FAVORITES ────────────────────────────── */}
                    {favoriteProjects.length > 0 && (
                        <>
                            <SectionHeader
                                icon="⭐"
                                title="Favorites"
                                count={favoriteProjects.length}
                                theme={theme}
                            />
                            {renderProjects(favoriteProjects)}
                        </>
                    )}

                    {/* ── MY PROJECTS (Owner) ─────────────────── */}
                    <SectionHeader
                        icon="📌"
                        title="My Projects"
                        count={ownerProjects.length}
                        theme={theme}
                    />
                    {ownerProjects.length > 0
                        ? renderProjects(ownerProjects)
                        : <EmptySection message="You don't own any projects in this status." theme={theme} />
                    }

                    {/* ── TEAM PROJECTS (Member) ──────────────── */}
                    {(teamPublic.length > 0 || teamPrivate.length > 0) && (
                        <>
                            <SectionHeader
                                icon="👥"
                                title="Team Projects"
                                count={teamPublic.length + teamPrivate.length}
                                theme={theme}
                            />

                            {teamPublic.length > 0 && (
                                <>
                                    {teamPrivate.length > 0 && (
                                        <SubLabel label="🌐 Public" theme={theme} />
                                    )}
                                    {renderProjects(teamPublic)}
                                </>
                            )}

                            {teamPrivate.length > 0 && (
                                <>
                                    <SubLabel label="🔒 Private" theme={theme} />
                                    {renderProjects(teamPrivate)}
                                </>
                            )}
                        </>
                    )}
                </>
            )}

            {/* ─── Board Distribution (Collapsed) ─────────────── */}
            {boardDistribution.totalBoards > 0 && (
                <div style={{ marginTop: theme.spacing['2xl'] }}>
                    <Collapse
                        ghost
                        items={[{
                            key: 'distribution',
                            label: (
                                <Text strong style={{
                                    fontSize: 13, color: theme.colors.textSecondary,
                                    textTransform: 'uppercase', letterSpacing: '0.5px',
                                }}>
                                    Board Distribution
                                </Text>
                            ),
                            children: (
                                <div style={{
                                    background: theme.colors.surface,
                                    border: `1px solid ${theme.colors.border}`,
                                    borderRadius: theme.borderRadius.lg,
                                    padding: theme.spacing.lg,
                                }}>
                                    {boardDistribution.scoped
                                        .filter(p => parseInt(p.board_count) > 0)
                                        .sort((a, b) => (parseInt(b.board_count) || 0) - (parseInt(a.board_count) || 0))
                                        .slice(0, 10)
                                        .map(p => {
                                            const pct = boardDistribution.totalBoards > 0
                                                ? Math.round((parseInt(p.board_count) / boardDistribution.totalBoards) * 100) : 0;
                                            const gradient = p.background_value || GRADIENTS[(p.id || 0) % GRADIENTS.length];
                                            return (
                                                <div key={p.id} style={{ marginBottom: 10 }}>
                                                    <div style={{
                                                        display: 'flex', justifyContent: 'space-between',
                                                        alignItems: 'center', marginBottom: 3,
                                                    }}>
                                                        <Text style={{ fontSize: 13, color: theme.colors.textPrimary }}>
                                                            {p.name}
                                                        </Text>
                                                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                                                            {p.board_count} boards
                                                        </Text>
                                                    </div>
                                                    <div style={{
                                                        height: 6, background: theme.colors.surfaceHover,
                                                        borderRadius: 3, overflow: 'hidden',
                                                    }}>
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
                            ),
                        }]}
                    />
                </div>
            )}
        </div>
    );
};

export default ProjectsTab;
