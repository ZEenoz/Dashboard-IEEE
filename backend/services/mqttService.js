// --- MQTT Service ---
// Supports 3 modes: TTN Cloud, ChirpStack, and Local Simulator
const mqtt = require('mqtt');
const http = require('http');
const { saveReading } = require('./dataManager');
const { getSettings } = require('../config/settings');

const USE_SIMULATOR = (process.env.USE_SIMULATOR === 'true');

// ──────────────────────────────────────────
// 🔧 TTN (The Things Network) Configuration
// ──────────────────────────────────────────
const MQTT_LOCAL = process.env.MQTT_LOCAL_URL || "mqtt://localhost:1883";
const TTI_HOST = process.env.TTI_HOST || "ieeew2025.as1.cloud.thethings.industries";
const TTI_APP_ID = process.env.TTI_APP_ID || "ieee2025";
const TTI_TENANT_ID = process.env.TTI_TENANT_ID || "ieeew2025";
const TTI_API_KEY = process.env.TTI_API_KEY;

// ──────────────────────────────────────────
// 🟣 ChirpStack Configuration
// ──────────────────────────────────────────
// ChirpStack v4 MQTT Integration
// Topic format: application/{application_id}/device/{dev_eui}/event/up
// Broker: typically mqtt(s)://chirpstack-host:1883 or 8883
// Auth: username/password OR TLS client certificate
const CHIRPSTACK_MQTT_URL = process.env.CHIRPSTACK_MQTT_URL || "mqtt://localhost:1883";
const CHIRPSTACK_MQTT_USER = process.env.CHIRPSTACK_MQTT_USER || "";
const CHIRPSTACK_MQTT_PASS = process.env.CHIRPSTACK_MQTT_PASS || "";
const CHIRPSTACK_APP_ID = process.env.CHIRPSTACK_APP_ID || "e9e6da7c-161e-402a-a4c9-8d8473f1bbc9";   // e.g. "a1b2c3d4..." (UUID from ChirpStack)
const CHIRPSTACK_USE_TLS = process.env.CHIRPSTACK_USE_TLS === 'false';

const FLASK_BOT_URL = process.env.FLASK_BOT_URL || 'http://localhost:5000';

const SENSOR_MAP = {
    "test-hel-v3": ["SEN001", "SEN002"],
    "test-hel-wifilora32": ["SEN003"]
};

let mqttClient;
let mqttOut;
let stationHistory = {};
let activeNodes = {};
let gatewayStatus = {};
let alertCooldowns = {};
let currentIo = null;         // Keep reference to Socket.IO for reconnection
let currentNetworkMode = null; // Track which mode we're connected in

const alertLog = [];

/**
 * Fire-and-forget HTTP POST to Flask LINE Bot.
 */
function pushToFlask(path, body) {
    try {
        const url = new URL(path, FLASK_BOT_URL);
        const data = JSON.stringify(body);
        const req = http.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        });
        req.on('error', (e) => {
            console.error("⚠️ Failed to push to Flask Bot:", e.message || e);
        });
        req.write(data);
        req.end();
    } catch (e) {
        console.error("⚠️ Flask Bot Request Error:", e.message || e);
    }
}

