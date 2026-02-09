const mqtt = require('mqtt');
const { saveReading } = require('./dataManager');
const { getSettings } = require('../config/settings');

const USE_SIMULATOR = false; // 🔴 false = TTI Cloud, 🟢 true = Simulator

// MQTT Config
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

function initMQTT(io) {
    // 1. Setup Output Publisher (Local Mosquitto for legacy components)
    mqttOut = mqtt.connect(MQTT_LOCAL);
    mqttOut.on("connect", () => console.log("📤 MQTT Publisher connected to local broker"));
    mqttOut.on("error", err => console.log("❌ MQTT Publisher error:", err.message));

    // 2. Setup Input Consumer (Simulator or TTI)
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
        // const pool = getPool(); // Removed
        const payload = JSON.parse(message.toString());

        const uplink = payload.uplink_message || {};
        const decoded = uplink.decoded_payload || {};
        const deviceId = payload.end_device_ids?.device_id || "unknown";

        const STATIONS_CONFIG = settings.stations || {};
        const stationName = STATIONS_CONFIG[deviceId]?.name || deviceId;

        // Determine Sensor Category
        const isFloat = stationName.toLowerCase().includes("float") || deviceId.includes("hel-v3") || deviceId === "ST001";
        const sensorType = isFloat ? "Float" : "Static";

        let pressure = parseFloat(decoded.pressure || decoded.Pressure || 0);

        // 1. Universal Water Level Extraction (Handle camelCase, snake_case, PascalCase)
        let rawLevel = parseFloat(decoded.waterLevel || decoded.waterlevel || decoded.water_level || decoded.Level || 0);

        // 2. Universal Unit Conversion (Heuristic: If > 10, assume cm and convert to m)
        // This handles "124cm" -> "1.24m" for both Static and Float nodes automatically
        if (rawLevel > 10) {
            rawLevel = rawLevel / 100;
        }

        let waterLevel = rawLevel;

        // Fallback: Only calculate from pressure if NO water level is found in payload
        if (waterLevel === 0 && pressure > 0) {
            // P = rho * g * h  =>  h = P / (rho * g)
            // Approx: 1 bar = 10.197 meters of water head.
            waterLevel = pressure * 10.197;
        }

        // Mapping
        const stationId =
            deviceId === "test-hel-v3" ? "ST001" :
                deviceId === "test-hel-wifilora32" ? "ST002" :
                    deviceId;

        // Logic Location
        let finalLat = 13.7563;
        let finalLng = 100.5018;
        let locationSource = "Default";

        if (decoded.latitude && decoded.longitude) {
            finalLat = parseFloat(decoded.latitude);
            finalLng = parseFloat(decoded.longitude);
            locationSource = "GPS Sensor";
        } else if (uplink.locations && uplink.locations['user']) {
            finalLat = uplink.locations['user'].latitude;
            finalLng = uplink.locations['user'].longitude;
            locationSource = "TTN Console";
        } else if (STATIONS_CONFIG[deviceId]) {
            finalLat = STATIONS_CONFIG[deviceId].lat;
            finalLng = STATIONS_CONFIG[deviceId].lng;
            locationSource = "Config File";
        }

        // History Management
        if (!stationHistory[deviceId]) stationHistory[deviceId] = [];
        const history = stationHistory[deviceId];

        let trend = 'stable';
        if (history.length > 0) {
            const lastVal = history[history.length - 1].waterLevel;
            if (waterLevel > lastVal) trend = 'up';
            else if (waterLevel < lastVal) trend = 'down';
        }

        const rssi = (uplink.rx_metadata && uplink.rx_metadata[0]) ? uplink.rx_metadata[0].rssi : -999;
        const snr = (uplink.rx_metadata && uplink.rx_metadata[0]) ? uplink.rx_metadata[0].snr : 0;

        // Try to get a readable data rate string (e.g. SF7BW125)
        let dataRateStr = uplink.settings?.data_rate?.index || 0;
        if (uplink.settings?.data_rate?.lora) {
            const lora = uplink.settings.data_rate.lora;
            dataRateStr = `SF${lora.spreading_factor}BW${lora.bandwidth / 1000}`;
        }

        const battery = parseFloat(decoded.battery || decoded.bat || decoded.Battery || 0);

        // const sensorType = stationName.toLowerCase().includes("float") ? "Float" : "Static"; // Moved up

        const newData = {
            time: new Date().toLocaleTimeString('th-TH'),
            waterLevel,
            pressure,
            dataRate: dataRateStr,
            rssi,
            snr,
            battery,
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
            pressure,
            lat: finalLat,
            lng: finalLng,
            src: locationSource,
            timestamp: new Date(),
            history,
            trend,
            dataRate: dataRateStr,
            rssi,
            snr,
            battery,
            sensorType
        };

        console.log(`📡 ${stationName} | water_level: ${waterLevel.toFixed(2)} | Data rate: ${dataRateStr} | SNR: ${snr} | RSSI: ${rssi}`);

        // Emit to Frontend
        io.emit('sensor-update', dataToSend);

        // Save via DataManager (Postgres + Google Sheets)
        await saveReading(dataToSend);

        // Publish to Legacy Mosquitto
        const sensors = SENSOR_MAP[deviceId] || [];
        for (let sensorId of sensors) {
            let value = 0;
            if (sensorId === "SEN001" || sensorId === "SEN003") value = waterLevel;
            else if (sensorId === "SEN002") value = pressure;

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

module.exports = {
    initMQTT,
    getStationHistory,
    updateStationHistory
};
