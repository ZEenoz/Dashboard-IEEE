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
    notificationPipeline: {
        quotaSafe: 1,
        quotaWatch: 3,
        quotaDanger: 6,
        nightBlockStart: 22,
        nightBlockEnd: 5,
        globalCooldownMin: 30
    },
    chirpstack: {
        // ChirpStack MQTT connection (override via env vars)
        mqttUrl: '',       // e.g. "mqtt://chirpstack.example.com:1883"
        mqttUser: '',      // MQTT username
        mqttPass: '',      // MQTT password 
        applicationIds: [], // Array of ChirpStack Application IDs (UUIDs)
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
            
            // Migration: Convert single applicationId to array
            if (settings.chirpstack && settings.chirpstack.applicationId && (!settings.chirpstack.applicationIds || settings.chirpstack.applicationIds.length === 0)) {
                settings.chirpstack.applicationIds = [settings.chirpstack.applicationId];
                delete settings.chirpstack.applicationId;
            } else if (settings.chirpstack && !settings.chirpstack.applicationIds) {
                settings.chirpstack.applicationIds = [];
            }

            console.log("⚙️ Loaded settings from settings.json");
        } catch (e) {
            console.error("⚠️ Failed to load settings.json, using defaults.");
        }
    }
    return settings;
}

function saveSettings(newSettings) {
    const previousMode = settings.networkMode;
    // Deep compare ChirpStack config to detect App ID or Broker changes
    const previousCS = JSON.stringify(settings.chirpstack || {});
    
    settings = newSettings;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    console.log("💾 Settings saved to settings.json");

    const modeChanged = previousMode !== settings.networkMode;
    const csChanged = previousCS !== JSON.stringify(settings.chirpstack || {});

    // If networkMode or ChirpStack configuration changed, trigger a full backend restart.
    // This is more reliable than just reconnecting MQTT as it re-initializes all services.
    if (modeChanged || csChanged) {
        console.log(`🔄 Critical settings changed: Mode=${modeChanged}, ChirpStack=${csChanged}`);
        console.log("🚀 Triggering automatic backend restart in 1.5s to apply changes...");
        
        // Delay exit to allow the HTTP response to be sent back to the frontend
        setTimeout(() => {
            console.log("👋 Shutting down process for automatic restart (Docker restart policy: unless-stopped)...");
            process.exit(0);
        }, 1500);
    }

    // Concurrently save to PostgreSQL without blocking
    try {
        const { getPool } = require('./database');
        const pool = getPool();
        if (pool) {
            // 1. Save Global config
            pool.query(`
                INSERT INTO system_settings (setting_key, setting_value)
                VALUES ('global_config', $1)
                ON CONFLICT (setting_key) DO UPDATE 
                SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
            `, [JSON.stringify(settings)])
                .then(() => console.log("💾 Global settings synced to PostgreSQL!"))
                .catch(e => console.error("⚠️ Failed to sync settings to PG:", e.message));

            // 2. Sync individual stations (Name and Image URL)
            if (settings.stations) {
                Object.entries(settings.stations).forEach(([id, config]) => {
                    pool.query(`
                        INSERT INTO stations (station_id, name, image_url)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (station_id) DO UPDATE SET
                            name = EXCLUDED.name,
                            image_url = EXCLUDED.image_url;
                    `, [id, config.name, config.image || config.imageUrl || null])
                    .catch(e => console.error(`⚠️ Failed to sync station ${id} to PG:`, e.message));
                });
            }
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
