const mqtt = require('mqtt');

// Configuration
const BROKER_URL = 'mqtt://localhost:1883';
const TOPIC_TEMPLATE = 'v3/simulator/devices/{deviceId}/up';

// Simulated Devices
// 2 Float Nodes (Blue)
// 2 Static Nodes (Purple)
const devices = [
    { id: 'tdd-float-01', type: 'Float', baseLevel: 1.5, variance: 1.5 },
    { id: 'tdd-float-02', type: 'Float', baseLevel: 2.0, variance: 1.5 },
    { id: 'tdd-static-01', type: 'Static', baseLevel: 1.5, variance: 1.5 },
    { id: 'tdd-static-02', type: 'Static', baseLevel: 2.0, variance: 1.5 },
];

console.log('🌊 Starting Water Level Simulator...');
console.log(`🔌 Connecting to Broker: ${BROKER_URL}`);

const client = mqtt.connect(BROKER_URL);

client.on('connect', () => {
    console.log('✅ Connected to MQTT Broker');

    // Publish immediately
    devices.forEach(publishData);

    // Then every 60 seconds
    setInterval(() => {
        devices.forEach(publishData);
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

function publishData(device) {
    // Generate random water level based on device specs
    const noise = (Math.random() - 0.5) * device.variance;
    const currentLevel = (device.baseLevel + noise).toFixed(3);

    // Simulate Battery (slowly draining or random fluctuation)
    const battery = (100 - Math.random() * 100).toFixed(2);

    // Simulate Signal
    const rssi = Math.floor(-100 + Math.random() * 40); // -100 to -60
    const snr = Math.floor(-5 + Math.random() * 15);    // -5 to 10

    // Construct Payload matching TTI/Backend expectation
    const payload = {
        end_device_ids: {
            device_id: device.id,
            application_ids: { application_id: "simulator-app" }
        },
        uplink_message: {
            decoded_payload: {
                waterLevel: parseFloat(currentLevel),
                type: device.type, // Explicitly pass the type
                battery: parseFloat(battery),
                latitude: 13.7563 + (Math.random() * 0.01), // Slight GPS jitter
                longitude: 100.5018 + (Math.random() * 0.01)
            },
            rx_metadata: [
                {
                    rssi: rssi,
                    snr: snr
                }
            ],
            settings: {
                data_rate: {
                    lora: {
                        spreading_factor: 7,
                        bandwidth: 125000
                    }
                }
            }
        }
    };

    const topic = TOPIC_TEMPLATE.replace('{deviceId}', device.id);
    const message = JSON.stringify(payload);

    client.publish(topic, message);
    console.log(`📤 [${device.id}] Type: ${device.type} | Level: ${currentLevel}m | Batt: ${battery}%`);
}