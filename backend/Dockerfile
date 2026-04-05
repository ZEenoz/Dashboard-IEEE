FROM node:18-alpine

# ติดตั้ง tzdata เพื่อตั้งค่า Timezone เป็น Asia/Bangkok
RUN apk add --no-cache tzdata
ENV TZ=Asia/Bangkok

# กำหนดโฟลเดอร์ทำงาน
WORKDIR /app

# คัดลอก package.json และ package-lock.json เพื่อลง library ก่อน (ช่วยให้ build เร็วขึ้น)
COPY package*.json ./

# ลงไลบรารีแบบ production เท่านั้น
RUN npm install --production

# คัดลอกโค้ดทั้งหมดเข้าตู้คอนเทนเนอร์
COPY . .

# เปิดพอร์ต API
EXPOSE 4000

# สั่งรัน Backend
CMD ["node", "server.js"]
