import { typography, spacing, borderRadius, transitions } from '../constants';

// Red Pastel Theme - True red tones with minimal pink undertones
export const redPastelTheme = {
    name: 'redPastel',
    displayName: 'Red Pastel',
    category: 'pastel',

    colors: {
        // Primary: True Red Pastel - Warmer red with less pink
        primary: '#FF5757',
        primaryLight: '#FF8A7A',
        primaryDark: '#E83838',
        primaryHover: '#FF6B6B',

        // Secondary: Warm Terracotta - Complementary warm tone
        secondary: '#E88B6B',
        secondaryLight: '#FFB098',
        secondaryDark: '#C86B4B',
        secondaryHover: '#F29B7B',

        // Accent: Warm Coral - Red-orange accent
        accent: '#FF8B6B',
        accentLight: '#FFAB8B',
        accentDark: '#E86B4B',

        // Extended Palette - Blue - Cool contrast to red
        blue: '#6B9BD8',
        blueLight: '#8BBFF8',
        blueDark: '#4B7BB8',

        // Extended Palette - Green - Olive/sage to complement red
        green: '#9BB88B',
        greenLight: '#BBD8AB',
        greenDark: '#7B986B',

        // Extended Palette - Orange/Red-Orange
        orange: '#FF8B57',
        orangeLight: '#FFAB7A',
        orangeDark: '#E86B38',

        // Extended Palette - Pure Red - Strong red
        red: '#FF5757',
        redLight: '#FF7A7A',
        redDark: '#E83838',

        // Status Colors - Warm toned
        success: '#98B88B',
        successLight: '#B8D8AB',
        successDark: '#78986B',

        warning: '#FF8B57',
        warningLight: '#FFAB7A',
        warningDark: '#E86B38',

        error: '#FF5757',
        errorLight: '#FF7A7A',
        errorDark: '#E83838',

        info: '#6B9BD8',
        infoLight: '#8BBFF8',
        infoDark: '#4B7BB8',

        // Neutrals - Warm red/orange tinted backgrounds
        background: '#FFF7F5',        // Warm red-tinted background (less pink)
        surface: '#FFFFFF',
        surfaceHover: '#FFE8E0',      // Warm peachy hover
        border: '#FFC0A8',            // Warm peachy-red border
        borderDark: '#FF9B7A',
        hover: '#FFE8E0',
        disabled: '#FFEAE5',

        // Text Colors (Darker warm tones for better contrast)
        textPrimary: '#3A1810',       // Very dark warm-black
        textSecondary: '#5A2820',     // Dark warm-gray
        textTertiary: '#7A4838',      // Medium warm-gray
        textDisabled: '#AA7868',
        textInverse: '#FFFFFF',

        // Chart Colors - True red-focused palette
        chart: {
            red: '#FF5757',
            scarlet: '#FF6B5A',
            coral: '#FF8B6B',
            terracotta: '#E88B6B',
            peach: '#FF9B7A',
            salmon: '#FFA888',
        },
    },

    shadows: {
        xs: '0 1px 2px rgba(255, 87, 87, 0.15)',
        sm: '0 2px 4px rgba(255, 87, 87, 0.18)',
        md: '0 4px 6px rgba(255, 87, 87, 0.20)',
        lg: '0 10px 15px rgba(255, 87, 87, 0.25)',
        xl: '0 20px 25px rgba(255, 87, 87, 0.30)',
        inner: 'inset 0 2px 4px rgba(255, 87, 87, 0.15)',
    },

    typography,
    spacing,
    borderRadius,
    transitions,
};

export default redPastelTheme;
