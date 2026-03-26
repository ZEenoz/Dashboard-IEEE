// ... (previous imports)
const mqtt = require('mqtt');
const http = require('http');
const { saveReading } = require('./dataManager');
const { getSettings } = require('../config/settings');

const USE_SIMULATOR = false; // 🔴 false = TTI Cloud, 🟢 true = Simulator

// ... (MQTT Config and SENSOR_MAP remain same)
const MQTT_LOCAL = "mqtt://localhost:1883";
const TTI_HOST = "ieeew2025.as1.cloud.thethings.industries";
const TTI_APP_ID = "ieee2025";
const TTI_TENANT_ID = "ieeew2025";
const TTI_API_KEY = "NNSXS.ENUINHN3B3EJ5RM4V7NH3SYS4TCYD4E2S6LQSHQ.UX2QZA5IJRIJSMGOLKKYUSQDSBGK4Z5OG4LXZG46IK6NBUT7MCUQ";

const SENSOR_MAP = {
    "test-hel-v3": ["SEN001", "SEN002"],
    "test-hel-wifilora32": ["SEN003"]
};

let mqttClient;
let mqttOut;
let stationHistory = {};
let activeNodes = {}; // Store { deviceId: { lastSeen: Date, rssi, battery, waterLevel, ... } }
let gatewayStatus = {}; // Store { gatewayId: { rssi, snr, lastSeen, count } }
let alertCooldowns = {}; // Separate store for cooldown timestamps — NOT mixed into activeNodes

// 🔔 Alert Log (in-memory, newest first, max 200 entries) - DEPRECATED
// See alerts table in database instead
const alertLog = [];

/**
 * Fire-and-forget HTTP POST to Flask LINE Bot.
 * Silently ignores errors if Flask is not running.
 */
function pushToFlask(path, body) {
    try {
        const data = JSON.stringify(body);
        const req = http.request({
            hostname: 'localhost',
            port: 5000,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        });
        req.on('error', (e) => {
            console.error("⚠️ Failed to push to Flask Bot:", e.message);
        });
        req.write(data);
        req.end();
    } catch (e) {
        console.error("⚠️ Flask Bot Request Error:", e.message);
    }
}

function initMQTT(io) {
    // ... (connection setup remains same)
    mqttOut = mqtt.connect(MQTT_LOCAL);
    mqttOut.on("connect", () => console.log("📤 MQTT Publisher connected to local broker"));
    mqttOut.on("error", err => console.log("❌ MQTT Publisher error:", err.message));

    let mqttOptions;
    let TOPIC;

    if (USE_SIMULATOR) {
        console.log("🟡 Mode: Using Simulator (Localhost)");
        mqttOptions = MQTT_LOCAL;
        TOPIC = "v3/+/devices/+/up";
    } else {
        console.log("🔵 Mode: Using Private TTI Data (ieeew2025)");
        mqttOptions = {
            protocol: 'mqtts',
            host: TTI_HOST,
            port: 8883,
            username: `${TTI_APP_ID}@${TTI_TENANT_ID}`,
            password: TTI_API_KEY,
            rejectUnauthorized: false
        };
        TOPIC = "v3/+/devices/+/up";
    }

    mqttClient = mqtt.connect(mqttOptions);

    mqttClient.on('connect', () => {
        console.log(`✅ Backend: Connected to MQTT Broker (${USE_SIMULATOR ? 'Local' : 'TTI Cloud'})`);
        mqttClient.subscribe(TOPIC, (err) => {
            if (!err) console.log(`📡 Subscribed to ${TOPIC}`);
        });
    });

    mqttClient.on('error', (err) => {
        console.error("❌ MQTT Connect Error:", err.message);
    });

    mqttClient.on('message', async (topic, message) => {
        await handleMessage(message, io);
    });
}

