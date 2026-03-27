import { typography, spacing, borderRadius, transitions } from '../constants';

// Mint & Peach Pastel Theme - Enhanced with darker, more readable colors
export const mintPeachTheme = {
    name: 'mintPeach',
    displayName: 'Mint & Peach',
    category: 'pastel',

    colors: {
        // Primary: Soft Mint - Darker for better visibility
        primary: '#6DB89A',
        primaryLight: '#8DD8BA',
        primaryDark: '#4D987A',
        primaryHover: '#7DC8AA',

        // Secondary: Soft Peach - Enhanced
        secondary: '#EEA578',
        secondaryLight: '#FFC598',
        secondaryDark: '#CE8558',
        secondaryHover: '#FEB588',

        // Accent: Soft Sky Blue - Darker
        accent: '#85B8E0',
        accentLight: '#A5D8FF',
        accentDark: '#6598C0',

        // Extended Palette - Blue - Enhanced
        blue: '#85B8E0',
        blueLight: '#A5D8FF',
        blueDark: '#6598C0',

        // Extended Palette - Green - Enhanced
        green: '#6DB89A',
        greenLight: '#8DD8BA',
        greenDark: '#4D987A',

        // Extended Palette - Orange/Peach - Enhanced
        orange: '#EEA578',
        orangeLight: '#FFC598',
        orangeDark: '#CE8558',

        // Extended Palette - Red/Coral - Enhanced
        red: '#E89B9B',
        redLight: '#FFB8B8',
        redDark: '#C87B7B',

        // Status Colors - Enhanced
        success: '#6DB89A',
        successLight: '#8DD8BA',
        successDark: '#4D987A',

        warning: '#EEA578',
        warningLight: '#FFC598',
        warningDark: '#CE8558',

        error: '#E89B9B',
        errorLight: '#FFB8B8',
        errorDark: '#C87B7B',

        info: '#85B8E0',
        infoLight: '#A5D8FF',
        infoDark: '#6598C0',

        // Neutrals - Themed mint backgrounds
        background: '#F3FAF7',        // Mint tinted background
        surface: '#FFFFFF',
        surfaceHover: '#E8F6F0',      // Soft mint hover
        border: '#B8E6CF',            // Mint border
        borderDark: '#8DD8BA',
        hover: '#E8F6F0',
        disabled: '#E6F2ED',

        // Text Colors (Darker for better contrast)
        textPrimary: '#1A2520',       // Very dark green-black
        textSecondary: '#2A453A',     // Dark green-gray
        textTertiary: '#4A655A',      // Medium green-gray
        textDisabled: '#7A9588',
        textInverse: '#FFFFFF',

        // Chart Colors - Enhanced
        chart: {
            mint: '#6DB89A',
            peach: '#EEA578',
            sky: '#85B8E0',
            coral: '#E89B9B',
            sage: '#9DBD9A',
            cream: '#F5E6D3',
        },
    },

    shadows: {
        xs: '0 1px 2px rgba(109, 184, 154, 0.12)',
        sm: '0 2px 4px rgba(109, 184, 154, 0.14)',
        md: '0 4px 6px rgba(109, 184, 154, 0.16)',
        lg: '0 10px 15px rgba(109, 184, 154, 0.20)',
        xl: '0 20px 25px rgba(109, 184, 154, 0.24)',
        inner: 'inset 0 2px 4px rgba(109, 184, 154, 0.12)',
    },

    typography,
    spacing,
    borderRadius,
    transitions,
};

export default mintPeachTheme;
