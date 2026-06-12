const https = require('https');
const { getSettings } = require('../config/settings');

/**
 * Send broadcast notification via LINE Messaging API (LINE OA)
 * @param {string|object[]} messageOrMessages - A string for text message, or an array of message objects (e.g., Flex messages)
 * @returns {Promise<boolean>}
 */
function sendLineNotify(messageOrMessages) {
    return new Promise((resolve, reject) => {
        const settings = getSettings();
        const token = settings.lineNotify?.token;

        if (!token || !settings.lineNotify?.active) {
            console.log("⚠️ LINE Notify: Token missing or disabled.");
            return resolve(false);
        }

        let messages;
        if (typeof messageOrMessages === 'string') {
            messages = [{ type: "text", text: messageOrMessages }];
        } else if (Array.isArray(messageOrMessages)) {
            messages = messageOrMessages;
        } else {
            messages = [messageOrMessages]; // Fallback if a single object was passed
        }

        const payload = JSON.stringify({
            messages: messages
        });
        const payloadBuffer = Buffer.from(payload, 'utf8');

        const options = {
            hostname: 'api.line.me',
            port: 443,
            path: '/v2/bot/message/broadcast',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Content-Length': payloadBuffer.length
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';

            res.on('data', (chunk) => {
                responseBody += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`✅ LINE Notification Sent successfully`);
                    resolve(true);
                } else {
                    console.error(`❌ LINE Notification Failed: ${res.statusCode} | ${responseBody}`);
                    resolve(false);
                }
            });
        });

        req.on('error', (error) => {
            console.error(`❌ LINE Request Error: ${error.message}`);
            resolve(false);
        });

        req.write(payloadBuffer);
        req.end();
    });
}

/**
 * Test Notification with provided token (for Settings Page test)
 */
function testLineNotify(token, userId = null) {
    return new Promise((resolve, reject) => {
        const message = "🔔 This is a test notification from Water Monitor System.";
        const targetUser = userId || "Ue79adabc356aa7b6f4f8c76debb1456a";
        const payload = JSON.stringify({
            to: targetUser, // Send specifically to this user
            messages: [
                {
                    type: "text",
                    text: message
                }
            ]
        });
        const payloadBuffer = Buffer.from(payload, 'utf8');

        const options = {
            hostname: 'api.line.me',
            port: 443,
            path: '/v2/bot/message/push', // Use push instead of broadcast
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Content-Length': payloadBuffer.length
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('✅ LINE Test Notification Sent!');
                    resolve({ success: true });
                } else {
                    console.error(`❌ LINE Test Notification Failed: ${res.statusCode} | ${responseBody}`);
                    resolve({ success: false, message: `Status: ${res.statusCode}, Error: ${responseBody}` });
                }
            });
        });

        req.on('error', (e) => {
            console.error(`❌ LINE Request Error: ${e.message}`);
            resolve({ success: false, message: e.message });
        });
        req.write(payloadBuffer);
        req.end();
    });
}

/**
 * Generate a combined message from a batch of alerts
 * @param {Array} alerts - Array of alert objects
 * @param {string} headerTitle - Title for the batch message
 */
function generateBatchMessage(alerts, headerTitle = "⚠️ สรุปแจ้งเตือนรวบยอด") {
    const engine = require('./NotificationEngine');
    return engine.createMorningFlexMessage(alerts, headerTitle) || `\n${headerTitle}\n\nไม่มีข้อมูล`;
}

function sendAlertByLevel(alertEntry) {
    const { alertLevel, stationName } = alertEntry;

    if (alertLevel === 'normal') {
        console.log(`🔇 Skip Notification LINE for ${stationName} (Safe)`);
        return;
    }

    const engine = require('./NotificationEngine');
    const flexMessage = engine.createFlexAlertMessage(alertEntry);

    // Send it via LINE
    return sendLineNotify(flexMessage);
}

// ============================================================
// TEST BROADCAST — Registry-driven, no hardcoded types
// ============================================================

/**
 * PORT of utils.py → create_monitor_flex_message
 * Builds a Carousel of "giga" bubbles showing water level + status per station.
 * Used for: 'monitor' type test.
 */
