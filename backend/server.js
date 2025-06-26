require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");
const admin = require("firebase-admin");
const userRoutes = require("./routes/userRoutes"); // استيراد الكائن
const googleAuthRoutes = require("./routes/googleAuthRoutes");
const { exec } = require("child_process");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const Room = require("../backend/models/Room");

// إنشاء الـ roomOwners هنا
const roomOwners = new Map();
const roomCodes = new Map();
const roomEditors = new Map();
const roomUsers = new Map();
const roomLanguages = new Map(); // لتخزين اللغة لكل Room

// استيراد apiRoutes وتمرير roomOwners كـ Dependency
const apiRoutes = require("./routes/api")(roomOwners);

const app = express();
app.use(express.json());

// السماح لـ Express بخدمة الملفات داخل `frontend`
app.use(express.static(path.join(__dirname, "../frontend")));

// السماح لـ Express بخدمة الملفات داخل `frontend/assets`
app.use("/assets", express.static(path.join(__dirname, "../frontend/assets")));

// Middleware لتسجيل الطلبات
app.use((req, res, next) => {
  // console.log(req.method, req.path);
  next();
});

// Route للصفحة الرئيسية
app.get("/", (req, res) => {
  // console.log('📌 Accessing root path /');
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// إرسال صفحات HTML عند زيارة الروابط الصحيحة
app.get("/signup", (req, res) => {
  // console.log('📌 Accessing /signup');
  res.sendFile(path.join(__dirname, "../frontend/pages/signup.html"));
});

app.get("/login", (req, res) => {
  // console.log('📌 Accessing /login');
  res.sendFile(path.join(__dirname, "../frontend/pages/login.html"));
});

app.get("/dashboard", (req, res) => {
  // console.log('📌 Accessing /dashboard');
  res.sendFile(path.join(__dirname, "../frontend/pages/dashboard.html"));
});

app.get("/profile", (req, res) => {
  // console.log('📌 Accessing /dashboard');
  res.sendFile(path.join(__dirname, "../frontend/pages/profile.html"));
});

app.get("/home", (req, res) => {
  // console.log('📌 Accessing /home');
  res.sendFile(path.join(__dirname, "../frontend/pages/home.html"));
});

app.get("/reset-password", (req, res) => {
  // console.log('📌 Accessing /reset-password');
  res.sendFile(path.join(__dirname, "../frontend/pages/reset-password.html"));
});

app.get("/new-password", (req, res) => {
  // console.log('📌 Accessing /new-password');
  res.sendFile(path.join(__dirname, "../frontend/pages/new-password.html"));
});

app.get("/logout", (req, res) => {
  // console.log('📌 Accessing /logout');
  res.sendFile(path.join(__dirname, "../frontend/pages/login.html"));
});

app.get("/join", (req, res) => {
  // console.log('📌 Accessing /join');
  const roomId = req.query.room;
  if (roomId) {
    res.redirect(`/login?redirect=/dashboard?room=${roomId}`);
  } else {
    res.redirect("/login");
  }
});

// استيراد الـ Routes (حطيناه في الآخر)
app.use(cors({ origin: "*" }));
app.use("/api", apiRoutes);
app.use("/api/auth", googleAuthRoutes);
app.use("/", userRoutes.router); // استخدام userRoutes.router بدل userRoutes

// الاتصال بقاعدة البيانات
mongoose
  .connect("mongodb://localhost:27017/codeSync")
  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });

// إعداد Nodemailer لإرسال الإيميلات
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// API لإرسال رابط إعادة تعيين كلمة المرور
app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    // استدعاء دالة من userRoutes للبحث عن المستخدم
    const user = await userRoutes.findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // إنشاء Reset Token
    const resetToken = jwt.sign(
      { email },
      process.env.JWT_SECRET || "supersecretkey123",
      { expiresIn: "1h" }
    );

    // إنشاء رابط إعادة التعيين
    const resetLink = `http://127.0.0.1:5000/new-password?token=${resetToken}`;

    // إرسال الإيميل
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

