/**
 * Advanced Alert & Notification Pipeline Engine
 * Handles State Management, Quotas, History Tracking, and Rules (Phase 1)
 */

class NotificationEngine {
    constructor() {
        // Daily send counters per device
        // Format: { deviceId: { safe: 0, watch: 0, danger: 0 } }
        this.daily_send_counts = {};

        // 30-min history tracking for Rapid Change detection
        // Format: { deviceId: [{ timestamp: number, level: number }] }
        this.history_30m = {};
        
        // Track the previous known alert level for State Change detection
        // Format: { deviceId: 'normal' | 'warning' | 'dangerous' }
        this.previous_states = {};

        // ==========================================
        // Queues for Batching and Night Block
        // ==========================================
        this.batch_queue = [];
        this.morning_queue = [];
    }

    /**
     * Increment the daily quota usage for a specific level
     */
    incrementDailyCount(deviceId, level) {
        if (!this.daily_send_counts[deviceId]) {
            this.daily_send_counts[deviceId] = { safe: 0, watch: 0, danger: 0 };
        }
        
        let quotaKey = 'safe';
        if (level === 'dangerous') quotaKey = 'danger';
        else if (level === 'warning') quotaKey = 'watch';
        else if (level === 'normal') quotaKey = 'safe';

        this.daily_send_counts[deviceId][quotaKey]++;
    }

    /**
     * Get current daily counts for a device
     */
    getDailyCounts(deviceId) {
        return this.daily_send_counts[deviceId] || { safe: 0, watch: 0, danger: 0 };
    }

    /**
     * Reset all daily counts (to be called by midnight cron)
     */
    resetDailyCounts() {
        console.log("🔄 Resetting daily notification quotas for all devices.");
        this.daily_send_counts = {};
    }

    /**
     * Track reading in history to calculate rapid changes.
     * Keeps only the last 30 minutes of data.
     */
    addReadingToHistory(deviceId, waterLevel) {
        const now = Date.now();
        const THIRTY_MINUTES_MS = 30 * 60 * 1000;

        if (!this.history_30m[deviceId]) {
            this.history_30m[deviceId] = [];
        }

        // Add current reading
        this.history_30m[deviceId].push({ timestamp: now, level: waterLevel });

        // Clean up readings older than 30 minutes
        this.history_30m[deviceId] = this.history_30m[deviceId].filter(
            entry => (now - entry.timestamp) <= THIRTY_MINUTES_MS
        );
    }

    /**
     * Check if water level changed by more than 0.3m within the last 30 minutes.
     * Returns the maximum delta found.
     */
    checkRapidChange(deviceId, currentLevel) {
        if (!this.history_30m[deviceId] || this.history_30m[deviceId].length === 0) {
            return { isRapid: false, delta: 0 };
        }

        let maxDelta = 0;
        for (const entry of this.history_30m[deviceId]) {
            const delta = Math.abs(currentLevel - entry.level);
            if (delta > maxDelta) {
                maxDelta = delta;
            }
        }

        // Return true if delta > 0.3m
        return { isRapid: maxDelta > 0.3, delta: maxDelta };
    }

    /**
     * Update and check state change
     */
    checkStateChange(deviceId, currentLevelStatus) {
        const prevState = this.previous_states[deviceId] || 'unknown';
        
        // Update to new state
        this.previous_states[deviceId] = currentLevelStatus;

        return {
            isChanged: prevState !== 'unknown' && prevState !== currentLevelStatus,
            prevState,
            currentState: currentLevelStatus
        };
    }

    // ==========================================
    // PHASE 2: Rule Evaluator & Cooldowns
    // ==========================================

    /**
     * Check if a specific alert level has reached its daily limit for a device.
     */
    hasDailyQuota(deviceId, level) {
        const settings = require('../config/settings').getSettings();
        const pipeline = settings.notificationPipeline || { quotaSafe: 1, quotaWatch: 3, quotaDanger: 6 };
        
        const counts = this.getDailyCounts(deviceId);
        if (level === 'dangerous' && counts.danger >= pipeline.quotaDanger) return false;
        if (level === 'warning' && counts.watch >= pipeline.quotaWatch) return false;
        if (level === 'normal' && counts.safe >= pipeline.quotaSafe) return false;
        return true;
    }

