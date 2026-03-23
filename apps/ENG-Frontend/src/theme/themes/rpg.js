import { typography, spacing, borderRadius, transitions } from '../constants';

// RPG Game Theme - Dark Medieval Fantasy with Orange Accents (Premium & Epic)
export const rpgTheme = {
    name: 'rpg',
    displayName: 'RPG Adventure',
    category: 'rpg',

    colors: {
        // Primary: Vibrant Orange (Fire/Magic) - Main interactive color
        primary: '#FF8C42',
        primaryLight: '#FFA666',
        primaryDark: '#E67228',
        primaryHover: '#FF9C5A',

        // Secondary: Gold/Treasure - For special highlights
        secondary: '#FFB84D',
        secondaryLight: '#FFD480',
        secondaryDark: '#E6A030',
        secondaryHover: '#FFC266',

        // Accent: Deep Amber - For subtle accents
        accent: '#E67E22',
        accentLight: '#F39C12',
        accentDark: '#D35400',

        // Extended Palette - Blue (Magic/Mana) - Muted for dark theme
        blue: '#5DADE2',
        blueLight: '#85C1E9',
        blueDark: '#3498DB',

        // Extended Palette - Green (Healing/Nature) - Vibrant but harmonious
        green: '#52C41A',
        greenLight: '#73D13D',
        greenDark: '#389E0D',

        // Extended Palette - Orange (Quest/Warning) - Primary orange family
        orange: '#FF8C42',
        orangeLight: '#FFA666',
        orangeDark: '#E67228',

        // Extended Palette - Red (Combat/Danger) - Intense red
        red: '#F5222D',
        redLight: '#FF4D4F',
        redDark: '#CF1322',

        // Status Colors (RPG themed with orange emphasis)
        success: '#52C41A',          // Healing/Success green
        successLight: '#73D13D',
        successDark: '#389E0D',

        warning: '#FF8C42',          // Orange warning
        warningLight: '#FFA666',
        warningDark: '#E67228',

        error: '#F5222D',            // Danger red
        errorLight: '#FF4D4F',
        errorDark: '#CF1322',

        info: '#5DADE2',             // Magic blue
        infoLight: '#85C1E9',
        infoDark: '#3498DB',

        // Neutrals - Dark Theme (Black/Charcoal/Dark Gray)
        background: '#0A0A0A',       // Almost black
        surface: '#1A1A1A',          // Charcoal
        surfaceHover: '#252525',     // Lighter charcoal on hover
        border: '#333333',           // Dark gray border
        borderDark: '#404040',       // Medium gray border
        hover: '#252525',            // Hover state
        disabled: '#1F1F1F',         // Disabled dark gray

        // Text Colors - Orange emphasis for readability on dark
        textPrimary: '#FF8C42',      // Primary orange text
        textSecondary: '#FFA666',    // Light orange for secondary text
        textTertiary: '#CCCCCC',     // Light gray for tertiary
        textDisabled: '#666666',     // Dark gray disabled
        textInverse: '#0A0A0A',      // Dark for light backgrounds

        // Chart Colors (RPG themed with orange dominance)
        chart: {
            orange: '#FF8C42',
            gold: '#FFB84D',
            amber: '#E67E22',
            ruby: '#F5222D',
            emerald: '#52C41A',
            sapphire: '#5DADE2',
        },
    },

    shadows: {
        xs: '0 2px 4px rgba(255, 140, 66, 0.15)',
        sm: '0 4px 6px rgba(255, 140, 66, 0.20)',
        md: '0 6px 10px rgba(255, 140, 66, 0.25)',
        lg: '0 12px 20px rgba(255, 140, 66, 0.30)',
        xl: '0 24px 32px rgba(255, 140, 66, 0.35)',
        inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.6)',
    },

    typography,
    spacing,
    borderRadius,
    transitions,
};

export default rpgTheme;
