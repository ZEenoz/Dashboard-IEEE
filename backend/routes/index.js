const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getSettings, saveSettings } = require('../config/settings');
const { getPool } = require('../config/database');
const bcrypt = require('bcryptjs');
const { requireApiKey } = require('../middleware/auth');

// --- Offset Presets APIs ---
const PRESETS_FILE = path.join(__dirname, '..', 'offset-presets.json');

router.get('/offset-presets', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    try {
        if (fs.existsSync(PRESETS_FILE)) {
            const data = JSON.parse(fs.readFileSync(PRESETS_FILE, 'utf8'));
            if (Array.isArray(data)) {
                return res.json(data);
            }
            console.warn('⚠️ offset-presets.json is not an array, returning []');
        }
        return res.json([]);
    } catch (e) {
        console.error('Failed to read offset presets:', e.message);
        return res.json([]);
    }
});

router.post('/offset-presets', requireApiKey, (req, res) => {
    try {
        const presets = req.body;
        if (!Array.isArray(presets)) return res.status(400).json({ error: 'Expected array' });
        fs.writeFileSync(PRESETS_FILE, JSON.stringify(presets, null, 2));
        console.log(`💾 Offset presets saved (${presets.length} presets)`);
        return res.json({ success: true, count: presets.length });
    } catch (e) {
        console.error('Failed to save offset presets:', e.message);
        return res.status(500).json({ error: e.message });
    }
});

// --- Settings APIs ---
router.get('/settings', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.json(getSettings());
});

router.post('/settings', requireApiKey, (req, res) => {
    const newSettings = req.body;
    if (!newSettings) return res.status(400).send("Invalid Body");
    saveSettings(newSettings);
    res.json({ success: true });
});

const { testLineNotify } = require('../services/notificationService');

router.post('/test-notify', requireApiKey, async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: "Token required" });

    console.log("🔔 Test Notify Requested");
    const success = await testLineNotify(token);

    if (success) {
        res.json({ success: true, message: "Notification sent successfully!" });
    } else {
        res.status(500).json({ success: false, message: "Failed to send notification. Check token." });
    }
});

// --- System Health API ---
const { getSystemHealth } = require('../controllers/systemController');
router.get('/system-health', getSystemHealth);

