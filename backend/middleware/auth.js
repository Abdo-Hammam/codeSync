const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        return res.status(401).json({ message: 'Access Denied. No token provided.' });
    }

    // استخراج التوكن بدون كلمة "Bearer"
    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, 'yourSecretKey'); // نفس الـ Secret Key بتاع login
        req.user = decoded;
        next();
    } catch (err) {
        res.status(400).json({ message: 'Invalid token' });
    }
};
