#!/bin/bash
# dashboard-check.sh
# สคริปต์ตรวจสอบสถานะระบบ Dashboard IEEE (System Monitor)

echo "=========================================="
echo "    🔍 System Health Check Monitor"
echo "=========================================="

# 1. ตรวจสอบ Docker Containers
echo "--- [1] Docker Container Status ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 2. ตรวจสอบ ngrok และดึง URL
echo ""
echo "--- [2] ngrok Tunnel Status ---"
NGROK_JSON=$(curl -s http://localhost:4040/api/tunnels)
if [[ $NGROK_JSON == *"public_url"* ]]; then
    if command -v jq >/dev/null 2>&1; then
        PUBLIC_URL=$(echo $NGROK_JSON | jq -r '.tunnels[0].public_url')
    else
        PUBLIC_URL=$(echo $NGROK_JSON | sed -n 's/.*"public_url":"\([^"]*\)".*/\1/p')
    fi
    echo "🔗 Public URL: $PUBLIC_URL"
    echo "📍 API Home:  $PUBLIC_URL/api/stations"
    echo "👉 Update this URL in Vercel & LINE Developers!"
else
    echo "❌ ngrok is NOT active or tunnel is not set up."
fi

# 3. ตรวจสอบการเชื่อมต่อ MQTT (Local)
echo ""
echo "--- [3] MQTT (Mosquitto) Check ---"
if command -v nc >/dev/null 2>&1; then
    if nc -z localhost 1883; then
        echo "✅ MQTT Broker (1883) is LISTENING."
    else
        echo "❌ MQTT Broker (1883) is NOT responding."
    fi
else
    # Fallback to check if container is running
    if docker ps | grep -q "mosquitto_broker"; then
        echo "✅ MQTT Container is running."
    else
        echo "❌ MQTT Container is NOT running."
    fi
fi

# 4. ตรวจสอบ Native Services
echo ""
echo "--- [4] Native Services Status ---"
if systemctl is-active --quiet postgresql; then
    echo "✅ PostgreSQL (Native): Active"
else
    echo "❌ PostgreSQL (Native): DEAD (REQUIRED FOR CHIRPSTACK)"
fi

if systemctl is-active --quiet chirpstack; then
    echo "✅ ChirpStack Server: Active (Port 8080 is up)"
else
    echo "❌ ChirpStack Server: DEAD"
fi

# 5. ข้อมูลระบบเบื้องต้น (CPU / Temp)
echo ""
echo "--- [5] Pi 5 System Info ---"
if [ -f /sys/class/thermal/thermal_zone0/temp ]; then
    TEMP=$(cat /sys/class/thermal/thermal_zone0/temp)
    echo "🌡️ CPU Temp: $(($TEMP/1000))'C"
fi
echo "📉 Load Average: $(uptime | awk -F'load average:' '{ print $2 }')"

# 6. ตรวจสอบ Tailscale
echo ""
echo "--- [6] Network & VPN ---"
if command -v tailscale >/dev/null 2>&1; then
    TS_STATUS=$(tailscale status | head -n 1)
    echo "🌐 Status: $TS_STATUS"
    echo "📍 Tailscale IP: $(tailscale ip -4)"
else
    echo "⚠️ Tailscale not found."
fi

echo "=========================================="
echo "🏁 Check complete. Run './dashboard-start.sh' if anything is Down."
