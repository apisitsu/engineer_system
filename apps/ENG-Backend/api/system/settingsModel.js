const fs = require('fs');
const path = require('path');

// Store in the root of ENG-Backend or a specific config folder
const settingsPath = path.join(__dirname, '../../../settings.json');

const defaultSettings = {
    tokenExpirationEnabled: true
};

const getSettings = (req, res) => {
    try {
        if (!fs.existsSync(settingsPath)) {
            // Return defaults if file doesn't exist
            return res.json({ result: 'true', data: defaultSettings });
        }
        const data = fs.readFileSync(settingsPath, 'utf8');
        res.json({ result: 'true', data: JSON.parse(data) });
    } catch (e) {
        console.error('Error reading settings:', e.message);
        res.status(500).json({ result: 'false', message: e.message });
    }
};

const updateSettings = (req, res) => {
    try {
        const newSettings = req.body;

        let current = { ...defaultSettings };
        if (fs.existsSync(settingsPath)) {
            try {
                current = { ...current, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
            } catch (err) {
                console.warn("Could not parse existing settings handling as default", err);
            }
        }

        // Merge with existing
        const updated = { ...current, ...newSettings };
        fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2), 'utf8');

        res.json({ result: 'true', message: 'Settings updated successfully', data: updated });
    } catch (e) {
        console.error('Error updating settings:', e.message);
        res.status(500).json({ result: 'false', message: e.message });
    }
};

module.exports = {
    getSettings,
    updateSettings
};