async function handleMessage(message, io) {
    try {
        const settings = getSettings();
        const payload = JSON.parse(message.toString());

        const networkMode = settings.networkMode || 'TTN';

        let deviceId, stationName, waterLevel, isFloat, sensorType, rawLevel;
        let finalLat = 13.7563, finalLng = 100.5018, locationSource = "Default";
        let rssi = -999, snr = 0, battery = 0, batteryVoltage = 0, dataRateStr = 0;
        let gateways = [];

        const STATIONS_CONFIG = settings.stations || {};

        if (networkMode === 'CHIRPSTACK') {
            deviceId = payload.deviceInfo?.devEui || "unknown";
            stationName = STATIONS_CONFIG[deviceId]?.name || deviceId;

            const obj = payload.object || {};

            isFloat = obj.type === 'Float' || stationName.toLowerCase().includes("float") || deviceId.toLowerCase().includes("float") || deviceId.includes("hel-v3") || deviceId === "ST001";
            sensorType = isFloat ? "Float" : "Static";

            rawLevel = parseFloat(obj.waterLevel || obj.waterlevel || obj.water_level || obj.Level || 0);

            if (payload.location) {
                finalLat = payload.location.latitude;
                finalLng = payload.location.longitude;
                locationSource = "GPS Sensor";
            } else if (STATIONS_CONFIG[deviceId]) {
                finalLat = STATIONS_CONFIG[deviceId].lat;
                finalLng = STATIONS_CONFIG[deviceId].lng;
                locationSource = "Config File";
            }

            if (payload.rxInfo && payload.rxInfo.length > 0) {
                rssi = payload.rxInfo[0].rssi || -999;
                snr = payload.rxInfo[0].snr || 0;
                gateways = payload.rxInfo.map(gw => ({
                    gateway_id: gw.gatewayId || "unknown-gateway",
                    rssi: gw.rssi,
                    snr: gw.snr
                }));
            }

            dataRateStr = payload.txInfo?.modulation?.lora?.spreadingFactor ? `SF${payload.txInfo.modulation.lora.spreadingFactor}BW${payload.txInfo.modulation.lora.bandwidth / 1000}` : 0;
            battery = parseFloat(obj.battery_percentage !== undefined ? obj.battery_percentage : (obj.battery || obj.bat || obj.Battery || 0));
            batteryVoltage = parseFloat(obj.battery_voltage !== undefined ? obj.battery_voltage : 0);

        } else {
            // TTN Mode
            const uplink = payload.uplink_message || {};
            const decoded = uplink.decoded_payload || {};
            deviceId = payload.end_device_ids?.device_id || "unknown";

            stationName = STATIONS_CONFIG[deviceId]?.name || deviceId;

            isFloat = decoded.type === 'Float' || stationName.toLowerCase().includes("float") || deviceId.toLowerCase().includes("float") || deviceId.includes("hel-v3") || deviceId === "ST001";
            sensorType = isFloat ? "Float" : "Static";

            rawLevel = parseFloat(decoded.waterLevel || decoded.waterlevel || decoded.water_level || decoded.Level || 0);

            if (decoded.latitude !== undefined && decoded.longitude !== undefined) {
                finalLat = parseFloat(decoded.latitude);
                finalLng = parseFloat(decoded.longitude);
                locationSource = "GPS Sensor";
            } else {
                // Recursive search for TTN payload latitude/longitude
                const findGPS = (obj, depth = 0) => {
                    if (!obj || typeof obj !== 'object' || depth > 5) return null;
                    if (obj.latitude !== undefined && obj.longitude !== undefined) {
                        return { lat: obj.latitude, lng: obj.longitude };
                    }
                    if (obj.lat !== undefined && obj.lng !== undefined) {
                        return { lat: obj.lat, lng: obj.lng };
                    }
                    for (let key in obj) {
                        const res = findGPS(obj[key], depth + 1);
                        if (res) return res;
                    }
                    return null;
                };

                const gpsPos = findGPS(decoded);
                if (gpsPos) {
                    finalLat = parseFloat(gpsPos.lat);
                    finalLng = parseFloat(gpsPos.lng);
                    locationSource = "GPS Sensor (Decoded)";
                } else if (uplink.locations) {
                    // Search in uplink.locations (e.g. frm-payload or user)
                    const locKeys = Object.keys(uplink.locations);
                    let foundLoc = false;
                    for (let key of locKeys) {
                        if (uplink.locations[key] && uplink.locations[key].latitude !== undefined) {
                            finalLat = parseFloat(uplink.locations[key].latitude);
                            finalLng = parseFloat(uplink.locations[key].longitude);
                            locationSource = `TTN Location (${key})`;
                            foundLoc = true;
                            break;
                        }
                    }
                    
                    if (!foundLoc && STATIONS_CONFIG[deviceId] && STATIONS_CONFIG[deviceId].lat !== undefined) {
                        finalLat = parseFloat(STATIONS_CONFIG[deviceId].lat);
                        finalLng = parseFloat(STATIONS_CONFIG[deviceId].lng);
                        locationSource = "Config File";
                    }
                } else if (STATIONS_CONFIG[deviceId] && STATIONS_CONFIG[deviceId].lat !== undefined) {
                    finalLat = parseFloat(STATIONS_CONFIG[deviceId].lat);
                    finalLng = parseFloat(STATIONS_CONFIG[deviceId].lng);
                    locationSource = "Config File";
                }
            }

            if (uplink.rx_metadata && uplink.rx_metadata.length > 0) {
                rssi = uplink.rx_metadata[0].rssi || -999;
                snr = uplink.rx_metadata[0].snr || 0;
                gateways = uplink.rx_metadata.map(gw => ({
                    gateway_id: gw.gateway_ids?.gateway_id || "unknown-gateway",
                    rssi: gw.rssi,
                    snr: gw.snr
                }));
            }

            dataRateStr = uplink.settings?.data_rate?.index || 0;
            if (uplink.settings?.data_rate?.lora) {
                const lora = uplink.settings.data_rate.lora;
                dataRateStr = `SF${lora.spreading_factor}BW${lora.bandwidth / 1000}`;
            }
            battery = parseFloat(decoded.battery_percentage !== undefined ? decoded.battery_percentage : (decoded.battery || decoded.bat || decoded.Battery || 0));
            batteryVoltage = parseFloat(decoded.battery_voltage !== undefined ? decoded.battery_voltage : 0);
        }

        if (rawLevel > 4) {
            rawLevel = rawLevel / 100;
        }

        // Apply Offset configured in Settings
        let offset = 0;
        if (STATIONS_CONFIG[deviceId] && STATIONS_CONFIG[deviceId].offset !== undefined) {
            offset = parseFloat(STATIONS_CONFIG[deviceId].offset) || 0;
        }
        waterLevel = parseFloat((rawLevel + offset).toFixed(3));


        const stationId =
            deviceId === "test-hel-v3" ? "ST001" :
                deviceId === "test-hel-wifilora32" ? "ST002" :
                    deviceId;

        // --- History Management ---
        if (!stationHistory[deviceId]) stationHistory[deviceId] = [];
        const history = stationHistory[deviceId];

        // --- 🔔 Calculate Alert Level First ---
        const alertThresholds = settings.alertThresholds || {};
        let warningLevel = alertThresholds.warningLevel || 1.8;
        let criticalLevel = alertThresholds.criticalLevel || 2.7;

        try {
            const pool = require('../config/database').getPool();
            if (pool) {
                const cfgRes = await pool.query(
                    'SELECT warning_level, critical_level FROM station_configs WHERE station_id = $1 LIMIT 1',
                    [deviceId]
                );
                if (cfgRes.rows.length > 0) {
                    warningLevel = parseFloat(cfgRes.rows[0].warning_level) || warningLevel;
                    criticalLevel = parseFloat(cfgRes.rows[0].critical_level) || criticalLevel;
                }
            }
        } catch (_) { /* use global fallback */ }

        let alertLevel = 'normal';
        if (waterLevel >= criticalLevel) {
            alertLevel = 'dangerous';
        } else if (waterLevel >= warningLevel) {
            alertLevel = 'warning';
        }


        activeNodes[deviceId] = {
            stationId: deviceId, // Use 'stationId' for consistent naming in frontend
            name: stationName,   // Include name
            lastSeen: new Date(),
            rssi,
            snr,
            battery,
            batteryVoltage,
            waterLevel: waterLevel, // Include current reading
            sensorType: sensorType, // Add explicitly for frontend map coloring
            alertLevel: alertLevel, // Track current severity status
            status: "Online"
        };

        // Update Gateway Status
        if (gateways && gateways.length > 0) {
            gateways.forEach(gw => {
                const gwId = gw.gateway_id || "unknown-gateway";
                if (!gatewayStatus[gwId]) {
                    gatewayStatus[gwId] = { count: 0 };
                }
                gatewayStatus[gwId] = {
                    id: gwId,
                    rssi: gw.rssi,
                    snr: gw.snr,
                    lastSeen: new Date(),
                    lastNode: deviceId,
                    count: gatewayStatus[gwId].count + 1
                };
            });
        }

        const newData = {
            time: new Date().toLocaleTimeString('th-TH'),
            waterLevel,
            dataRate: dataRateStr,
            rssi,
            snr,
            battery,
            batteryVoltage,
            sensorType,
            rawTimestamp: new Date()
        };

        history.push(newData);
        if (history.length > 20) history.shift();

        const dataToSend = {
            stationId: deviceId,
            displayId: stationId,
            stationName: stationName,
            waterLevel,
            lat: finalLat,
            lng: finalLng,
            src: locationSource,
            timestamp: new Date(),
            dataRate: dataRateStr,
            rssi,
            snr,
            battery,
            batteryVoltage,
            sensorType,
            alertLevel
        };


        console.log(`📡 ${stationName} | water: ${waterLevel.toFixed(2)}m | RSSI: ${rssi} | Level: ${alertLevel.toUpperCase()} | GWs: ${Object.keys(gatewayStatus).length}`);

        io.emit('sensor-update', dataToSend);
        await saveReading(dataToSend);

        // ─────────────────────────────────────────────
        // 📡 Phase 1: Push real water data to Flask Bot
        // ─────────────────────────────────────────────
        pushToFlask('/internal/water-update', {
            stationId: deviceId,
            stationName,
            waterLevel,
            sensorType,
            battery,
            batteryVoltage,
            rssi,
            timestamp: new Date().toISOString()
        });

        // --- 🔔 2-Tier Alert Logic (Warning + Dangerous) ---

        let warningCooldown = (alertThresholds.warningCooldownMin || 60) * 60 * 1000;
        let dangerousCooldown = (alertThresholds.dangerousCooldownMin || 15) * 60 * 1000;

        // 🟢 By-pass cooldown in Simulator mode for easier testing
        if (USE_SIMULATOR) {
            warningCooldown = 0;
            dangerousCooldown = 0;
        }

        const now = Date.now();
        const cooldownState = alertCooldowns[deviceId] || {};
        const lastWarnNotified = cooldownState.lastWarnNotified || 0;
        const lastDangerNotified = cooldownState.lastDangerNotified || 0;

        if (alertLevel !== 'normal') {
            const isCooldownPassed = alertLevel === 'dangerous'
                ? (now - lastDangerNotified > dangerousCooldown)
                : (now - lastWarnNotified > warningCooldown);

            if (isCooldownPassed) {
                const threshold = alertLevel === 'dangerous' ? criticalLevel : warningLevel;
                console.log(`${alertLevel === 'dangerous' ? '🚨' : '⚠️'} ${alertLevel.toUpperCase()} Alert: ${stationName} | ${waterLevel.toFixed(2)}m >= ${threshold}m`);

                // ─────────────────────────────────────────────
                // 📋 Add to Alert Log (for Alerts page) -> NOW IN POSTGRES
                // ─────────────────────────────────────────────
                const alertEntry = {
                    id: `alert-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    stationId: deviceId,
                    stationName,
                    waterLevel,
                    threshold,
                    warningThreshold: warningLevel,
                    criticalThreshold: criticalLevel,
                    alertLevel,       // 'warning' | 'dangerous'
                    battery,
                    rssi,
                    sensorType,
                    lineStatus: 'sent_to_bot'
                };

                // 📨 Push to Flask Bot
                if (settings.lineBot?.active !== false) {
                    pushToFlask('/trigger-alert', alertEntry);
                } else {
                    console.log("🔕 LINE Bot alert swallowed (LINE Bot is disabled in settings)");
                }

                // 📲 Send LINE Notify with level-specific message
                const { sendAlertByLevel } = require('./notificationService');
                sendAlertByLevel(alertEntry);

                // Save to PostgreSQL
                try {
                    const pool = require('../config/database').getPool();
                    if (pool) {
                        const insertQuery = `
                            INSERT INTO alerts (station_id, alert_level, water_level, threshold, battery, rssi, line_status)
                            VALUES ($1, $2, $3, $4, $5, $6, $7)
                            RETURNING id, created_at
                        `;
                        const res = await pool.query(insertQuery, [deviceId, alertLevel, waterLevel, threshold, battery, rssi, 'sent_to_bot']);

                        // Emit real-time alert to frontend
                        if (res.rows.length > 0) {
                            alertEntry.id = res.rows[0].id;
                            alertEntry.timestamp = res.rows[0].created_at;
                            io.emit('new-alert', alertEntry);
                        } else {
                            io.emit('new-alert', alertEntry);
                        }
                    } else {
                        io.emit('new-alert', alertEntry);
                    }
                } catch (e) {
                    console.error("⚠️ Failed to save alert to DB:", e.message);
                    io.emit('new-alert', alertEntry); // Still emit even if DB fails
                }

                // Update cooldown timestamps (separate from node data)
                if (!alertCooldowns[deviceId]) alertCooldowns[deviceId] = {};
                if (alertLevel === 'dangerous') {
                    alertCooldowns[deviceId].lastDangerNotified = now;
                } else {
                    alertCooldowns[deviceId].lastWarnNotified = now;
                }
            }
        }

        // ... (MQTT Publish to Legacy remains same)
        const sensors = SENSOR_MAP[deviceId] || [];
        for (let sensorId of sensors) {
            let value = 0;
            if (sensorId === "SEN001" || sensorId === "SEN003") value = waterLevel;

            if (mqttOut && mqttOut.connected) {
                mqttOut.publish(`water/${stationId}/${sensorId}`, JSON.stringify({ value }));
            }
        }

    } catch (error) {
        console.error("❌ Error processing message:", error);
    }
}

function getStationHistory() {
    return stationHistory;
}

function updateStationHistory(id, historyData) {
    stationHistory[id] = historyData;
}

function getAlertLog() {
    return alertLog;
}

// System Health Helpers
function getMQTTStatus() {
    return {
        connected: mqttClient ? mqttClient.connected : false,
        broker: USE_SIMULATOR ? 'Local Simulator' : 'TTI Cloud',
        topic: USE_SIMULATOR ? "v3/+/devices/+/up" : "v3/+/devices/+/up"
    };
}

function getGatewayStatus() {
    // Return detailed list of gateways
    const gateways = Object.values(gatewayStatus).sort((a, b) => b.lastSeen - a.lastSeen);

    // If using simulator and no gateways found (yet), add a mock one for testing UI
    if (USE_SIMULATOR && gateways.length === 0) {
        return {
            type: 'Simulator (Mock)',
            gateways: [
                { id: 'sim-gateway-01', rssi: -45, snr: 9, lastSeen: new Date(), lastNode: 'test-node', count: 124 },
                { id: 'sim-gateway-02', rssi: -110, snr: -2, lastSeen: new Date(Date.now() - 60000), lastNode: 'test-node', count: 5 }
            ]
        };
    }

    return {
        type: 'TTI/LoRaWAN',
        gateways: gateways
    };
}

function getActiveNodes() {
    return Object.values(activeNodes).sort((a, b) => b.lastSeen - a.lastSeen);
}

module.exports = {
    initMQTT,
    getStationHistory,
    updateStationHistory,
    getAlertLog,
    getMQTTStatus,
    getGatewayStatus,
    getActiveNodes
};
