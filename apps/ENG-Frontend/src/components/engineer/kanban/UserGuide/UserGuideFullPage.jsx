/**
 * UserGuideFullPage.jsx
 * 
 * Dedicated full-page layout for the Kanban System Manual.
 * Left sidebar navigation + right content area.
 * Accessible via /eng/kanban/guide route.
 */

import React, { useState } from 'react';
import { Typography, Input, Badge, Button } from 'antd';
import { IoSearchOutline, IoBookOutline, IoChevronBackOutline } from 'react-icons/io5';
import { useTheme } from '../../../../theme';
import { useNavigate } from 'react-router-dom';
import ScrollbarStyle from '../../../common/scrollbar';
import { GUIDE_SECTIONS } from './guideStyles';

// Sub-guide imports
import ProjectGuide from './ProjectGuide';
import BoardGuideDrawer from './BoardGuideDrawer';
import CardGuide from './CardGuide';
import BoardToolbarGuide from './BoardToolbarGuide';
import SettingsGuide from './SettingsGuide';
import TemplatesGuide from './TemplatesGuide';
import PermissionsGuide from './PermissionsGuide';

const { Text } = Typography;

const GUIDE_COMPONENTS = {
    'projects': ProjectGuide,
    'board-canvas': BoardGuideDrawer,
    'board-toolbar': BoardToolbarGuide,
    'card-detail': CardGuide,
    'settings': SettingsGuide,
    'templates': TemplatesGuide,
    'permissions': PermissionsGuide,
};

const UserGuideFullPage = () => {
    const { theme } = useTheme();
    const navigate = useNavigate();
    const [activeGuide, setActiveGuide] = useState('projects');
    const [search, setSearch] = useState('');
    const [visitedSections, setVisitedSections] = useState(['projects']);

    const handleOpenGuide = (key) => {
        setActiveGuide(key);
        if (!visitedSections.includes(key)) {
            setVisitedSections(prev => [...prev, key]);
        }
    };

    // Filter sections by search
    const filteredSections = GUIDE_SECTIONS.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase())
    );

    const ActiveComponent = GUIDE_COMPONENTS[activeGuide];
    const activeSection = GUIDE_SECTIONS.find(s => s.key === activeGuide);

    return (
        <div style={{
            height: 'calc(100vh - 64px)',
            display: 'flex',
            background: theme.colors.background,
            overflow: 'hidden',
        }}>
            <ScrollbarStyle primary={theme.colors.primary} />

            {/* ═══ Left Sidebar ═══ */}
            <div style={{
                width: 300,
                minWidth: 300,
                background: theme.colors.surface,
                borderRight: `1px solid ${theme.colors.border}`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>
                {/* Sidebar Header */}
                <div style={{
                    padding: '20px 16px 12px',
                    borderBottom: `1px solid ${theme.colors.border}`,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <Button type="text" size="small" icon={<IoChevronBackOutline size={16} />}
                            onClick={() => navigate('/eng/kanban')}
                            style={{ color: theme.colors.textSecondary }} />
                        <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: `${theme.colors.primary}20`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <IoBookOutline size={18} color={theme.colors.primary} />
                        </div>
                        <div>
                            <Text strong style={{ fontSize: 15, display: 'block', lineHeight: 1.2 }}>
                                System Manual
                            </Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                                {visitedSections.length}/{GUIDE_SECTIONS.length} explored
                            </Text>
                        </div>
                    </div>

                    {/* Search */}
                    <Input
                        placeholder="Search topics..."
                        prefix={<IoSearchOutline size={14} color={theme.colors.textTertiary} />}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        allowClear
                        size="small"
                        style={{ borderRadius: 6 }}
                    />
                </div>

                {/* Section List */}
                <div className="kb-vscroll" style={{
                    flex: 1, overflowY: 'auto', padding: '8px 8px',
                }}>
                    {filteredSections.map(section => {
                        const isActive = activeGuide === section.key;
                        const isVisited = visitedSections.includes(section.key);
                        return (
                            <div
                                key={section.key}
                                onClick={() => handleOpenGuide(section.key)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 12px',
                                    borderRadius: theme.borderRadius.md || 8,
                                    cursor: 'pointer',
                                    marginBottom: 2,
                                    background: isActive ? `${theme.colors.primary}12` : 'transparent',
                                    borderLeft: isActive ? `3px solid ${theme.colors.primary}` : '3px solid transparent',
                                    transition: 'all 0.15s ease',
                                }}
                                onMouseOver={e => { if (!isActive) e.currentTarget.style.background = theme.colors.surfaceHover; }}
                                onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{section.icon}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Text strong={isActive} style={{
                                        fontSize: 13,
                                        color: isActive ? theme.colors.primary : theme.colors.textPrimary,
                                        display: 'block',
                                    }}>
                                        {section.title}
                                    </Text>
                                    <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                                        {section.description}
                                    </Text>
                                </div>
                                {isVisited && !isActive && (
                                    <span style={{
                                        width: 6, height: 6, borderRadius: '50%',
                                        background: '#52c41a', flexShrink: 0,
                                    }} />
                                )}
                            </div>
                        );
                    })}

                    {filteredSections.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '24px 0', color: theme.colors.textTertiary, fontSize: 12 }}>
                            No topics match "{search}"
                        </div>
                    )}
                </div>

                {/* Sidebar Footer */}
                <div style={{
                    padding: '8px 16px',
                    borderTop: `1px solid ${theme.colors.border}`,
                    textAlign: 'center',
                }}>
                    <Text type="secondary" style={{ fontSize: 10 }}>
                        All simulations use mock data
                    </Text>
                </div>
            </div>

            {/* ═══ Right Content Area ═══ */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>
                {/* Content Header */}
                <div style={{
                    padding: '16px 28px',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    background: theme.colors.surface,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 24 }}>{activeSection?.icon}</span>
                        <div>
                            <Text strong style={{ fontSize: 18, display: 'block', lineHeight: 1.2 }}>
                                {activeSection?.title} Guide
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                {activeSection?.description}
                            </Text>
                        </div>
                    </div>

                    <Badge
                        count={`${visitedSections.length}/${GUIDE_SECTIONS.length}`}
                        style={{
                            backgroundColor: visitedSections.length === GUIDE_SECTIONS.length ? '#52c41a' : theme.colors.primary,
                            fontSize: 11, fontWeight: 600,
                        }}
                    />
                </div>

                {/* Content Body */}
                <div className="kb-vscroll" style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '24px 28px',
                }}>
                    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                        {ActiveComponent && <ActiveComponent theme={theme} />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserGuideFullPage;
