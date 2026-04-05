const fs = require('fs');

const SETTINGS_FILE = './settings.json';

// Default Settings
let settings = {
    networkMode: 'CHIRPSTACK',
    alertThresholds: {
        warningLevel: 1.8,
        criticalLevel: 2.7,
        warningCooldownMin: 60,
        dangerousCooldownMin: 15
    },
    chirpstack: {
        // ChirpStack MQTT connection (override via env vars)
        mqttUrl: '',       // e.g. "mqtt://chirpstack.example.com:1883"
        mqttUser: '',      // MQTT username
        mqttPass: '',      // MQTT password 
        applicationId: '', // ChirpStack Application ID (UUID)
        useTls: false
    },
    lineNotify: { token: '', active: false },
    lineBot: { active: true },
    stations: {
        "test-hel-v3": { name: "Float Station", lat: 14.422328, lng: 100.387755 },
        "test-hel-v3-n2": { name: "Static Station 1", lat: 14.420291, lng: 100.389034 },
    },
    data_source: {
        type: 'postgres'  // Default to postgres, will be augmented by dataManager if env vars present
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
    const previousMode = settings.networkMode;
    settings = newSettings;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    console.log("💾 Settings saved!");

    // If networkMode changed, reconnect MQTT to the new broker
    if (previousMode !== settings.networkMode) {
        console.log(`🔄 Network mode changed: ${previousMode} → ${settings.networkMode}`);
        try {
            const { reconnectMQTT } = require('../services/mqttService');
            reconnectMQTT();
        } catch (e) {
            console.error("⚠️ Failed to trigger MQTT reconnect:", e.message);
        }
    }

    // Concurrently save to PostgreSQL without blocking
    try {
        const { getPool } = require('./database');
        const pool = getPool();
        if (pool) {
            pool.query(`
                INSERT INTO system_settings (setting_key, setting_value)
                VALUES ('global_config', $1)
                ON CONFLICT (setting_key) DO UPDATE 
                SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
            `, [JSON.stringify(settings)])
                .then(() => console.log("💾 Settings synced to PostgreSQL!"))
                .catch(e => console.error("⚠️ Failed to sync settings to PG:", e.message));
        }
    } catch (e) {
        console.error("⚠️ Could not load database pool during settings save");
    }
}

async function loadSettingsFromDB() {
    try {
        const { getPool } = require('./database');
        const pool = getPool();
        if (pool) {
            const res = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'global_config'");
            if (res.rowCount > 0) {
                settings = { ...settings, ...res.rows[0].setting_value };
                fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
                console.log("⚙️ Overrode settings.json with data loaded from PostgreSQL global_config");
            }
        }
    } catch (e) {
        console.error("⚠️ Failed to load settings from DB:", e.message);
    }
}

function getSettings() {
    return settings;
}

// Initial Load
loadSettings();

module.exports = {
    getSettings,
    saveSettings,
    loadSettings,
    loadSettingsFromDB
};
