const https = require('https');
const { getSettings } = require('../config/settings');

/**
 * Send broadcast notification via LINE Messaging API (LINE OA)
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

        const payload = JSON.stringify({
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

        req.write(payloadBuffer);
        req.end();
    });
}

/**
 * Test Notification with provided token (for Settings Page test)
 */
function testLineNotify(token) {
    return new Promise((resolve, reject) => {
        const message = "🔔 This is a test notification from Water Monitor System.";
        const payload = JSON.stringify({
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
    let msg = `\n${headerTitle}\n\n`;
    alerts.forEach(alert => {
        let icon = "🟢";
        if (alert.alertLevel === 'dangerous') icon = "🔴";
        else if (alert.alertLevel === 'warning') icon = "🟡";

        msg += `${icon} สถานี: ${alert.stationName}\n`;
        msg += `   ระดับน้ำ: ${Number(alert.waterLevel).toFixed(2)} m\n`;
        if (alert.isRapidChange) {
            msg += `   🚨 ระดับน้ำเปลี่ยนแปลกฉับพลัน!\n`;
        }
    });
    return msg;
}

/**
 * Send a level-specific alert notification via LINE Messaging API
 * @param {object} alertEntry - Alert data from mqttService
 */
function sendAlertByLevel(alertEntry) {
    const { alertLevel, stationName, waterLevel, threshold, battery, rssi, isRapidChange } = alertEntry;

    let msg;
    if (alertLevel === 'dangerous') {
        msg = `\n🚨🚨 ระดับน้ำวิกฤต! ต้องการความสนใจทันที!\n` +
            `📍 สถานี: ${stationName}\n` +
            `💧 ระดับน้ำ: ${Number(waterLevel).toFixed(2)} m (เกิน Critical ${Number(threshold).toFixed(1)} m)\n` +
            `⚠️ กรุณาตรวจสอบและดำเนินการ!\n`;
    } else if (alertLevel === 'warning') {
        msg = `\n⚠️ แจ้งเตือนระดับน้ำสูง\n` +
            `📍 สถานี: ${stationName}\n` +
            `💧 ระดับน้ำ: ${Number(waterLevel).toFixed(2)} m (เกิน Warning ${Number(threshold).toFixed(1)} m)\n`;
    } else {
        console.log(`🔇 Skip Notification LINE for ${stationName} (Safe)`);
        return;
    }

    if (isRapidChange) {
        msg += `\n🌊⚠️ มีการเปลี่ยนแปลงระดับน้ำอย่างรวดเร็ว (เกิน 0.3m ใน 30 นาที)!\n`;
    }

    msg += `🔋 Battery: ${Number(battery).toFixed(1)} V | 📶 RSSI: ${rssi} dBm`;

    return sendLineNotify(msg);
}

module.exports = { sendLineNotify, testLineNotify, sendAlertByLevel, generateBatchMessage };

