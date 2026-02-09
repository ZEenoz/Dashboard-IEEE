// backend/simulator.js
const mqtt = require('mqtt');

// Simulator เชื่อมต่อไปที่ Localhost เสมอ
const client = mqtt.connect('mqtt://localhost:1883');

const stations = [
    { id: "Device_001", lat: 13.7563, lng: 100.5018 },
    { id: "Device_002", lat: 13.7600, lng: 100.5100 },
    { id: "Device_003", lat: 13.7500, lng: 100.4900 }
];

client.on('connect', () => {
    console.log("🤖 Simulator: Connected to Local MQTT. Sending data...");

    setInterval(() => {
        stations.forEach((station) => {
            // โครงสร้างเลียนแบบ TTN v3 เป๊ะๆ
            const dummyData = {
                end_device_ids: {
                    device_id: station.id,
                    application_ids: { application_id: "ieeew2025" }
                },
                uplink_message: {
                    decoded_payload: {
                        waterLevel: parseFloat((Math.random() * 5).toFixed(2)),
                        pressure: parseFloat((Math.random() * 10).toFixed(2)),
                        lat: station.lat,
                        lng: station.lng
                    },
                    rx_metadata: [
                        { rssi: Math.floor(Math.random() * 50) - 130 } // Random RSSI -80 to -130
                    ]
                }
            };

            // Topic format: v3/{application id}/devices/{device id}/up
            const topic = `v3/ieeew2025/devices/${station.id}/up`;

            client.publish(topic, JSON.stringify(dummyData));
            console.log(`📤 Sim: ${station.id} -> ${dummyData.uplink_message.decoded_payload.waterLevel}m`);
        });
    }, 2000);
});