// API لإعادة تعيين كلمة المرور
app.post("/api/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    // التحقق من الـ Token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "supersecretkey123"
    );
    const email = decoded.email;

    // استدعاء دالة من userRoutes لتحديث كلمة المرور
    const user = await userRoutes.resetUserPassword(email, newPassword);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    // console.error('Error resetting password:', error);
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
  // console.log('🔌 New user connected:', socket.id);

  // لما المستخدم ينضم لـ Room
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

        // إدارة roomUsers في الذاكرة
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
          // تحديث socket.id لو اليوزر موجود بالفعل
          users = users.map((user) =>
            user.username === username ? { ...user, id: socket.id } : user
          );
          roomUsers.set(roomId, users);
          console.log(
            `📋 Updated socket.id for user ${username} in room ${roomId}:`,
            roomUsers.get(roomId)
          );
        }

        // إدارة participants في قاعدة البيانات مع تنظيف التكرارات
        const userInParticipants = room.participants.some(
          (p) => p.toLowerCase() === username.toLowerCase()
        );

        if (!userInParticipants) {
          room.participants.push(username);
          // تنظيف التكرارات قبل الحفظ
          room.participants = [...new Set(room.participants)];
          await room.save();
          console.log(
            `✅ Added ${username} to participants for room ${roomId} in database. Participants:`,
            room.participants
          );
        } else {
          // تنظيف التكرارات إذا وجدت
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
  });

  // لما مستخدم يغير اللغة
  socket.on("languageChange", async (data) => {
    const { language, roomId } = data;
    try {
      console.log("📝 Language changed to:", language, "for room:", roomId);
      roomLanguages.set(roomId, language); // تحديث اللغة في الذاكرة

      // تحديث اللغة في قاعدة البيانات
      const room = await Room.findOne({ roomId });
      if (room) {
        room.language = language;
        await room.save();
      }

      // إرسال التغيير لكل المستخدمين في الـ Room
      io.to(roomId).emit("languageChange", { language });
    } catch (error) {
      console.error("Error in languageChange:", error);
    }
  });

  // لما مستخدم يرسل كود
  socket.on("codeChange", async (data) => {
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
      const room = await Room.findOne({ roomId });
      if (room) {
        const versionNumber = room.versions.length + 1;
        room.versions.push({
          versionNumber,
          code,
          createdAt: new Date(),
        });
        await room.save();
        console.log(
          `📤 Broadcasting codeChange to room ${roomId} with username=${username}, versionNumber=${versionNumber}`
        );
        io.to(roomId).emit("codeChange", {
          code,
          roomId,
          username,
          versionNumber,
        });
      }
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

  // لما الـ Owner يغير إذن التعديل لمستخدم
  socket.on("toggleEditAccess", (data) => {
    const { roomId, username, canEdit } = data;
    const owner = roomOwners.get(roomId);

    // التحقق من إن الـ Socket هو بتاع الـ Owner بشكل أكثر أمانًا
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room || !roomOwners.has(roomId)) {
      // console.log(`Room ${roomId} not found or no owner set`);
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

      // تحديث حالة المستخدم في قايمة المستخدمين
      const users = roomUsers.get(roomId);
      const user = users.find((u) => u.username === username);
      if (user) {
        user.canEdit = canEdit;
        roomUsers.set(roomId, users);
      }

      // إرسال تحديث لكل المستخدمين
      io.to(roomId).emit("updateUsers", { users: roomUsers.get(roomId) });

      // إرسال حالة التعديل للمستخدم المستهدف
      const targetSocket = [...io.sockets.sockets.values()].find((s) => {
        const user = roomUsers
          .get(roomId)
          ?.find((u) => u.username === username);
        return user && s.id === user.id;
      });
      if (targetSocket) {
        // console.log(`📌 Updating editor mode for ${username}: canEdit=${canEdit}, readOnly=${!canEdit}`);
        targetSocket.emit("setEditorMode", { readOnly: !canEdit });
      }
    } else {
      // console.log(`Socket ${socket.id} is not the owner of room ${roomId}`);
    }
  });

  // لما مستخدم يطلب Access من الـ Admin
  socket.on("requestAccess", (data) => {
    const { roomId, username } = data;
    const owner = roomOwners.get(roomId);

    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room || !roomOwners.has(roomId)) {
      // console.log(`Room ${roomId} not found or no owner set`);
      return;
    }

    const socketsInRoom = [...room];
    const ownerSocket = socketsInRoom.find((socketId) => {
      const user = roomUsers.get(roomId)?.find((u) => u.username === owner);
      return user && socketId === user.id;
    });

    if (ownerSocket) {
      // console.log(`📌 Sending access request from ${username} to owner ${owner} (socket: ${ownerSocket})`);
      io.to(ownerSocket).emit("accessRequest", { username });
    }
  });

  // تشغيل الكود
  socket.on("runCode", (data) => {
    const { code, language, roomId } = data;
    let output = "";
    // console.log('📥 Received code to run:', { code, language });

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
      io.to(roomId).emit("codeOutput", { output }); // إرسال الـ Output لكل المستخدمين في الـ Room
    } else if (language === "python") {
      fs.writeFileSync("temp.py", code);
      // استخدام الأمر py مباشرة
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
        io.to(roomId).emit("codeOutput", { output }); // إرسال الـ Output لكل المستخدمين في الـ Room
        fs.unlinkSync("Main.java");
        if (fs.existsSync("Main.class")) {
          fs.unlinkSync("Main.class");
        }
      });
    } else {
      output = "Language not supported yet";
      io.to(roomId).emit("codeOutput", { output }); // إرسال الـ Output لكل المستخدمين في الـ Room
    }

    // console.log('📤 Sending output:', output);
  });

  socket.on("disconnect", () => {
    // console.log('🔌 User disconnected:', socket.id);
    // إزالة المستخدم من قايمة المستخدمين في الـ Room
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
