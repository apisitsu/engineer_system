import React, { useMemo, useState } from 'react';
import { Input, Select, Tooltip, Button, Row, Col, Typography, Tabs } from 'antd';
import { IoSearchOutline } from 'react-icons/io5';
import { FiPlus } from 'react-icons/fi';
import ProjectGridCard from './components/ProjectGridCard';
import ProjectListRow from './components/ProjectListRow';

const { Text } = Typography;

const ProjectsTab = ({
    projects,
    onSelectProject,
    onToggleFavorite,
    onOpenProjectSettings,
    onShowCreateModal,
    theme
}) => {
    const [search, setSearch] = useState('');
    const [filterOwner, setFilterOwner] = useState('all');
    const [sortBy, setSortBy] = useState('recent');
    const [viewMode, setViewMode] = useState('grid');
    const [projectStatusFilter, setProjectStatusFilter] = useState('active');

    const filteredProjects = useMemo(() => {
        let list = [...projects];

        // Status Filter
        list = list.filter(p => (p.status || 'active').toLowerCase() === projectStatusFilter);

        if (search) {
            const q = search.toLowerCase();
            list = list.filter(p => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
        }
        if (filterOwner === 'mine') list = list.filter(p => p.role === 'owner');
        if (filterOwner === 'favorites') list = list.filter(p => p.is_favorite);

        if (sortBy === 'recent') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        else if (sortBy === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        else if (sortBy === 'boards') list.sort((a, b) => (b.board_count || 0) - (a.board_count || 0));

        return list;
    }, [projects, search, filterOwner, sortBy, projectStatusFilter]);

    return (
        <div>
            {/* Filter Bar */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: theme.spacing.md,
                flexWrap: 'wrap', marginBottom: theme.spacing.xl,
                padding: `${theme.spacing.md} ${theme.spacing.lg}`,
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
                    style={{ width: 260, borderRadius: theme.borderRadius.sm }}
                />
                <Select
                    value={filterOwner}
                    onChange={setFilterOwner}
                    style={{ width: 140 }}
                    options={[
                        { value: 'all', label: 'All Projects' },
                        { value: 'mine', label: 'Owned by Me' },
                        { value: 'favorites', label: '⭐ Favorites' },
                    ]}
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
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
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
            {/* <Tabs
                activeKey={projectStatusFilter}
                onChange={setProjectStatusFilter}
                items={[
                    { key: 'active', label: '✅ Active' },
                    { key: 'waiting', label: '⏳ Waiting(Pool)' },
                    { key: 'suspended', label: '🚫 Suspend' },
                    { key: 'completed', label: '🏁 Completed' },
                ]}
                style={{ marginBottom: theme.spacing.md }}
            /> */}
            <Tabs
                activeKey={projectStatusFilter}
                onChange={setProjectStatusFilter}
                items={[
                    { key: 'active', label: 'Active' },
                    { key: 'waiting', label: 'Waiting(Pool)' },
                    { key: 'suspended', label: 'Suspend' },
                    { key: 'completed', label: 'Completed' },
                ]}
                style={{ marginBottom: theme.spacing.md }}
            />

            {/* Projects Grid/List */}
            {filteredProjects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 0', background: theme.colors.surface, borderRadius: theme.borderRadius.lg, border: `1px dashed ${theme.colors.border}` }}>
                    <Text type="secondary">No projects found matching your criteria.</Text>
                </div>
            ) : viewMode === 'grid' ? (
                <Row gutter={[24, 24]}>
                    {filteredProjects.map(p => (
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
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                    {filteredProjects.map(p => (
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
    );
};

export default ProjectsTab;