function buildMonitorFlexCarousel(stationsData, altText = '📊 [Test] สถานะระดับน้ำปัจจุบัน') {
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

    const bubbles = stationsData.map(st => {
        const statusStr = st.status || 'ปกติ';
        let color = '#1DB446';
        let description = 'สถานการณ์ปกติ';

        if (st.alertLevel === 'dangerous' || statusStr.includes('อันตราย')) {
            color = '#e02424';
            description = 'ขอให้อพยพโดยทันที';
        } else if (st.alertLevel === 'warning' || statusStr.includes('เฝ้าระวัง')) {
            color = '#ff9f00';
            description = 'โปรดติดตามสถานการณ์อย่างใกล้ชิด';
        }

        const statusLabel = st.alertLevel === 'dangerous' ? 'อันตราย 🚨'
            : st.alertLevel === 'warning' ? 'เฝ้าระวัง ⚠️'
            : 'ปกติ 🟢';

        const bodyContents = [
            { type: 'text', text: `${st.stationName}`, weight: 'bold', size: 'xl', color, wrap: true },
            { type: 'separator', margin: 'md' },
            {
                type: 'box', layout: 'vertical', margin: 'md',
                contents: [
                    { type: 'text', text: `ระดับน้ำ: ${Number(st.waterLevel).toFixed(2)} ม.`, size: 'lg' },
                    { type: 'text', text: `สถานะ: ${statusLabel}`, size: 'lg', weight: 'bold', color }
                ]
            }
        ];

        // Danger → add emergency call button
        if (st.alertLevel === 'dangerous') {
            bodyContents.push({ type: 'separator', margin: 'lg' });
            bodyContents.push({
                type: 'button', style: 'primary', color: '#e02424', margin: 'md',
                action: { type: 'uri', label: '📞 โทรสายด่วนฉุกเฉิน', uri: 'tel:1669' }
            });
        }

        // "เช็คสถานี" link button
        if (st.stationId) {
            const stationUrl = `${FRONTEND_URL}/parameters/${encodeURIComponent(String(st.stationId))}`;
            bodyContents.push({ type: 'separator', margin: 'md' });
            bodyContents.push({
                type: 'button', style: 'secondary', color: '#06C755', margin: 'md', height: 'sm',
                action: { type: 'uri', label: '📊 เช็คสถานี', uri: stationUrl }
            });
        }

        return {
            type: 'bubble',
            size: 'giga',
            body: { type: 'box', layout: 'vertical', contents: bodyContents }
        };
    });

    if (bubbles.length === 0) {
        bubbles.push({
            type: 'bubble',
            body: { type: 'box', layout: 'vertical', contents: [
                { type: 'text', text: 'ไม่พบข้อมูลสถานี', align: 'center', wrap: true }
            ]}
        });
    }

    return {
        type: 'flex',
        altText,
        contents: { type: 'carousel', contents: bubbles }
    };
}

/**
 * PORT of utils.py → create_dashboard_flex_dict
 * Builds a Carousel with hero image, station name, location — like the registration confirmation card.
 * Used for: 'registration' type test.
 */
function buildRegistrationFlexCarousel(stationsData, altText = '📋 [Test] ยืนยันการลงทะเบียนสถานี') {
    const DEFAULT_IMAGE = 'https://img1.pic.in.th/images/Gemini_Generated_Image_cxndnqcxndnqcxnd.png';

    const bubbles = stationsData.map(st => {
        const imgUrl = (st.imageUrl && st.imageUrl.trim() && st.imageUrl.toLowerCase() !== 'none')
            ? st.imageUrl
            : DEFAULT_IMAGE;

        return {
            type: 'bubble',
            size: 'mega',
            hero: {
                type: 'image',
                url: imgUrl,
                size: 'full',
                aspectMode: 'cover',
                aspectRatio: '320:213'
            },
            body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '10px',
                contents: [
                    { type: 'text', text: String(st.stationName), weight: 'bold', size: 'lg', wrap: true },
                    { type: 'text', text: String(st.location || 'ไม่ระบุตำแหน่ง'), size: 'md', color: '#aaaaaa', wrap: true },
                    {
                        type: 'box', layout: 'vertical', margin: 'md',
                        contents: [
                            { type: 'text', text: 'ลงทะเบียนสำเร็จ ✅', size: 'md', color: '#1DB446', weight: 'bold' }
                        ]
                    }
                ]
            }
        };
    });

    if (bubbles.length === 0) {
        return {
            type: 'flex',
            altText,
            contents: {
                type: 'bubble',
                body: { type: 'box', layout: 'vertical', contents: [
                    { type: 'text', text: 'ไม่พบข้อมูลสถานี', align: 'center' }
                ]}
            }
        };
    }

    return {
        type: 'flex',
        altText,
        contents: { type: 'carousel', contents: bubbles }
    };
}

