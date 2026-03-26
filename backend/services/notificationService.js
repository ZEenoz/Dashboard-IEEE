const https = require('https');
const { getSettings } = require('../config/settings');

/**
 * Send notification to LINE Notify
 * @param {string} message 
 * @returns {Promise<boolean>}
 */
function sendLineNotify(message) {
    return new Promise((resolve, reject) => {
        const settings = getSettings();
        const token = settings.lineNotify?.token;

        if (!token || !settings.lineNotify?.active) {
            console.log("⚠️ LINE Notify: Token missing or disabled.");
            return resolve(false);
        }

        const data = new TextEncoder().encode(`message=${message}`);

        const options = {
            hostname: 'notify-api.line.me',
            port: 443,
            path: '/api/notify',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${token}`,
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';

            res.on('data', (chunk) => {
                responseBody += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`✅ LINE Notification Sent: "${message}"`);
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

        req.write(data);
        req.end();
    });
}

/**
 * Test Notification with provided token (for Settings Page test)
 */
function testLineNotify(token) {
    return new Promise((resolve, reject) => {
        const message = "🔔 This is a test notification from Water Monitor System.";
        const data = new TextEncoder().encode(`message=${message}`);

        const options = {
            hostname: 'notify-api.line.me',
            port: 443,
            path: '/api/notify',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${token}`,
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            resolve(res.statusCode === 200);
        });

        req.on('error', () => resolve(false));
        req.write(data);
        req.end();
    });
}

/**
 * Send a level-specific alert notification via LINE Notify
 * @param {object} alertEntry - Alert data from mqttService
 */
function sendAlertByLevel(alertEntry) {
    const { alertLevel, stationName, waterLevel, threshold, battery, rssi } = alertEntry;

    let msg;
    if (alertLevel === 'dangerous') {
        msg = `\n🚨🚨 ระดับน้ำวิกฤต! ต้องการความสนใจทันที!\n` +
            `📍 สถานี: ${stationName}\n` +
            `💧 ระดับน้ำ: ${Number(waterLevel).toFixed(2)} m (เกิน Critical ${Number(threshold).toFixed(1)} m)\n` +
            `⚠️ กรุณาตรวจสอบและดำเนินการ!\n` +
            `🔋 Battery: ${Number(battery).toFixed(1)} V | 📶 RSSI: ${rssi} dBm`;
    } else {
        msg = `\n⚠️ แจ้งเตือนระดับน้ำสูง\n` +
            `📍 สถานี: ${stationName}\n` +
            `💧 ระดับน้ำ: ${Number(waterLevel).toFixed(2)} m (เกิน Warning ${Number(threshold).toFixed(1)} m)\n` +
            `🔋 Battery: ${Number(battery).toFixed(1)} V | 📶 RSSI: ${rssi} dBm`;
    }

    return sendLineNotify(msg);
}

module.exports = { sendLineNotify, testLineNotify, sendAlertByLevel };

