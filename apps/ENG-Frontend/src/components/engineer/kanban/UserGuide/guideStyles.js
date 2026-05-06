/**
 * guideStyles.js
 * 
 * Shared styling utilities for the Kanban User Guide system.
 * Ported and refined from the legacy BoardGuide.jsx getSandboxStyle pattern.
 * Provides a consistent design language across all guide components.
 */

// ─── CORE LAYOUT STYLES ────────────────────────────────────────────

/** Section container — the outer card for each major guide section */
export const getSectionCardStyle = (theme) => ({
    background: theme.colors.surface,
    padding: '28px',
    borderRadius: theme.borderRadius.xl || 16,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadows.sm,
    marginBottom: '28px',
});

/** Interactive sandbox — the "try it yourself" container */
export const getSandboxStyle = (theme) => ({
    background: theme.colors.background,
    borderRadius: theme.borderRadius.lg || 12,
    border: `1.5px dashed ${theme.colors.border}`,
    padding: '24px',
    margin: '16px 0',
    position: 'relative',
});

/** Glass-effect overlay panels */
export const getGlassStyle = (theme) => ({
    background: `${theme.colors.surface}E8`,
    backdropFilter: 'blur(12px)',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg || 12,
    padding: '20px',
});

// ─── ANNOTATION COMPONENTS ──────────────────────────────────────────

/** Step indicator — numbered circle badge for sequential walkthroughs */
export const StepBadge = ({ number, theme, active, size = 28 }) => (
    <div style={{
        width: size, height: size,
        borderRadius: '50%',
        background: active ? theme.colors.primary : `${theme.colors.primary}15`,
        color: active ? '#fff' : theme.colors.primary,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.43,
        fontWeight: 700,
        flexShrink: 0,
        border: `2px solid ${active ? theme.colors.primary : `${theme.colors.primary}40`}`,
        transition: 'all 0.2s ease',
    }}>
        {number}
    </div>
);

/** Step row — combines a step badge with content */
export const StepRow = ({ number, title, description, theme, active = true, children }) => (
    <div style={{
        display: 'flex', gap: 14, alignItems: 'flex-start',
        padding: '12px 0',
        borderBottom: `1px solid ${theme.colors.border}22`,
    }}>
        <StepBadge number={number} theme={theme} active={active} />
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
                fontSize: 14, fontWeight: 600,
                color: theme.colors.textPrimary,
                marginBottom: description || children ? 4 : 0,
            }}>
                {title}
            </div>
            {description && (
                <div style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 1.6 }}>
                    {description}
                </div>
            )}
            {children}
        </div>
    </div>
);

/** Section label — uppercase tiny label used inside sandboxes */
export const SectionLabel = ({ children, theme, icon }) => (
    <div style={{
        fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2,
        color: theme.colors.textTertiary, fontWeight: 700,
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 10, marginTop: 4,
    }}>
        {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
        {children}
    </div>
);

/** Section title — bold heading for guide sections */
export const SectionTitle = ({ icon, title, subtitle, theme }) => (
    <div style={{ marginBottom: 20 }}>
        <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 17, fontWeight: 700, color: theme.colors.textPrimary,
            marginBottom: subtitle ? 6 : 0,
        }}>
            {icon && <span style={{ color: theme.colors.primary, fontSize: 20, display: 'flex' }}>{icon}</span>}
            {title}
        </div>
        {subtitle && (
            <div style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 1.6, marginLeft: icon ? 30 : 0 }}>
                {subtitle}
            </div>
        )}
    </div>
);

// ─── CALLOUT BLOCKS ─────────────────────────────────────────────────

const CALLOUT_TYPES = {
    info: { bg: '#e6f7ff', border: '#91d5ff', icon: 'ℹ️', color: '#096dd9' },
    tip: { bg: '#f6ffed', border: '#b7eb8f', icon: '💡', color: '#389e0d' },
    warning: { bg: '#fff7e6', border: '#ffd591', icon: '⚠️', color: '#d46b08' },
    danger: { bg: '#fff1f0', border: '#ffa39e', icon: '🚨', color: '#cf1322' },
    feature: { bg: '#f9f0ff', border: '#d3adf7', icon: '✨', color: '#722ed1' },
};

