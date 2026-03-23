import { typography, spacing, borderRadius, transitions } from '../constants';

// Pastel Theme 5: Orange Pastel (Warm Sunset) - Enhanced with darker, more readable colors
export const orangePastelTheme = {
    name: 'orangePastel',
    displayName: 'Orange Pastel',
    category: 'pastel',

    colors: {
        // Primary: Soft Orange - Darker for better visibility
        primary: '#E8A870',
        primaryLight: '#FFC890',
        primaryDark: '#C88850',
        primaryHover: '#F8B880',

        // Secondary: Soft Teal/Turquoise - Enhanced
        secondary: '#6DB8B8',
        secondaryLight: '#8DD8D8',
        secondaryDark: '#4D9898',
        secondaryHover: '#7DC8C8',

        // Accent: Warm Pink/Coral - Darker
        accent: '#E8948A',
        accentLight: '#FFB4AA',
        accentDark: '#C8746A',

        // Extended Palette - Blue/Teal - Enhanced
        blue: '#78B8CC',
        blueLight: '#98D8EC',
        blueDark: '#5898AC',

        // Extended Palette - Green - Enhanced
        green: '#88B898',
        greenLight: '#A8D8B8',
        greenDark: '#689878',

        // Extended Palette - Orange - Enhanced
        orange: '#E8A870',
        orangeLight: '#FFC890',
        orangeDark: '#C88850',

        // Extended Palette - Red/Coral - Enhanced
        red: '#E8847A',
        redLight: '#FFA49A',
        redDark: '#C8645A',

        // Status Colors - Enhanced
        success: '#88B898',
        successLight: '#A8D8B8',
        successDark: '#689878',

        warning: '#E8A870',
        warningLight: '#FFC890',
        warningDark: '#C88850',

        error: '#E8847A',
        errorLight: '#FFA49A',
        errorDark: '#C8645A',

        info: '#78B8CC',
        infoLight: '#98D8EC',
        infoDark: '#5898AC',

        // Neutrals - Themed orange/warm backgrounds
        background: '#FDF9F3',        // Warm orange tinted background
        surface: '#FFFFFF',
        surfaceHover: '#F9F0E6',      // Soft warm hover
        border: '#F5D8C0',            // Warm border
        borderDark: '#E8C0A0',
        hover: '#F9F0E6',
        disabled: '#F7F0E8',

        // Text Colors (Darker for better contrast)
        textPrimary: '#281812',       // Very dark warm-black
        textSecondary: '#483020',     // Dark warm-gray
        textTertiary: '#685040',      // Medium warm-gray
        textDisabled: '#988870',
        textInverse: '#FFFFFF',

        // Chart Colors - Enhanced
        chart: {
            orange: '#E8A870',
            teal: '#6DB8B8',
            coral: '#E8948A',
            sky: '#78B8CC',
            sage: '#88B898',
            peach: '#E89870',
        },
    },

    shadows: {
        xs: '0 1px 2px rgba(232, 168, 112, 0.12)',
        sm: '0 2px 4px rgba(232, 168, 112, 0.14)',
        md: '0 4px 6px rgba(232, 168, 112, 0.16)',
        lg: '0 10px 15px rgba(232, 168, 112, 0.20)',
        xl: '0 20px 25px rgba(232, 168, 112, 0.24)',
        inner: 'inset 0 2px 4px rgba(232, 168, 112, 0.12)',
    },

    typography,
    spacing,
    borderRadius,
    transitions,
};

export default orangePastelTheme;
