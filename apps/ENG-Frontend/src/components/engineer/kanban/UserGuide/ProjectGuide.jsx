/**
 * ProjectGuide.jsx
 * 
 * Interactive guide for the Projects Tab — covers creation, browsing,
 * favorites, status management, views, and the board distribution chart.
 * All UI elements are interactive with working state changes.
 */

import React, { useState, useMemo } from 'react';
import { Typography, Input, Select, Button, Switch, Tag, Badge, Avatar, Tooltip, Progress, Row, Col, Tabs, Divider } from 'antd';
import { BsKanban, BsGrid3X3Gap, BsListUl } from 'react-icons/bs';
import { IoSearchOutline, IoLayersOutline, IoStarOutline, IoStar, IoLockClosedOutline, IoAddOutline } from 'react-icons/io5';
import { MdOutlinePeople } from 'react-icons/md';
import { AiFillStar, AiOutlineStar } from 'react-icons/ai';
import { FiPlus, FiEdit2 } from 'react-icons/fi';
import {
    getSectionCardStyle, getSandboxStyle, SandboxDot, SectionTitle, SectionLabel,
    StepRow, Callout, LabeledDivider,
} from './guideStyles';
import { MOCK_PROJECTS, MOCK_USERS } from './mockData';

const { Text, Paragraph } = Typography;