// ══════════════════════════════════════════════════════
// 🚀 initMQTT — Main entry point
// ══════════════════════════════════════════════════════
function initMQTT(io) {
    currentIo = io;
    const settings = getSettings();
    const networkMode = settings.networkMode || 'TTN';

    let mqttOptions;
    let TOPIC;

    // --- 📤 LOCAL PUBLISHER (Only needed for simulator/local bridge) ---
    if (USE_SIMULATOR) {
        console.log("📤 Connecting to Local MQTT Broker...");
        mqttOut = mqtt.connect(MQTT_LOCAL);
        mqttOut.on("connect", () => console.log("📤 MQTT Publisher connected to local broker"));
        mqttOut.on("error", err => console.log("❌ MQTT Publisher error (Local):", err.message));
    }

    // ─────────────────────────────────────────────
    // Determine connection based on mode
    // ─────────────────────────────────────────────
    if (USE_SIMULATOR) {
        // ── SIMULATOR MODE ──
        console.log("🟡 Mode: Simulator (Localhost MQTT)");
        mqttOptions = MQTT_LOCAL;
        TOPIC = "v3/+/devices/+/up";
        currentNetworkMode = 'SIMULATOR';

    } else if (networkMode === 'CHIRPSTACK') {
        // ── CHIRPSTACK MODE ──
        // Merge config: UI settings (settings.chirpstack) override env vars
        const csConfig = settings.chirpstack || {};
        const csMqttUrl = csConfig.mqttUrl || CHIRPSTACK_MQTT_URL;
        const csMqttUser = csConfig.mqttUser || CHIRPSTACK_MQTT_USER;
        const csMqttPass = csConfig.mqttPass || CHIRPSTACK_MQTT_PASS;
        const csAppId = csConfig.applicationId || CHIRPSTACK_APP_ID;
        const csUseTls = csConfig.useTls || CHIRPSTACK_USE_TLS;

        console.log("🟣 Mode: ChirpStack v4");
        console.log(`   Broker: ${csMqttUrl}`);
        console.log(`   App ID: ${csAppId || '(wildcard)'}`);
        console.log(`   TLS: ${csUseTls ? 'Enabled' : 'Disabled'}`);
        console.log(`   Auth: ${csMqttUser ? 'Username/Password' : 'Anonymous'}`);

        const opts = {
            clientId: `dashboard-ieee-cs-${Date.now()}`,
            clean: true,
            connectTimeout: 15000,
            reconnectPeriod: 5000,
        };

        // Add auth if provided
        if (csMqttUser) {
            opts.username = csMqttUser;
            opts.password = csMqttPass;
        }

        // TLS support
        if (csUseTls) {
            opts.rejectUnauthorized = false; // Set true in production with valid certs
        }

        const protocol = csUseTls ? 'mqtts' : 'mqtt';
        const brokerUrl = csMqttUrl.startsWith('mqtt')
            ? csMqttUrl
            : `${protocol}://${csMqttUrl}`;

        mqttOptions = { ...opts };

        // ChirpStack v4 topic structure:
        //   application/{application_id}/device/{dev_eui}/event/up
        // Use + wildcard for application_id if not specified
        const appFilter = csAppId || '+';
        TOPIC = `application/${appFilter}/device/+/event/up`;

        console.log(`   Topic: ${TOPIC}`);

        mqttClient = mqtt.connect(brokerUrl, mqttOptions);

        currentNetworkMode = 'CHIRPSTACK';

        mqttClient.on('connect', () => {
            console.log(`✅ Connected to ChirpStack MQTT Broker`);
            mqttClient.subscribe(TOPIC, (err) => {
                if (!err) {
                    console.log(`📡 Subscribed to ChirpStack topic: ${TOPIC}`);
                } else {
                    console.error(`❌ ChirpStack Subscribe Error:`, err.message);
                }
            });

            // Also subscribe to device status events for richer monitoring
            const statusTopic = `application/${appFilter}/device/+/event/status`;
            mqttClient.subscribe(statusTopic, (err) => {
                if (!err) console.log(`📡 Subscribed to ChirpStack status: ${statusTopic}`);
            });

            // Subscribe to join events
            const joinTopic = `application/${appFilter}/device/+/event/join`;
            mqttClient.subscribe(joinTopic, (err) => {
                if (!err) console.log(`📡 Subscribed to ChirpStack join: ${joinTopic}`);
            });
        });

        mqttClient.on('error', (err) => {
            console.error("❌ ChirpStack MQTT Error:", err.message);
        });

        mqttClient.on('reconnect', () => {
            console.log("🔄 Reconnecting to ChirpStack MQTT...");
        });

        mqttClient.on('offline', () => {
            console.log("⚫ ChirpStack MQTT Broker offline");
        });

        mqttClient.on('message', async (topic, message) => {
            // Only process uplink events, ignore status/join for now
            if (topic.includes('/event/up')) {
                await handleMessage(message, io);
            } else if (topic.includes('/event/status')) {
                handleChirpStackStatus(topic, message);
            } else if (topic.includes('/event/join')) {
                handleChirpStackJoin(topic, message);
            }
        });

        // Early return since we handled connection inline
        return;

    } else {
        // ── TTN MODE ──
        console.log("🔵 Mode: The Things Network (TTI Cloud)");
        mqttOptions = {
            protocol: 'mqtts',
            host: TTI_HOST,
            port: 8883,
            username: `${TTI_APP_ID}@${TTI_TENANT_ID}`,
            password: TTI_API_KEY,
            rejectUnauthorized: false
        };
        TOPIC = "v3/+/devices/+/up";
        currentNetworkMode = 'TTN';
    }

    // ── Connect (TTN / Simulator path) ──
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

    // Announce the active mode to all connected clients immediately after init
    if (io) io.emit('system-mode', currentNetworkMode);
}

