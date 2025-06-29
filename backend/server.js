require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");
const admin = require("firebase-admin");
const userRoutes = require("./routes/userRoutes");
const googleAuthRoutes = require("./routes/googleAuthRoutes");
const { exec } = require("child_process");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const Room = require("../backend/models/Room");

const roomOwners = new Map();
const roomCodes = new Map();
const roomEditors = new Map();
const roomUsers = new Map();
const roomLanguages = new Map();

const apiRoutes = require("./routes/api")(roomOwners);

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, "../frontend")));
app.use("/assets", express.static(path.join(__dirname, "../frontend/assets")));
app.use((req, res, next) => {
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});
app.use((req, res, next) => {
  next();
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/signup.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/login.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/dashboard.html"));
});

app.get("/profile", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/profile.html"));
});

app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/home.html"));
});

app.get("/reset-password", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/reset-password.html"));
});

app.get("/new-password", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/new-password.html"));
});

app.get("/logout", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/login.html"));
});
app.use((req, res, next) => {
  // التحقق من وجود token في query parameters
  if (req.query.auth) {
    req.headers.authorization = `Bearer ${req.query.auth}`;
  }
  next();
});
app.get("/join", async (req, res) => {
  const token = req.query.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecretkey123");
      const roomId = decoded.roomId;
      
      // تحقق من وجود token تسجيل دخول في localStorage
      if (req.cookies.token || req.headers.authorization) {
        // إذا كان المستخدم مسجل الدخول بالفعل
        return res.redirect(`/dashboard?room=${roomId}`);
      } else {
        // إذا لم يكن مسجل الدخول
        return res.redirect(`/login?redirect=/dashboard?room=${roomId}`);
      }
    } catch (error) {
      console.error("Error decoding token in /join:", error);
      return res.redirect("/login");
    }
  } else {
    return res.redirect("/login");
  }
});

app.use(cors({ origin: "*" }));
app.use("/api", apiRoutes);
app.use("/api/auth", googleAuthRoutes);
app.use("/", userRoutes.router);

