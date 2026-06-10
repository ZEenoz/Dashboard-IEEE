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

    /**
     * Check if the global 30-minute cooldown has passed.
     */
    isGlobalCooldownActive() {
        const settings = require('../config/settings').getSettings();
        const pipeline = settings.notificationPipeline || { globalCooldownMin: 30 };
        const now = Date.now();
        const cooldown_ms = pipeline.globalCooldownMin * 60 * 1000;
        
        if (!this.global_last_sent) {
            return false;
        }

        return (now - this.global_last_sent) < cooldown_ms;
    }

    /**
     * Mark global broadcast as sent
     */
    markGlobalBroadcastSent() {
        this.global_last_sent = Date.now();
    }

    // ==========================================
    // PHASE 3: Queueing & Batching
    // ==========================================

    queueMessage(alertEntry, queueType) {
        if (queueType === 'morning') {
            this.morning_queue.push(alertEntry);
        } else {
            this.batch_queue.push(alertEntry);
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
     * Flush the Global Batch Queue
     */
    flushBatchQueue() {
        if (this.batch_queue.length === 0) return [];
        const merged = this._consolidateQueue(this.batch_queue);
        this.batch_queue = [];
        return merged;
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
    // PHASE 4: Schedulers (Cron Jobs)
    // ==========================================

    initSchedulers(sendLineNotifyFunc, generateBatchMessageFunc) {
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
                const combinedMessage = generateBatchMessageFunc(morningAlerts, "⛅ สรุปสถานการณ์ช่วงกลางคืนที่ผ่านมา");
                sendLineNotifyFunc(combinedMessage);
                this.markGlobalBroadcastSent();
            }
        }, { timezone: "Asia/Bangkok" });

        // 3. Scheduled Report (06:30) - Daily SAFE Check-in
        cron.schedule('30 6 * * *', () => {
            console.log('⏰ [Cron] Running Scheduled Morning Report (06:30)');
            // Need a callback to gather all SAFE stations and send a single report
            if (typeof this.onScheduledReport === 'function') {
                this.onScheduledReport();
            }
        }, { timezone: "Asia/Bangkok" });

        // 4. 30-min Global Cooldown Batch Flusher
        // Runs every minute to check if the cooldown has passed and queue has items
        cron.schedule('* * * * *', () => {
            if (this.batch_queue.length > 0 && !this.isGlobalCooldownActive()) {
                console.log('⏰ [Cron] Global Cooldown passed, flushing batch queue');
                const batchedAlerts = this.flushBatchQueue();
                if (batchedAlerts.length > 0) {
                    const combinedMessage = generateBatchMessageFunc(batchedAlerts, "⚠️ สรุปแจ้งเตือนรวบยอด (รอบ 30 นาที)");
                    sendLineNotifyFunc(combinedMessage);
                    this.markGlobalBroadcastSent();
                }
            }
        }, { timezone: "Asia/Bangkok" });
    }
}

// Export as singleton
const engine = new NotificationEngine();
module.exports = engine;
