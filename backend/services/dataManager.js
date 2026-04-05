const { getSettings } = require('../config/settings');
const { initDatabase, getPool } = require('../config/database');
const { initGoogleSheets, saveReadingToSheet, getHistoryFromSheet } = require('./googleSheetService');

let usePostgres = false;
let useSheets = false;

// Initialize Data Sources based on Settings
async function initDataManager() {
    const settings = getSettings();
    let type = (settings.data_source && settings.data_source.type) ? settings.data_source.type.toLowerCase() : "postgres";

    // Auto-enable Google Sheets if ID is present in ENV
    if (process.env.GOOGLE_SHEET_ID && !type.includes('google')) {
        type += ', google';
        console.log("📝 Auto-enabling Google Sheets (detected GOOGLE_SHEET_ID in env)");
    }

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
                    INSERT INTO stations (station_id, name, latitude, longitude, location_source, network_mode, last_active_at)
                    VALUES ($1, $2, $3, $4, $5, $6, NOW())
                    ON CONFLICT (station_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        latitude = EXCLUDED.latitude,
                        longitude = EXCLUDED.longitude,
                        location_source = EXCLUDED.location_source,
                        network_mode = EXCLUDED.network_mode,
                        last_active_at = NOW();
                `, [data.stationId, data.stationName, data.lat, data.lng, data.src, data.networkMode || 'TTN']);

                // Insert Reading
                // Insert Reading
                await pool.query(`
                    INSERT INTO readings (station_id, water_level, offset_water_level, data_rate, rssi, snr, battery, battery_voltage, sensor_type, latitude, longitude, location_source, timestamp)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                `, [
                    data.stationId, 
                    data.rawLevel,          // Raw Data -> water_level
                    data.waterLevel,        // Calibrated -> offset_water_level
                    data.dataRate, 
                    data.rssi, 
                    data.snr, 
                    data.battery, 
                    data.batteryVoltage, 
                    data.sensorType, 
                    data.lat, 
                    data.lng, 
                    data.src
                ]);

                console.log(`💾 Saved to DB: ${data.stationId} | Raw=${data.rawLevel} | Offset=${data.waterLevel}`);
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
                    SELECT 
                        r.station_id, 
                        to_char(r.timestamp, 'YYYY-MM-DD HH24:MI:SS') as raw_time_str, 
                        r.water_level, 
                        r.offset_water_level,
                        r.battery,
                        r.battery_voltage,
                        r.rssi,
                        r.snr,
                        r.data_rate,
                        r.sensor_type,
                        s.name as station_name,
                        r.latitude,
                        r.longitude,
                        r.location_source,
                        s.network_mode
                    FROM readings r
                    LEFT JOIN stations s ON r.station_id = s.station_id
                    WHERE r.timestamp > NOW() - INTERVAL '${hours} HOURS'
                    ORDER BY r.timestamp ASC
                `;
                const res = await pool.query(sql);

                // Transform to object format
                const history = {};
                res.rows.forEach(row => {
                    const deviceId = row.station_id; // Keeping original ID

                    if (!history[deviceId]) history[deviceId] = [];

                    history[deviceId].push({
                        time: new Date(row.raw_time_str).toLocaleTimeString('th-TH'),
                        rawTimestamp: new Date(row.raw_time_str).getTime(), // Ensure standardized format
                        timestamp: new Date(row.raw_time_str).toLocaleTimeString('th-TH'), // Add timestamp field for frontend
                        waterLevel: parseFloat(row.offset_water_level || row.water_level), // Calibrated (with fallback for old data)
                        rawLevel: parseFloat(row.water_level), // Raw Data
                        battery: parseFloat(row.battery || 0),
                        batteryVoltage: parseFloat(row.battery_voltage || 0),
                        rssi: parseInt(row.rssi || 0),
                        snr: parseFloat(row.snr || 0),
                        dataRate: row.data_rate,
                        sensorType: row.sensor_type,
                        stationName: row.station_name || deviceId,
                        lat: parseFloat(row.latitude || 0),
                        lng: parseFloat(row.longitude || 0),
                        src: row.location_source || 'Unknown',
                        networkMode: row.network_mode || 'TTN',
                        stationId: deviceId
                    });
                });
                console.log("✅ History loaded from Postgres");
                return history;
            } catch (e) {
                console.error("⚠️ SQL History Load Error:", e.message || e);
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
