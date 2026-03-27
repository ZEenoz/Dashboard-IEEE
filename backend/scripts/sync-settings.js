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

        // 4. Upsert settings
        const query = `
            INSERT INTO system_settings (setting_key, setting_value)
            VALUES ('global_config', $1)
            ON CONFLICT (setting_key) DO UPDATE 
            SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
        `;
        
        await pool.query(query, [JSON.stringify(settings)]);
        
        console.log("🚀 SUCCESS: Settings synced to PostgreSQL!");
        console.log("💡 The Railway backend will now use these settings on next restart or data refresh.");

    } catch (err) {
        console.error("❌ Database Error:", err.message);
    } finally {
        await pool.end();
    }
}

syncSettings();
