# แผนการดำเนินงาน: 3 ฟีเจอร์หลัก (Roadmap)

เอกสารนี้แสดงขั้นตอนการทำงานและการพัฒนาระบบ 3 ส่วน: ปุ่มกดใน LINE, ระบบสลับภาษา (TH/EN) และการเชื่อมต่อ ChirpStack

---

## 1. การเพิ่ม Button Action ใน Rich Message (LINE Bot)
**เป้าหมาย**: ให้ผู้ใช้งานสามารถกดดูรายละเอียดสถานี (Dashboard) ได้ทันทีหลังจากเช็คระดับน้ำ

### ขั้นตอนการดำเนินงาน:
1.  **ปรับแต่ง Flex Message Template**:
    -   แก้ไขไฟล์ `line-bot/utils.py` ในฟังก์ชัน `create_monitor_flex_message`.
    -   เพิ่มคอมโพเนนต์ `button` เข้าไปในส่วน `body_contents` ของทุกๆ สถานี (Carousel Bubble)
    -   **ประเภท Action**: `uri`.
    -   **รูปแบบลิงก์**: `https://dashboard-ieee.vercel.app/parameters/{station_id}`.
2.  **ส่งค่า Station ID เข้า Template**:
    -   ตรวจสอบไฟล์ `handlers.py` ให้ส่ง `stationId` เข้าไปใน dictionary `monitor_data` เพื่อให้ปุ่มสร้างลิงก์ที่ถูกต้องตามสถานีนั้นๆ
3.  **เพิ่มปุ่ม "ดูภาพรวมระบบ" (Global Dashboard)**:
    -   เพิ่มปุ่มท้าย Carousel เพื่อลิงก์กลับไปที่หน้า Home `https://dashboard-ieee.vercel.app/`.

---

## 2. ระบบสลับภาษา (Thai/English UI)
**Goal**: เพื่อรองรับทั้งผู้ใช้งานในพื้นที่และนักวิจัยชาวต่างชาติ

### ขั้นตอนการดำเนินงาน:
1.  **ติดตั้ง i18n Dependencies**:
    -   รันคำสั่ง `npm install react-i18next i18next i18next-browser-languagedetector`.
2.  **สร้างไฟล์แปลภาษา (Translation Files)**:
    -   สร้าง `frontend/locales/th.json`: เก็บค่าคำศัพท์ภาษาไทย เช่น "ภาพรวมระบบ", "ระดับน้ำ", "แบตเตอรี่".
    -   สร้าง `frontend/locales/en.json`: เก็บค่าเดียวกันเป็นภาษาอังกฤษ.
3.  **ตั้งค่า i18n Configuration**:
    -   สร้างไฟล์ `frontend/lib/i18n.js` สำหรับตั้งค่าเริ่มต้นของไลบรารี
4.  **สร้างคอมโพเนนต์สลับภาษา (Language Switcher)**:
    -   สร้างไฟล์ `LanguageToggle.js`.
    -   นำไปใส่ในส่วน `Header` หรือ `Sidebar` ทั้งบน Desktop และ Mobile.
5.  **Refactor หน้าจอ Frontend**:
    -   เปลี่ยนข้อความที่พิมพ์ไว้ตรงๆ (Hardcoded) ให้ใช้ฟังก์ชัน `t()` จาก `useTranslation()`.

---

## 3. การนำ Web ไปลง/ฝังใน ChirpStack
**เป้าหมาย**: ให้ผู้ดูแลระบบเครือข่ายสามารถกดดู Dashboard ได้โดยตรงจาก ChirpStack Console

### ขั้นตอนการดำเนินงาน:
1.  **ตั้งค่า External Links ใน ChirpStack**:
    -   ล็อกอินเข้า **ChirpStack Application Server**.
    -   ไปที่ **Applications** -> เลือกแอปพลิเคชันของคุณ (เช่น "IEEE Water Monitoring").
    -   เลือกแท็บ **External Links**.
    -   กรอกข้อมูล:
        -   **Label**: "Live Monitoring Dashboard".
        -   **URL**: `https://dashboard-ieee.vercel.app/parameters/{{dev_eui}}` (ChirpStack รองรับตัวแปร `{{dev_eui}}`).
2.  **การตั้งค่า CORS & Iframe (หากต้องการฝังแบบ Widget)**:
    -   หากต้องการใช้ `<iframe>` ภายใน UI อื่นๆ ต้องตั้งค่า Header ในระบบ Backend:
        -   ตั้งค่า `X-Frame-Options: ALLOW-FROM` หรือ `Content-Security-Policy: frame-ancestors`.
3.  **สร้างโหมด "ChirpStack Embed" (Optional)**:
    -   เพิ่ม URL parameter `?embed=true` เพื่อซ่อนแถบเมนู (Sidebar/Nav) เมื่อเปิดจาก ChirpStack เพื่อประหยัดพื้นที่หน้าจอ

---

### ขั้นตอนต่อไป
1.  **อนุมัติแผนงาน**: ตรวจสอบขั้นตอนเบื้องต้นว่าถูกต้องตามความต้องการหรือไม่
2.  **ระบุ Domain จริง**: ระบุ Domain ที่จะใช้สำหรับปุ่มใน LINE (เช่น Vercel หรือ Domain ส่วนตัว)
3.  **ตรวจสอบคำศัพท์**: ตรวจสอบรายการคำศัพท์ที่ต้องการแปลเบื้องต้น
