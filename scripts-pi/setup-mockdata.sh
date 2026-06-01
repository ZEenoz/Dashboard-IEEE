#!/bin/bash
# setup-mockdata.sh
# สร้าง Systemd Service สำหรับรัน Simulator 24/7

echo "🛠️ Creating Mockdata Service..."

# หาพาธที่แท้จริง
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../backend" && pwd)"

# สร้างไฟล์ service
cat <<EOF | sudo tee /etc/systemd/system/dashboard-simulator.service > /dev/null
[Unit]
Description=Dashboard IEEE - Mockdata Simulator
After=network.target postgresql.service mosquitto.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$BACKEND_DIR
ExecStart=/usr/bin/node simulator-chirpstack.js
Restart=always
RestartSec=10
Environment="NODE_ENV=development"

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
