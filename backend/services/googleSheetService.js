const { google } = require('googleapis');
const { getSettings } = require('../config/settings');
const path = require('path');

let sheetsService = null;
let spreadsheetId = null;

async function initGoogleSheets() {
    try {
        const settings = getSettings();
        if (!settings.data_source || !settings.data_source.google_sheets) {
            console.log("⚠️ Google Sheets configuration missing.");
            return false;
        }

        const config = settings.data_source.google_sheets;
        spreadsheetId = config.spreadsheetId;
        const keyFile = path.resolve(config.credentials_path || './service-account.json');

        const auth = new google.auth.GoogleAuth({
            keyFile: keyFile,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const authClient = await auth.getClient();
        sheetsService = google.sheets({ version: 'v4', auth: authClient });

        console.log("✅ Google Sheets Service Initialized");
        return true;
    } catch (error) {
        console.error("❌ Google Sheets Init Error:", error.message);
        return false;
    }
}

async function saveReadingToSheet(data) {
    if (!sheetsService || !spreadsheetId) return;

    try {
        // Prepare row data: [Timestamp, StationID, StationName, WaterLevel, Pressure, DataRate, RSSI, SNR, Battery, SensorType]
        // Removed 'src' as requested
        const timestamp = new Date().toLocaleString("en-GB", { timeZone: "Asia/Bangkok", hour12: false }).replace(',', '');

        const values = [
            [
                timestamp,                // A: Local Time
                data.stationId,           // B
                data.stationName,         // C
                data.waterLevel,          // D
                data.pressure,            // E
                data.dataRate,            // F
                data.rssi,                // G
                data.snr,                 // H
                data.battery,             // I
                data.sensorType           // J
            ]
        ];

        const resource = { values };

        // Determine Sheet Name based on Sensor Type
        // If Sensor Type contains 'Float', go to 'Float' sheet, else 'Static'
        const sheetName = (data.sensorType && data.sensorType.toLowerCase().includes('float')) ? 'Float' : 'Static';

        // Append to specific sheet
        console.log(`📝 Appending to Sheet: ${sheetName}`);
        await sheetsService.spreadsheets.values.append({
            spreadsheetId,
            range: sheetName,
            valueInputOption: 'USER_ENTERED',
            resource,
        });

        console.log(`📝 Saved to Sheet (${sheetName}): ${data.stationId} | L=${data.waterLevel}`);
    } catch (error) {
        console.error("❌ Sheet Save Error:", error.message);
    }
}

async function getHistoryFromSheet(hours = 48) {
    if (!sheetsService || !spreadsheetId) return {};

    try {
        // Read all data (Not efficient for huge datasets, but fine for prototype)
        const result = await sheetsService.spreadsheets.values.get({
            spreadsheetId,
            range: 'Static', // Read whole sheet
        });

        const rows = result.data.values;
        if (!rows || rows.length === 0) return {};

        const history = {};
        const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

        // Skip header if exists (simple check: if first row is text)
        // We iterate and filter
        rows.forEach(row => {
            const timestamp = new Date(row[0]);
            if (isNaN(timestamp.getTime())) return; // invalid date or header

            if (timestamp > cutoffTime) {
                const stationId = row[1]; // B
                const waterLevel = parseFloat(row[3]); // D
                const pressure = parseFloat(row[4]); // E

                // Map to device ID if needed (or just use what's in sheet)
                let deviceId = stationId;

                if (!history[deviceId]) history[deviceId] = [];

                history[deviceId].push({
                    time: timestamp.toLocaleTimeString('th-TH'),
                    rawTimestamp: timestamp,
                    waterLevel: waterLevel || 0,
                    pressure: pressure || 0
                });
            }
        });

        console.log("✅ History loaded from Google Sheet");
        return history;
    } catch (error) {
        console.error("⚠️ Sheet History Load Error:", error.message);
        return {};
    }
}

module.exports = {
    initGoogleSheets,
    saveReadingToSheet,
    getHistoryFromSheet
};