// ══════════════════════════════════════════════════════
// 🔄 reconnectMQTT — Switch broker when networkMode changes
// ══════════════════════════════════════════════════════
function reconnectMQTT() {
    const settings = getSettings();
    const newMode = USE_SIMULATOR ? 'SIMULATOR' : (settings.networkMode || 'TTN');

    if (newMode === currentNetworkMode) {
        console.log(`🔄 Network mode unchanged (${newMode}), skipping reconnect.`);
        return;
    }

    console.log(`🔄 Network mode changed: ${currentNetworkMode} → ${newMode}`);
    console.log(`🔌 Disconnecting from current MQTT broker...`);

    // Gracefully close existing connection
    if (mqttClient) {
        mqttClient.end(true, () => {
            console.log("✅ Previous MQTT connection closed.");
            mqttClient = null;
            // Re-initialize with new settings
            if (currentIo) {
                initMQTT(currentIo);
            }
        });
    } else {
        if (currentIo) {
            initMQTT(currentIo);
        }
    }
}

// ══════════════════════════════════════════════════════
// 🟣 ChirpStack Event Handlers
// ══════════════════════════════════════════════════════

/**
 * Handle ChirpStack device status event
 * Topic: application/{app_id}/device/{dev_eui}/event/status
 */
function handleChirpStackStatus(topic, message) {
    try {
        const payload = JSON.parse(message.toString());
        const devEui = payload.deviceInfo?.devEui || extractDevEuiFromTopic(topic);
        const batteryLevel = payload.batteryLevel;       // 0-254 (ChirpStack value)
        const margin = payload.margin;                   // Demodulation margin (dB)
        const externalPowerSource = payload.externalPowerSource;

        console.log(`📊 ChirpStack Status | Device: ${devEui} | Battery: ${batteryLevel} | Margin: ${margin}dB`);

        // Update active node with battery info if available
        if (activeNodes[devEui]) {
            if (batteryLevel !== undefined && batteryLevel !== 255) {
                // ChirpStack battery: 0 = end-of-life, 1-254 = level, 255 = unknown
                activeNodes[devEui].battery = Math.round((batteryLevel / 254) * 100);
            }
            activeNodes[devEui].lastSeen = new Date();
        }
    } catch (e) {
        console.error("⚠️ ChirpStack Status Parse Error:", e.message);
    }
}

/**
 * Handle ChirpStack join event
 * Topic: application/{app_id}/device/{dev_eui}/event/join
 */
function handleChirpStackJoin(topic, message) {
    try {
        const payload = JSON.parse(message.toString());
        const devEui = payload.deviceInfo?.devEui || extractDevEuiFromTopic(topic);
        const deviceName = payload.deviceInfo?.deviceName || devEui;

        console.log(`🤝 ChirpStack Join | Device: ${deviceName} (${devEui}) joined the network`);
    } catch (e) {
        console.error("⚠️ ChirpStack Join Parse Error:", e.message);
    }
}

/**
 * Extract DevEUI from ChirpStack topic path
 * e.g. "application/abc123/device/a1b2c3d4e5f6/event/up" → "a1b2c3d4e5f6"
 */
function extractDevEuiFromTopic(topic) {
    const parts = topic.split('/');
    const deviceIdx = parts.indexOf('device');
    if (deviceIdx !== -1 && deviceIdx + 1 < parts.length) {
        return parts[deviceIdx + 1];
    }
    return 'unknown';
}


