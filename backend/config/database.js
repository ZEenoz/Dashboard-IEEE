const { Pool } = require('pg');
const fs = require('fs');

// PostgreSQL Configuration (Supports Railway defaults and DATABASE_URL)
const dbConfig = process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.DB_USER || process.env.PGUSER || 'postgres',
        host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
        password: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'Waterretention1',
        port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432'),
        database: process.env.DB_NAME || process.env.PGDATABASE || 'water_monitoring'
    };

let pool;

async function initDatabase() {
    // Check if configuration is missing
    if (!process.env.DB_HOST && !process.env.DATABASE_URL) {
        console.warn("⚠️ Database configuration (DB_HOST/DATABASE_URL) is missing. Using defaults (localhost).");
    }

    // 1. Check & Create 'water_monitoring' database
    // Note: If using a managed DB like Railway Postgres, this might fail, which is fine if it already exists.
    const tempPool = new Pool({ ...dbConfig, database: 'postgres' });
    try {
        const res = await tempPool.query("SELECT 1 FROM pg_database WHERE datname = 'water_monitoring'");
        if (res.rowCount === 0) {
            console.log("⚠️ Database 'water_monitoring' not found. Creating...");
            await tempPool.query('CREATE DATABASE "water_monitoring"');
            console.log("✅ Database 'water_monitoring' created.");
        }
    } catch (e) {
        console.error("❌ Init DB (Database Check) Error:", e.message || e);
    } finally {
        await tempPool.end();
    }

    // 2. Connect to the actual database
    pool = new Pool(dbConfig);

    // 3. Ensure every new connection in the pool uses Bangkok timezone
    // This is crucial for Railway/Production where the default is UTC.
    pool.on('connect', (client) => {
        client.query("SET TIME ZONE 'Asia/Bangkok'").catch(e => console.error("⚠️ Database TZ Error:", e.message));
    });
    console.log("🌍 Database Pool: Timezone handler set to Asia/Bangkok");

    // 4. Initialize Schema & Indexes
    try {
        console.log("🔄 Initializing Schema...");

        // Stations Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS stations (
                station_id VARCHAR(30) PRIMARY KEY,
                name VARCHAR(60),
                latitude NUMERIC,
                longitude NUMERIC,
                location_source VARCHAR(50),
                network_mode VARCHAR(20) DEFAULT 'TTN',
                image_url TEXT,
                custom_location TEXT,
                last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Readings Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS readings (
                id SERIAL PRIMARY KEY,
                station_id VARCHAR(30) REFERENCES stations(station_id),
                water_level NUMERIC,
                offset_water_level NUMERIC,
                data_rate VARCHAR(30),
                rssi INTEGER,
                snr DOUBLE PRECISION,
                battery NUMERIC,
                battery_voltage NUMERIC,
                sensor_type VARCHAR(20),
                latitude NUMERIC,
                longitude NUMERIC,
                location_source VARCHAR(50),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Migration: Add columns if they don't exist (for existing tables)
        try {
            await pool.query(`ALTER TABLE stations ADD COLUMN IF NOT EXISTS network_mode VARCHAR(20) DEFAULT 'TTN';`);
            await pool.query(`ALTER TABLE stations ADD COLUMN IF NOT EXISTS image_url TEXT;`);
            await pool.query(`ALTER TABLE stations ADD COLUMN IF NOT EXISTS custom_location TEXT;`);
            await pool.query(`ALTER TABLE readings ADD COLUMN IF NOT EXISTS offset_water_level NUMERIC;`);
            await pool.query(`ALTER TABLE readings ADD COLUMN IF NOT EXISTS data_rate VARCHAR(50);`);
            await pool.query(`ALTER TABLE readings ADD COLUMN IF NOT EXISTS snr DOUBLE PRECISION;`);
            await pool.query(`ALTER TABLE readings ADD COLUMN IF NOT EXISTS battery NUMERIC;`);
            await pool.query(`ALTER TABLE readings ADD COLUMN IF NOT EXISTS battery_voltage NUMERIC;`);
            await pool.query(`ALTER TABLE readings ADD COLUMN IF NOT EXISTS latitude NUMERIC;`);
            await pool.query(`ALTER TABLE readings ADD COLUMN IF NOT EXISTS longitude NUMERIC;`);
            await pool.query(`ALTER TABLE readings ADD COLUMN IF NOT EXISTS location_source VARCHAR(50);`);

            // Alerts migration
            await pool.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS alert_level VARCHAR(50);`);
            await pool.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS water_level NUMERIC;`);
            await pool.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS threshold NUMERIC;`);
            await pool.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS battery NUMERIC;`);
            await pool.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS rssi INTEGER;`);
            await pool.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS line_status VARCHAR(50) DEFAULT 'sent';`);
            // Phase 2: Ensure UNIQUE constraint on station_configs.station_id for ON CONFLICT upsert
            await pool.query(`
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'uq_station_configs_station_id'
                    ) THEN
                        ALTER TABLE station_configs
                        ADD CONSTRAINT uq_station_configs_station_id UNIQUE (station_id);
                    END IF;
                END $$;
            `);
            // Cleanup old unused columns
            await pool.query(`ALTER TABLE alerts DROP COLUMN IF EXISTS alert_type;`);
            await pool.query(`ALTER TABLE alerts DROP COLUMN IF EXISTS message;`);
            await pool.query(`ALTER TABLE alerts DROP COLUMN IF EXISTS resolved_at;`);
            await pool.query(`ALTER TABLE readings DROP COLUMN IF EXISTS pressure;`);
        } catch (mErr) {
            console.log("ℹ️ Schema Migration:", mErr.message);
        }

        // [Performance] Add Indexes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON readings(timestamp DESC);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_readings_station ON readings(station_id);`);

        // Alerts Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS alerts (
                id SERIAL PRIMARY KEY,
                station_id VARCHAR(30),
                alert_level VARCHAR(30),
                water_level NUMERIC,
                threshold NUMERIC,
                battery NUMERIC,
                rssi INTEGER,
                line_status VARCHAR(30) DEFAULT 'sent',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Users Table (Phase 1)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                username VARCHAR(30) UNIQUE NOT NULL,
                password_hash VARCHAR(60) NOT NULL,
                role VARCHAR(20) DEFAULT 'viewer',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Station Configs Table (Phase 1)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS station_configs (
                config_id SERIAL PRIMARY KEY,
                station_id VARCHAR(30) REFERENCES stations(station_id),
                critical_level NUMERIC DEFAULT 2.5,
                warning_level NUMERIC DEFAULT 1.5,
                notify_interval INTEGER DEFAULT 60,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Seeding: Default Admin User
        const userRes = await pool.query("SELECT COUNT(*) FROM users");
        if (parseInt(userRes.rows[0].count) === 0) {
            console.log("🌱 Seeding: Creating default admin user...");
            await pool.query(`
                INSERT INTO users (username, password_hash, role, is_active)
                VALUES ('admin', 'admin123', 'admin', true)
            `);
        }

        // Seeding: Default Station Configs (Removed hardcoded tdd-* stations)
        const configRes = await pool.query("SELECT COUNT(*) FROM station_configs");
        if (parseInt(configRes.rows[0].count) === 0) {
            console.log("🌱 Station configs table is empty. Ready for dynamic configuration.");
        }

        console.log("✅ Schema & Indexes Verified.");

        // System Settings Table (Global settings)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                id SERIAL PRIMARY KEY,
                setting_key VARCHAR(50) UNIQUE NOT NULL,
                setting_value JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Load Global Configuration from Database into Memory
        const { loadSettingsFromDB } = require('./settings');
        await loadSettingsFromDB();


    } catch (err) {
        console.error("❌ Schema Init Error:", err.message || err);
    }
}

module.exports = {
    initDatabase,
    getPool: () => pool
};
