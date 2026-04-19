import psycopg2
from psycopg2.extras import RealDictCursor
from config import PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD, DATABASE_URL

def get_db_connection():
    # If DATABASE_URL is present, use it directly (safer for special characters)
    if DATABASE_URL:
        # Check if it's a cloud database (Supabase, Railway, etc.)
        is_cloud = "supabase.com" in DATABASE_URL or "rlwy.net" in DATABASE_URL or "render.com" in DATABASE_URL
        
        # Add sslmode=require for cloud databases
        if is_cloud and "sslmode" not in DATABASE_URL:
            # Append sslmode if not present
            connector = "&" if "?" in DATABASE_URL else "?"
            conn_string = f"{DATABASE_URL}{connector}sslmode=require"
        else:
            conn_string = DATABASE_URL
            
        return psycopg2.connect(conn_string)
        
    # Fallback to individual parameters
    return psycopg2.connect(
        host=PG_HOST,
        port=PG_PORT,
        dbname=PG_DATABASE,
        user=PG_USER,
        password=PG_PASSWORD
    )

def init_db():
    """สร้างตารางในฐานข้อมูล PostgreSQL รองรับ LINE QA และผสานกับ Node.js"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. ตารางเก็บ Users ของ LINE
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS line_users (
            user_id TEXT PRIMARY KEY,
            stations TEXT
        )
    ''')
    
    # 2. ปรับปรุงตาราง Stations ของ Node.js ให้รองรับรูปและข้อความสถานที่สำหรับ LINE
    cursor.execute('''
        ALTER TABLE stations ADD COLUMN IF NOT EXISTS custom_location TEXT;
    ''')
    cursor.execute('''
        ALTER TABLE stations ADD COLUMN IF NOT EXISTS image_url TEXT;
    ''')
    
    # 3. ตารางเก็บ Messages (Inbox)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS line_messages (
            id SERIAL PRIMARY KEY,
            user_id TEXT,
            message TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 4. ตารางเก็บการส่งข้อความออก (Outbound / Bot Logs)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS line_outbound_logs (
            id SERIAL PRIMARY KEY,
            target_users TEXT,
            message TEXT,
            message_type TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    cursor.close()
    conn.close()

def add_user(user_id):
    """เพิ่ม user ใหม่"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO line_users (user_id) 
        VALUES (%s) 
        ON CONFLICT (user_id) DO NOTHING
    """, (user_id,))
    conn.commit()
    cursor.close()
    conn.close()

def update_user_stations(user_id, stations_list):
    """อัปเดตสถานีที่ผู้ใช้เลือก"""
    conn = get_db_connection()
    cursor = conn.cursor()
    stations_str = ",".join(map(str, stations_list))
    
    cursor.execute("""
        INSERT INTO line_users (user_id, stations) 
        VALUES (%s, %s) 
        ON CONFLICT (user_id) DO UPDATE SET stations = EXCLUDED.stations
    """, (user_id, stations_str))
    
    conn.commit()
    cursor.close()
    conn.close()
    print(f"User {user_id} updated stations: {stations_str}")

def get_all_users():
    """ดึง userId ทั้งหมด"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id FROM line_users")
    users = [row[0] for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return users

def get_user_stations(user_id):
    """ดึง stations ที่ user เลือกไว้ (คืนค่าเป็น list ของ string)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT stations FROM line_users WHERE user_id = %s", (user_id,))
    result = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if result and result[0]:
        return [s.strip() for s in result[0].split(",") if s.strip()]
    return []

# --- Station CRUD Operations ---

def get_all_stations():
    """ดึงข้อมูลสถานีทั้งหมด โดยแปลงกลับเป็น format เดิมที่ใช้ใน Python"""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT station_id as id, name, custom_location as location, image_url FROM stations")
    stations = cursor.fetchall()
    cursor.close()
    conn.close()
    return [dict(s) for s in stations]

def add_station(station_id, name, location, image_url):
    """เพิ่มสถานีใหม่ หรืออัปเดตถ้ามีอยู่แล้ว (Upsert)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO stations (station_id, name, custom_location, image_url) 
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (station_id) DO UPDATE SET
            name = EXCLUDED.name,
            custom_location = EXCLUDED.custom_location,
            image_url = EXCLUDED.image_url
    """, (str(station_id), name, location, image_url))
    conn.commit()
    cursor.close()
    conn.close()

def update_station(station_id, name, location, image_url):
    """แก้ไขสถานี (ใช้ add_station แทนได้เพราะเป็น Upsert แต่คงไว้เพื่อ Compatibility)"""
    add_station(station_id, name, location, image_url)

def delete_station(station_id):
    """ลบสถานี (ปุ่มลบถูกซ่อนใน admin.html แล้ว แต่ทำเผื่อไว้)"""
    pass

def get_user_count():
    """นับจำนวน Users ทั้งหมด"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM line_users")
    count = cursor.fetchone()[0]
    cursor.close()
    conn.close()
    return count

def save_message(user_id, message):
    """บันทึกข้อความลงตาราง messages"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO line_messages (user_id, message) VALUES (%s, %s)", (user_id, message))
    conn.commit()
    cursor.close()
    conn.close()

def get_recent_messages(limit=50):
    """ดึงข้อความล่าสุด"""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM line_messages ORDER BY timestamp DESC LIMIT %s", (limit,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    
    # แปลง timestamp เป็น string เพื่อไม่ให้ error ตอน jsonify
    result = []
    for row in rows:
        r = dict(row)
        if r.get('timestamp'):
            r['timestamp'] = r['timestamp'].strftime("%Y-%m-%d %H:%M:%S")
        result.append(r)
    return result

def save_outbound_log(target_users, message, msg_type):
    """บันทึกประวัติที่บอทส่งข้อความออกไป"""
    conn = get_db_connection()
    cursor = conn.cursor()
    # ถ้าส่งหลายคน (List/Dict) ให้ยุบรวมเป็น String แบบย่อๆ แต่ถ้าส่งคนเดียวก็เก็บตรงๆ
    targets_str = str(target_users)
    cursor.execute(
        "INSERT INTO line_outbound_logs (target_users, message, message_type) VALUES (%s, %s, %s)",
        (targets_str, str(message), msg_type)
    )
    conn.commit()
    cursor.close()
    conn.close()

def get_outbound_logs(limit=100):
    """ดึงประวัติบอทส่งออกล่าสุด"""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM line_outbound_logs ORDER BY timestamp DESC LIMIT %s", (limit,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    
    result = []
    for row in rows:
        r = dict(row)
        if r.get('timestamp'):
            r['timestamp'] = r['timestamp'].strftime("%Y-%m-%d %H:%M:%S")
        result.append(r)
    return result

def get_latest_water_level(station_id):
    """ดึงค่าระดับน้ำล่าสุดของสถานีจากฐานข้อมูล (ใช้เป็น fallback กรณี Node.js ไม่ได้ส่ง live data)"""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute('''
            SELECT water_level, timestamp 
            FROM readings 
            WHERE station_id = %s 
            ORDER BY timestamp DESC 
            LIMIT 1
        ''', (str(station_id),))
        result = cursor.fetchone()
        return dict(result) if result else None
    except Exception as e:
        print(f"Error fetching latest water level for {station_id}: {e}")
        return None
    finally:
        cursor.close()
        conn.close()
