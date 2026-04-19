const { Pool } = require('pg');

const dbConfig = {
    user: 'postgres.miwgcphzntzqofypnswj',
    host: 'aws-1-ap-northeast-1.pooler.supabase.com',
    database: 'postgres',
    password: 'Beambo234_#%',
    port: 6543,
    ssl: { rejectUnauthorized: false }
};

async function resetDb() {
    const pool = new Pool(dbConfig);
    console.log("🗑️ Cleaning up Supabase tables...");
    try {
        // ลบตารางเก่าทิ้งเพื่อให้ Backend สร้างใหม่ที่สมบูรณ์กว่า
        await pool.query('DROP TABLE IF EXISTS readings, alerts, station_configs, stations, system_settings, users CASCADE;');
        console.log("✅ Tables dropped. The Backend will now recreate them correctly.");
    } catch (err) {
        console.error("❌ Error dropping tables:", err.message);
    } finally {
        await pool.end();
    }
}

resetDb();
