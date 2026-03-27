import os
import random
from flask import Flask, request, abort, render_template, jsonify
import requests
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.messaging import (
    ApiClient,
    MessagingApi,
    MulticastRequest,
    PushMessageRequest,
    TextMessage,
    FlexMessage,
    FlexContainer
)

# Import local modules
from config import CHANNEL_SECRET, NODE_API_URL
from line_instance import handler, configuration
from database import (
    init_db, update_user_stations, get_all_users,
    get_all_stations, add_station, update_station, delete_station, get_user_count
)
from utils import create_dashboard_flex_dict
import handlers  # Import to register handlers

app = Flask(__name__)

# Fix: Bypass ngrok browser interstitial warning for LINE WebView
@app.after_request
def add_ngrok_header(response):
    response.headers['ngrok-skip-browser-warning'] = 'true'
    return response

# --- WEB ROUTES ---

# 1. หน้าแรกสำหรับแสดง LIFF
@app.route('/')
@app.route('/register')
def liff_page():
    # Pass dynamic station list to frontend template
    stations = get_live_stations()
    return render_template('register.html', stations=stations)

def get_live_stations():
    """ Helper to fetch live stations from Node.js backend. """
    stations = []
    try:
        # Normalize NODE_API_URL: ensure it ends with /api and no trailing slash
        base_url = NODE_API_URL.strip().rstrip('/')
        if not base_url.endswith('/api') and 'railway.app' in base_url:
            base_url += '/api'
        
        # 1. Fetch config from settings API
        api_url = f'{base_url}/settings'
        print(f"DEBUG: Calling Backend API -> {api_url}")
        settings_res = requests.get(api_url, timeout=5)
        
        if settings_res.status_code == 200:
            try:
                config_stations = settings_res.json().get('stations', {})
                for st_id, data in config_stations.items():
                    stations.append({
                        'id': st_id,
                        'name': data.get('name') or f"สถานี {st_id}",
                        'location': f"Lat: {data.get('lat', '')}, Lng: {data.get('lng', '')}" if data.get('lat') else "ระบุพิกัดใน Settings",
                        'image_url': 'https://img1.pic.in.th/images/Gemini_Generated_Image_cxndnqcxndnqcxnd.png' # default
                    })
                print(f"✅ Fetched {len(stations)} stations from Node.js API")
            except Exception as json_err:
                print(f"⚠️ API returned invalid JSON for settings: {json_err}")
                print(f"⚠️ Response content: {settings_res.text[:200]}")
        else:
            print(f"⚠️ Backend API for settings returned status {settings_res.status_code}")
        
        # 2. Add active physical nodes from system-health if they are not in config
        health_api_url = f'{base_url}/system-health'
        print(f"DEBUG: Calling Backend API -> {health_api_url}")
        health_res = requests.get(health_api_url, timeout=5)
        if health_res.status_code == 200:
            try:
                active_nodes = health_res.json().get('nodes', {}).get('active', [])
                existing_ids = [s['id'] for s in stations]
                
                for node in active_nodes:
                    node_id = node.get('stationId') or node.get('displayId')
                    if node_id and node_id not in existing_ids:
                        stations.append({
                            'id': node_id,
                            'name': node.get('name', f"Station {node_id}"),
                            'location': 'Active Device Route',
                            'image_url': 'https://s.isanook.com/ns/0/ud/1628/8144062/new-normal.jpg'
                        })
            except Exception as json_err:
                print(f"⚠️ API returned invalid JSON for system-health: {json_err}")
                print(f"⚠️ Response content: {health_res.text[:200]}")
        else:
            print(f"⚠️ Backend API for system-health returned status {health_res.status_code}")
    except requests.exceptions.RequestException as req_err:
        print(f"❌ Network/Request Error fetching live stations from API: {req_err}")
        print("🔄 Falling back to database query...")
        stations = get_all_stations()
    except Exception as e:
        print(f"❌ Unexpected Error fetching live stations from API: {e}")
        print("🔄 Falling back to database query...")
        stations = get_all_stations()
        
    # 3. Fallback to Database if no stations found via API
    if not stations:
        print("⚠️ No stations found via API. Falling back to database...")
        stations = get_all_stations()

    # 4. Override images and locationsกับ Admin-saved custom data
    try:
        db_stations = {str(s['id']): s for s in get_all_stations()}
        for st in stations:
            st_id_str = str(st['id'])
            if st_id_str in db_stations:
                saved = db_stations[st_id_str]
                # Priority: 1. DB saved value, 2. API value
                if saved.get('name'): st['name'] = saved['name']
                if saved.get('location'): st['location'] = saved['location']
                if saved.get('image_url'): st['image_url'] = saved['image_url']
                # print(f"DEBUG: Syncing {st_id_str} from DB -> Name: {st['name']}, Image: {st['image_url'][:30]}...")
            
            # Final check to ensure NO field is empty (LINE requires non-empty strings)
            if not st.get('name'):
                st['name'] = f"Station {st.get('id', 'Unknown')}"
                
            if not st.get('location') or str(st['location']).strip() == '':
                st['location'] = "ไม่ระบุตำแหน่ง"
                
            if not st.get('image_url') or str(st['image_url']).strip() == '' or str(st['image_url']).lower() == 'none':
                st['image_url'] = "https://img1.pic.in.th/images/Gemini_Generated_Image_cxndnqcxndnqcxnd.png"
    except Exception as e:
        print(f"⚠️ Error overriding custom data: {e}")

    # 5. Sort stations: Static first, then Float, then others
    def sort_key(s):
        name = s.get('name', '').lower()
        if 'static' in name: return (0, name)
        elif 'float' in name: return (1, name)
        return (2, name)

    stations.sort(key=sort_key)
    return stations

