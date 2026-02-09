const fs = require('fs');

const SETTINGS_FILE = './settings.json';

// Default Settings
let settings = {
    alertThresholds: { waterLevel: 3.0, pressureLow: 0.5, pressureHigh: 10.0 },
    lineNotify: { token: 'default_token' },
    stations: {
        "test-hel-v3": { name: "Float Station", lat: 14.422328, lng: 100.387755 },
        "test-hel-v3-n2": { name: "Static Station 1", lat: 14.420291, lng: 100.389034 },
    }
};

function loadSettings() {
    if (fs.existsSync(SETTINGS_FILE)) {
        try {
            const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
            settings = JSON.parse(raw);
            console.log("⚙️ Loaded settings from settings.json");
        } catch (e) {
            console.error("⚠️ Failed to load settings.json, using defaults.");
        }
    }
    return settings;
}

function saveSettings(newSettings) {
    settings = newSettings;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    console.log("💾 Settings saved!");
}

function getSettings() {
    return settings;
}

// Initial Load
loadSettings();

module.exports = {
    getSettings,
    saveSettings,
    loadSettings
};
