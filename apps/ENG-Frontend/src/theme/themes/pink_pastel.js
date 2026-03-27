import { typography, spacing, borderRadius, transitions } from '../constants';

// Pastel Theme 4: Pink Pastel (Sweet Romance) - Enhanced with darker, more readable colors
export const pinkPastelTheme = {
    name: 'pinkPastel',
    displayName: 'Pink Pastel',
    category: 'pastel',

    colors: {
        // Primary: Soft Pink - Darker for better visibility
        primary: '#E889A5',
        primaryLight: '#F5A9C5',
        primaryDark: '#C86985',
        primaryHover: '#F299B5',

        // Secondary: Soft Lavender - Enhanced
        secondary: '#B895D9',
        secondaryLight: '#D8B5F9',
        secondaryDark: '#9875B9',
        secondaryHover: '#C8A5E9',

        // Accent: Sage Green - Darker
        accent: '#88B89A',
        accentLight: '#A8D8BA',
        accentDark: '#68987A',

        // Extended Palette - Blue - Enhanced
        blue: '#98A8D6',
        blueLight: '#B8C8F6',
        blueDark: '#7888B6',

        // Extended Palette - Green - Enhanced
        green: '#88B89A',
        greenLight: '#A8D8BA',
        greenDark: '#68987A',

        // Extended Palette - Orange/Peach - Enhanced
        orange: '#E8A878',
        orangeLight: '#FFC898',
        orangeDark: '#C88858',

        // Extended Palette - Red/Rose - Enhanced
        red: '#E87888',
        redLight: '#FF98A8',
        redDark: '#C85868',

        // Status Colors - Enhanced
        success: '#88B89A',
        successLight: '#A8D8BA',
        successDark: '#68987A',

        warning: '#E8A878',
        warningLight: '#FFC898',
        warningDark: '#C88858',

        error: '#E87888',
        errorLight: '#FF98A8',
        errorDark: '#C85868',

        info: '#98A8D6',
        infoLight: '#B8C8F6',
        infoDark: '#7888B6',

        // Neutrals - Themed pink backgrounds
        background: '#FDF5F8',        // Pink tinted background
        surface: '#FFFFFF',
        surfaceHover: '#F9E9F0',      // Soft pink hover
        border: '#F5C8D8',            // Pink border
        borderDark: '#E8A8C0',
        hover: '#F9E9F0',
        disabled: '#F7ECF2',

        // Text Colors (Darker for better contrast)
        textPrimary: '#281620',       // Very dark pink-black
        textSecondary: '#482838',     // Dark pink-gray
        textTertiary: '#684858',      // Medium pink-gray
        textDisabled: '#988878',
        textInverse: '#FFFFFF',

        // Chart Colors - Enhanced
        chart: {
            pink: '#E889A5',
            lavender: '#B895D9',
            sage: '#88B89A',
            sky: '#98A8D6',
            peach: '#E8A878',
            rose: '#E87888',
        },
    },

    shadows: {
        xs: '0 1px 2px rgba(232, 137, 165, 0.12)',
        sm: '0 2px 4px rgba(232, 137, 165, 0.14)',
        md: '0 4px 6px rgba(232, 137, 165, 0.16)',
        lg: '0 10px 15px rgba(232, 137, 165, 0.20)',
        xl: '0 20px 25px rgba(232, 137, 165, 0.24)',
        inner: 'inset 0 2px 4px rgba(232, 137, 165, 0.12)',
    },

    typography,
    spacing,
    borderRadius,
    transitions,
};

export default pinkPastelTheme;
