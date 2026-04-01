const { google } = require('googleapis');
const { getSettings } = require('../config/settings');
const path = require('path');
const fs = require('fs');

let sheetsService = null;
let spreadsheetId = null;

async function initGoogleSheets() {
    try {
        const settings = getSettings();
        const config = settings.data_source?.google_sheets || {};

        // 1. Determine Spreadsheet ID (Env Var > Settings)
        spreadsheetId = process.env.GOOGLE_SHEET_ID || config.spreadsheetId;

        if (!spreadsheetId) {
            console.log("⚠️ Google Sheets: Spreadsheet ID is missing (neither in Env nor Settings).");
            return false;
        }

        // 2. Prepare Auth
        let auth;
        const envCreds = process.env.GOOGLE_SERVICE_ACCOUNT;

        if (envCreds) {
            // Use JSON string from Environment Variable (Best for Railway/Production)
            console.log("🔐 Google Sheets: Using credentials from GOOGLE_SERVICE_ACCOUNT environment variable.");
            const credentials = JSON.parse(envCreds);
            auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
        } else {
            // Fallback to Service Account File (Best for Local)
            const keyFile = path.resolve(config.credentials_path || './service-account.json');
            if (!fs.existsSync(keyFile)) {
                console.log(`⚠️ Google Sheets: Credentials file not found at ${keyFile}`);
                return false;
            }
            console.log(`🔐 Google Sheets: Using credentials from file: ${keyFile}`);
            auth = new google.auth.GoogleAuth({
                keyFile: keyFile,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
        }

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
                timestamp,                // 1. Time (A)
                data.stationName,         // 2. Station (B)
                data.stationId,           // 3. Stationd ID (C)
                data.rawLevel,            // 4. water_level (Raw) (D)
                data.waterLevel,          // 5. offset_water_level (Calibrated) (E)
                data.dataRate,            // 6. data_rate (F)
                data.rssi,                // 7. RSSI (G)
                data.snr,                 // 8. snr (H)
                data.battery,             // 9. battery (I)
                data.batteryVoltage || 0, // 10. battery_voltage (J)
                data.sensorType,          // 11. Sensor Type (K)
                data.lat,                 // 12. Latitude (L)
                data.lng,                 // 13. Longitude (M)
                data.src || 'Unknown'     // 14. Source (N)
            ]
        ];

        const resource = { values };

        // Determine Sheet Name based on Sensor Type
        // If Sensor Type contains 'Float', go to 'Float' sheet, else 'Static'
        const sheetName = (data.sensorType && data.sensorType.toLowerCase().includes('float')) ? 'Float' : 'Static1';

        // Append to specific sheet
        console.log(`📝 Appending to Sheet: ${sheetName}`);
        await sheetsService.spreadsheets.values.append({
            spreadsheetId,
            range: sheetName,
            valueInputOption: 'USER_ENTERED',
            resource,
        });

        console.log(`📝 Saved to Sheet (${sheetName}): ${data.stationId} | L=${data.waterLevel}`);

        // Save GPS Data to 'GPS' Sheet
        if (data.lat !== undefined && data.lng !== undefined) {
            const gpsValues = [
                [
                    timestamp,
                    data.stationId,
                    data.lat,
                    data.lng,
                    data.src || 'Unknown'
                ]
            ];

            await sheetsService.spreadsheets.values.append({
                spreadsheetId,
                range: 'GPS',
                valueInputOption: 'USER_ENTERED',
                resource: { values: gpsValues },
            });
            console.log(`📍 Saved to Sheet (GPS): ${data.stationId}`);
        }
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
            range: 'Static1-1', // Read from the correct sheet
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
                // Index mappings: Time(0), StationName(1), StationID(2), waterLevel(3)
                const stationId = row[2]; // C
                const waterLevel = parseFloat(row[3]); // D

                // Map to device ID if needed (or just use what's in sheet)
                let deviceId = stationId;

                if (!history[deviceId]) history[deviceId] = [];

                history[deviceId].push({
                    time: timestamp.toLocaleTimeString('th-TH'),
                    rawTimestamp: timestamp.getTime(),
                    waterLevel: parseFloat(row[4] || row[3] || 0), // Calibrated (E)
                    rawLevel: parseFloat(row[3] || 0), // Raw (D)
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