# 2. API สำหรับรับข้อมูลการลงทะเบียน
@app.route('/api/register', methods=['POST'])
def register_station():
    try:
        data = request.json
        user_id = data.get('userId')
        selected_stations = data.get('stations') # list เช่น [1, 3]

        # บันทึกลง Database (SQLite)
        update_user_stations(user_id, selected_stations)

        # Fetch all stations dynamically instead of from SQLite
        all_stations = get_live_stations()

        # สร้าง Flex Message Dictionary
        flex_dict = create_dashboard_flex_dict(selected_stations, all_stations)
        
        # แปลง Dict เป็น FlexContainer ของ V3
        flex_container = FlexContainer.from_dict(flex_dict)

        # หาสถานีที่เลือกเพื่อเอาชื่อมาโชว์ใน Summary
        selected_names = []
        for sid in selected_stations:
            for st in all_stations:
                if str(st['id']) == str(sid):
                    selected_names.append(st['name'])
                    break
                    
        # สร้างข้อความสรุป
        names_str = ", ".join(selected_names) if selected_names else "0 สถานี"
        summary_text = f"ลงทะเบียนสถานี {names_str} เรียบร้อยครับ 😊"

        print(f"DEBUG: Attempting to push message to {user_id}")
        
        # ส่ง Push Message ด้วย V3 SDK
        try:
            with ApiClient(configuration) as api_client:
                line_bot_api = MessagingApi(api_client)
                push_res = line_bot_api.push_message(
                    PushMessageRequest(
                        to=user_id,
                        messages=[
                            FlexMessage(alt_text="ผลการลงทะเบียน", contents=flex_container),
                            TextMessage(text=summary_text)
                        ]
                    )
                )
                print(f"✅ Push Message Success: {push_res}")
        except Exception as push_err:
            print(f"❌ Push Message Failed: {push_err}")
            # Even if push fails, we saved the settings to DB, so we return 500 to let frontend know
            return jsonify({"status": "error", "message": f"Saved settings but failed to send LINE message: {str(push_err)}"}), 500

        return jsonify({"status": "success", "message": "Registered and Pushed"}), 200
    except Exception as e:
        print(f"❌ Register Script Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

# 4. Admin Dashboard Routes
@app.route("/admin")
def admin_dashboard():
    return render_template("admin.html")

# 5. LINE Webhook Callback
@app.route("/callback", methods=['POST'])
def callback():
    signature = request.headers['X-Line-Signature']
    body = request.get_data(as_text=True)

    try:
        handler.handle(body, signature)
    except InvalidSignatureError:
        print("Invalid signature. Please check your channel access token/channel secret.")
        abort(400)

    return 'OK'

# 6. Internal API to receive data from Node.js
@app.route("/internal/water-update", methods=['POST'])
def receive_water_update():
    # Node.js ส่งข้อมูลระดับน้ำแบบ Real-time มาให้ที่นี่
    data = request.json
    print(f"Received water update from Node.js: {data}")
    # ในอนาคตสามารถนำข้อมูลนี้ไปทำ Alert หรือ Save log เพิ่มได้
    return jsonify({"status": "received"}), 200

@app.route("/trigger-alert", methods=['POST'])
def trigger_alert_from_node():
    try:
        data = request.json
        print(f"Received alert from Node.js: {data}")
        
        station_id = str(data.get('stationId', ''))
        station_name = data.get('stationName', 'ระบุชื่อไม่ได้')
        water_level = data.get('waterLevel', 0)
        alert_level = data.get('alertLevel', 'warning')
        
        from utils import create_alert_flex_message
        flex_dict = create_alert_flex_message(station_id, station_name, water_level, alert_level)
        flex_container = FlexContainer.from_dict(flex_dict)
        
        status_text = "อันตราย 🚨" if alert_level == 'dangerous' else "เฝ้าระวัง ⚠️"
        alt_text = f"แจ้งเตือนภัย: {station_name} อยู่ในระดับ {status_text}"

        # Find users who subscribed to this station
        from database import get_all_users, get_user_stations, save_outbound_log
        all_users = get_all_users()
        target_users = []
        for uid in all_users:
            subs = get_user_stations(uid)
            if station_id in subs:
                target_users.append(uid)

        if not target_users:
            print(f"No users subscribed to station {station_id}")
            return jsonify({"status": "no_subscribers"}), 200

        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            # แบ่งส่งทีละ 150
            for i in range(0, len(target_users), 150):
                chunk = target_users[i:i + 150]
                try:
                    line_bot_api.multicast(
                        MulticastRequest(
                            to=chunk, 
                            messages=[FlexMessage(alt_text=alt_text, contents=flex_container)]
                        )
                    )
                except Exception as chunk_err:
                    print(f"Push alert chunk {i} failed: {chunk_err}")
                    continue
            
            # บันทึกประวัติการส่งออก (Outbound Log)
            save_outbound_log(target_users=target_users, message=alt_text, msg_type="push-alert")
                    
        return jsonify({"status": "alert_sent", "subscribers_count": len(target_users)}), 200
    except Exception as e:
        print(f"Error handling trigger-alert: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/stats", methods=['GET'])
def get_stats():
    return jsonify({
        "user_count": get_user_count(),
        "station_count": len(get_all_stations())
    })

@app.route("/api/messages", methods=['GET'])
def get_messages():
    from database import get_recent_messages
    return jsonify(get_recent_messages())

@app.route("/api/outbound-logs", methods=['GET'])
def api_get_outbound_logs():
    from database import get_outbound_logs
    return jsonify(get_outbound_logs())

@app.route("/api/stations", methods=['GET', 'POST'])
def manage_stations():
    if request.method == 'GET':
        # Get live stations (images already overridden in get_live_stations)
        return jsonify(get_live_stations())
        
    elif request.method == 'POST':
        data = request.json
        add_station(data['id'], data['name'], data['location'], data['image_url'])
        return jsonify({"status": "created_or_updated"}), 201

@app.route("/api/stations/<station_id>", methods=['PUT', 'DELETE'])
def update_delete_station(station_id):
    if request.method == 'PUT':
        data = request.json
        update_station(station_id, data['name'], data['location'], data['image_url'])
        return jsonify({"status": "updated"})
    elif request.method == 'DELETE':
        delete_station(station_id)
        return jsonify({"status": "deleted"})

@app.route("/broadcast", methods=['POST'])
def broadcast_message():
    try:
        from database import save_outbound_log
        data = request.json
        message_text = data.get('message')
        if not message_text: return jsonify({'error': 'No message'}), 400

        user_ids = get_all_users()
        if not user_ids: return jsonify({'error': 'No users'}), 404

        # ส่งแบบ Multicast
        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            # แบ่งส่งทีละ 150 คน (ตามข้อจำกัด LINE)
            chunk_size = 150 # ลดลงเพื่อความชัวร์
            for i in range(0, len(user_ids), chunk_size):
                chunk = user_ids[i:i + chunk_size]
                try:
                    line_bot_api.multicast(
                        MulticastRequest(to=chunk, messages=[TextMessage(text=message_text)])
                    )
                except Exception as chunk_err:
                    print(f"Broadcast chunk {i} failed: {chunk_err}")
                    # Continue to the next chunk even if one chunk fails
                    continue
                    
            # บันทึกประวัติการส่งออก (Outbound Log)
            save_outbound_log(target_users="ALL_USERS", message=message_text, msg_type="broadcast")
            
        return jsonify({'status': 'Sent'}), 200
    except Exception as e:
        print(f"Broadcast Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route("/push-alert", methods=['GET'])
def push_alert():
    try:
        user_ids = get_all_users()
        if not user_ids: return "No users"
        
        # ตัวอย่างการสุ่มค่า
        alert_msg = (
            f"🚨🚨 ประกาศเตือนภัยฉุกเฉิน 🚨🚨\n"
            f"ระดับน้ำวิกฤต! {random.uniform(2.5, 4.0):.2f} เมตร\n"
            f"ขอให้เตรียมอพยพทันที"
        )
        
        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            # แบ่งส่งทีละ 150
            for i in range(0, len(user_ids), 150):
                chunk = user_ids[i:i + 150]
                try:
                    line_bot_api.multicast(
                        MulticastRequest(to=chunk, messages=[TextMessage(text=alert_msg)])
                    )
                except Exception as chunk_err:
                    print(f"Push alert chunk {i} failed: {chunk_err}")
                    continue
        return "Alert Sent!"
    except Exception as e:
        print(e)
        return "Error", 500

# --- Initialization ---
try:
    init_db()  # Ensure database schema is ready (Important for Gunicorn)
    print("✅ Database initialized successfully.")
except Exception as e:
    print("--------------------------------------------------")
    print("❌ DB INIT ERROR: Could not connect to PostgreSQL.")
    print(f"Error Details: {e}")
    print("--------------------------------------------------")

if __name__ == "__main__":
    app.run(port=5000, debug=True)