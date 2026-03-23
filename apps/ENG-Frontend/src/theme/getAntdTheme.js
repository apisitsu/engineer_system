// Dynamic Ant Design theme configuration based on current theme
export const getAntdTheme = (theme) => ({
    token: {
        colorPrimary: theme.colors.primary,
        colorSuccess: theme.colors.success,
        colorWarning: theme.colors.warning,
        colorError: theme.colors.error,
        colorInfo: theme.colors.info,
        colorBgContainer: theme.colors.surface,
        colorBgLayout: theme.colors.background,
        colorBorder: theme.colors.border,
        colorText: theme.colors.textPrimary,
        colorTextSecondary: theme.colors.textSecondary,
        borderRadius: parseInt(theme.borderRadius.md),
        fontSize: parseInt(theme.typography.fontSize.base),
        fontFamily: theme.typography.fontFamily,
    },
    components: {
        Button: {
            controlHeight: 40,
            borderRadius: parseInt(theme.borderRadius.md),
            colorPrimary: theme.colors.primary,
            algorithm: true,
        },
        Card: {
            borderRadiusLG: parseInt(theme.borderRadius.lg),
            boxShadow: theme.shadows.sm,
        },
        Table: {
            headerBg: theme.colors.hover,
            borderColor: theme.colors.border,
        },
        Input: {
            controlHeight: 40,
            borderRadius: parseInt(theme.borderRadius.md),
            colorBgContainer: theme.colors.background,    // Input background (lighter than surface)
            colorText: theme.colors.textPrimary,          // Input text color
            colorTextPlaceholder: theme.colors.textTertiary, // Placeholder text
            colorBorder: theme.colors.border,             // Input border
        },
        TextArea: {
            colorBgContainer: theme.colors.background,
            colorText: theme.colors.textPrimary,
            colorTextPlaceholder: theme.colors.textTertiary,
        },
        Select: {
            controlHeight: 40,
            borderRadius: parseInt(theme.borderRadius.md),
            colorBgContainer: theme.colors.background,
            colorText: theme.colors.textPrimary,
            optionSelectedBg: theme.colors.surfaceHover,  // Selected option background
        },
        DatePicker: {
            controlHeight: 40,
            borderRadius: parseInt(theme.borderRadius.md),
            colorBgContainer: theme.colors.background,
            colorText: theme.colors.textPrimary,
        },
        Layout: {
            headerBg: theme.colors.primary,
            siderBg: theme.colors.surface,
            bodyBg: theme.colors.background,
        },
        Modal: {
            contentBg: theme.colors.surface,          // Modal content background
            headerBg: theme.colors.surface,           // Modal header background
            footerBg: theme.colors.surface,           // Modal footer background
            colorBgMask: 'rgba(0, 0, 0, 0.45)',       // Modal backdrop/mask
            colorText: theme.colors.textPrimary,      // Modal text color
            colorTextHeading: theme.colors.textPrimary, // Modal heading color
            borderRadiusLG: theme.borderRadius.lg,    // Modal border radius
        },
        Drawer: {
            colorBgElevated: theme.colors.surface,    // Drawer background
            colorText: theme.colors.textPrimary,
        },
        Popover: {
            colorBgElevated: theme.colors.surface,    // Popover background
        },
        Dropdown: {
            colorBgElevated: theme.colors.surface,    // Dropdown background
        }
    },
});
