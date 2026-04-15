# 📋 คู่มือจัดการระบบหลัง Reset (SOP Checklist)
เอกสารสรุปขั้นตอนการดูแลระบบ Dashboard IEEE บน Raspberry Pi 5 หลังจากเกิดเหตุการณ์ไฟดับหรือเครื่อง Restart

---

## 🟢 1. การติดตั้งสคริปต์ (ทำครั้งแรกครั้งเดียว)
ให้นำไฟล์ในโฟลเดอร์ `scripts-pi` ไปวางที่ Raspberry Pi (เช่นที่ `~/dashboard-ieee/scripts-pi`) แล้วสั่ง:
```bash
# ให้สิทธิ์รันสคริปต์
chmod +x ~/dashboard-ieee/scripts-pi/*.sh

# (สำหรับ Auto-Start) ก๊อปปี้ไฟล์ service และเปิดใช้งาน
sudo cp ~/dashboard-ieee/scripts-pi/dashboard-tunnel.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable dashboard-tunnel.service
sudo systemctl start dashboard-tunnel.service
```

---

## 🔍 2. ขั้นตอนการตรวจสอบเมื่อเครื่องเปิดใหม่ (Post-Reset)

### Step A: ตรวจสอบสถานะการทำงาน
รันสคริปต์ตรวจสอบสุขภาพระบบ:
```bash
cd ~/dashboard-ieee/scripts-pi
./dashboard-check.sh
```
*   **สิ่งที่ต้องเห็น:** Docker ทุกตัวเป็น `Up` และมี `Public URL` ของ ngrok แสดงออกมา

### Step B: อัปเดตการเชื่อมต่อ (สำคัญมาก ⚠️)
เนื่องจาก URL ของ ngrok อาจเปลี่ยนไป ให้ทำตามลำดับนี้:
1.  **Vercel Dashboard:**
    *   เข้าหน้า Project Settings > Environment Variables
    *   เปลี่ยนค่า `NEXT_PUBLIC_API_URL` เป็น URL ใหม่ที่ได้จากสคริปต์ (เช่น `https://xxxx.ngrok-free.app/api`)
    *   **กด Redeploy** ในแถบ Deployments เพื่อให้หน้าเว็บเปลี่ยนไปคุยกับ URL ใหม่
2.  **LINE Developers Console:**
    *   ไปที่ Messaging API > Webhook settings
    *   อัปเดต Webhook URL เป็น `URLใหม่/callback`
    *   กด **Verify** เพื่อเช็คว่าเชื่อมต่อได้

---

## 🛠️ 3. วิธีแก้ปัญหาเบื้องต้น (Troubleshooting)

| อาการ | สาเหตุที่เป็นไปได้ | วิธีแก้ไข |
|---|---|---|
| รันสคริปต์แล้ว Nginx/Backend ไม่ขึ้น | Docker ยังไม่สลัด Lock เดิม | รัน `./dashboard-start.sh` ซ้ำ หรือใช้ `docker-compose restart` |
| ngrok ไม่แสดง URL | อินเทอร์เน็ตยังไม่ติด หรือ Token หมดอายุ | เช็คการเชื่อมต่อเน็ต หรือรัน `ngrok config add-authtoken <TOKEN>` |
| หน้าเว็บ Vercel ค้าง | ยังไม่ได้ Redeploy Vercel | ต้องกด Redeploy ทุกครั้งที่ URL Backend เปลี่ยน |
| **Windows: Port 4000 Busy** | **Docker หรือ Node ค้าง** | **รัน `backend/start-backend.bat` เพื่อล้างค่าอัตโนมัติ** |

---

## 💻 5. การดูแลระบบบน Windows (Development)
สำหรับการพัฒนาบน Windows หากรัน Backend (`node server.js`) ไม่สำเร็จเพราะ Port 4000 ติดขัด:
1.  **ใช้สคริปต์ช่วย**: เข้าไปที่โฟลเดอร์ `backend` แล้วรันไฟล์ `start-backend.bat`
2.  **จัดการ Docker**: ตรวจสอบใน Docker Desktop ว่าไม่มีคอนเทนเนอร์ `dashboard_backend` รันซ้อนอยู่
3.  **Error Message**: สังเกตในคอนโซล หากพบข้อความ `EADDRINUSE` ให้ใช้สคริปต์ในข้อ 1 ทันที

---

## 📊 6. สรุปพอร์ตที่ใช้งานในระบบ
- **8888**: Nginx Gateway (ทางเข้าหลัก - ต้องทำ Tunnel)
- **4000**: Backend API
- **5000**: LINE Bot
- **1883**: MQTT Broker (Mosquitto)
- **5433**: PostgreSQL Database
