require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
// const { initDatabase, getPool } = require('./config/database'); // Removed
const { initMQTT, getStationHistory } = require('./services/mqttService');
const apiRoutes = require('./routes/index');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Middleware
const corsOptions = {
    origin: '*', // Allow all origins for the dashboard
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.use(express.json());

// ngrok Interstitial Page Skip & CORS Headers
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, ngrok-skip-browser-warning");
    
    // Auto-skip ngrok warning if the client forgot the header
    if (req.headers['user-agent'] && !req.headers['ngrok-skip-browser-warning']) {
        // This won't stop the browser's own check but helps some clients
    }
    
    req.io = io;
    next();
});

// Routes
app.use('/api', apiRoutes);

// Socket.io
io.on('connection', async (socket) => {
    console.log('👤 Client Connected');
    
    // 1. Send History (for charts) - Deep retrieval from DB
    try {
        const historyData = await getHistory(48);
        socket.emit('init-data', historyData);
    } catch (err) {
        console.error("❌ Failed to emit init-data:", err.message);
        // Fallback to empty if DB fails
        socket.emit('init-data', {});
    }
    
    // 2. Send Latest per Station (for cards) - NEW
    const { getLatestReadings } = require('./services/dataManager');
    const latest = await getLatestReadings();
    socket.emit('latest-readings', latest);

    // 3. System Mode
    const settingsMod = require('./config/settings');
    socket.emit('system-mode', settingsMod.getSettings().networkMode || 'TTN');
});

// Initialization
const { initDataManager, getHistory } = require('./services/dataManager');

// ... (imports remain)

// Initialization
async function startServer() {
    await initDataManager();

    // Load History from DataManager (Postgres or Sheets)
    try {
        const history = await getHistory();
        const currentHistory = getStationHistory();
        Object.assign(currentHistory, history);
        console.log("✅ History loaded into memory");
    } catch (e) {
        console.error("⚠️ History Load Error:", e.message);
    }

    initMQTT(io);

    server.listen(4000, () => {
        console.log('🚀 Backend (Refactored) running on port 4000');
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error('\n❌ ERROR: Port 4000 is already in use!');
            console.error('👉 Suggestion: Run "start-backend.bat" to automatically clear port conflicts (Docker/Zombie Node).');
            process.exit(1);
        } else {
            console.error('❌ Server error:', err.message);
        }
    });
}

startServer();