    /**
     * Check if current time is within the blocked window (22:00 - 05:59).
     * Time is evaluated in Asia/Bangkok time.
     */
    isTimeBlocked(level) {
        // Danger is never blocked
        if (level === 'dangerous') return false;

        const settings = require('../config/settings').getSettings();
        const pipeline = settings.notificationPipeline || { nightBlockStart: 22, nightBlockEnd: 5 };

        const bkkTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" });
        const dateObj = new Date(bkkTime);
        const hour = dateObj.getHours();

        // Blocked between start and end (e.g. 22 to 5)
        if (pipeline.nightBlockStart > pipeline.nightBlockEnd) {
            return (hour >= pipeline.nightBlockStart || hour <= pipeline.nightBlockEnd);
        } else {
            return (hour >= pipeline.nightBlockStart && hour <= pipeline.nightBlockEnd);
        }
    }

    // ==========================================
    // PHASE 3: Queueing & Batching
    // ==========================================

    queueMessage(alertEntry, queueType) {
        if (queueType === 'morning') {
            this.morning_queue.push(alertEntry);
        }
    }

    /**
     * Helper to consolidate alerts. Retains only the latest entry per station.
     */
    _consolidateQueue(queue) {
        const consolidated = {};
        for (const entry of queue) {
            // Overwrite with latest reading for this station
            consolidated[entry.stationId] = entry;
        }
        return Object.values(consolidated);
    }

    /**
     * Flush the Morning Queue
     */
    flushMorningQueue() {
        if (this.morning_queue.length === 0) return [];
        const merged = this._consolidateQueue(this.morning_queue);
        this.morning_queue = [];
        return merged;
    }

    // ==========================================
    // PHASE 4: Flex Message Generators
    // ==========================================