// --- Export API ---
router.get('/export', async (req, res) => {
    const { start_date, end_date, station_id } = req.query;
    console.log(`📂 Export Requested: ${start_date} to ${end_date} (Station: ${station_id || 'All'})`);

    const pool = getPool();
    if (!pool) return res.status(500).send("Database not connected");

    try {
        let query = `
            SELECT 
                r.id,
                to_char(r.timestamp, 'YYYY-MM-DD HH24:MI:SS') as time,
                COALESCE(s.name, r.station_id) as station_name,
                r.station_id,
                s.network_mode,
                r.water_level,
                r.offset_water_level,
                r.data_rate,
                r.rssi,
                r.snr,
                r.battery,
                r.battery_voltage,
                r.sensor_type,
                r.latitude,
                r.longitude,
                r.location_source as source
            FROM readings r
            LEFT JOIN stations s ON r.station_id = s.station_id
            WHERE 1=1
        `;
        const params = [];
        let pIdx = 1;

        if (start_date) {
            query += ` AND r.timestamp >= $${pIdx++}`;
            params.push(start_date);
        }
        if (end_date) {
            query += ` AND r.timestamp <= $${pIdx++}::date + interval '1 day'`; // Include the end date fully
            params.push(end_date);
        }
        if (station_id && station_id !== 'all') {
            query += ` AND r.station_id = $${pIdx++}`;
            params.push(station_id);
        }

        query += ` ORDER BY r.timestamp DESC`;

        const result = await pool.query(query, params);

        // Generate CSV
        const headers = [
            'ID',
            'Time', 
            'Station Name', 
            'Station ID', 
            'Network Mode',
            'Water Level Raw (m)', 
            'Water Level Calibrated (m)', 
            'Data Rate', 
            'RSSI (dBm)', 
            'SNR (dB)', 
            'Battery (%)', 
            'Battery Voltage (V)', 
            'Sensor Type', 
            'Latitude', 
            'Longitude', 
            'Location Source'
        ];
        const csvRows = [headers.join(',')];

        result.rows.forEach(row => {
            const safeName = row.station_name ? row.station_name.replace(/"/g, '""') : '';
            csvRows.push([
                row.id,
                row.time,
                `"${safeName}"`, // Quote name in case of commas/quotes
                row.station_id,
                row.network_mode || 'TTN',
                row.water_level,          // Raw
                row.offset_water_level,   // Calibrated
                row.data_rate,
                row.rssi,
                row.snr,
                row.battery,
                row.battery_voltage,
                row.sensor_type,
                row.latitude,
                row.longitude,
                `"${row.source || ''}"`
            ].join(','));
        });

        // Use Windows CRLF line endings for Excel compatibility
        const csvString = csvRows.join('\r\n');

        // Add explicit UTF-8 BOM (Byte Order Mark) so Excel recognizes the Thai characters
        const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
        const csvBuffer = Buffer.from(csvString, 'utf8');
        const finalBuffer = Buffer.concat([bom, csvBuffer]);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="station_data_${Date.now()}.csv"`);
        res.send(finalBuffer);

    } catch (err) {
        console.error("⚠️ Export Error:", err);
        res.status(500).send("Export failed");
    }
});

// --- Alerts API ---
router.get('/alerts', async (req, res) => {
    const pool = getPool();
    if (!pool) return res.status(500).send("Database not connected");

    const { stationId, date } = req.query;
    try {
        let query = `
            SELECT 
                a.id, 
                a.created_at as timestamp, 
                a.station_id as "stationId",
                COALESCE(s.name, a.station_id) as "stationName",
                a.water_level as "waterLevel",
                a.threshold,
                a.alert_level as "alertLevel",
                a.battery,
                a.rssi,
                'Float' as "sensorType",
                a.line_status as "lineStatus"
            FROM alerts a
            LEFT JOIN stations s ON a.station_id = s.station_id
        `;
        const params = [];
        let whereClauses = [];

        const currentNetworkMode = getSettings().networkMode || 'TTN';
        whereClauses.push(`COALESCE(s.network_mode, 'TTN') = $1`);
        params.push(currentNetworkMode);

        if (stationId && stationId !== 'all') {
            whereClauses.push(`a.station_id = $${params.length + 1}`);
            params.push(stationId);
        }

        if (date) {
            whereClauses.push(`DATE(a.created_at) = $${params.length + 1}`);
            params.push(date);
        }

        if (whereClauses.length > 0) {
            query += ` WHERE ` + whereClauses.join(' AND ');
        }

        const limitVal = parseInt(req.query.limit, 10) || 50;
        const offsetVal = parseInt(req.query.offset, 10) || 0;

        query += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limitVal, offsetVal);

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error("⚠️ Alerts Query Error:", err);
        res.status(500).json([]);
    }
});

// --- History API ---
router.get('/history', async (req, res) => {
    const pool = getPool();
    if (!pool) return res.status(500).send("Database not connected");

    const { stationId, limit, offset = 0, range = '24h', date, aggregate = 'false' } = req.query;
    try {
        let timeFilter = '';
        let truncateSQL = "date_trunc('minute', r.timestamp)"; // default aggregation
        const params = [];
        let pIdx = 1;

        if (date) {
            timeFilter = `DATE(r.timestamp) = $${pIdx++}`;
            params.push(date);
        } else {
            // Define time constraint and aggregation level
            if (range === '1h') {
                timeFilter = "r.timestamp >= NOW() - INTERVAL '1 hour'";
                truncateSQL = "date_trunc('minute', r.timestamp)"; 
            } else if (range === '6h') {
                timeFilter = "r.timestamp >= NOW() - INTERVAL '6 hours'";
                // Group by 5 minutes
                truncateSQL = "to_timestamp(floor((extract('epoch' from r.timestamp) / 300 )) * 300)"; 
            } else if (range === '24h') {
                timeFilter = "r.timestamp >= NOW() - INTERVAL '24 hours'";
                // Group by 15 minutes
                truncateSQL = "to_timestamp(floor((extract('epoch' from r.timestamp) / 900 )) * 900)";
            } else if (range === '7d') {
                timeFilter = "r.timestamp >= NOW() - INTERVAL '7 days'";
                truncateSQL = "date_trunc('hour', r.timestamp)"; // 1 point per hour
            } else if (range === '30d') {
                timeFilter = "r.timestamp >= NOW() - INTERVAL '30 days'";
                truncateSQL = "date_trunc('day', r.timestamp)"; // 1 point per day
            }
        }

        let query = '';

        if (!date && aggregate === 'true') {
            // 🟢 Aggregated Query (Downsampling for Analytics)
            query = `
                SELECT 
                    ${truncateSQL} as "rawTimestamp", 
                    r.station_id as "stationId",
                    COALESCE(MAX(s.name), r.station_id) as "stationName",
                    ROUND(AVG(r.water_level)::numeric, 3) as "rawLevel",
                    ROUND(AVG(COALESCE(r.offset_water_level, r.water_level))::numeric, 3) as "waterLevel",
                    MAX(r.sensor_type) as "sensorType"
                FROM readings r
                LEFT JOIN stations s ON r.station_id = s.station_id
                WHERE (${timeFilter || '1=1'})
                AND COALESCE(s.network_mode, 'TTN') = $${pIdx++}
            `;

            params.push(getSettings().networkMode || 'TTN');

            if (stationId && stationId !== 'all') {
                query += ` AND r.station_id = $${pIdx++}`;
                params.push(stationId);
            }

            query += ` GROUP BY ${truncateSQL}, r.station_id`;
            query += ` ORDER BY "rawTimestamp" ASC LIMIT $${pIdx}`; // ASC for charts, limit to prevent overflow
            
            // Limit for charts doesn't strictly need precise pagination, just a safe max bound
            params.push(parseInt(limit || 2000, 10));

        } else {
            // 🟢 Raw Data Query (For History Table)
            query = `
                SELECT 
                    r.id, 
                    r.timestamp as "rawTimestamp", 
                    r.station_id as "stationId",
                    COALESCE(s.name, r.station_id) as "stationName",
                    r.water_level as "rawLevel",
                    COALESCE(r.offset_water_level, r.water_level) as "waterLevel",
                    r.data_rate as "dataRateStr",
                    r.battery,
                    r.rssi,
                    r.snr,
                    r.sensor_type as "sensorType",
                    r.latitude,
                    r.longitude,
                    r.location_source as "locationSource"
                FROM readings r
                LEFT JOIN stations s ON r.station_id = s.station_id
                WHERE (${timeFilter || '1=1'})
                AND COALESCE(s.network_mode, 'TTN') = $${pIdx++}
            `;

            params.push(getSettings().networkMode || 'TTN');

            if (stationId && stationId !== 'all') {
                query += ` AND r.station_id = $${pIdx++}`;
                params.push(stationId);
            }

            query += ` ORDER BY r.timestamp DESC LIMIT $${pIdx++} OFFSET $${pIdx}`;
            params.push(parseInt(limit || 50, 10)); // Default to 50 for paginated table
            params.push(parseInt(offset, 10));
        }

        const result = await pool.query(query, params);

        // Format timestamp for consistency
        const historyData = result.rows.map(row => ({
            ...row,
            timestamp: new Date(row.rawTimestamp).toLocaleTimeString('th-TH')
        }));

        res.json(historyData);
    } catch (err) {
        console.error("⚠️ History Query Error:", err);
        res.status(500).json([]);
    }
});

// --- Per-Station Config API (Phase 2) ---

/**
 * GET /api/station-config/:id
 * Returns warning_level and critical_level for a specific station
 */
router.get('/station-config/:id', async (req, res) => {
    const pool = getPool();
    if (!pool) return res.status(500).json({ error: 'Database not connected' });

    const { id } = req.params;
    try {
        const result = await pool.query(
            'SELECT warning_level, critical_level FROM station_configs WHERE station_id = $1 LIMIT 1',
            [id]
        );
        if (result.rows.length === 0) {
            return res.json({ warning_level: null, critical_level: null });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('station-config GET error:', err);
        res.status(500).json({ error: 'Failed to fetch config' });
    }
});

/**
 * POST /api/station-config/:id
 * Body: { warning_level, critical_level }
 * Upserts per-station thresholds in station_configs table
 */
router.post('/station-config/:id', requireApiKey, async (req, res) => {
    const pool = getPool();
    if (!pool) return res.status(500).json({ error: 'Database not connected' });

    const { id } = req.params;
    const { warning_level, critical_level } = req.body;

    if (warning_level == null && critical_level == null) {
        return res.status(400).json({ error: 'Provide at least one of warning_level or critical_level' });
    }

    try {
        // Ensure station row exists first (FK constraint safety)
        await pool.query(`
            INSERT INTO stations (station_id, name, location_source)
            VALUES ($1, $1, 'Manual')
            ON CONFLICT (station_id) DO NOTHING
        `, [id]);

        await pool.query(`
            INSERT INTO station_configs (station_id, warning_level, critical_level)
            VALUES ($1, $2, $3)
            ON CONFLICT (station_id) DO UPDATE
                SET warning_level  = COALESCE($2, station_configs.warning_level),
                    critical_level = COALESCE($3, station_configs.critical_level),
                    updated_at     = NOW()
        `, [id, warning_level ?? null, critical_level ?? null]);

        console.log(`✅ Saved thresholds for ${id}: warn=${warning_level} crit=${critical_level}`);
        res.json({ success: true });
    } catch (err) {
        console.error('station-config POST error:', err);
        res.status(500).json({ error: 'Failed to save config' });
    }
});

// --- User Management API (Admin Only) ---

router.get('/users', requireApiKey, async (req, res) => {
    const pool = getPool();
    if (!pool) return res.status(500).json({ error: 'Database not connected' });

    try {
        const result = await pool.query(
            'SELECT user_id as id, username, role, is_active FROM users ORDER BY user_id ASC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error("⚠️ Users GET Error:", err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.post('/users', requireApiKey, async (req, res) => {
    const pool = getPool();
    if (!pool) return res.status(500).json({ error: 'Database not connected' });

    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ error: 'Username, password, and role are required' });
    }

    try {
        const check = await pool.query('SELECT user_id FROM users WHERE username = $1', [username]);
        if (check.rows.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const validRoles = ['admin', 'local_authority', 'general_user'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        const result = await pool.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ($1, $2, $3, true)
            RETURNING user_id as id, username, role, is_active
        `, [username, hashedPassword, role]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("⚠️ Users POST Error:", err);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

router.put('/users/:id', requireApiKey, async (req, res) => {
    const pool = getPool();
    if (!pool) return res.status(500).json({ error: 'Database not connected' });

    const { id } = req.params;
    const { role, is_active, password } = req.body;

    try {
        let query = 'UPDATE users SET ';
        const params = [];
        let pIdx = 1;
        const updates = [];

        if (role) {
            updates.push(`role = $${pIdx++}`);
            params.push(role);
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${pIdx++}`);
            params.push(is_active);
        }
        if (password) {
            const hashedPassword = bcrypt.hashSync(password, 10);
            updates.push(`password_hash = $${pIdx++}`);
            params.push(hashedPassword);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        query += updates.join(', ') + ` WHERE user_id = $${pIdx} RETURNING user_id as id, username, role, is_active`;
        params.push(id);

        const result = await pool.query(query, params);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("⚠️ Users PUT Error:", err);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

router.delete('/users/:id', requireApiKey, async (req, res) => {
    const pool = getPool();
    if (!pool) return res.status(500).json({ error: 'Database not connected' });

    const { id } = req.params;

    // Safety check to prevent deleting all admins
    try {
        const adminCheck = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
        const targetUser = await pool.query("SELECT role FROM users WHERE user_id = $1", [id]);

        if (targetUser.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (targetUser.rows[0].role === 'admin' && parseInt(adminCheck.rows[0].count) <= 1) {
            return res.status(400).json({ error: 'Cannot delete the last admin user' });
        }

        await pool.query('DELETE FROM users WHERE user_id = $1', [id]);
        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        console.error("⚠️ Users DELETE Error:", err);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

module.exports = router;