// ============================================================
// TEST BROADCAST REGISTRY — extensible, no hardcoded types
// Add new types here only. No other file needs to change.
// ============================================================

/**
 * Registry of all supported test notification types.
 * To add a new type in the future, just push a new entry here.
 * Each entry: { value, label, labelTh, build(primaryStation, allStations) → LINE message object }
 */
const TEST_NOTIFICATION_REGISTRY = [
    {
        value: 'text',
        label: '📝 Simple Text Message',
        labelTh: '📝 ข้อความทดสอบทั่วไป',
        build: () => ({
            type: 'text',
            text: '🔔 [Test] ทดสอบระบบ Water Monitor System — ข้อความนี้เป็นเพียงการทดสอบ ไม่ใช่การแจ้งเตือนจริง'
        })
    },
    {
        value: 'monitor',
        label: '📊 Station Status Overview (Flex Carousel)',
        labelTh: '📊 สถานะระดับน้ำปัจจุบัน (Flex Carousel)',
        build: (_primary, allStations) => buildMonitorFlexCarousel(allStations)
    },
    {
        value: 'registration',
        label: '📋 Registration Confirmation (Flex Card)',
        labelTh: '📋 ยืนยันการลงทะเบียน (Flex Card)',
        build: (_primary, allStations) => buildRegistrationFlexCarousel(allStations)
    },
    {
        value: 'warning',
        label: '⚠️ Warning Alert (Flex)',
        labelTh: '⚠️ แจ้งเตือนระดับเฝ้าระวัง',
        build: (stationData) => {
            const engine = require('./NotificationEngine');
            return engine.createFlexAlertMessage({
                stationId: stationData.stationId,
                stationName: `${stationData.stationName} (Test)`,
                waterLevel: stationData.waterLevel,
                alertLevel: 'warning',
                isRapidChange: false
            });
        }
    },
    {
        value: 'dangerous',
        label: '🚨 Dangerous Alert (Flex)',
        labelTh: '🚨 แจ้งเตือนอันตราย/ฉุกเฉิน',
        build: (stationData) => {
            const engine = require('./NotificationEngine');
            return engine.createFlexAlertMessage({
                stationId: stationData.stationId,
                stationName: `${stationData.stationName} (Test)`,
                waterLevel: stationData.waterLevel,
                alertLevel: 'dangerous',
                isRapidChange: false
            });
        }
    },
    {
        value: 'rapid',
        label: '🌊 Rapid Rise Alert (Flex)',
        labelTh: '🌊 น้ำขึ้นเฉียบพลัน',
        build: (stationData) => {
            const engine = require('./NotificationEngine');
            return engine.createFlexAlertMessage({
                stationId: stationData.stationId,
                stationName: `${stationData.stationName} (Test)`,
                waterLevel: stationData.waterLevel,
                alertLevel: 'warning',
                isRapidChange: true
            });
        }
    },
    {
        value: 'morning',
        label: '⛅ Morning Summary Report (Carousel)',
        labelTh: '⛅ รายงานสรุปช่วงเช้า',
        build: (_primary, allStations) => {
            const engine = require('./NotificationEngine');
            const alerts = allStations.map(st => ({
                stationId: st.stationId,
                stationName: `${st.stationName} (Test)`,
                waterLevel: st.waterLevel,
                alertLevel: st.alertLevel || 'normal'
            }));
            return engine.createMorningFlexMessage(alerts, '⛅ [Test] สรุปสถานการณ์น้ำ');
        }
    }
];

/**
 * Returns the list of supported test types (for Frontend dropdown).
 */
function getTestBroadcastTypes() {
    return TEST_NOTIFICATION_REGISTRY.map(({ value, label, labelTh }) => ({ value, label, labelTh }));
}

/**
 * Execute a test broadcast to a specific LINE userId, using their registered stations.
 * @param {string} token - Channel Access Token
 * @param {string} userId - Target LINE User ID
 * @param {string} testType - One of the values in TEST_NOTIFICATION_REGISTRY
 * @param {object} pool - pg Pool instance for DB queries
 */