    createFlexAlertMessage(alertEntry) {
        const { stationId, stationName, waterLevel, alertLevel, isRapidChange } = alertEntry;
        const FRONTEND_URL = process.env.FRONTEND_URL || 'https://dashboard-ieee-kappa.vercel.app';

        const isDangerous = alertLevel === 'dangerous';
        const statusText = isDangerous ? "อันตราย 🚨" : "เฝ้าระวัง ⚠️";
        const color = isDangerous ? "#e02424" : "#ff9f00";
        const description = isDangerous ? "ขอให้อพยพโดยทันที" : "โปรดติดตามสถานการณ์อย่างใกล้ชิด";
        const headerText = isDangerous ? "🚨 ประกาศเตือนภัยฉุกเฉิน 🚨" : "⚠️แจ้งเตือนระดับน้ำ ⚠️";

        const bubble = {
            type: "bubble",
            size: "mega",
            header: {
                type: "box",
                layout: "vertical",
                backgroundColor: color,
                contents: [
                    {
                        type: "text",
                        text: headerText,
                        color: "#ffffff",
                        weight: "bold",
                        size: "lg",
                        align: "center"
                    }
                ]
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: `${stationName}`,
                        weight: "bold",
                        size: "xl",
                        color: "#000000",
                        wrap: true
                    },
                    {
                        type: "text",
                        text: `ID: ${stationId}`,
                        size: "sm",
                        color: "#aaaaaa"
                    },
                    { type: "separator", margin: "md" },
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "md",
                        contents: [
                            {
                                type: "text",
                                text: `ระดับน้ำ: ${Number(waterLevel).toFixed(2)} ม.`,
                                size: "xl",
                                weight: "bold"
                            },
                            {
                                type: "text",
                                text: `สถานะ: ${statusText}`,
                                size: "xl",
                                weight: "bold",
                                color: color
                            }
                        ]
                    },
                    ...(isRapidChange ? [{
                        type: "text",
                        text: "🌊 น้ำขึ้นอย่างรวดเร็วฉับพลัน!",
                        color: "#e02424",
                        size: "md",
                        weight: "bold",
                        margin: "md",
                        align: "center"
                    }] : []),
                    { type: "separator", margin: "md" },
                    {
                        type: "text",
                        text: description,
                        wrap: true,
                        color: color,
                        size: "lg",
                        weight: "bold",
                        margin: "md",
                        align: "center"
                    }
                ]
            },
            footer: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "button",
                        style: "link",
                        height: "sm",
                        action: {
                            type: "uri",
                            label: "📊 เช็คสถานี (Open Dashboard)",
                            uri: `${FRONTEND_URL}/parameters/${encodeURIComponent(stationId)}`
                        }
                    }
                ]
            }
        };

        if (isDangerous) {
            bubble.body.contents.push({
                type: "button",
                style: "primary",
                color: "#e02424",
                margin: "md",
                action: {
                    type: "uri",
                    label: "📞 โทรสายด่วน 1669",
                    uri: "tel:1669"
                }
            });
        }

        return {
            type: "flex",
            altText: `แจ้งเตือนระดับน้ำ: ${stationName} (${statusText})`,
            contents: bubble
        };
    }

    createMorningFlexMessage(alerts, headerTitle = "⛅ สรุปสถานการณ์") {
        if (!alerts || alerts.length === 0) return null;

        const FRONTEND_URL = process.env.FRONTEND_URL || 'https://dashboard-ieee-kappa.vercel.app';
        
        const bubbles = alerts.map(alert => {
            const isDangerous = alert.alertLevel === 'dangerous';
            const isWarning = alert.alertLevel === 'warning';
            
            let color = "#1DB446"; // Normal
            let statusText = "ปกติ ✅";
            if (isDangerous) { color = "#e02424"; statusText = "อันตราย 🚨"; }
            else if (isWarning) { color = "#ff9f00"; statusText = "เฝ้าระวัง ⚠️"; }

            const bodyContents = [
                { type: "text", text: alert.stationName, weight: "bold", size: "xl", color: color, wrap: true },
                { type: "separator", margin: "md" },
                {
                    type: "box", layout: "vertical", margin: "md", contents: [
                        { type: "text", text: `ระดับน้ำ: ${Number(alert.waterLevel).toFixed(2)} ม.`, size: "lg", align: "start" },
                        { type: "text", text: `สถานะ: ${statusText}`, size: "lg", weight: "bold", color: color, align: "start" }
                    ]
                }
            ];

            if (isDangerous) {
                bodyContents.push({ type: "separator", margin: "lg" });
                bodyContents.push({
                    type: "button", style: "primary", color: "#e02424", margin: "md",
                    action: { type: "uri", label: "📞 โทรสายด่วนฉุกเฉิน", uri: "tel:1669" }
                });
            }

            bodyContents.push({ type: "separator", margin: "md" });
            bodyContents.push({
                type: "button",
                style: "secondary",
                color: "#06C755",
                margin: "md",
                height: "sm",
                action: {
                    type: "uri",
                    label: "📊 เช็คสถานี",
                    uri: `${FRONTEND_URL}/parameters/${encodeURIComponent(alert.stationId)}`
                }
            });

            return {
                type: "bubble",
                size: "giga",
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: bodyContents
                }
            };
        });

        // Split into chunks if there are too many bubbles (LINE Carousel max is 12)
        const maxBubbles = 10;
        const displayBubbles = bubbles.slice(0, maxBubbles);

        return {
            type: "flex",
            altText: headerTitle,
            contents: {
                type: "carousel",
                contents: displayBubbles
            }
        };
    }

    // ==========================================
    // PHASE 5: Schedulers (Cron Jobs)
    // ==========================================

    initSchedulers(sendLineNotifyFunc) {
        const cron = require('node-cron');

        // 1. Midnight Reset (00:00)
        cron.schedule('0 0 * * *', () => {
            console.log('⏰ [Cron] Running Daily Quota Reset');
            this.resetDailyCounts();
        }, { timezone: "Asia/Bangkok" });

        // 2. Morning Flush (06:00) - Send all blocked messages from the night
        cron.schedule('0 6 * * *', () => {
            console.log('⏰ [Cron] Running Morning Flush (06:00)');
            const morningAlerts = this.flushMorningQueue();
            if (morningAlerts.length > 0) {
                const flexMessage = this.createMorningFlexMessage(morningAlerts, "⛅ สรุปแจ้งเตือนที่ถูกระงับช่วงกลางคืน");
                if (flexMessage) sendLineNotifyFunc(flexMessage);
            }
        }, { timezone: "Asia/Bangkok" });

        // 3. Scheduled Report (06:30) - Daily Check-in
        cron.schedule('30 6 * * *', () => {
            console.log('⏰ [Cron] Running Scheduled Morning Report (06:30)');
            if (typeof this.onScheduledReport === 'function') {
                this.onScheduledReport();
            }
        }, { timezone: "Asia/Bangkok" });
    }
}

// Export as singleton
const engine = new NotificationEngine();
module.exports = engine;
