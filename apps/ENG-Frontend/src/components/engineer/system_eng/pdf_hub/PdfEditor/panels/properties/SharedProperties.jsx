import React from 'react';
import { useTheme } from '../../../../../../../theme';

export const COLOR_PRESETS = [
    {
        label: 'Recommended',
        colors: [
            '#000000', '#595959', '#BFBFBF', '#FFFFFF', 
            '#F5222D', '#FA541C', '#FA8C16', '#FAAD14', 
            '#FADB14', '#A0D911', '#52C41A', '#13A8A8', 
            '#1677FF', '#2F54EB', '#722ED1', '#EB2F96'
        ],
    }
];

export const SectionTitle = ({ children }) => {
    const { theme } = useTheme();
    return (
        <div className="pdf-ws-prop-section-title" style={{ color: theme.colors.textSecondary }}>
            {children}
        </div>
    );
};

export const PropRow = ({ label, children }) => {
    const { theme } = useTheme();
    return (
        <div className="pdf-ws-prop-row">
            <label style={{ color: theme.colors.textSecondary }}>{label}</label>
            {children}
        </div>
    );
};
