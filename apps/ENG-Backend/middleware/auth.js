const jwt = require('jsonwebtoken');
const moment = require('moment-timezone');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET; // || 'ENG_SYSTEM_SECRET_KEY'

const generateToken = (user) => {
    const payload = {
        empno: user.u_code,
        name: user.u_name,
        department: user.u_department || user.department || null,
        group: user.user_group || user.group || null,
        role: user.u_role || user.role,
    };

    // Calculate expiration: Min(Now + 2 hours, Midnight of current day)
    const now = moment().tz('Asia/Bangkok');
    const midnight = moment().tz('Asia/Bangkok').endOf('day');

<<<<<<< HEAD
    // Add 4 hours to now
    let expiresAt = moment(now).add(4, 'hours');

    // If 4 hours from now is past midnight, cap it at midnight
=======
    // Add 2 hours to now
    let expiresAt = moment(now).add(2, 'hours');

    // If 2 hours from now is past midnight, cap it at midnight
>>>>>>> old-work-backup
    if (expiresAt.isAfter(midnight)) {
        expiresAt = midnight;
    }

    // `expiresIn` should be in seconds
    const expiresInSeconds = Math.floor(expiresAt.diff(now, 'seconds'));

    // Edge case if somehow the time difference is negative (which shouldn't happen unless clocks are messed up)
    const finalExpiresIn = Math.max(expiresInSeconds, 1);

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: finalExpiresIn });

    return { token, expiresInSeconds, expiresAt: expiresAt.format() };
};

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

    if (!token) {
        return res.status(401).json({ result: 'false', message: 'Token is required' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ result: 'false', message: 'Token is invalid or expired' });
        }
        req.user = decoded; // Store decoded user payload
        next();
    });
};

module.exports = {
    generateToken,
    verifyToken,
    JWT_SECRET
};
