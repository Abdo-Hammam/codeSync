const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const User = require("../models/User");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

module.exports = (roomOwners) => {
  const userRoutes = require("./userRoutes");
  router.use("/users", userRoutes.router);

  const auth = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "supersecretkey123"
      );
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({ message: "Invalid token" });
    }
  };
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, "../../frontend/assets/uploads");
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, "avatar-" + uniqueSuffix + path.extname(file.originalname));
    },
  });

  const upload = multer({ storage: storage });

  router.post(
    "/upload-avatar",
    auth,
    upload.single("avatar"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res
            .status(400)
            .json({ success: false, message: "No file uploaded" });
        }

        const avatarPath = "/assets/uploads/" + req.file.filename;
        const user = await User.findByIdAndUpdate(
          req.user.id,
          { avatar: avatarPath },
          { new: true }
        );

        res.json({ success: true, avatar: avatarPath });
      } catch (error) {
        console.error("Error uploading avatar:", error);
        res
          .status(500)
          .json({ success: false, message: "Error uploading avatar" });
      }
    }
  );
  router.post("/createRoom", auth, async (req, res) => {
    try {
      const { roomId, password } = req.body;
      const owner = req.user.username;
      console.log(`📌 Creating room ${roomId} with owner ${owner}`);
      const defaultCode = 'console.log("Welcome to CodeSync!");';
      const room = new Room({
        roomId,
        owner,
        password: password || "",
        language: "javascript",
        lastOpened: new Date(),
        participants: [owner],
        versions: [
          { versionNumber: 1, code: defaultCode, createdAt: new Date() },
        ],
      });

      await room.save();
      roomOwners.set(roomId, owner);
      console.log(`📌 roomOwners after set:`, roomOwners);
      res.json({ success: true, roomId });
    } catch (error) {
      console.error("Error creating room:", error);
      res.status(500).json({ success: false, message: "Error creating room" });
    }
  });

  router.get("/userRooms", auth, async (req, res) => {
    try {
      const username = req.query.username;
      const rooms = await Room.find({ owner: username }).sort({
        lastOpened: -1,
      });
      res.json({
        rooms: rooms.map((room) => ({
          roomId: room.roomId,
          owner: room.owner,
          lastOpened: room.lastOpened,
          participants: room.participants,
          hasPassword: !!room.password,
        })),
      });
    } catch (error) {
      console.error("Error fetching rooms:", error);
      res.status(500).json({ message: "Error fetching rooms" });
    }
  });

  router.get("/checkRoom", auth, async (req, res) => {
    try {
      const roomId = req.query.roomId;
      const room = await Room.findOne({ roomId });
      if (room) {
        res.json({
          exists: true,
          hasPassword: !!room.password,
          owner: room.owner,
        });
      } else {
        res.json({ exists: false });
      }
    } catch (error) {
      console.error("Error checking room:", error);
      res.status(500).json({ message: "Error checking room" });
    }
  });

  router.post("/verifyRoomPassword", auth, async (req, res) => {
    try {
      const { roomId, password } = req.body;
      const room = await Room.findOne({ roomId });
      if (room) {
        if (room.password && room.password !== password) {
          res.json({ success: false, message: "Incorrect password" });
        } else {
          res.json({ success: true });
        }
      } else {
        res.json({ success: false, message: "Room not found" });
      }
    } catch (error) {
      console.error("Error verifying password:", error);
      res.status(500).json({ message: "Error verifying password" });
    }
  });

  router.post("/generateRoomToken", auth, async (req, res) => {
    try {
      const { roomId } = req.body;
      const room = await Room.findOne({ roomId });
      if (!room) {
        return res
          .status(404)
          .json({ success: false, message: "Room not found" });
      }
      const token = jwt.sign(
        { roomId },
        process.env.JWT_SECRET || "supersecretkey123",
        { expiresIn: "7d" }
      );
      res.json({ success: true, token });
    } catch (error) {
      console.error("Error generating room token:", error);
      res
        .status(500)
        .json({ success: false, message: "Error generating room token" });
    }
  });

  router.get("/decodeRoomToken", (req, res) => {
    try {
      const token = req.query.token;
      if (!token) {
        return res
          .status(400)
          .json({ success: false, message: "No token provided" });
      }
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "supersecretkey123"
      );
      res.json({ success: true, roomId: decoded.roomId });
    } catch (error) {
      console.error("Error decoding room token:", error);
      res.status(400).json({ success: false, message: "Invalid token" });
    }
  });

  router.post("/saveVersion", auth, async (req, res) => {
    try {
      console.log("📌 Save Version Request:", {
        body: req.body,
        user: req.user,
      });

      const { roomId, code } = req.body;
      const room = await Room.findOne({ roomId });

      if (!room) {
        console.log("❌ Room not found");
        return res.status(404).json({
          success: false,
          message: "Room not found",
        });
      }

      console.log("🔍 Room found:", {
        owner: room.owner,
        participants: room.participants,
      });

      // التحقق من صلاحيات المستخدم
      if (req.user.username !== room.owner) {
        console.log("⛔ Unauthorized user:", req.user.username);
        return res.status(403).json({
          success: false,
          message: "Unauthorized to save version",
        });
      }

      const versionNumber = room.versions.length + 1;
      room.versions.push({
        versionNumber,
        code,
        createdAt: new Date(),
      });

      await room.save();
      console.log("✅ Version saved successfully");
      res.json({ success: true, versionNumber });
    } catch (error) {
      console.error("🔥 Error saving version:", error);
      res.status(500).json({
        success: false,
        message: "Error saving version",
        error: error.message,
      });
    }
  });

  router.get("/roomVersions", auth, async (req, res) => {
    try {
      const { roomId } = req.query;
      const room = await Room.findOne({ roomId }).select(
        "versions participants"
      );
      if (!room) {
        return res
          .status(404)
          .json({ success: false, message: "Room not found" });
      }
      res.json({
        success: true,
        versions: room.versions.map((v) => ({
          versionNumber: v.versionNumber,
          createdAt: v.createdAt,
        })),
        participants: room.participants,
      });
    } catch (error) {
      console.error("Error fetching room versions:", error);
      res
        .status(500)
        .json({ success: false, message: "Error fetching room versions" });
    }
  });

  router.get("/searchRooms", auth, async (req, res) => {
    try {
      const query = req.query.query || "";
      const rooms = await Room.find({
        roomId: { $regex: query, $options: "i" },
      }).sort({ lastOpened: -1 });

      res.json({
        rooms: rooms.map((room) => ({
          roomId: room.roomId,
          owner: room.owner,
          lastOpened: room.lastOpened,
          participants: room.participants,
          hasPassword: !!room.password,
        })),
      });
    } catch (error) {
      console.error("Error searching rooms:", error);
      res.status(500).json({ message: "Error searching rooms" });
    }
  });

  router.get("/roomVersionCode", auth, async (req, res) => {
    try {
      const { roomId, versionNumber } = req.query;
      const room = await Room.findOne({ roomId });
      if (!room) {
        return res
          .status(404)
          .json({ success: false, message: "Room not found" });
      }
      const version = room.versions.find(
        (v) => v.versionNumber == versionNumber
      );
      if (!version) {
        return res
          .status(404)
          .json({ success: false, message: "Version not found" });
      }
      res.json({ success: true, code: version.code });
    } catch (error) {
      console.error("Error fetching version code:", error);
      res
        .status(500)
        .json({ success: false, message: "Error fetching version code" });
    }
  });

  router.delete("/users/:id", async (req, res) => {
    try {
      const deleted = await User.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: "User not found" });
      res.json({ message: "User deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
