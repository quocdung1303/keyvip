// api/keys.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join('/tmp', 'keys.json');

// Khởi tạo file nếu chưa có
function initData() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([]));
    }
}

function readKeys() {
    initData();
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
}

function writeKeys(keys) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(keys, null, 2));
}

function generateKey() {
    return crypto.randomBytes(16).toString('hex').toUpperCase();
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const keys = readKeys();

        // CREATE KEY
        if (req.method === 'POST' && req.body.action === 'create') {
            const { duration, ip, note } = req.body;
            const key = generateKey();
            const now = new Date();
            const expiresAt = new Date(now.getTime() + duration * 60 * 60 * 1000);

            const newKey = {
                key,
                createdAt: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
                ip: ip || null,
                note: note || null
            };

            keys.push(newKey);
            writeKeys(keys);

            return res.json({ success: true, key, expiresAt });
        }

        // LIST KEYS
        if (req.method === 'GET' && req.query.action === 'list') {
            return res.json({ success: true, keys });
        }

        // VERIFY KEY
        if (req.method === 'GET' && req.query.action === 'verify') {
            const { key } = req.query;
            const found = keys.find(k => k.key === key);

            if (!found) {
                return res.json({ valid: false, message: 'Key không tồn tại' });
            }

            const now = new Date();
            const expires = new Date(found.expiresAt);

            if (now > expires) {
                return res.json({ valid: false, message: 'Key đã hết hạn' });
            }

            const timeLeft = Math.floor((expires - now) / (1000 * 60 * 60));
            return res.json({
                valid: true,
                timeLeft: `${timeLeft} giờ`,
                ip: found.ip,
                note: found.note
            });
        }

        // DELETE KEY
        if (req.method === 'DELETE') {
            const { key } = req.body;
            const filtered = keys.filter(k => k.key !== key);
            writeKeys(filtered);
            return res.json({ success: true });
        }

        // EXTEND KEY
        if (req.method === 'PUT') {
            const { key, hours } = req.body;
            const found = keys.find(k => k.key === key);

            if (found) {
                const currentExpires = new Date(found.expiresAt);
                const newExpires = new Date(currentExpires.getTime() + hours * 60 * 60 * 1000);
                found.expiresAt = newExpires.toISOString();
                writeKeys(keys);
                return res.json({ success: true });
            }

            return res.json({ success: false, message: 'Key không tồn tại' });
        }

        res.json({ success: false, message: 'Invalid request' });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
