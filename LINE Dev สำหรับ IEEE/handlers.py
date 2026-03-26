from linebot.v3.webhooks import (
    MessageEvent,
    TextMessageContent,
    FollowEvent
)
from linebot.v3.messaging import (
    ApiClient,
    MessagingApi,
    ReplyMessageRequest,
    TextMessage,
    FlexMessage,
    FlexContainer
)
from line_instance import handler, configuration
from database import add_user, get_user_stations, save_message, save_outbound_log
from utils import create_monitor_flex_message
from config import NODE_API_URL
import random
import requests

@handler.add(FollowEvent)
def handle_follow(event):
    user_id = event.source.user_id
    add_user(user_id)
    print(f"New follower: {user_id}")

@handler.add(MessageEvent, message=TextMessageContent)
def handle_message(event):
    user_id = event.source.user_id
    add_user(user_id) # เก็บ user ไว้ก่อนเสมอ

    user_message = event.message.text.strip().lower()
    save_message(user_id, event.message.text) # บันทึกข้อความลง DB (ใช้ข้อความจริงไม่ปัด lower)
    
    print(f"User message: {user_message}") # LOG
    if user_message in ["ดูระดับน้ำ", "check", "ระดับน้ำ","ระบบน้ำ"]:
        # 1. ดึงสถานีที่ User เลือก
        selected_ids = get_user_stations(user_id)
        print(f"Selected IDs for {user_id}: {selected_ids}") # LOG
        
        if not selected_ids:
            reply_result = TextMessage(text="⚠️ คุณยังไม่ได้เลือกสถานีที่ต้องการแจ้งเตือน\nกรุณากดเมนูเพื่อเลือกสถานีก่อนครับ")
        else:
            # 2. ดึงข้อมูลสถานีทั้งหมดแบบ Live
            from app import get_live_stations
            all_stations = get_live_stations()
            # แปลงเป็น dict เพื่อค้นหาง่ายๆ
            station_map = {str(s['id']): s for s in all_stations}
            
            # 3. เตรียมข้อมูลสำหรับ Flex Message และดึง Live Data จาก NodeJS Backend
            live_nodes = {}
            try:
                # ดึงสถานะ live จาก MQTT/Node.js System Health
                res = requests.get(f'{NODE_API_URL}/system-health', timeout=5)
                if res.status_code == 200:
                    health_data = res.json()
                    active_nodes = health_data.get('nodes', {}).get('active', [])
                    for node in active_nodes:
                        node_id = str(node.get('stationId') or node.get('displayId') or '')
                        live_nodes[node_id] = node
            except Exception as e:
                print(f"Failed to fetch live data: {e}")

            monitor_data = []
            for sid in selected_ids:
                sid = str(sid)
                if sid in station_map:
                    st_info = station_map[sid]
                    
                    # ตรวจสอบ ID ตรงๆ ไม่ต้อง Fuzzy Match
                    live_info = live_nodes.get(sid)
                    level = None
                            
                    if live_info:
                        level = float(live_info.get('waterLevel', 0))
                    else:
                        # Fallback จาก Database 
                        from database import get_latest_water_level
                        db_record = get_latest_water_level(sid)
                        if db_record and db_record.get('water_level') is not None:
                            level = float(db_record['water_level'])
                        
                    if level is not None:
                        status = "ปกติ ✅" if level < 1.5 else "เฝ้าระวัง ⚠️" if level < 2.5 else "อันตราย 🚨"
                        color = "#1DB446" if level < 1.5 else "#F5BA00" if level < 2.5 else "#DB2424"
                        
                        monitor_data.append({
                            "name": st_info['name'] + (" [LIVE]" if live_info else ""),
                            "level": level,
                            "status": status,
                            "color": color
                        })
                    else:
                        # ถ้าระบบจริงไม่มีทั้ง Live และข้อมูลเก่าใน DB (ออฟไลน์สมบูรณ์)
                        monitor_data.append({
                            "name": st_info['name'],
                            "level": "N/A",
                            "status": "ออฟไลน์ ⚪",
                            "color": "#aaaaaa"
                        })
            
            # 4. สร้าง Flex Message
            flex_content = create_monitor_flex_message(monitor_data)
            try:
                flex_container = FlexContainer.from_dict(flex_content)
                reply_result = FlexMessage(alt_text="สถานะระดับน้ำ", contents=flex_container)
            except Exception as e:
                print(f"Error creating Flex Message: {e}")
                reply_result = TextMessage(text="เกิดข้อผิดพลาดในการแสดงผล กรุณาลองใหม่")

    else:
        reply_result = TextMessage(text="พิมพ์ 'ดูระดับน้ำ' เพื่อเช็คสถานะ\nหรือกดเมนูเพื่อลงทะเบียนแจ้งเตือนครับ 😊")

    with ApiClient(configuration) as api_client:
        line_bot_api = MessagingApi(api_client)
        line_bot_api.reply_message(
            ReplyMessageRequest(
                reply_token=event.reply_token,
                messages=[reply_result]
            )
        )
        
    # บันทึกประวัติการตอบกลับของ Bot ลงฐานข้อมูล
    # เราแยกประเภทข้อความว่าเป็น Text หรือ Flex เพื่อเก็บบันทึก
    log_msg = reply_result.text if isinstance(reply_result, TextMessage) else f"[Flex Message: {getattr(reply_result, 'alt_text', 'Status')}]"
    save_outbound_log(target_users=user_id, message=log_msg, msg_type="reply")
