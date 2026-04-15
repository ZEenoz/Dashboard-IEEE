const { getPool, initDatabase } = require('../config/database');
const { getSettings, loadSettings } = require('../config/settings');

async function test() {
    console.log("🔍 Diagnosing Database Sync...");
    
    // 1. Check Pool
    const pool = getPool();
    if (!pool) {
        console.error("❌ Database pool is NULL. Attempting to initialize...");
        await initDatabase();
    }
    
    const activePool = getPool();
    if (!activePool) {
        console.error("❌ Failed to get database pool.");
        process.exit(1);
    }
    
    // 2. Check Settings
    loadSettings();
    const settings = getSettings();
    const stationId = 'fe8d0488eb75e746';
    const config = settings.stations?.[stationId];
    
    if (!config) {
        console.error(`❌ Station ${stationId} not found in settings.`);
        console.log("Available stations:", Object.keys(settings.stations || {}));
        process.exit(1);
    }
    
    console.log(`✅ Found station ${stationId} in settings.`);
    console.log(`📡 Image URL in settings: "${config.image}"`);
    
    // 3. Try to update DB manually
    try {
        console.log("📝 Attempting to update database...");
        const res = await activePool.query(`
            UPDATE stations 
            SET image_url = $1, name = $2 
            WHERE station_id = $3
            RETURNING *
        `, [config.image, config.name, stationId]);
        
        if (res.rowCount === 0) {
            console.log("⚠️ No rows updated. Checking if station exists in DB...");
            const exists = await activePool.query("SELECT * FROM stations WHERE station_id = $1", [stationId]);
            if (exists.rowCount === 0) {
                console.error(`❌ Station ${stationId} DOES NOT EXIST in database stations table.`);
                
                console.log("📥 Attempting to INSERT station...");
                await activePool.query(`
                    INSERT INTO stations (station_id, name, image_url)
                    VALUES ($1, $2, $3)
                `, [stationId, config.name, config.image]);
                console.log("✅ Inserted station.");
            } else {
                console.log("❓ Station exists but update missed? Row data:", exists.rows[0]);
            }
        } else {
            console.log("✅ Database updated successfully!");
            console.log("Updated row:", res.rows[0]);
        }
    } catch (err) {
        console.error("❌ SQL Error:", err.message);
    }
    
    process.exit(0);
}

test();
