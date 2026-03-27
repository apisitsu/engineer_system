import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { server, key_constance } from '../constance/constance';
import { minimalTheme } from './themes/minimal';
import { lavenderRoseTheme } from './themes/lavender_rose';
import { mintPeachTheme } from './themes/mint_peach';
import { skyCoralTheme } from './themes/sky_coral';
import { pinkPastelTheme } from './themes/pink_pastel';
import { orangePastelTheme } from './themes/orange_pastel';
import { brightPinkTheme } from './themes/bright_pink';
import { redPastelTheme } from './themes/red_pastel';
import { rpgTheme } from './themes/rpg';

const ThemeContext = createContext();

const THEME_STORAGE_KEY = 'eng-system-theme';

const themes = {
    minimal: minimalTheme,
    lavenderRose: lavenderRoseTheme,
    mintPeach: mintPeachTheme,
    skyCoral: skyCoralTheme,
    pinkPastel: pinkPastelTheme,
    orangePastel: orangePastelTheme,
    brightPink: brightPinkTheme,
    redPastel: redPastelTheme,
    rpg: rpgTheme,
};

export const ThemeProvider = ({ children }) => {
    // Load theme from localStorage or default to 'mintPeach'
    const [currentThemeName, setCurrentThemeName] = useState(() => {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        // Also check if user info has a theme saved (in case it wasn't mapped to eng-system-theme yet)
        const userInfoStr = localStorage.getItem(key_constance.USER_INFO);
        // console.log(userInfoStr);
        if (userInfoStr) {
            try {
                const userInfo = JSON.parse(userInfoStr);
                if (userInfo.theme && themes[userInfo.theme]) {
                    return userInfo.theme;
                }
            } catch (e) {
                console.error("Error parsing user info for theme:", e);
            }
        }
        return saved && themes[saved] ? saved : 'mintPeach';
    });

    const currentTheme = themes[currentThemeName];

    // Check if current theme is in pastel category
    const isPastelTheme = currentTheme.category === 'pastel';

    // Save to localStorage when theme changes
    useEffect(() => {
        localStorage.setItem(THEME_STORAGE_KEY, currentThemeName);
    }, [currentThemeName]);

    const switchTheme = async (themeName, saveToBackend = true) => {
        if (themes[themeName]) {
            setCurrentThemeName(themeName);

            // Sync with backend if user is logged in
            const empno = localStorage.getItem(key_constance.USER_EMPNO);
            if (empno && saveToBackend) {
                try {
                    await axios.post(server.UPDATE_USER_THEME, {
                        empno: empno,
                        theme: themeName
                    });
                } catch (error) {
                    console.error("Failed to sync theme with backend:", error);
                }
            }
        }
    };

    const toggleThemeCategory = () => {
        // Toggle between pastel (any pastel theme) and RPG
        if (isPastelTheme) {
            switchTheme('rpg');
        } else {
            // When switching back to pastel, use the last pastel theme or default to pastel1
            const lastPastelTheme = Object.keys(themes).find(
                key => themes[key].category === 'pastel' && key !== 'rpg'
            );
            switchTheme(lastPastelTheme || 'mintPeach');
        }
    };

    return (
        <ThemeContext.Provider value={{
            theme: currentTheme,
            themeName: currentThemeName,
            isPastelTheme,
            switchTheme,
            toggleThemeCategory,
            availableThemes: Object.keys(themes),
            pastelThemes: Object.keys(themes).filter(key => themes[key].category === 'pastel'),
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

// Custom hook to use theme
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};
