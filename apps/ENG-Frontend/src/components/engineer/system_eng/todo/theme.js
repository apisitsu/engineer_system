// Re-export main theme system for backward compatibility
// This file previously contained hard-coded colors but now uses the main theme system

import { useTheme } from '../../../../theme';

// Helper function to get priority color from main theme
export const getPriorityColor = (priority) => {
    // Map to theme colors - components should use useTheme() directly for best results
    const colorMap = {
        'high': '#ef4444',      // theme.colors.error
        'medium': '#f59e0b',    // theme.colors.warning  
        'low': '#10b981'        // theme.colors.success
    };
    return colorMap[priority] || '#6b7280';
};

// Helper function to get status color from main theme
export const getStatusColor = (status) => {
    // Map to theme color keys - components should use useTheme() directly
    const colorMap = {
        'todo': '#6366f1',      // info/primary variant
        'in_progress': '#8b5cf6', // warning/secondary variant
        'check': '#faad14',     // amber/warning - review status
        'done': '#10b981'       // success
    };
    return colorMap[status] || '#6b7280';
};

// Export useTheme for easy access
export { useTheme };

// Legacy theme object for backward compatibility
// Components should migrate to using useTheme() hook directly
export const theme = {
    spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px'
    },
    borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px'
    },
    shadows: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
    },
    transitions: {
        fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
        base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
        slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)'
    },
    typography: {
        fontSize: {
            xs: '12px',
            sm: '14px',
            base: '16px',
            lg: '18px'
        }
    },
    colors: {
        // Placeholder - components should use useTheme() to get actual theme colors
        background: {
            primary: '#ffffff',
            secondary: '#f9fafb',
            tertiary: '#f3f4f6'
        },
        text: {
            primary: '#111827',
            secondary: '#6b7280',
            tertiary: '#9ca3af'
        },
        border: {
            light: '#e5e7eb',
            medium: '#d1d5db',
            dark: '#9ca3af'
        },
        error: '#ef4444',
        warning: '#f59e0b',
        success: '#10b981',
        info: '#3b82f6'
    }
};
