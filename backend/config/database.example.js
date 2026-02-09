const { Pool } = require('pg');
const fs = require('fs');

// PostgreSQL Configuration
const dbConfig = {
    user: 'postgres',
    host: 'localhost',
    password: 'your_password_here',
    port: 5432,
    database: 'water_monitoring' // Default database
};

let pool;

async function initDatabase() {
    // 1. Check & Create 'water_monitoring' database
    const tempPool = new Pool({ ...dbConfig, database: 'postgres' });
    try {
        const res = await tempPool.query("SELECT 1 FROM pg_database WHERE datname = 'water_monitoring'");
        if (res.rowCount === 0) {
            console.log("⚠️ Database 'water_monitoring' not found. Creating...");
            await tempPool.query('CREATE DATABASE "water_monitoring"');
            console.log("✅ Database 'water_monitoring' created.");
        }
    } catch (e) {
        console.error("❌ Init DB Error:", e.message);
    } finally {
        await tempPool.end();
    }

    // 2. Connect to the actual database
    pool = new Pool(dbConfig);

    // 3. Initialize Schema & Indexes
    try {
        console.log("🔄 Initializing Schema...");

        // Stations Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS stations (
                station_id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100),
                latitude NUMERIC,
                longitude NUMERIC,
                location_source VARCHAR(50),
                last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Readings Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS readings (
                id SERIAL PRIMARY KEY,
                station_id VARCHAR(50) REFERENCES stations(station_id),
                water_level NUMERIC,
                pressure NUMERIC,
                data_rate VARCHAR(50),
                rssi INTEGER,
                snr DOUBLE PRECISION,
                battery NUMERIC,
                sensor_type VARCHAR(20),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Migration: Add columns if they don't exist (for existing tables)
        try {
            await pool.query(`ALTER TABLE readings ADD COLUMN IF NOT EXISTS data_rate VARCHAR(50);`);
            await pool.query(`ALTER TABLE readings ADD COLUMN IF NOT EXISTS snr DOUBLE PRECISION;`);
            await pool.query(`ALTER TABLE readings ADD COLUMN IF NOT EXISTS battery NUMERIC;`);
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
                station_id VARCHAR(50),
                alert_type VARCHAR(50),
                message TEXT,
                resolved_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("✅ Schema & Indexes Verified.");

    } catch (err) {
        console.error("❌ Schema Init Error:", err.message);
    }
}

module.exports = {
    initDatabase,
    getPool: () => pool
};
