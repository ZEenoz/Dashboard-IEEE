const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Path to settings.json
const SETTINGS_FILE = path.join(__dirname, '../settings.json');

// Get Database URL from environment or prompt
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.error("❌ Error: DATABASE_URL environment variable is not set.");
    console.log("\nUsage:");
    console.log("  Windows (PowerShell): $env:DATABASE_URL=\"postgres://...\"; node scripts/sync-settings.js");
    console.log("  Linux/Mac/bash: DATABASE_URL=\"postgres://...\" node scripts/sync-settings.js");
    process.exit(1);
}

async function syncSettings() {
    console.log("🔄 Starting Settings Sync...");

    // 1. Read local settings.json
    if (!fs.existsSync(SETTINGS_FILE)) {
        console.error(`❌ Error: ${SETTINGS_FILE} not found.`);
        process.exit(1);
    }

    let settings;
    try {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
        settings = JSON.parse(raw);
        console.log("✅ Read local settings.json");
    } catch (e) {
        console.error("❌ Error parsing settings.json:", e.message);
        process.exit(1);
    }

    // 2. Connect to Database
    const pool = new Pool({
        connectionString: dbUrl,
        ssl: {
            rejectUnauthorized: false // Required for Railway/Render/AWS RDS
        }
    });

    try {
        console.log("🔗 Connecting to database...");
        
        // 3. Ensure table exists (optional but safe)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                id SERIAL PRIMARY KEY,
                setting_key VARCHAR(50) UNIQUE NOT NULL,
                setting_value JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. Upsert global settings
        const globalQuery = `
            INSERT INTO system_settings (setting_key, setting_value)
            VALUES ('global_config', $1)
            ON CONFLICT (setting_key) DO UPDATE 
            SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
        `;
        await pool.query(globalQuery, [JSON.stringify(settings)]);

        // 5. Upsert Individual Stations (for LINE Bot visibility)
        if (settings.stations) {
            console.log("📡 Syncing individual stations to 'stations' table...");
            for (const [id, data] of Object.entries(settings.stations)) {
                await pool.query(`
                    INSERT INTO stations (station_id, name, latitude, longitude, location_source)
                    VALUES ($1, $2, $3, $4, 'Config')
                    ON CONFLICT (station_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude
                `, [id, data.name || id, data.lat || 0, data.lng || 0]);
            }
        }
        
        console.log("🚀 SUCCESS: Settings & Stations synced to PostgreSQL!");
        console.log("💡 The Railway backend and LINE Bot will now see these stations.");

    } catch (err) {
        console.error("❌ Database Error:", err.message);
    } finally {
        await pool.end();
    }
}

syncSettings();
