import { typography, spacing, borderRadius, transitions } from '../constants';

// Pastel Theme 1: Lavender & Rose Pink (Soft Romance) - Enhanced with darker, more readable colors
export const pastel1Theme = {
    name: 'pastel1',
    displayName: 'Lavender & Rose',
    category: 'pastel',

    colors: {
        // Primary: Soft Lavender (Purple family) - Darker for better visibility
        primary: '#9A85D9',
        primaryLight: '#B4A5F5',
        primaryDark: '#7A65B9',
        primaryHover: '#AA95E9',

        // Secondary: Rose Pink - Enhanced
        secondary: '#E085A5',
        secondaryLight: '#F5A5C5',
        secondaryDark: '#C06585',
        secondaryHover: '#EA95B5',

        // Accent: Soft Mint - Darker
        accent: '#88C6AF',
        accentLight: '#A8E6CF',
        accentDark: '#68A68F',

        // Extended Palette - Blue (inspired by Ant Design blue) - Enhanced
        blue: '#85A9E0',
        blueLight: '#A5C9F5',
        blueDark: '#6589C0',

        // Extended Palette - Green - Enhanced
        green: '#98C6A9',
        greenLight: '#B8E6C9',
        greenDark: '#78A689',

        // Extended Palette - Orange/Gold - Enhanced
        orange: '#E0B483',
        orangeLight: '#FFD4A3',
        orangeDark: '#C09463',

        // Extended Palette - Red/Pink - Enhanced
        red: '#DF98A2',
        redLight: '#FFB8C2',
        redDark: '#BF7882',

        // Status Colors (softer, more harmonious) - Enhanced
        success: '#98C6A9',
        successLight: '#B8E6C9',
        successDark: '#78A689',

        warning: '#E0B483',
        warningLight: '#FFD4A3',
        warningDark: '#C09463',

        error: '#DF98A2',
        errorLight: '#FFB8C2',
        errorDark: '#BF7882',

        info: '#85A9E0',
        infoLight: '#A5C9F5',
        infoDark: '#6589C0',

        // Neutrals - Themed lavender backgrounds
        background: '#F5F3FA',        // Lavender tinted background
        surface: '#FFFFFF',
        surfaceHover: '#EDE9F7',      // Soft lavender hover
        border: '#D4CBFA',            // Lavender border
        borderDark: '#B4A5F5',
        hover: '#EDE9F7',
        disabled: '#E8E6F0',

        // Text Colors (Darker for better contrast and readability)
        textPrimary: '#1A1625',       // Very dark purple-black
        textSecondary: '#3A3548',     // Dark purple-gray
        textTertiary: '#5A5568',      // Medium purple-gray
        textDisabled: '#8A8598',
        textInverse: '#FFFFFF',

        // Chart Colors (for dashboard visualizations) - Enhanced
        chart: {
            purple: '#9A85D9',
            pink: '#E085A5',
            mint: '#88C6AF',
            blue: '#85A9E0',
            peach: '#E0B483',
            coral: '#DF98A2',
        },
    },

    shadows: {
        xs: '0 1px 2px rgba(154, 133, 217, 0.12)',
        sm: '0 2px 4px rgba(154, 133, 217, 0.14)',
        md: '0 4px 6px rgba(154, 133, 217, 0.16)',
        lg: '0 10px 15px rgba(154, 133, 217, 0.20)',
        xl: '0 20px 25px rgba(154, 133, 217, 0.24)',
        inner: 'inset 0 2px 4px rgba(154, 133, 217, 0.12)',
    },

    typography,
    spacing,
    borderRadius,
    transitions,
};

export default pastel1Theme;
