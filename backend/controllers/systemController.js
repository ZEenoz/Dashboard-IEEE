const system = require('systeminformation');
const { getPool } = require('../config/database');
const { getMQTTStatus, getGatewayStatus, getStationHistory, getActiveNodes } = require('../services/mqttService');

async function getSystemHealth(req, res) {
    try {
        // 1. System Metrics (CPU, Mem, Disk, OS, Uptime)
        const [cpuLoad, mem, fsSize, osInfo, time] = await Promise.all([
            system.currentLoad(),
            system.mem(),
            system.fsSize(),
            system.osInfo(),
            system.time()
        ]);

        // 2. Database Status
        let dbStatus = 'disconnected';
        let dbLatency = -1;
        let dbRows = 0;
        let dbSize = 'Unknown';

        const pool = getPool();
        if (pool) {
            const start = Date.now();
            try {
                // Determine connection latency
                await pool.query('SELECT 1');
                dbLatency = Date.now() - start;
                dbStatus = 'connected';

                // Fetch Row Count (using exact count, if it gets too large we can switch to estimate)
                const countRes = await pool.query('SELECT count(*) FROM readings');
                dbRows = parseInt(countRes.rows[0].count, 10);

                // Fetch Database Size
                const sizeRes = await pool.query('SELECT pg_size_pretty(pg_database_size(current_database())) as db_size');
                dbSize = sizeRes.rows[0].db_size;

            } catch (e) {
                dbStatus = 'error';
                console.error("DB Check Failed:", e.message);
            }
        }

        // 3. Network / MQTT Status
        const mqttStatus = getMQTTStatus();

        // 4. Node Status (Active logic)
        const activeNodes = getActiveNodes();
        // In a real app, query DB for 'last_active_at' > 1 hour ago

        // 5. Gateway Status
        const gateways = getGatewayStatus();

        res.json({
            server: {
                uptime: time.uptime,
                platform: osInfo.platform,
                distro: osInfo.distro,
                hostname: osInfo.hostname
            },
            cpu: {
                currentLoad: cpuLoad.currentLoad
            },
            memory: {
                total: mem.total,
                active: mem.active,
                used: mem.used,
                percent: (mem.active / mem.total) * 100
            },
            disk: fsSize.length > 0 ? {
                size: fsSize[0].size,
                used: fsSize[0].used,
                percent: fsSize[0].use
            } : {},
            database: {
                status: dbStatus,
                latency: dbLatency,
                rows: dbRows,
                size: dbSize,
                type: 'PostgreSQL'
            },
            network: {
                mqtt: mqttStatus,
                gateways: gateways
            },
            nodes: {
                active: activeNodes, // Now an array of node objects
                count: activeNodes.length
            }
        });

    } catch (err) {
        console.error("System Health Error:", err);
        res.status(500).json({ error: "Failed to fetch system health" });
    }
}

module.exports = {
    getSystemHealth
};
