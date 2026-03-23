import { Card } from 'antd';
import { useTheme } from '../../theme';

export const SharedCard = ({ children, hoverable = false, ...props }) => {
    const { theme } = useTheme();

    return (
        <Card
            {...props}
            style={{
                borderRadius: theme.borderRadius.lg,
                border: `1px solid ${theme.colors.border}`,
                boxShadow: theme.shadows.sm,
                transition: `all ${theme.transitions.normal}`,
                ...(hoverable && {
                    ':hover': {
                        boxShadow: theme.shadows.md,
                        transform: 'translateY(-2px)',
                    },
                }),
                ...props.style,
            }}
        >
            {children}
        </Card>
    );
};

export default SharedCard;
