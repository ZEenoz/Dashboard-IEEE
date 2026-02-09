const express = require('express');
const router = express.Router();
const fs = require('fs');
const { getSettings, saveSettings } = require('../config/settings');
const { getPool } = require('../config/database');

// --- Settings APIs ---
router.get('/settings', (req, res) => {
    res.json(getSettings());
});

router.post('/settings', (req, res) => {
    const newSettings = req.body;
    if (!newSettings) return res.status(400).send("Invalid Body");
    saveSettings(newSettings);
    res.json({ success: true });
});

router.post('/test-notify', (req, res) => {
    console.log("🔔 Test Notify Requested");
    res.json({ success: true, message: "Test notification sent (mock)" });
});

module.exports = router;
