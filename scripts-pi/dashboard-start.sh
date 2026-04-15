#!/bin/bash
# dashboard-start.sh
# สคริปต์สำหรับเริ่มต้นระบบจัดการ Dashboard IEEE (Manual Start)

# หาพาธของโปรเจกต์
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "=========================================="
echo "   🚀 Starting Dashboard IEEE Services"
echo "=========================================="

# 1. ตรวจสอบและเริ่ม Docker Containers (รวม MQTT)
echo "[1/3] Starting Docker Containers..."
docker-compose up -d

if [ $? -eq 0 ]; then
    echo "✅ Docker Services are running."
else
    echo "❌ Failed to start Docker. Please check 'docker ps'"
    exit 1
fi

# 2. เริ่ม Native Services (ChirpStack & Postgres)
echo ""
echo "[2/3] Starting Native Services (ChirpStack)..."
sudo systemctl start postgresql
sudo systemctl start chirpstack
sudo systemctl start chirpstack-gateway-bridge
echo "✅ Native services initiated."

# 3. ตรวจสอบและเริ่ม ngrok Tunnel
echo ""
echo "[3/3] Checking ngrok Tunnel..."
if pgrep -x "ngrok" > /dev/null
then
    echo "✅ ngrok is already running."
else
    echo "🌐 Starting ngrok for port 8888 (Background)..."
    nohup ngrok http 8888 > "$SCRIPT_DIR/ngrok.log" 2>&1 &
    sleep 3
    echo "✅ ngrok started in background."
fi

echo ""
echo "=========================================="
echo "  🏁 All tasks initiated!"
echo "  👉 Run './dashboard-check.sh' to see your Public URL."
echo "=========================================="