const ProjectGuide = ({ theme }) => {
    // ─── Interactive State ──────────────────────────────────────────
    const [projects, setProjects] = useState(MOCK_PROJECTS.map(p => ({ ...p })));
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('recent');
    const [viewMode, setViewMode] = useState('card');
    const [statusFilter, setStatusFilter] = useState('active');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectPrivate, setNewProjectPrivate] = useState(false);
    const [selectedIcon, setSelectedIcon] = useState('rocket');
    const [selectedGradient, setSelectedGradient] = useState('linear-gradient(135deg,#6366f1,#8b5cf6)');

    const GRADIENTS = [
        'linear-gradient(135deg,#6366f1,#8b5cf6)', 'linear-gradient(135deg,#0ea5e9,#3b82f6)',
        'linear-gradient(135deg,#10b981,#059669)', 'linear-gradient(135deg,#f59e0b,#ef4444)',
        'linear-gradient(135deg,#ec4899,#f43f5e)', 'linear-gradient(135deg,#475569,#1e293b)',
    ];

    const toggleFavorite = (id) => {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, is_favorite: !p.is_favorite } : p));
    };

    // Filter logic
    const filtered = useMemo(() => {
        let list = projects.filter(p => (p.status || 'active').toLowerCase() === statusFilter);
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(p => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
        }
        if (sortBy === 'recent') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        else if (sortBy === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        else if (sortBy === 'boards') list.sort((a, b) => (b.board_count || 0) - (a.board_count || 0));
        return list;
    }, [projects, search, sortBy, statusFilter]);

    const statusCounts = useMemo(() => ({
        active: projects.filter(p => (p.status || 'active').toLowerCase() === 'active').length,
        waiting: projects.filter(p => (p.status || '').toLowerCase() === 'waiting').length,
        suspended: projects.filter(p => (p.status || '').toLowerCase() === 'suspended').length,
        completed: projects.filter(p => (p.status || '').toLowerCase() === 'completed').length,
    }), [projects]);

    const stats = useMemo(() => {
        const scoped = projects.filter(p => (p.status || 'active').toLowerCase() === statusFilter);
        return {
            total: scoped.length,
            totalBoards: scoped.reduce((s, p) => s + (parseInt(p.board_count) || 0), 0),
            owned: scoped.filter(p => p.role === 'owner').length,
            favorites: scoped.filter(p => p.is_favorite).length,
        };
    }, [projects, statusFilter]);

    const favoriteProjects = filtered.filter(p => p.is_favorite);
    const ownerProjects = filtered.filter(p => p.role === 'owner');
    const teamProjects = filtered.filter(p => p.role !== 'owner');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* ═══════════════════════════════════════════════════════════
                SECTION 1: Stats Overview
               ═══════════════════════════════════════════════════════════ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle
                    icon={<BsKanban />}
                    title="Stats Overview"
                    subtitle="The top row shows real-time aggregate metrics scoped to the currently selected status tab."
                    theme={theme}
                />

                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {[
                            { icon: <BsKanban />, label: 'Total Projects', value: stats.total, color: theme.colors.primary },
                            { icon: <IoLayersOutline />, label: 'Total Boards', value: stats.totalBoards, color: '#10b981' },
                            { icon: <MdOutlinePeople />, label: 'Owned by Me', value: stats.owned, color: '#f59e0b' },
                            { icon: <AiFillStar />, label: 'Favorites', value: stats.favorites, color: '#ef4444' },
                        ].map((stat, i) => (
                            <div key={i} style={{
                                flex: '1 1 140px',
                                padding: '14px 16px',
                                background: theme.colors.surface,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: theme.borderRadius.md || 8,
                                display: 'flex', alignItems: 'center', gap: 12,
                            }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: 8,
                                    background: `${stat.color}15`,
                                    color: stat.color,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 16,
                                }}>
                                    {stat.icon}
                                </div>
                                <div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: theme.colors.textPrimary }}>{stat.value}</div>
                                    <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>{stat.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <Callout type="tip" theme={theme}>
                    Stats automatically update when you switch between <strong>Active</strong>, <strong>Waiting</strong>, <strong>Suspended</strong>, and <strong>Completed</strong> tabs below.
                </Callout>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                SECTION 2: Filter Bar & Controls
               ═══════════════════════════════════════════════════════════ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle
                    icon={<IoSearchOutline />}
                    title="Filter Bar"
                    subtitle="Use these controls to search, sort, and switch views. Every control updates the project list below in real-time."
                    theme={theme}
                />

                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />

                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        flexWrap: 'wrap',
                        padding: '10px 16px',
                        background: theme.colors.surface,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.lg || 12,
                    }}>
                        {/* Search */}
                        <Input
                            placeholder="Search projects..."
                            prefix={<IoSearchOutline color={theme.colors.textTertiary} />}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            allowClear
                            style={{ width: 200, borderRadius: 6 }}
                            size="small"
                        />

                        {/* Sort */}
                        <Select
                            value={sortBy}
                            onChange={setSortBy}
                            size="small"
                            style={{ width: 150 }}
                            options={[
                                { value: 'recent', label: '🕒 Most Recent' },
                                { value: 'name', label: '🔤 Name A→Z' },
                                { value: 'boards', label: '📋 Most Boards' },
                            ]}
                        />

                        {/* Spacer */}
                        <div style={{ flex: 1 }} />

                        {/* View Mode Toggle */}
                        <div style={{
                            display: 'inline-flex',
                            background: theme.colors.surfaceHover,
                            borderRadius: 8, padding: 3, gap: 2,
                        }}>
                            <Tooltip title="Card View">
                                <Button
                                    type="text" size="small"
                                    icon={<BsGrid3X3Gap size={14} />}
                                    onClick={() => setViewMode('card')}
                                    style={{
                                        borderRadius: 6,
                                        ...(viewMode === 'card'
                                            ? { background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.08)', color: '#000' }
                                            : { color: '#666' })
                                    }}
                                />
                            </Tooltip>
                            <Tooltip title="List View">
                                <Button
                                    type="text" size="small"
                                    icon={<BsListUl size={14} />}
                                    onClick={() => setViewMode('list')}
                                    style={{
                                        borderRadius: 6,
                                        ...(viewMode === 'list'
                                            ? { background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.08)', color: '#000' }
                                            : { color: '#666' })
                                    }}
                                />
                            </Tooltip>
                        </div>

                        {/* Create */}
                        <Tooltip title="Create Project">
                            <Button type="text" size="small" icon={<FiPlus size={16} />}
                                onClick={() => setShowCreateForm(!showCreateForm)}
                                style={{ color: theme.colors.textSecondary }}
                            />
                        </Tooltip>
                    </div>
                </div>

                <StepRow number={1} title="Search" description="Type keywords to filter by project name or description." theme={theme} />
                <StepRow number={2} title="Sort" description="Choose between Most Recent, Name A→Z, or Most Boards." theme={theme} />
                <StepRow number={3} title="View Mode" description="Toggle between Card View (visual grid) and List View (compact rows)." theme={theme} />
                <StepRow number={4} title="Create Button" description="The [+] button opens the Create Project form to start a new workspace." theme={theme} />
            </div>

            {/* ═══════════════════════════════════════════════════════════
                SECTION 3: Status Tabs
               ═══════════════════════════════════════════════════════════ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle
                    icon="📊"
                    title="Status Tabs"
                    subtitle="Projects are organized by lifecycle status. Click each tab to filter."
                    theme={theme}
                />

                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <Tabs
                        activeKey={statusFilter}
                        onChange={setStatusFilter}
                        items={[
                            { key: 'active', label: `Active (${statusCounts.active})` },
                            { key: 'waiting', label: `Waiting (Pool) (${statusCounts.waiting})` },
                            { key: 'suspended', label: `Suspended (${statusCounts.suspended})` },
                            { key: 'completed', label: `Completed (${statusCounts.completed})` },
                        ]}
                        style={{ marginBottom: 0 }}
                    />
                </div>

                <Callout type="info" title="Status Meanings" theme={theme}>
                    <strong>Active</strong> — Currently in progress. <strong>Waiting (Pool)</strong> — Queued for future start.
                    <strong> Suspended</strong> — Paused (blocked or on hold). <strong>Completed</strong> — Finished & archived for reference.
                </Callout>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                SECTION 4: Project Cards (Interactive Grid)
               ═══════════════════════════════════════════════════════════ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle
                    icon="📌"
                    title="Project Listing"
                    subtitle="Projects are grouped into Favorites, My Projects (owner), and Team Projects. Click the star to toggle favorites."
                    theme={theme}
                />

                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />

                    {/* Favorites */}
                    {favoriteProjects.length > 0 && (
                        <>
                            <SectionLabel theme={theme} icon="⭐">Favorites</SectionLabel>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                                {favoriteProjects.map(p => (
                                    <ProjectMockCard key={p.id} project={p} theme={theme} viewMode={viewMode} onToggleFav={() => toggleFavorite(p.id)} />
                                ))}
                            </div>
                        </>
                    )}

                    {/* My Projects */}
                    <SectionLabel theme={theme} icon="📌">My Projects</SectionLabel>
                    {ownerProjects.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                            {ownerProjects.map(p => (
                                <ProjectMockCard key={p.id} project={p} theme={theme} viewMode={viewMode} onToggleFav={() => toggleFavorite(p.id)} />
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: theme.colors.textTertiary, fontSize: 13 }}>
                            No projects owned by you in this status.
                        </div>
                    )}

                    {/* Team Projects */}
                    {teamProjects.length > 0 && (
                        <>
                            <SectionLabel theme={theme} icon="👥">Team Projects</SectionLabel>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                                {teamProjects.map(p => (
                                    <ProjectMockCard key={p.id} project={p} theme={theme} viewMode={viewMode} onToggleFav={() => toggleFavorite(p.id)} />
                                ))}
                            </div>
                        </>
                    )}

                    {filtered.length === 0 && (
                        <div style={{
                            textAlign: 'center', padding: '40px 0',
                            background: theme.colors.surface,
                            borderRadius: theme.borderRadius.lg || 12,
                            border: `1px dashed ${theme.colors.border}`,
                        }}>
                            <BsKanban size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                            <div style={{ color: theme.colors.textTertiary, fontSize: 13 }}>No projects match your criteria.</div>
                        </div>
                    )}
                </div>

                <Callout type="feature" title="Card Elements" theme={theme}>
                    Each project card displays: <strong>Gradient banner</strong> with icon, <strong>Project name</strong>,
                    <strong> Board count</strong>, <strong>Role badge</strong> (Owner/Editor/Viewer),
                    <strong> Privacy lock</strong> 🔒 for private projects, and the <strong>Star</strong> toggle for favorites.
                </Callout>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                SECTION 5: Create Project
               ═══════════════════════════════════════════════════════════ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle
                    icon={<FiPlus />}
                    title="Creating a New Project"
                    subtitle="Step-by-step walkthrough of the project creation form."
                    theme={theme}
                />

                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />

                    <div style={{
                        background: theme.colors.surface,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.lg || 12,
                        padding: 20,
                        maxWidth: 480,
                    }}>
                        <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 16 }}>
                            Create New Project
                        </Text>

                        {/* Name */}
                        <div style={{ marginBottom: 14 }}>
                            <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Project Name</Text>
                            <Input
                                placeholder="e.g. Swage Tool Redesign"
                                value={newProjectName}
                                onChange={e => setNewProjectName(e.target.value)}
                                style={{ borderRadius: 6 }}
                            />
                        </div>

                        {/* Gradient Picker */}
                        <div style={{ marginBottom: 14 }}>
                            <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Cover Gradient</Text>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {GRADIENTS.map(g => (
                                    <div
                                        key={g}
                                        onClick={() => setSelectedGradient(g)}
                                        style={{
                                            width: 36, height: 24, borderRadius: 6,
                                            background: g, cursor: 'pointer',
                                            border: selectedGradient === g ? '2px solid #333' : '2px solid transparent',
                                            transition: 'border 0.15s',
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Privacy Toggle */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 12px',
                            background: theme.colors.surfaceHover,
                            borderRadius: 8, marginBottom: 14,
                        }}>
                            <div>
                                <Text strong style={{ fontSize: 13 }}>Private Project</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: 11 }}>Only assigned members can see this project</Text>
                            </div>
                            <Switch checked={newProjectPrivate} onChange={setNewProjectPrivate} />
                        </div>

                        {/* Preview */}
                        <div style={{
                            height: 60, borderRadius: 8,
                            background: selectedGradient,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontWeight: 700, fontSize: 14,
                            marginBottom: 14,
                        }}>
                            {newProjectName || 'Project Preview'}
                            {newProjectPrivate && <IoLockClosedOutline size={14} style={{ marginLeft: 8 }} />}
                        </div>

                        <Button type="primary" block
                            disabled={!newProjectName.trim()}
                            style={{
                                background: theme.colors.primary,
                                borderColor: theme.colors.primary,
                                borderRadius: 8,
                            }}
                        >
                            Create Project
                        </Button>
                    </div>
                </div>

                <StepRow number={1} title="Enter a descriptive project name" theme={theme} />
                <StepRow number={2} title="Select a cover gradient to visually distinguish the project" theme={theme} />
                <StepRow number={3} title="Toggle Privacy if the project should be restricted to members only" theme={theme} />
                <StepRow number={4} title="Click 'Create Project' to finalize" theme={theme} />

                <Callout type="warning" title="Private Projects" theme={theme}>
                    When a project is set to <strong>Private</strong>, only explicitly added members (and system admins) can view it.
                    The project will show a 🔒 lock icon in the project listing. Non-members will not see it at all.
                </Callout>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                SECTION 6: Board Distribution
               ═══════════════════════════════════════════════════════════ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle
                    icon="📊"
                    title="Board Distribution"
                    subtitle="A collapsible bar chart showing how boards are distributed across projects."
                    theme={theme}
                />

                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    {projects
                        .filter(p => (p.status || 'active').toLowerCase() === statusFilter && p.board_count > 0)
                        .sort((a, b) => b.board_count - a.board_count)
                        .map(p => {
                            const totalBoards = projects.filter(pp => (pp.status || 'active').toLowerCase() === statusFilter)
                                .reduce((s, pp) => s + (pp.board_count || 0), 0);
                            const pct = totalBoards > 0 ? Math.round((p.board_count / totalBoards) * 100) : 0;
                            return (
                                <div key={p.id} style={{ marginBottom: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                        <Text style={{ fontSize: 13 }}>{p.name}</Text>
                                        <Text type="secondary" style={{ fontSize: 12 }}>{p.board_count} boards</Text>
                                    </div>
                                    <div style={{ height: 6, background: theme.colors.surfaceHover, borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', width: `${pct}%`,
                                            background: p.background_value || theme.colors.primary,
                                            borderRadius: 3,
                                            transition: 'width 0.6s ease',
                                        }} />
                                    </div>
                                </div>
                            );
                        })}
                </div>

                <Callout type="tip" theme={theme}>
                    In the production interface, this section is collapsed by default. Click the header to expand it.
                    It helps managers identify which projects have the most boards and may need resource rebalancing.
                </Callout>
            </div>
        </div>
    );
};

/* ─── Mock Project Card ──────────────────────────────────────────────── */
const ProjectMockCard = ({ project, theme, viewMode, onToggleFav }) => {
    const [hovered, setHovered] = useState(false);

    if (viewMode === 'list') {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', width: '100%',
                background: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 8,
            }}>
                <div style={{
                    width: 32, height: 32, borderRadius: 6,
                    background: project.background_value,
                    flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                    <Text strong style={{ fontSize: 13 }}>{project.name}</Text>
                    {project.is_private && <IoLockClosedOutline size={12} style={{ marginLeft: 6, color: '#8b5cf6' }} />}
                </div>
                <Tag style={{ fontSize: 11, margin: 0 }}>{project.board_count} boards</Tag>
                <Tag color={project.role === 'owner' ? 'blue' : project.role === 'editor' ? 'green' : 'default'} style={{ fontSize: 11, margin: 0, textTransform: 'capitalize' }}>
                    {project.role}
                </Tag>
                <div onClick={(e) => { e.stopPropagation(); onToggleFav(); }} style={{ cursor: 'pointer' }}>
                    {project.is_favorite ? <AiFillStar size={16} color="#f59e0b" /> : <AiOutlineStar size={16} color={theme.colors.textTertiary} />}
                </div>
            </div>
        );
    }

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                width: 220, borderRadius: 10, overflow: 'hidden',
                background: theme.colors.surface,
                border: `1px solid ${hovered ? `${theme.colors.primary}40` : theme.colors.border}`,
                boxShadow: hovered ? theme.shadows.md : theme.shadows.xs,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                transform: hovered ? 'translateY(-2px)' : 'none',
            }}
        >
            {/* Gradient Banner */}
            <div style={{
                height: 52, background: project.background_value,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
            }}>
                {project.is_private && (
                    <IoLockClosedOutline size={14} color="rgba(255,255,255,0.8)" style={{ position: 'absolute', top: 8, left: 10 }} />
                )}
                <div
                    onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
                    style={{ position: 'absolute', top: 6, right: 8, cursor: 'pointer' }}
                >
                    {project.is_favorite
                        ? <AiFillStar size={18} color="#f59e0b" />
                        : <AiOutlineStar size={18} color="rgba(255,255,255,0.7)" />
                    }
                </div>
            </div>
            {/* Content */}
            <div style={{ padding: '10px 12px' }}>
                <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>{project.name}</Text>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>{project.board_count} boards</Text>
                    <Tag
                        color={project.role === 'owner' ? 'blue' : project.role === 'editor' ? 'green' : 'default'}
                        style={{ fontSize: 10, margin: 0, textTransform: 'capitalize', lineHeight: '18px' }}
                    >
                        {project.role}
                    </Tag>
                </div>
            </div>
        </div>
    );
};

export default ProjectGuide;
