import { typography, spacing, borderRadius, transitions } from '../constants';

// Bright Pink Pastel Theme - Vibrant pink with warm tones
export const brightPinkTheme = {
    name: 'brightPink',
    displayName: 'Bright Pink',
    category: 'pastel',

    colors: {
        // Primary: Enhanced Pink/Rose - Vibrant pink while staying pastel
        primary: '#FF6B7F',
        primaryLight: '#FFB8A8',
        primaryDark: '#E85565',
        primaryHover: '#FF8595',

        // Secondary: Soft Warm Pink - Complementary pink tone
        secondary: '#FF95A8',
        secondaryLight: '#FFB5C8',
        secondaryDark: '#E87588',
        secondaryHover: '#FFA5B8',

        // Accent: Coral/Salmon - Warm pinkish accent
        accent: '#FF9B88',
        accentLight: '#FFBBAA',
        accentDark: '#E87B68',

        // Extended Palette - Blue - Cooler contrast
        blue: '#88A8D8',
        blueLight: '#A8C8F8',
        blueDark: '#6888B8',

        // Extended Palette - Green - With pink undertone
        green: '#B8A888',
        greenLight: '#D8C8A8',
        greenDark: '#988868',

        // Extended Palette - Orange/Peachy Pink
        orange: '#FF9878',
        orangeLight: '#FFB898',
        orangeDark: '#E87858',

        // Extended Palette - Pure Pink - Enhanced
        red: '#FF6B7F',
        redLight: '#FF8B9F',
        redDark: '#E85565',

        // Status Colors - Pink-tinted where appropriate
        success: '#B8C898',
        successLight: '#D8E8B8',
        successDark: '#98A878',

        warning: '#FF9878',
        warningLight: '#FFB898',
        warningDark: '#E87858',

        error: '#FF6B7F',
        errorLight: '#FF8B9F',
        errorDark: '#E85565',

        info: '#88A8D8',
        infoLight: '#A8C8F8',
        infoDark: '#6888B8',

        // Neutrals - Strong pink tinted backgrounds
        background: '#FFF5F6',        // Stronger pink tinted background
        surface: '#FFFFFF',
        surfaceHover: '#FFE8EC',      // More visible pink hover
        border: '#FFC8D0',            // More pink in borders
        borderDark: '#FF9BA8',
        hover: '#FFE8EC',
        disabled: '#FFEAED',

        // Text Colors (Darker for better contrast with pink backgrounds)
        textPrimary: '#3A1820',       // Very dark pink-black
        textSecondary: '#5A2838',     // Dark pink-gray
        textTertiary: '#7A4858',      // Medium pink-gray
        textDisabled: '#AA8898',
        textInverse: '#FFFFFF',

        // Chart Colors - Pink-focused palette
        chart: {
            pink: '#FF6B7F',
            rose: '#FF95A8',
            coral: '#FF9B88',
            blush: '#FFB5C8',
            peach: '#FF9878',
            salmon: '#FFA888',
        },
    },

    shadows: {
        xs: '0 1px 2px rgba(255, 107, 127, 0.15)',
        sm: '0 2px 4px rgba(255, 107, 127, 0.18)',
        md: '0 4px 6px rgba(255, 107, 127, 0.20)',
        lg: '0 10px 15px rgba(255, 107, 127, 0.25)',
        xl: '0 20px 25px rgba(255, 107, 127, 0.30)',
        inner: 'inset 0 2px 4px rgba(255, 107, 127, 0.15)',
    },

    typography,
    spacing,
    borderRadius,
    transitions,
};

export default brightPinkTheme;
