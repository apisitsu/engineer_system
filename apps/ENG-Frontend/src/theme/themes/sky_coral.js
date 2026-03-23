import { typography, spacing, borderRadius, transitions } from '../constants';

// Sky & Coral Pastel Theme - Enhanced with darker, more readable colors
export const skyCoralTheme = {
    name: 'skyCoral',
    displayName: 'Sky & Coral',
    category: 'pastel',

    colors: {
        // Primary: Soft Sky Blue - Darker for better visibility
        primary: '#6199CC',
        primaryLight: '#81B9EC',
        primaryDark: '#4179AC',
        primaryHover: '#71A9DC',

        // Secondary: Warm Coral - Enhanced
        secondary: '#E8896B',
        secondaryLight: '#FFA98B',
        secondaryDark: '#C8694B',
        secondaryHover: '#F8997B',

        // Accent: Lavender - Darker
        accent: '#9A85D9',
        accentLight: '#BAA5F9',
        accentDark: '#7A65B9',

        // Extended Palette - Blue - Enhanced
        blue: '#6199CC',
        blueLight: '#81B9EC',
        blueDark: '#4179AC',

        // Extended Palette - Green - Enhanced
        green: '#7AB897',
        greenLight: '#9AD8B7',
        greenDark: '#5A9877',

        // Extended Palette - Orange/Coral - Enhanced
        orange: '#E8896B',
        orangeLight: '#FFA98B',
        orangeDark: '#C8694B',

        // Extended Palette - Red - Enhanced
        red: '#E8797B',
        redLight: '#FF999B',
        redDark: '#C8595B',

        // Status Colors - Enhanced
        success: '#7AB897',
        successLight: '#9AD8B7',
        successDark: '#5A9877',

        warning: '#E8896B',
        warningLight: '#FFA98B',
        warningDark: '#C8694B',

        error: '#E8797B',
        errorLight: '#FF999B',
        errorDark: '#C8595B',

        info: '#6199CC',
        infoLight: '#81B9EC',
        infoDark: '#4179AC',

        // Neutrals - Themed sky blue backgrounds
        background: '#F2F7FB',        // Sky blue tinted background
        surface: '#FFFFFF',
        surfaceHover: '#E6F2F9',      // Soft sky blue hover
        border: '#B8D8EC',            // Sky blue border
        borderDark: '#81B9EC',
        hover: '#E6F2F9',
        disabled: '#E4EFF7',

        // Text Colors (Darker for better contrast)
        textPrimary: '#1A2028',       // Very dark blue-black
        textSecondary: '#2A3548',     // Dark blue-gray
        textTertiary: '#4A5568',      // Medium blue-gray
        textDisabled: '#7A8598',
        textInverse: '#FFFFFF',

        // Chart Colors - Enhanced
        chart: {
            sky: '#6199CC',
            coral: '#E8896B',
            lavender: '#9A85D9',
            mint: '#7AB897',
            peach: '#EEA578',
            rose: '#E885A5',
        },
    },

    shadows: {
        xs: '0 1px 2px rgba(97, 153, 204, 0.12)',
        sm: '0 2px 4px rgba(97, 153, 204, 0.14)',
        md: '0 4px 6px rgba(97, 153, 204, 0.16)',
        lg: '0 10px 15px rgba(97, 153, 204, 0.20)',
        xl: '0 20px 25px rgba(97, 153, 204, 0.24)',
        inner: 'inset 0 2px 4px rgba(97, 153, 204, 0.12)',
    },

    typography,
    spacing,
    borderRadius,
    transitions,
};

export default skyCoralTheme;
