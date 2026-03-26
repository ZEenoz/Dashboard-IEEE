const API_KEY = process.env.API_KEY || 'IEEE_SECURE_API_KEY_2025';

function requireApiKey(req, res, next) {
    const key = req.header('x-api-key');
    if (key === API_KEY) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
    }
}

module.exports = { requireApiKey };
