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
function testLineNotify(token) {
    return new Promise((resolve, reject) => {
        const message = "🔔 This is a test notification from Water Monitor System.";
        const payload = JSON.stringify({
            to: "Ue79adabc356aa7b6f4f8c76debb1456a", // Send specifically to this user
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

module.exports = { sendLineNotify, testLineNotify, sendAlertByLevel, generateBatchMessage };