async function testBroadcast(token, userId, testType, pool) {
    if (!token) throw new Error('Token required');
    if (!userId) throw new Error('userId required');

    // 1. Find the type definition
    const typeDef = TEST_NOTIFICATION_REGISTRY.find(t => t.value === testType);
    if (!typeDef) throw new Error(`Unknown testType: "${testType}". Available: ${TEST_NOTIFICATION_REGISTRY.map(t => t.value).join(', ')}`);

    // 2. Fetch subscribed station IDs for this user from line_users table
    let subscribedStationIds = [];
    try {
        const userResult = await pool.query(
            'SELECT stations FROM line_users WHERE user_id = $1',
            [userId]
        );
        if (userResult.rows.length > 0 && userResult.rows[0].stations) {
            subscribedStationIds = userResult.rows[0].stations
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);
        }
    } catch (e) {
        console.warn(`⚠️ Could not query line_users for ${userId}: ${e.message}`);
    }

    // If user has no subscriptions, use a single fallback station
    const useAllStations = subscribedStationIds.length === 0;

    // 3. Fetch latest reading for each subscribed station (or all stations as fallback)
    let stationsWithData = [];
    try {
        let stationQuery;
        if (useAllStations) {
            stationQuery = await pool.query(`
                SELECT DISTINCT ON (r.station_id)
                    r.station_id as "stationId",
                    COALESCE(s.name, r.station_id) as "stationName",
                    COALESCE(r.offset_water_level, r.water_level) as "waterLevel",
                    r.timestamp
                FROM readings r
                LEFT JOIN stations s ON r.station_id = s.station_id
                ORDER BY r.station_id, r.timestamp DESC
                LIMIT 5
            `);
        } else {
            stationQuery = await pool.query(`
                SELECT DISTINCT ON (r.station_id)
                    r.station_id as "stationId",
                    COALESCE(s.name, r.station_id) as "stationName",
                    COALESCE(r.offset_water_level, r.water_level) as "waterLevel",
                    r.timestamp
                FROM readings r
                LEFT JOIN stations s ON r.station_id = s.station_id
                WHERE r.station_id = ANY($1::text[])
                ORDER BY r.station_id, r.timestamp DESC
            `, [subscribedStationIds]);
        }
        stationsWithData = stationQuery.rows;
    } catch (e) {
        console.error(`❌ DB query failed for test broadcast: ${e.message}`);
        throw new Error(`DB Error: ${e.message}`);
    }

    // If DB has no data at all, use dummy
    if (stationsWithData.length === 0) {
        stationsWithData = [{
            stationId: 'demo-01',
            stationName: 'สถานีสาธิต (Test)',
            waterLevel: 1.85
        }];
    }

    // 4. Build the message using the registry's build function
    const primaryStation = stationsWithData[0];
    const message = typeDef.build(
        {
            stationId: primaryStation.stationId,
            stationName: primaryStation.stationName,
            waterLevel: parseFloat(primaryStation.waterLevel) || 0
        },
        stationsWithData.map(st => ({
            stationId: st.stationId,
            stationName: st.stationName,
            waterLevel: parseFloat(st.waterLevel) || 0,
            alertLevel: 'normal'
        }))
    );

    // 5. Push message to LINE via /push endpoint (send to specific user)
    return new Promise((resolve) => {
        // Normalize message to array for LINE API
        let messages;
        if (Array.isArray(message)) {
            messages = message;
        } else if (message && message.type === 'flex' && message.contents) {
            // The engine returns { type: 'flex', altText: '...', contents: {...} }
            // LINE push API expects the full message object in messages array
            messages = [{
                type: 'flex',
                altText: message.altText || `[Test] ${typeDef.label}`,
                contents: message.contents
            }];
        } else if (typeof message === 'string') {
            messages = [{ type: 'text', text: message }];
        } else {
            messages = [message];
        }

        const payload = JSON.stringify({ to: userId, messages });
        const payloadBuffer = Buffer.from(payload, 'utf8');

        const options = {
            hostname: 'api.line.me',
            port: 443,
            path: '/v2/bot/message/push',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Content-Length': payloadBuffer.length
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`✅ [TestBroadcast] type=${testType} → userId=${userId}`);
                    resolve({ success: true, message: `ส่ง [${typeDef.labelTh}] สำเร็จ ไปยัง ${userId}` });
                } else {
                    console.error(`❌ [TestBroadcast] Failed: ${res.statusCode} | ${responseBody}`);
                    resolve({ success: false, message: `Status ${res.statusCode}: ${responseBody}` });
                }
            });
        });

        req.on('error', (e) => {
            console.error(`❌ [TestBroadcast] Request Error: ${e.message}`);
            resolve({ success: false, message: e.message });
        });

        req.write(payloadBuffer);
        req.end();
    });
}

module.exports = { sendLineNotify, testLineNotify, sendAlertByLevel, generateBatchMessage, testBroadcast, getTestBroadcastTypes };