const { getSettings } = require('../config/settings');
const { initDatabase, getPool } = require('../config/database');
const { initGoogleSheets, saveReadingToSheet, getHistoryFromSheet } = require('./googleSheetService');

let usePostgres = false;
let useSheets = false;

// Initialize Data Sources based on Settings
async function initDataManager() {
    const settings = getSettings();
    const type = (settings.data_source && settings.data_source.type) ? settings.data_source.type.toLowerCase() : "postgres";

    console.log(`🔧 Data Source Configuration: ${type}`);

    // Check configuration
    if (type.includes('postgres')) {
        await initDatabase();
        usePostgres = true;
    }

    if (type.includes('google') || type.includes('sheet')) {
        const sheetInitSuccess = await initGoogleSheets();
        if (sheetInitSuccess) useSheets = true;
    }
}

// Save Reading
async function saveReading(data) {
    // 1. Save to Postgres
    if (usePostgres) {
        const pool = getPool();
        if (pool) {
            try {
                // Upsert Station
                await pool.query(`
                    INSERT INTO stations (station_id, name, latitude, longitude, location_source, last_active_at)
                    VALUES ($1, $2, $3, $4, $5, NOW())
                    ON CONFLICT (station_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        latitude = EXCLUDED.latitude,
                        longitude = EXCLUDED.longitude,
                        location_source = EXCLUDED.location_source,
                        last_active_at = NOW();
                `, [data.stationId, data.stationName, data.lat, data.lng, data.src]);

                // Insert Reading
                // Insert Reading
                await pool.query(`
                    INSERT INTO readings (station_id, water_level, pressure, data_rate, rssi, snr, battery, sensor_type, timestamp)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                `, [data.stationId, data.waterLevel, data.pressure, data.dataRate, data.rssi, data.snr, data.battery, data.sensorType]);

                console.log(`💾 Saved to DB: ${data.stationId} | L=${data.waterLevel} | P=${data.pressure}`);
            } catch (err) {
                console.error(`⚠️ DB Save Error: ${err.message}`);
            }
        }
    }

    // 2. Save to Google Sheet
    if (useSheets) {
        await saveReadingToSheet(data);
    }
}

// Get History
async function getHistory(hours = 48) {
    // Prefer Postgres for history if available (faster/reliable)
    if (usePostgres) {
        const pool = getPool();
        if (pool) {
            try {
                console.log("🔄 Loading history from PostgreSQL...");
                const sql = `
                    SELECT station_id, to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as raw_time_str, water_level, pressure 
                    FROM readings 
                    WHERE timestamp > NOW() - INTERVAL '${hours} HOURS'
                    ORDER BY timestamp ASC
                `;
                const res = await pool.query(sql);

                // Transform to object format
                const history = {};
                res.rows.forEach(row => {
                    const deviceId = row.station_id; // Keeping original ID

                    if (!history[deviceId]) history[deviceId] = [];

                    history[deviceId].push({
                        time: new Date(row.raw_time_str).toLocaleTimeString('th-TH'),
                        rawTimestamp: new Date(row.raw_time_str),
                        waterLevel: row.water_level,
                        pressure: row.pressure
                    });
                });
                console.log("✅ History loaded from Postgres");
                return history;
            } catch (e) {
                console.error("⚠️ SQL History Load Error:", e.message);
                // Fallback to sheets if SQL fails?
            }
        }
    }

    // If Postgres disabled or failed, try Sheets
    if (useSheets) {
        console.log("🔄 Loading history from Google Sheets...");
        return await getHistoryFromSheet(hours);
    }

    return {};
}

module.exports = {
    initDataManager,
    saveReading,
    getHistory
};