/** Callout block — highlighted info/tip/warning boxes */
export const Callout = ({ type = 'info', title, children, theme }) => {
    const cfg = CALLOUT_TYPES[type] || CALLOUT_TYPES.info;
    return (
        <div style={{
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            borderRadius: theme.borderRadius.md || 8,
            padding: '12px 16px',
            margin: '12px 0',
            display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
            <div style={{ flex: 1 }}>
                {title && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: cfg.color, marginBottom: 4 }}>
                        {title}
                    </div>
                )}
                <div style={{ fontSize: 13, color: cfg.color, lineHeight: 1.6 }}>
                    {children}
                </div>
            </div>
        </div>
    );
};

// ─── INTERACTIVE UI HELPERS ─────────────────────────────────────────

/** Toggle row — for sandbox switch demonstrations */
export const ToggleRow = ({ title, description, checked, onChange, theme, disabled }) => (
    <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 0',
    }}>
        <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.colors.textPrimary }}>{title}</div>
            {description && (
                <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>{description}</div>
            )}
        </div>
        <span>{/* Switch is rendered by consumer with antd */}</span>
    </div>
);

/** Mock toolbar button — simulates a toolbar button for demonstration */
export const MockToolbarButton = ({ icon, label, active, onClick, theme, badge }) => (
    <div
        onClick={onClick}
        style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px',
            borderRadius: theme.borderRadius.sm || 6,
            fontSize: 13,
            fontWeight: active ? 600 : 400,
            background: active ? `${theme.colors.primary}15` : 'transparent',
            color: active ? theme.colors.primary : theme.colors.textSecondary,
            border: `1px solid ${active ? `${theme.colors.primary}40` : 'transparent'}`,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            position: 'relative',
        }}
    >
        {icon}
        {label}
        {badge > 0 && (
            <span style={{
                position: 'absolute', top: -6, right: -6,
                background: theme.colors.error || '#f5222d',
                color: '#fff', fontSize: 10, fontWeight: 700,
                width: 16, height: 16, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                {badge}
            </span>
        )}
    </div>
);

/** Key badge — for keyboard shortcut display */
export const KeyBadge = ({ children, theme }) => (
    <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: '2px 8px',
        fontSize: 11, fontWeight: 600,
        fontFamily: 'monospace',
        background: theme.colors.surfaceHover,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: 4,
        color: theme.colors.textPrimary,
    }}>
        {children}
    </span>
);

/** Dot indicator for sandbox section */
export const SandboxDot = ({ theme }) => (
    <div style={{
        position: 'absolute', top: 10, right: 12,
        display: 'flex', gap: 4, alignItems: 'center',
    }}>
        <span style={{ fontSize: 9, color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginRight: 4 }}>
            Interactive
        </span>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#52c41a' }} />
    </div>
);

/** Divider with label */
export const LabeledDivider = ({ label, theme }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        margin: '20px 0 16px',
    }}>
        <div style={{ flex: 1, height: 1, background: theme.colors.border }} />
        <span style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: 1, color: theme.colors.textTertiary,
        }}>
            {label}
        </span>
        <div style={{ flex: 1, height: 1, background: theme.colors.border }} />
    </div>
);

// ─── BADGE COLORS ───────────────────────────────────────────────────

export const BADGE_COLORS = {
    overdue: { bg: '#eb5a46', text: '#fff' },
    dueSoon: { bg: '#f2d600', text: '#333' },
    onTime: { bg: '#61bd4f', text: '#fff' },
    suspended: { bg: '#fff1f0', text: '#cf1322', border: '#ffa39e' },
    private: { bg: '#f9f0ff', text: '#722ed1', border: '#d3adf7' },
};

// ─── NAVIGATION HELPERS ─────────────────────────────────────────────

export const GUIDE_SECTIONS = [
    { key: 'projects', title: 'Projects', icon: '📌', description: 'Create, browse & manage project workspaces' },
    { key: 'board-canvas', title: 'Board Canvas', icon: '🎨', description: 'Lists, cards, drag-and-drop & WIP limits' },
    { key: 'board-toolbar', title: 'Board Toolbar', icon: '🔧', description: 'Filtering, search, notifications & view modes' },
    { key: 'card-detail', title: 'Card Detail', icon: '📋', description: 'The command center for every individual task' },
    { key: 'settings', title: 'Settings', icon: '⚙️', description: 'Board & project configuration drawers' },
    { key: 'templates', title: 'Templates', icon: '📐', description: 'Blueprints, card, checklist & label templates' },
    { key: 'permissions', title: 'Permissions & Security', icon: '🔐', description: 'RBAC, visibility, suspension & audit trail' },
];