// ══════════════════════════════════════════════════════
// 📦 handleMessage — Parse uplink payload (TTN or ChirpStack)
// ══════════════════════════════════════════════════════
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
            // ──────────────────────────────────────────
            // 🟣 ChirpStack v4 Payload Parsing
            // ──────────────────────────────────────────
            // ChirpStack v4 uplink JSON structure:
            // {
            //   "deduplicationId": "...",
            //   "time": "2024-01-01T00:00:00Z",
            //   "deviceInfo": {
            //     "tenantId": "...",
            //     "tenantName": "...",
            //     "applicationId": "...",
            //     "applicationName": "...",
            //     "deviceProfileId": "...",
            //     "deviceProfileName": "...",
            //     "deviceName": "My Sensor",
            //     "devEui": "a1b2c3d4e5f6a7b8",
            //     "tags": {}
            //   },
            //   "devAddr": "01abc123",
            //   "adr": true,
            //   "dr": 5,
            //   "fCnt": 42,
            //   "fPort": 1,
            //   "confirmed": false,
            //   "data": "base64encodedFRMPayload",
            //   "object": {                 ← Decoded by ChirpStack codec
            //     "waterLevel": 1.23,
            //     "battery": 85,
            //     "type": "Float"
            //   },
            //   "rxInfo": [
            //     {
            //       "gatewayId": "a1b2c3d4e5f6a7b8",
            //       "uplinkId": 12345,
            //       "nsTime": "2024-01-01T00:00:00Z",
            //       "rssi": -65,
            //       "snr": 8.5,
            //       "location": { "latitude": 13.76, "longitude": 100.50 }
            //     }
            //   ],
            //   "txInfo": {
            //     "frequency": 923200000,
            //     "modulation": {
            //       "lora": {
            //         "bandwidth": 125000,
            //         "spreadingFactor": 7,
            //         "codeRate": "CR_4_5"
            //       }
            //     }
            //   }
            // }

            // Device identification
            deviceId = payload.deviceInfo?.devEui || "unknown";
            const deviceName = payload.deviceInfo?.deviceName || deviceId;

            // Use config name if available, otherwise use ChirpStack device name
            stationName = STATIONS_CONFIG[deviceId]?.name || deviceName;

            // Decoded object (requires ChirpStack codec to be configured)
            const obj = payload.object || {};

            // If no codec is configured, try to decode base64 FRMPayload
            if (Object.keys(obj).length === 0 && payload.data) {
                console.log(`⚠️ ChirpStack: No decoded 'object' for ${deviceId}. Raw base64 data: ${payload.data}`);
                console.log(`   → Please configure a Codec (JavaScript or CayenneLPP) in your ChirpStack Device Profile.`);
                // Attempt basic decode for common formats
                try {
                    const rawBytes = Buffer.from(payload.data, 'base64');
                    // If payload is 2 bytes, interpret as water level in cm
                    if (rawBytes.length >= 2) {
                        const rawCm = (rawBytes[0] << 8) | rawBytes[1];
                        obj.waterLevel = rawCm / 100; // Convert cm to meters
                        console.log(`   → Auto-decoded ${rawBytes.length} bytes → waterLevel: ${obj.waterLevel}m`);
                    }
                } catch (decodeErr) {
                    console.error(`   → Base64 decode failed:`, decodeErr.message);
                }
            }

            // Sensor type detection
            const cfgType = STATIONS_CONFIG[deviceId]?.type;
            isFloat = cfgType === 'Float'
                || obj.type === 'Float'
                || stationName.toLowerCase().includes("float")
                || deviceId.toLowerCase().includes("float");
            sensorType = isFloat ? "Float" : "Static";

            // Water level extraction (try multiple field names for flexibility)
            rawLevel = parseFloat(
                obj.waterLevel ?? obj.waterlevel ?? obj.water_level ?? obj.Level ?? obj.level ?? obj.distance ?? 0
            );

            // Location: priority → payload GPS > gateway location > config file > default
            if (obj.latitude !== undefined && obj.longitude !== undefined) {
                finalLat = parseFloat(obj.latitude);
                finalLng = parseFloat(obj.longitude);
                locationSource = "GPS Sensor (Decoded)";
            } else if (payload.deviceInfo?.tags?.latitude) {
                // ChirpStack device tags can store static coordinates
                finalLat = parseFloat(payload.deviceInfo.tags.latitude);
                finalLng = parseFloat(payload.deviceInfo.tags.longitude);
                locationSource = "ChirpStack Device Tags";
            } else if (STATIONS_CONFIG[deviceId]?.lat !== undefined) {
                finalLat = STATIONS_CONFIG[deviceId].lat;
                finalLng = STATIONS_CONFIG[deviceId].lng;
                locationSource = "Config File";
            } else if (payload.rxInfo?.[0]?.location) {
                // Fallback to gateway location
                finalLat = payload.rxInfo[0].location.latitude;
                finalLng = payload.rxInfo[0].location.longitude;
                locationSource = "Gateway Location";
            }

            // RF metadata from rxInfo
            if (payload.rxInfo && payload.rxInfo.length > 0) {
                rssi = payload.rxInfo[0].rssi ?? -999;
                snr = payload.rxInfo[0].snr ?? 0;
                gateways = payload.rxInfo.map(gw => ({
                    gateway_id: gw.gatewayId || "unknown-gateway",
                    rssi: gw.rssi,
                    snr: gw.snr,
                    location: gw.location || null
                }));
            }

            // Data rate from txInfo
            if (payload.txInfo?.modulation?.lora) {
                const lora = payload.txInfo.modulation.lora;
                dataRateStr = `SF${lora.spreadingFactor}BW${(lora.bandwidth || 125000) / 1000}`;
            } else if (payload.dr !== undefined) {
                dataRateStr = `DR${payload.dr}`;
            }

            // Battery
            battery = parseFloat(
                obj.battery_percentage ?? obj.battery ?? obj.bat ?? obj.Battery ?? 0
            );
            batteryVoltage = parseFloat(
                obj.battery_voltage ?? obj.batteryVoltage ?? obj.vbat ?? 0
            );

        } else {
            // ──────────────────────────────────────────
            // 🔵 TTN Mode (The Things Network)
            // ──────────────────────────────────────────
            const uplink = payload.uplink_message || {};
            const decoded = uplink.decoded_payload || {};
            deviceId = payload.end_device_ids?.device_id || "unknown";

            stationName = STATIONS_CONFIG[deviceId]?.name || deviceId;

            const cfgType = STATIONS_CONFIG[deviceId]?.type;
            isFloat = cfgType === 'Float'
                || decoded.type === 'Float'
                || stationName.toLowerCase().includes("float")
                || deviceId.toLowerCase().includes("float")
                || deviceId.includes("hel-v3")
                || deviceId === "ST001";
            sensorType = isFloat ? "Float" : "Static";

            rawLevel = parseFloat(decoded.waterLevel || decoded.waterlevel || decoded.water_level || decoded.Level || 0);

            if (decoded.latitude !== undefined && decoded.longitude !== undefined) {
                finalLat = parseFloat(decoded.latitude);
                finalLng = parseFloat(decoded.longitude);
                locationSource = "GPS Sensor";
            } else {
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

        // ──────────────────────────────────────────
        // 📐 Common processing (both modes)
        // ──────────────────────────────────────────

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
            stationId: deviceId,
            name: stationName,
            lastSeen: new Date(),
            rssi,
            snr,
            battery,
            batteryVoltage,
            waterLevel: waterLevel, // Calibrated
            rawLevel: rawLevel,     // Original Sensor Value
            sensorType: sensorType,
            alertLevel: alertLevel,
            status: "Online",
            networkMode: currentNetworkMode
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
            waterLevel, // Calibrated
            rawLevel,   // Original Sensor Value
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
            alertLevel,
            networkMode: currentNetworkMode
        };


        console.log(`📡 ${stationName} | water: ${waterLevel.toFixed(2)}m | RSSI: ${rssi} | Level: ${alertLevel.toUpperCase()} | GWs: ${Object.keys(gatewayStatus).length}`);

        io.emit('sensor-update', dataToSend);
        await saveReading(dataToSend);

        // ─────────────────────────────────────────────
        // 📡 Push real water data to Flask Bot
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

                const alertEntry = {
                    id: `alert-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    stationId: deviceId,
                    stationName,
                    waterLevel,
                    threshold,
                    warningThreshold: warningLevel,
                    criticalThreshold: criticalLevel,
                    alertLevel,
                    battery,
                    rssi,
                    sensorType,
                    lineStatus: 'sent_to_bot'
                };

                if (settings.lineBot?.active !== false) {
                    pushToFlask('/trigger-alert', alertEntry);
                } else {
                    console.log("🔕 LINE Bot alert swallowed (LINE Bot is disabled in settings)");
                }

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
                    io.emit('new-alert', alertEntry);
                }

                if (!alertCooldowns[deviceId]) alertCooldowns[deviceId] = {};
                if (alertLevel === 'dangerous') {
                    alertCooldowns[deviceId].lastDangerNotified = now;
                } else {
                    alertCooldowns[deviceId].lastWarnNotified = now;
                }
            }
        }

        // Legacy MQTT publish
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
        broker: USE_SIMULATOR ? 'Local Simulator' : (currentNetworkMode === 'CHIRPSTACK' ? 'ChirpStack' : 'TTI Cloud'),
        mode: currentNetworkMode || 'Unknown',
        topic: currentNetworkMode === 'CHIRPSTACK'
            ? `application/${CHIRPSTACK_APP_ID || '+'}/device/+/event/up`
            : "v3/+/devices/+/up"
    };
}

function getGatewayStatus() {
    const gateways = Object.values(gatewayStatus).sort((a, b) => b.lastSeen - a.lastSeen);

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
        type: currentNetworkMode === 'CHIRPSTACK' ? 'ChirpStack' : 'TTI/LoRaWAN',
        gateways: gateways
    };
}

function getActiveNodes() {
    return Object.values(activeNodes).sort((a, b) => b.lastSeen - a.lastSeen);
}

module.exports = {
    initMQTT,
    reconnectMQTT,
    getStationHistory,
    updateStationHistory,
    getAlertLog,
    getMQTTStatus,
    getGatewayStatus,
    getActiveNodes
};
