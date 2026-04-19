import urllib.parse
from config import FRONTEND_URL

def create_dashboard_flex_dict(selected_ids, all_stations=None):
    # ฟังก์ชันนี้คืนค่าเป็น Dictionary (JSON Structure)
    # param: all_stations: list of dicts from database (id, name, location, image_url)
    
    # Convert list of dicts to dict of dicts for easier lookup by ID
    station_db = {}
    if all_stations:
        for s in all_stations:
            # ใช้ str() เพื่อรองรับทั้งตัวเลขจาก SQLite เก่า และ String จาก Node.js
            # ใช้รูปสำรองหากไม่มีรูปใน DB
            img_url = s.get('image_url')
            if not img_url or str(img_url).lower() == 'none' or str(img_url).strip() == '':
                img_url = "https://img1.pic.in.th/images/Gemini_Generated_Image_cxndnqcxndnqcxnd.png"
            
            # บังคับเป็น string และห้ามว่าง (LINE Requirement)
            img_url = str(img_url)
            st_name = str(s.get('name') or f"สถานี {s.get('id')}")
            st_loc = str(s.get('location') or "ไม่ระบุตำแหน่ง")
            if st_loc.strip() == '': st_loc = "ไม่ระบุตำแหน่ง"
                
            station_db[str(s['id'])] = {
                "name": st_name,
                "location": st_loc,
                "image": img_url
            }
            # print(f"DEBUG utils: station {s['id']} image = {img_url}")
    else:
        # Fallback (Old Hardcoded) - เผื่อกรณีไม่ได้ส่งค่ามา
        station_db = {
            1: {
                "name": "1. หน้าเขื่อน (Float)",
                "location": "จุดปล่อยน้ำหลัก",
                "image": "https://media-cdn.tripadvisor.com/media/photo-s/08/ca/bc/2a/caption.jpg"
            },
            2: {
                "name": "2. ทุ่งนา (Static)",
                "location": "พื้นที่การเกษตร",
                "image": "https://mpics.mgronline.com/pics/Images/565000011883301.JPEG"
            },
            3: {
                "name": "3. ทุ่งรับน้ำ (Static)",
                "location": "แก้มลิง/บ่อพักน้ำ",
                "image": "https://www.kasetkaoklai.com/home/wp-content/uploads/2022/05/%E0%B9%81%E0%B8%81%E0%B9%89%E0%B8%A1%E0%B8%A5%E0%B8%B4%E0%B8%87%E0%B8%97%E0%B8%B8%E0%B9%88%E0%B8%87%E0%B8%AB%E0%B8%B4%E0%B8%99.jpeg"
            }
        }

    bubbles = []
    for sid in selected_ids:
        sid = str(sid) # เปลี่ยนเป็น str แทน int
        if sid in station_db:
            info = station_db[sid]
            bubble = {
                "type": "bubble",
                "size": "mega",
                "hero": {
                    "type": "image",
                    "url": info['image'],
                    "size": "full",
                    "aspectMode": "cover",
                    "aspectRatio": "320:213"
                },
                "body": {
                    "type": "box",
                    "layout": "vertical",
                    "paddingAll": "10px",
                    "contents": [
                        {"type": "text", "text": info['name'], "weight": "bold", "size": "lg", "wrap": True},
                        {"type": "text", "text": info['location'], "size": "md", "color": "#aaaaaa", "wrap": True},
                        {"type": "box", "layout": "vertical", "margin": "md", "contents": [
                            {"type": "text", "text": "ลงทะเบียนสำเร็จ", "size": "md", "color": "#1DB446", "weight": "bold"}
                        ]}
                    ]
                }
            }
            bubbles.append(bubble)

    if not bubbles:
        # ถ้าไม่เลือกอะไรเลย ให้ส่งเป็น Bubble แจ้งเตือนธรรมดา
        return {
            "type": "bubble",
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {"type": "text", "text": "คุณยังไม่ได้เลือกสถานีใดๆ", "align": "center"}
                ]
            }
        }

    return {
        "type": "carousel",
        "contents": bubbles
    }

