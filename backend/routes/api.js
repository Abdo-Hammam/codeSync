const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

module.exports = (roomOwners) => {
    const userRoutes = require('./userRoutes');
    router.use('/users', userRoutes.router); 

    // مسار تجريبي
    router.get('/', (req, res) => {
        res.json({ message: 'Welcome to CodeSync API!' });
    });

    const roomSchema = new mongoose.Schema({
        roomId: { type: String, required: true, unique: true },
        owner: { type: String, required: true },
        password: { type: String, default: '' },
        lastOpened: { type: Date, default: Date.now }
    });

    const Room = mongoose.model('Room', roomSchema);

    const auth = (req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123');
            req.user = decoded;
            next();
        } catch (error) {
            res.status(401).json({ message: 'Invalid token' });
        }
    };

    router.post('/createRoom', auth, async (req, res) => {
        try {
            const { roomId, owner, password } = req.body;
            const room = new Room({ roomId, owner, password: password || '', lastOpened: new Date() });
            await room.save();

            roomOwners.set(roomId, owner);

            res.json({ success: true, roomId });
        } catch (error) {
            console.error('Error creating room:', error);
            res.status(500).json({ success: false, message: 'Error creating room' });
        }
    });

    router.get('/userRooms', auth, async (req, res) => {
        try {
            const username = req.query.username;
            const rooms = await Room.find({ owner: username }).sort({ lastOpened: -1 });
            res.json({ rooms: rooms.map(room => ({
                roomId: room.roomId,
                owner: room.owner,
                lastOpened: room.lastOpened,
                hasPassword: !!room.password
            })) });
        } catch (error) {
            console.error('Error fetching rooms:', error);
            res.status(500).json({ message: 'Error fetching rooms' });
        }
    });

    router.get('/checkRoom', auth, async (req, res) => {
        try {
            const roomId = req.query.roomId;
            const room = await Room.findOne({ roomId });
            if (room) {
                res.json({ exists: true, hasPassword: !!room.password, owner: room.owner });
            } else {
                res.json({ exists: false });
            }
        } catch (error) {
            console.error('Error checking room:', error);
            res.status(500).json({ message: 'Error checking room' });
        }
    });

    router.post('/verifyRoomPassword', auth, async (req, res) => {
        try {
            const { roomId, password } = req.body;
            const room = await Room.findOne({ roomId });
            if (room) {
                if (room.password && room.password !== password) {
                    res.json({ success: false, message: 'Incorrect password' });
                } else {
                    res.json({ success: true });
                }
            } else {
                res.json({ success: false, message: 'Room not found' });
            }
        } catch (error) {
            console.error('Error verifying password:', error);
            res.status(500).json({ message: 'Error verifying password' });
        }
    });

    router.post('/generateRoomToken', auth, async (req, res) => {
        try {
            const { roomId } = req.body;
            const room = await Room.findOne({ roomId });
            if (!room) {
                return res.status(404).json({ success: false, message: 'Room not found' });
            }
            const token = jwt.sign({ roomId }, process.env.JWT_SECRET || 'supersecretkey123', { expiresIn: '7d' });
            res.json({ success: true, token });
        } catch (error) {
            console.error('Error generating room token:', error);
            res.status(500).json({ success: false, message: 'Error generating room token' });
        }
    });

    router.get('/decodeRoomToken', (req, res) => {
        try {
            const token = req.query.token;
            if (!token) {
                return res.status(400).json({ success: false, message: 'No token provided' });
            }
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123');
            res.json({ success: true, roomId: decoded.roomId });
        } catch (error) {
            console.error('Error decoding room token:', error);
            res.status(400).json({ success: false, message: 'Invalid token' });
        }
    });

    return router;
};