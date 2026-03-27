// Organization Chart RPG Theme
// This theme is specifically for the /eng/all_eng page (home_overall.jsx)
// It contains element-based colors and styling for the RPG-style organization chart

export const orgRpgTheme = {
    // Element Colors - Each element has [primary, dark, light background, lighter]
    elements: {
        Fire: {
            primary: "#ff4d4f",    // Main element color
            dark: "#a03234",       // Darker variant for text/borders
            lightBg: "#fff1f0",    // Light background
            lighter: "#ffccc7",    // Gradient/hover background
        },
        Water: {
            primary: "#4096ff",
            dark: "#2c65ac",
            lightBg: "#e6f7ff",
            lighter: "#bae0ff",
        },
        Wind: {
            primary: "#73d13d",
            dark: "#478027",
            lightBg: "#f6ffed",
            lighter: "#d9f7be",
        },
        Earth: {
            primary: "#d48806",
            dark: "#7e5104",
            lightBg: "#fff7e6",
            lighter: "#ffe7ba",
        },
        Light: {
            primary: "#fadb14",
            dark: "#9e8b0e",
            lightBg: "#feffe6",
            lighter: "#ffffb8",
        },
        Dark: {
            primary: "#722ed1",
            dark: "#3f1875",
            lightBg: "#f9f0ff",
            lighter: "#efdbff",
        },
    },

    // Stats Colors (for Progress bars)
    stats: {
        atk: "#ff4d4f",   // Attack - Red
        def: "#1677ff",   // Defense - Blue
        hp: "#52c41a",    // Health - Green
        mp: "#722ed1",    // Magic - Purple
    },

    // Layout Colors
    layout: {
        cardBorder: "#f0f0f0",
        cardBg: "#ffffff",
        defaultBg: "#e6e6e6",
        containerBg: "#fafafa",
        connector: "#e0e0e0",
        dividerDashed: "#ccc",
    },

    // Shadows
    shadows: {
        gold: "0 4px 15px rgba(250, 219, 20, 0.4)",  // For manager/boss cards
        element: (color) => `0 0 15px ${color}40`,   // Dynamic element glow
    },

    // Special Role Colors
    roles: {
        manager: "gold",
        head: "blue",
    },
};

// Helper to get element config for easier usage
export const getElementConfig = (elementName) => {
    const element = orgRpgTheme.elements[elementName] || orgRpgTheme.elements.Light;
    return {
        primary: element.primary,
        dark: element.dark,
        lightBg: element.lightBg,
        lighter: element.lighter,
    };
};

// Helper for stat colors
export const getStatColor = (statType) => {
    return orgRpgTheme.stats[statType] || orgRpgTheme.stats.hp;
};
