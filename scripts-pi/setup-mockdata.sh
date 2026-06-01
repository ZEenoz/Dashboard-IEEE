#!/bin/bash
# setup-mockdata.sh
# สร้าง Systemd Service สำหรับรัน Simulator 24/7

echo "🛠️ Creating Mockdata Service..."

# หาพาธที่แท้จริง
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../backend" && pwd)"
# สร้างไฟล์ service โดยใช้ Docker (ไม่ต้องลง Node ที่เครื่อง)
cat <<EOF | sudo tee /etc/systemd/system/dashboard-simulator.service > /dev/null
[Unit]
Description=Dashboard IEEE - Mockdata Simulator (via Docker)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
# รันผ่าน Container ของ Backend ที่มี Node อยู่แล้ว
ExecStart=/usr/bin/docker exec dashboard_backend node simulator-chirpstack.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# รีโหลดและเปิดใช้งาน
sudo systemctl daemon-reload
sudo systemctl enable dashboard-simulator
sudo systemctl start dashboard-simulator

echo "✅ Mockdata Simulator (24/7) Installed and Started!"
echo ""
echo "👉 เช็คสถานะ: sudo systemctl status dashboard-simulator"
echo "👉 ดู Log สด: sudo journalctl -u dashboard-simulator -f"
echo "👉 หยุดการทำงานชั่วคราว: sudo systemctl stop dashboard-simulator"