def create_monitor_flex_message(stations_data):
    """
    สร้าง Flex Message สำหรับแสดงระดับน้ำของสถานีที่เลือก
    stations_data: list of dicts, e.g.
    [
      {"name": "Station 1", "level": 1.2, "status": "ปกติ", "color": "#ff9f00"},
      ...
    ]
    """
    bubbles = []
    for st in stations_data:
        status_str = st.get('status', 'ปกติ')
        
        # กำหนดสีและคำแนะนำตามสถานะ
        color = "#1DB446"
        description = "สถานการณ์ปกติ"
        
        if "อันตราย" in status_str:
            color = "#e02424"
            description = "ขอให้อพยพโดยทันที"
        elif "เฝ้าระวัง" in status_str:
            color = "#ff9f00"
            description = "โปรดติดตามสถานการณ์อย่างใกล้ชิด"
            
        body_contents = [
            {
                "type": "text",
                "text": st['name'],
                "weight": "bold",
                "size": "xl",
                "color": color
            },
            {
                "type": "separator",
                "margin": "md"
            },
            {
                "type": "box",
                "layout": "vertical",
                "margin": "md",
                "contents": [
                    {
                        "type": "text",
                        "text": f"ระดับน้ำ: {st['level']:.2f} ม." if isinstance(st['level'], (int, float)) else f"ระดับน้ำ: {st['level']}",
                        "size": "lg",
                        "align": "start"
                    },
                    {
                        "type": "text",
                        "text": f"สถานะ: {status_str}",
                        "size": "lg",
                        "weight": "bold",
                        "color": color,
                        "align": "start"
                    }
                ]
            }
        ]
        
        if "อันตราย" in st['status']:
            body_contents.append({
                "type": "separator",
                "margin": "lg"
            })
            body_contents.append({
                "type": "button",
                "style": "primary",
                "color": "#e02424",
                "margin": "md",
                "action": {
                    "type": "uri",
                    "label": "📞 โทรสายด่วนฉุกเฉิน",
                    "uri": "tel:1669"
                }
            })

        # --- Add "เช็คสถานี" Button ---
        if FRONTEND_URL and st.get('id'):
            quoted_id = urllib.parse.quote(str(st['id']))
            station_url = f"{FRONTEND_URL}/parameters/{quoted_id}"
            
            body_contents.append({
                "type": "separator",
                "margin": "md"
            })
            body_contents.append({
                "type": "button",
                "style": "secondary",
                "color": "#06C755",
                "margin": "md",
                "height": "sm",
                "action": {
                    "type": "uri",
                    "label": "📊 เช็คสถานี",
                    "uri": station_url
                }
            })

        bubble = {
            "type": "bubble",
            "size": "giga",
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": body_contents
            }
        }
        bubbles.append(bubble)

    if not bubbles:
         return {
            "type": "bubble",
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {"type": "text", "text": "ไม่พบข้อมูลสถานีที่ท่านเลือก หรือท่านยังไม่ได้เลือกสถานี", "align": "center", "wrap": True}
                ]
            }
        }

    return {
        "type": "carousel",
        "contents": bubbles
    }

def create_alert_flex_message(station_id, station_name, water_level, alert_level):
    """
    สร้าง Rich Message สำหรับตอนแจ้งเตือนภัยแบบอัตโนมัติ
    """
    status_text = "อันตราย 🚨" if alert_level == 'dangerous' else "เฝ้าระวัง ⚠️" 
    color = "#e02424" if alert_level == 'dangerous' else "#ff9f00" 
    description = "ขอให้อพยพโดยทันที" if alert_level == 'dangerous' else "โปรดติดตามสถานการณ์อย่างใกล้ชิด"
    
    header_text = "🚨 ประกาศเตือนภัยฉุกเฉิน 🚨" if alert_level == 'dangerous' else "⚠️แจ้งเตือนระดับน้ำ ⚠️"
    header_color = "#e02424" if alert_level == 'dangerous' else "#ff9f00"
    
    # Format water_level as float explicitly to avoid crashes if it's sent as string
    try:
        water_level = float(water_level)
    except (ValueError, TypeError):
        water_level = 0.0

    bubble = {
        "type": "bubble",
        "size": "mega",
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": header_color,
            "contents": [
                {
                    "type": "text",
                    "text": header_text,
                    "color": "#ffffff",
                    "weight": "bold",
                    "size": "lg",
                    "align": "center"
                }
            ]
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "text",
                    "text": f"{station_name}",
                    "weight": "bold",
                    "size": "xl",
                    "color": "#000000",
                    "wrap": True
                },
                {
                    "type": "text",
                    "text": f"ID: {station_id}",
                    "size": "sm",
                    "color": "#aaaaaa"
                },
                {
                    "type": "separator",
                    "margin": "md"
                },
                {
                    "type": "box",
                    "layout": "vertical",
                    "margin": "md",
                    "contents": [
                        {
                            "type": "text",
                            "text": f"ระดับน้ำ: {water_level:.2f} ม.",
                            "size": "xl",
                            "weight": "bold"
                        },
                        {
                            "type": "text",
                            "text": f"สถานะ: {status_text}",
                            "size": "xl",
                            "weight": "bold",
                            "color": color
                        },
                    ]
                },
                {
                    "type": "separator",
                    "margin": "md"
                },
                {
                    "type": "text",
                    "text": description,
                    "wrap": True,
                    "color": color,
                    "size": "lg",
                    "weight": "bold",
                    "margin": "md",
                    "align": "center"
                }
            ]
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "button",
                    "style": "link",
                    "height": "sm",
                    "action": {
                        "type": "uri",
                        "label": "📊 เช็คสถานี (Open Dashboard)",
                        "uri": f"{FRONTEND_URL}/parameters/{urllib.parse.quote(str(station_id))}"
                    }
                }
            ]
        }
    }
    
    if alert_level == 'dangerous':
        bubble["body"]["contents"].append({
            "type": "button",
            "style": "primary",
            "color": "#e02424",
            "margin": "md",
            "action": {
                "type": "uri",
                "label": "📞 โทรสายด่วน 1669",
                "uri": "tel:1669"
            }
        })
        
    return bubble
