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
app.use(cors());
app.use(express.json());

// Inject IO into request for routes to use
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Routes
app.use('/api', apiRoutes);

// Socket.io
io.on('connection', (socket) => {
    console.log('👤 Client Connected');
    socket.emit('init-data', getStationHistory());
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
}

startServer();