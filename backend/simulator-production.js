/**
 * 🌊 Water Monitoring Production Simulator (ChirpStack v4)
 * 
 * จำลองสถานีจำลอง 5 จุด (Static 3, Float 2) 
 * เลียนแบบระดับน้ำขึ้นน้ำลงด้วย Sine Wave เพื่อความสมจริงบน Dashboard
 * 
 * วิธีใช้งาน:
 *   1. ตรวจสอบ MQTT Broker URL ในไฟล์นี้
 *   2. รันคำสั่ง: node simulator-production.js
 */

const mqtt = require('mqtt');

// --- ⚙️ Configuration ---
const BROKER_URL = 'mqtt://192.168.1.53:1883'; // IP ของ Raspberry Pi หรือ MQTT Broker
const APPLICATION_ID = 'a2549f99-aaea-42b5-a900-2f72dfcba547'; // มาจาก backend/.env
const INTERVAL_MS = 60000; // ส่งข้อมูลทุก 1 นาที

// --- 📍 สถานีจำลอง (5 จุด) ---
const devices = [
    { id: 'rmutt-static-01', name: 'RMUTT Static 01', type: 'Static', lat: 14.0375, lng: 100.7325, base: 2.5 },
    { id: 'rmutt-static-02', name: 'RMUTT Static 02', type: 'Static', lat: 14.0380, lng: 100.7335, base: 2.0 },
    { id: 'rmutt-static-03', name: 'RMUTT Static 03', type: 'Static', lat: 14.0370, lng: 100.7315, base: 3.0 },
    { id: 'rmutt-float-01', name: 'RMUTT Float 01', type: 'Float', lat: 14.0385, lng: 100.7345, base: 1.8 },
    { id: 'rmutt-float-02', name: 'RMUTT Float 02', type: 'Float', lat: 14.0365, lng: 100.7295, base: 2.2 }
];

console.log('🚀 Starting Production Simulator...');
const client = mqtt.connect(BROKER_URL);

client.on('connect', () => {
    console.log('✅ Connected to MQTT Broker');
    
    // ส่งข้อมูลทันทีครั้งแรก
    devices.forEach(publishReading);
    
    // ส่งวนไปเรื่อยๆ
    setInterval(() => {
        devices.forEach(publishReading);
    }, INTERVAL_MS);
});

client.on('error', (err) => {
    console.error('❌ MQTT Error:', err.message);
});

/**
 * คำนวณระดับน้ำแบบคลื่น Sine เพื่อให้กราฟดูสมจริง
 */
function calculateWaterLevel(base) {
    const now = new Date();
    const hours = now.getHours() + now.getMinutes() / 60;
    
    // รอบน้ำขึ้นน้ำลงทุก 12 ชั่วโมง
    // แอมพลิจูด (ความสูงคลื่น) = 2.4 เมตร เพื่อให้ช่วงแกว่งกว้างขึ้น (ครอบคลุม 0 - 5 เมตร)
    const wave = Math.sin((hours / 12) * Math.PI * 2);
    const level = base + (wave * 2.4) + (Math.random() * 0.1); // แกว่งประมาณ +/- 2.4 เมตร
    
    return Math.max(0, level).toFixed(3);
}

function publishReading(device) {
    const level = calculateWaterLevel(device.base);
    const battery = (85 + Math.random() * 15).toFixed(1); // 85-100%
    const rssi = Math.floor(-95 + Math.random() * 20); // -95 to -75
    const snr = (5.0 + Math.random() * 5).toFixed(1);

    // โครงสร้าง Payload แบบ ChirpStack v4
    const payload = {
        time: new Date().toISOString(),
        deviceInfo: {
            applicationId: APPLICATION_ID,
            deviceName: device.name,
            devEui: device.id,
            tags: {
                latitude: String(device.lat),
                longitude: String(device.lng)
            }
        },
        object: {
            waterLevel: parseFloat(level),
            type: device.type,
            battery: parseFloat(battery),
            battery_voltage: (3.7 + Math.random() * 0.5).toFixed(2),
            latitude: device.lat,
            longitude: device.lng
        },
        rxInfo: [{
            rssi: rssi,
            snr: parseFloat(snr)
        }]
    };

    const topic = `application/${APPLICATION_ID}/device/${device.id}/event/up`;
    client.publish(topic, JSON.stringify(payload));
    
    console.log(`📤 [${device.id}] Level: ${level}m | Batt: ${battery}% | Status: ${level > 2.5 ? '⚠️ ALERT' : 'OK'}`);
}
