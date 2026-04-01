/**
 * 🟣 ChirpStack v4 Simulator
 * 
 * Publishes mock uplink data in ChirpStack v4 JSON format
 * to a local MQTT broker for testing the dashboard's ChirpStack integration.
 * 
 * Usage:
 *   1. Start local Mosquitto: docker-compose up -d mosquitto
 *   2. Set backend env: USE_SIMULATOR=false, networkMode=CHIRPSTACK
 *   3. Set CHIRPSTACK_MQTT_URL=mqtt://localhost:1883
 *   4. Run this script: node simulator-chirpstack.js
 */

const mqtt = require('mqtt');

const BROKER_URL = 'mqtt://192.168.1.53:1883';
const APPLICATION_ID = 'e9e6da7c-161e-402a-a4c9-8d8473f1bbc9'; // Simulated ChirpStack App ID

// Simulated devices (using devEui as device ID, matching ChirpStack behavior)
const devices = [
    {
        devEui: 'tdd-float-01',
        deviceName: 'สถานีวัดระดับน้ำ (ลอยน้ำ 1)',
        type: 'Float',
        baseLevel: 1.5,
        variance: 1.5,
        lat: 13.760358,
        lng: 100.507556
    },
    {
        devEui: 'tdd-float-02',
        deviceName: 'สถานีวัดระดับน้ำ (ลอยน้ำ 2)',
        type: 'Float',
        baseLevel: 2.0,
        variance: 1.5,
        lat: 13.765575,
        lng: 100.510262
    },
    {
        devEui: 'tdd-static-01',
        deviceName: 'สถานีวัดระดับน้ำ (ปักพื้น 1)',
        type: 'Static',
        baseLevel: 1.5,
        variance: 1.5,
        lat: 13.761119,
        lng: 100.510366
    },
    {
        devEui: 'tdd-static-02',
        deviceName: 'สถานีวัดระดับน้ำ (ปักพื้น 2)',
        type: 'Static',
        baseLevel: 2.0,
        variance: 1.5,
        lat: 13.765068,
        lng: 100.507542
    },
];

console.log('🟣 Starting ChirpStack v4 Simulator...');
console.log(`🔌 Connecting to Broker: ${BROKER_URL}`);

const client = mqtt.connect(BROKER_URL);

client.on('connect', () => {
    console.log('✅ Connected to MQTT Broker');

    // Publish immediately
    devices.forEach(publishChirpStackUplink);

    // Then every 60 seconds
    setInterval(() => {
        devices.forEach(publishChirpStackUplink);
    }, 60000);
});

client.on('error', (err) => {
    console.error('❌ MQTT Error:', err.message);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Gracefully shutting down simulator...');
    client.end(() => {
        console.log('✅ MQTT Client disconnected');
        process.exit(0);
    });
});

function publishChirpStackUplink(device) {
    // Generate random water level
    const noise = (Math.random() - 0.5) * device.variance;
    const currentLevel = (device.baseLevel + noise).toFixed(3);

    // Simulate Battery (0-100%)
    const battery = (100 - Math.random() * 100).toFixed(2);

    // Simulate Signal
    const rssi = Math.floor(-100 + Math.random() * 40);
    const snr = (Math.random() * 15 - 5).toFixed(1);

    // ═══════════════════════════════════════════
    // ChirpStack v4 Uplink Event JSON
    // ═══════════════════════════════════════════
    const payload = {
        deduplicationId: `dedup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        time: new Date().toISOString(),
        deviceInfo: {
            tenantId: "tenant-001",
            tenantName: "IEEE Dashboard",
            applicationId: APPLICATION_ID,
            applicationName: "Water Monitoring",
            deviceProfileId: "profile-001",
            deviceProfileName: "Water Sensor Profile",
            deviceName: device.deviceName,
            devEui: device.devEui,
            tags: {
                latitude: String(device.lat),
                longitude: String(device.lng)
            }
        },
        devAddr: "01" + Math.random().toString(16).substr(2, 6),
        adr: true,
        dr: 5,
        fCnt: Math.floor(Math.random() * 10000),
        fPort: 1,
        confirmed: false,
        data: Buffer.from([
            Math.floor(parseFloat(currentLevel) * 100) >> 8,
            Math.floor(parseFloat(currentLevel) * 100) & 0xFF
        ]).toString('base64'),
        // Decoded payload (as if ChirpStack codec is configured)
        object: {
            waterLevel: parseFloat(currentLevel),
            type: device.type,
            battery: parseFloat(battery),
            battery_percentage: parseFloat(battery),
            battery_voltage: (3.0 + Math.random() * 1.2).toFixed(2),
            latitude: device.lat + (Math.random() * 0.001 - 0.0005),
            longitude: device.lng + (Math.random() * 0.001 - 0.0005)
        },
        rxInfo: [
            {
                gatewayId: "gw-cs-001",
                uplinkId: Math.floor(Math.random() * 100000),
                nsTime: new Date().toISOString(),
                rssi: rssi,
                snr: parseFloat(snr),
                channel: 0,
                rfChain: 0,
                location: {
                    latitude: 13.762,
                    longitude: 100.508,
                    altitude: 10
                },
                context: Buffer.from('chirpstack-sim').toString('base64'),
                metadata: {
                    region_common_name: "AS923",
                    region_config_id: "as923"
                },
                crcStatus: "CRC_OK"
            }
        ],
        txInfo: {
            frequency: 923200000,
            modulation: {
                lora: {
                    bandwidth: 125000,
                    spreadingFactor: 7,
                    codeRate: "CR_4_5"
                }
            }
        }
    };

    // ChirpStack v4 topic: application/{application_id}/device/{dev_eui}/event/up
    const topic = `application/${APPLICATION_ID}/device/${device.devEui}/event/up`;
    const message = JSON.stringify(payload);

    client.publish(topic, message);
    console.log(`📤 [CS] ${device.devEui} | ${device.type} | Level: ${currentLevel}m | Batt: ${battery}% | RSSI: ${rssi}`);
}
