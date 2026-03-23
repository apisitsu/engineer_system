import { typography, spacing, borderRadius, transitions } from '../constants';

// Minimal (Pastel) Theme - Bright & Vibrant Edition
export const minimalTheme = {
    name: 'minimal',
    displayName: 'Minimal',
    category: 'pastel',

    colors: {
        // Primary: Bright Blue - Vivid and eye-catching
        primary: '#5FB8FF',
        primaryLight: '#8ACEFC',
        primaryDark: '#42A0E8',
        primaryHover: '#75C3FF',

        // Secondary: Bright Pink - Vibrant and cheerful
        secondary: '#FF8FB8',
        secondaryLight: '#FFB3D1',
        secondaryDark: '#E87AA0',
        secondaryHover: '#FFA0C3',

        // Accent: Bright Mint - Fresh and lively
        accent: '#5FE3B0',
        accentLight: '#8AEFC8',
        accentDark: '#42CC98',

        // Extended Palette - Bright Blue - Vivid
        blue: '#5FB8FF',
        blueLight: '#8ACEFC',
        blueDark: '#42A0E8',

        // Extended Palette - Bright Green - Vibrant
        green: '#5FE39B',
        greenLight: '#8AEFB8',
        greenDark: '#42CC83',

        // Extended Palette - Bright Orange - Warm and energetic
        orange: '#FFB85F',
        orangeLight: '#FFCE8A',
        orangeDark: '#E8A042',

        // Extended Palette - Bright Red - Bold
        red: '#FF7B8F',
        redLight: '#FF9FAF',
        redDark: '#E86377',

        // Status Colors - Bright and clear
        success: '#5FE39B',
        successLight: '#8AEFB8',
        successDark: '#42CC83',

        warning: '#FFB85F',
        warningLight: '#FFCE8A',
        warningDark: '#E8A042',

        error: '#FF7B8F',
        errorLight: '#FF9FAF',
        errorDark: '#E86377',

        info: '#5FB8FF',
        infoLight: '#8ACEFC',
        infoDark: '#42A0E8',

        // Neutrals - Clean and bright backgrounds
        background: '#FAFCFF',        // Bright white with subtle blue tint
        surface: '#FFFFFF',
        surfaceHover: '#F0F5FF',      // Bright hover state
        border: '#D8E5FF',            // Bright border
        borderDark: '#B8D0FF',
        hover: '#F0F5FF',
        disabled: '#E8F0FF',

        // Text Colors (Still dark for contrast but against brighter backgrounds)
        textPrimary: '#1A1F3A',       // Deep blue-black
        textSecondary: '#3A4466',     // Medium blue-gray
        textTertiary: '#5A6688',      // Light blue-gray
        textDisabled: '#9AA8C8',
        textInverse: '#FFFFFF',

        // Chart Colors - Bright and vibrant set
        chart: {
            blue: '#5FB8FF',
            pink: '#FF8FB8',
            mint: '#5FE3B0',
            cyan: '#5FE3E3',
            peach: '#FFB85F',
            coral: '#FF7B8F',
        },
    },

    shadows: {
        xs: '0 1px 3px rgba(95, 184, 255, 0.15)',
        sm: '0 2px 6px rgba(95, 184, 255, 0.18)',
        md: '0 4px 8px rgba(95, 184, 255, 0.20)',
        lg: '0 10px 20px rgba(95, 184, 255, 0.25)',
        xl: '0 20px 30px rgba(95, 184, 255, 0.30)',
        inner: 'inset 0 2px 4px rgba(95, 184, 255, 0.15)',
    },

    typography,
    spacing,
    borderRadius,
    transitions,
};

export default minimalTheme;

