import { Tag } from 'antd';
import { useTheme } from '../../theme';

export const StatusTag = ({ status, children, ...props }) => {
    const { theme } = useTheme();

    const statusColors = {
        success: { bg: theme.colors.success, text: theme.colors.successDark },
        warning: { bg: theme.colors.warning, text: theme.colors.warningDark },
        error: { bg: theme.colors.error, text: theme.colors.errorDark },
        info: { bg: theme.colors.info, text: theme.colors.infoDark },
        pending: { bg: theme.colors.warning, text: theme.colors.warningDark },
        complete: { bg: theme.colors.success, text: theme.colors.successDark },
        inProgress: { bg: theme.colors.info, text: theme.colors.infoDark },
        'On time': { bg: theme.colors.success, text: theme.colors.successDark },
        'Delay': { bg: theme.colors.error, text: theme.colors.errorDark },
        'Pending': { bg: theme.colors.warning, text: theme.colors.warningDark },
        'Accept': { bg: theme.colors.success, text: theme.colors.successDark },
        'Reject': { bg: theme.colors.error, text: theme.colors.errorDark },
        'In Progress': { bg: theme.colors.info, text: theme.colors.infoDark },
        'Complete': { bg: theme.colors.success, text: theme.colors.successDark },
        'Denied': { bg: theme.colors.error, text: theme.colors.errorDark },
    };

    const colorConfig = statusColors[status] || statusColors.info;

    return (
        <Tag
            {...props}
            style={{
                backgroundColor: colorConfig.bg,
                color: colorConfig.text,
                border: 'none',
                borderRadius: '6px',
                padding: '4px 12px',
                fontWeight: 500,
                ...props.style,
            }}
        >
            {children || status}
        </Tag>
    );
};

export default StatusTag;