mongoose
  .connect("mongodb://localhost:27017/codeSync")
  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await userRoutes.findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const resetToken = jwt.sign(
      { email },
      process.env.JWT_SECRET || "supersecretkey123",
      { expiresIn: "1h" }
    );
    const resetLink = `http://127.0.0.1:5000/new-password?token=${resetToken}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Request - CodeSync",
      html: `
                <h2>Password Reset Request</h2>
                <p>You requested to reset your password. Click the link below to set a new password:</p>
                <a href="${resetLink}">Reset Password</a>
                <p>This link will expire in 1 hour.</p>
                <p>If you did not request this, please ignore this email.</p>
            `,
    };
    await transporter.sendMail(mailOptions);
    res.json({
      success: true,
      message: "Password reset link sent to your email",
    });
  } catch (error) {
    console.error("Error sending reset email:", error);
    res.status(500).json({ message: "Error sending reset email" });
  }
});

app.post("/api/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "supersecretkey123"
    );
    const email = decoded.email;
    const user = await userRoutes.resetUserPassword(email, newPassword);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      res.status(400).json({ message: "Reset link has expired" });
    } else {
      res.status(500).json({ message: "Error resetting password" });
    }
  }
});

const server = http.createServer(app);
const io = new Server(server);

io.on("connection", (socket) => {
  socket.on("joinRoom", async (data) => {
    const { roomId, username } = data;
    try {
      socket.join(roomId);
      console.log(`User ${socket.id} (${username}) joined room: ${roomId}`);
      const room = await Room.findOne({ roomId });
      if (!room) {
        console.log(`❌ Room ${roomId} not found`);
        socket.emit("error", { message: "Room not found" });
        return;
      }
      const owner = roomOwners.get(roomId);
      console.log(
        `📌 Room ${roomId} owner: ${owner}, joining user: ${username}`
      );
      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, []);
      }
      let users = roomUsers.get(roomId);
      const userExists = users.find((user) => user.username === username);
      if (!userExists) {
        const canEdit =
          username === owner ||
          (roomEditors.get(roomId) || []).includes(username);
        users.push({
          id: socket.id,
          username,
          canEdit,
        });
        roomUsers.set(roomId, users);
        console.log(
          `📋 Added user ${username} to roomUsers for room ${roomId}:`,
          roomUsers.get(roomId)
        );
      } else {
        users = users.map((user) =>
          user.username === username ? { ...user, id: socket.id } : user
        );
        roomUsers.set(roomId, users);
        console.log(
          `📋 Updated socket.id for user ${username} in room ${roomId}:`,
          roomUsers.get(roomId)
        );
      }
      const userInParticipants = room.participants.some(
        (p) => p.toLowerCase() === username.toLowerCase()
      );
      if (!userInParticipants) {
        room.participants.push(username);
        room.participants = [...new Set(room.participants)];
        await room.save();
        console.log(
          `✅ Added ${username} to participants for room ${roomId} in database. Participants:`,
          room.participants
        );
      } else {
        const uniqueParticipants = [...new Set(room.participants)];
        if (uniqueParticipants.length !== room.participants.length) {
          room.participants = uniqueParticipants;
          await room.save();
          console.log(
            `🧹 Cleaned duplicates in participants for room ${roomId}:`,
            room.participants
          );
        } else {
          console.log(
            `ℹ️ User ${username} already in room ${roomId} participants`
          );
        }
      }
      const latestVersion = room.versions[room.versions.length - 1];
      const code = latestVersion
        ? latestVersion.code
        : "Write your code here...";
      const language = room.language || "javascript";
      roomCodes.set(roomId, code);
      roomLanguages.set(roomId, language);
      socket.emit("codeChange", { code, roomId, username });
      socket.emit("languageChange", { language });
      const editors = roomEditors.get(roomId) || [];
      const canEdit = username === room.owner || editors.includes(username);
      console.log(
        `📌 Setting editor mode for ${username} in room ${roomId}: canEdit=${canEdit}, readOnly=${!canEdit}`
      );
      socket.emit("setEditorMode", { readOnly: !canEdit });
      io.to(roomId).emit("updateUsers", { users: roomUsers.get(roomId) });
      socket.to(roomId).emit("userJoined", { userId: username });
    } catch (error) {
      console.error("Error in joinRoom:", error);
      socket.emit("error", { message: "Error joining room" });
    }
  });

  socket.on("languageChange", async (data) => {
    const { language, roomId } = data;
    try {
      console.log("📝 Language changed to:", language, "for room:", roomId);
      roomLanguages.set(roomId, language);
      const room = await Room.findOne({ roomId });
      if (room) {
        room.language = language;
        await room.save();
      }
      io.to(roomId).emit("languageChange", { language });
    } catch (error) {
      console.error("Error in languageChange:", error);
    }
  });

  socket.on("codeChange", (data) => {
    const { code, roomId, username } = data;
    console.log(
      `📝 codeChange received: username=${username}, roomId=${roomId}, code=${code.substring(
        0,
        50
      )}...`
    );
    const owner = roomOwners.get(roomId);
    const editors = roomEditors.get(roomId) || [];
    const canEdit = username === owner || editors.includes(username);
    if (canEdit) {
      roomCodes.set(roomId, code);
      console.log(
        `📤 Broadcasting codeChange to room ${roomId} with username=${username}`
      );
      io.to(roomId).emit("codeChange", { code, roomId, username });
    } else {
      console.log(
        `📤 Sending current code back to ${username} (no edit permissions)`
      );
      socket.emit("codeChange", {
        code: roomCodes.get(roomId) || "Write your code here...",
        roomId,
        username,
      });
    }
  });

  socket.on("toggleEditAccess", (data) => {
    const { roomId, username, canEdit } = data;
    const owner = roomOwners.get(roomId);
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room || !roomOwners.has(roomId)) {
      return;
    }
    const socketsInRoom = [...room];
    const ownerSocket = socketsInRoom.find((socketId) => {
      const user = roomUsers.get(roomId)?.find((u) => u.username === owner);
      return user && socketId === user.id;
    });
    if (ownerSocket && socket.id === ownerSocket) {
      let editors = roomEditors.get(roomId) || [];
      if (canEdit) {
        if (!editors.includes(username)) {
          editors.push(username);
        }
      } else {
        editors = editors.filter((user) => user !== username);
      }
      roomEditors.set(roomId, editors);
      const users = roomUsers.get(roomId);
      const user = users.find((u) => u.username === username);
      if (user) {
        user.canEdit = canEdit;
        roomUsers.set(roomId, users);
      }
      io.to(roomId).emit("updateUsers", { users: roomUsers.get(roomId) });
      const targetSocket = [...io.sockets.sockets.values()].find((s) => {
        const user = roomUsers
          .get(roomId)
          ?.find((u) => u.username === username);
        return user && s.id === user.id;
      });
      if (targetSocket) {
        targetSocket.emit("setEditorMode", { readOnly: !canEdit });
      }
    }
  });

  socket.on("requestAccess", (data) => {
    const { roomId, username } = data;
    const owner = roomOwners.get(roomId);
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room || !roomOwners.has(roomId)) {
      return;
    }
    const socketsInRoom = [...room];
    const ownerSocket = socketsInRoom.find((socketId) => {
      const user = roomUsers.get(roomId)?.find((u) => u.username === owner);
      return user && socketId === user.id;
    });
    if (ownerSocket) {
      io.to(ownerSocket).emit("accessRequest", { username });
    }
  });

  socket.on("runCode", (data) => {
    const { code, language, roomId } = data;
    let output = "";
    if (language === "javascript") {
      try {
        const consoleLog = [];
        const originalConsoleLog = console.log;
        console.log = (...args) => {
          consoleLog.push(args.join(" "));
        };
        eval(code);
        console.log = originalConsoleLog;
        output = consoleLog.join("\n") || "No output";
      } catch (error) {
        output = `Error: ${error.message}`;
      }
      io.to(roomId).emit("codeOutput", { output });
    } else if (language === "python") {
      fs.writeFileSync("temp.py", code);
      exec("py temp.py", (error, stdout, stderr) => {
        if (error) {
          output =
            `Error: ${stderr}\n` +
            `Python execution failed. Please ensure Python is installed and the 'py' command is accessible.\n` +
            `Steps to fix:\n` +
            `1. Verify Python is installed by running 'py --version' in your terminal.\n` +
            `2. If not installed, download and install Python from https://www.python.org/downloads/.\n` +
            `3. Ensure Python is added to your PATH during installation.\n` +
            `4. Restart your terminal and try again.`;
        } else {
          output = stdout || "No output";
        }
        io.to(roomId).emit("codeOutput", { output });
        fs.unlinkSync("temp.py");
      });
    } else if (language === "java") {
      const javaCode = code.includes("class Main")
        ? code
        : `
                public class Main {
                    ${code}
                }
            `;
      fs.writeFileSync("Main.java", javaCode);
      exec("javac Main.java && java Main", (error, stdout, stderr) => {
        if (error) {
          output = `Error: ${stderr}`;
        } else {
          output = stdout || "No output";
        }
        io.to(roomId).emit("codeOutput", { output });
        fs.unlinkSync("Main.java");
        if (fs.existsSync("Main.class")) {
          fs.unlinkSync("Main.class");
        }
      });
    } else {
      output = "Language not supported yet";
      io.to(roomId).emit("codeOutput", { output });
    }
  });

  socket.on("disconnect", () => {
    roomUsers.forEach((users, roomId) => {
      const userIndex = users.findIndex((user) => user.id === socket.id);
      if (userIndex !== -1) {
        users.splice(userIndex, 1);
        roomUsers.set(roomId, users);
        io.to(roomId).emit("updateUsers", { users: roomUsers.get(roomId) });
      }
    });
  });
});

server.listen(5000, () => {
  console.log("Server is running on http://127.0.0.1:5000");
});