/**
 * UserGuideDrawer.jsx
 * 
 * Navigation Hub for the Engineering Kanban User Manual.
 * Opens as a full-width drawer with a sidebar menu linking to each sub-guide.
 * Serves as the master entry point accessible from KanbanMain's "?" button.
 */

import React, { useState } from 'react';
import { Drawer, Typography, Space, Input, Badge, Button, Divider, Tooltip } from 'antd';
import { BsKanban } from 'react-icons/bs';
import { IoSearchOutline, IoChevronForwardOutline, IoBookOutline, IoCloseOutline } from 'react-icons/io5';
import { GUIDE_SECTIONS, getSectionCardStyle } from './guideStyles';

// Sub-guide imports
import ProjectGuide from './ProjectGuide';
import BoardGuideDrawer from './BoardGuideDrawer';
import CardGuide from './CardGuide';
import BoardToolbarGuide from './BoardToolbarGuide';
import SettingsGuide from './SettingsGuide';
import TemplatesGuide from './TemplatesGuide';
import PermissionsGuide from './PermissionsGuide';

const { Text, Paragraph } = Typography;

const GUIDE_COMPONENTS = {
    'projects': ProjectGuide,
    'board-canvas': BoardGuideDrawer,
    'board-toolbar': BoardToolbarGuide,
    'card-detail': CardGuide,
    'settings': SettingsGuide,
    'templates': TemplatesGuide,
    'permissions': PermissionsGuide,
};

const UserGuideDrawer = ({ open, onClose, theme }) => {
    const [activeGuide, setActiveGuide] = useState(null);
    const [search, setSearch] = useState('');
    const [visitedSections, setVisitedSections] = useState([]);

    const handleOpenGuide = (key) => {
        setActiveGuide(key);
        if (!visitedSections.includes(key)) {
            setVisitedSections(prev => [...prev, key]);
        }
    };

    const handleBack = () => setActiveGuide(null);

    // Filter sections by search
    const filteredSections = GUIDE_SECTIONS.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase())
    );

    // Render the active guide component inline
    const ActiveComponent = activeGuide ? GUIDE_COMPONENTS[activeGuide] : null;

    return (
        <Drawer
            title={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Space>
                        {activeGuide && (
                            <Button
                                type="text"
                                size="small"
                                onClick={handleBack}
                                style={{ color: theme.colors.textSecondary, marginRight: 4 }}
                            >
                                ← Back
                            </Button>
                        )}
                        <BsKanban size={22} color={theme.colors.primary} />
                        <span style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: 700 }}>
                            {activeGuide
                                ? GUIDE_SECTIONS.find(s => s.key === activeGuide)?.title + ' Guide'
                                : 'Kanban System Manual'
                            }
                        </span>
                    </Space>
                    {!activeGuide && (
                        <Badge
                            count={`${visitedSections.length}/${GUIDE_SECTIONS.length}`}
                            style={{
                                backgroundColor: visitedSections.length === GUIDE_SECTIONS.length ? '#52c41a' : theme.colors.primary,
                                fontSize: 11, fontWeight: 600,
                            }}
                        />
                    )}
                </div>
            }
            placement="right"
            onClose={onClose}
            open={open}
            width={activeGuide ? 820 : 700}
            styles={{
                header: {
                    background: theme.colors.surface,
                    borderBottom: `1px solid ${theme.colors.border}`,
                },
                body: {
                    background: theme.colors.background,
                    padding: activeGuide ? theme.spacing.xl : theme.spacing['2xl'],
                },
            }}
        >
            {activeGuide && ActiveComponent ? (
                /* ─── Active Guide Content ─── */
                <ActiveComponent theme={theme} />
            ) : (
                /* ─── Navigation Hub ─── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Hero Banner */}
                    <div style={{
                        background: `linear-gradient(135deg, ${theme.colors.primary}12, ${theme.colors.secondary || theme.colors.primary}08)`,
                        borderRadius: theme.borderRadius.xl || 16,
                        padding: '28px 24px',
                        border: `1px solid ${theme.colors.primary}20`,
                        marginBottom: 8,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: `${theme.colors.primary}20`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <IoBookOutline size={24} color={theme.colors.primary} />
                            </div>
                            <div>
                                <Text strong style={{ fontSize: 18, display: 'block', color: theme.colors.textPrimary }}>
                                    Engineering Kanban System
                                </Text>
                                <Text style={{ fontSize: 13, color: theme.colors.textSecondary }}>
                                    Complete Interactive Reference Manual
                                </Text>
                            </div>
                        </div>
                        <Paragraph style={{ fontSize: 13, color: theme.colors.textSecondary, margin: 0, lineHeight: 1.7 }}>
                            This comprehensive guide covers every feature of the Kanban project management system.
                            Each section contains <strong>interactive simulations</strong> that mirror the production interface —
                            click, toggle, and explore to build muscle memory before using the real system.
                        </Paragraph>
                    </div>

                    {/* Search */}
                    <Input
                        placeholder="Search guide topics..."
                        prefix={<IoSearchOutline size={16} color={theme.colors.textTertiary} />}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        allowClear
                        style={{
                            borderRadius: theme.borderRadius.md || 8,
                            marginBottom: 4,
                        }}
                    />

                    {/* Section Cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {filteredSections.map((section) => {
                            const isVisited = visitedSections.includes(section.key);
                            return (
                                <div
                                    key={section.key}
                                    onClick={() => handleOpenGuide(section.key)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 14,
                                        padding: '16px 18px',
                                        background: theme.colors.surface,
                                        border: `1px solid ${isVisited ? `${theme.colors.primary}30` : theme.colors.border}`,
                                        borderRadius: theme.borderRadius.lg || 12,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = `${theme.colors.primary}60`;
                                        e.currentTarget.style.boxShadow = theme.shadows.md;
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = isVisited ? `${theme.colors.primary}30` : theme.colors.border;
                                        e.currentTarget.style.boxShadow = 'none';
                                        e.currentTarget.style.transform = 'none';
                                    }}
                                >
                                    {/* Icon */}
                                    <div style={{
                                        width: 42, height: 42,
                                        borderRadius: 10,
                                        background: `${theme.colors.primary}10`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 20, flexShrink: 0,
                                    }}>
                                        {section.icon}
                                    </div>

                                    {/* Text */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Text strong style={{ fontSize: 14, display: 'block', color: theme.colors.textPrimary }}>
                                            {section.title}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                                            {section.description}
                                        </Text>
                                    </div>

                                    {/* Status & Arrow */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                        {isVisited && (
                                            <Tooltip title="Explored">
                                                <span style={{
                                                    width: 8, height: 8, borderRadius: '50%',
                                                    background: '#52c41a', display: 'inline-block',
                                                }} />
                                            </Tooltip>
                                        )}
                                        <IoChevronForwardOutline size={16} color={theme.colors.textTertiary} />
                                    </div>
                                </div>
                            );
                        })}

                        {filteredSections.length === 0 && (
                            <div style={{
                                textAlign: 'center', padding: '40px 0',
                                color: theme.colors.textTertiary, fontSize: 13,
                            }}>
                                No guide sections match "{search}"
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <Divider style={{ margin: '16px 0 8px' }} />
                    <div style={{ textAlign: 'center' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Engineering Projects Management System &copy; {new Date().getFullYear()}
                        </Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            All interactive simulations use mock data — no production data is affected.
                        </Text>
                    </div>
                </div>
            )}
        </Drawer>
    );
};

export default UserGuideDrawer;
