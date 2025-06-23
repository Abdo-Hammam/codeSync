// routes/googleAuthRoutes.js
const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// تأكد إن Firebase Admin متهيأ مرة واحدة
if (!admin.apps.length) {
  const serviceAccount = require("../config/serviceAccountKey.json"); // عدل المسار حسب مكانه
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

router.post("/google-auth", async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    console.error("No idToken provided in request");
    return res.status(400).json({ message: "No idToken provided" });
  }

  try {
    console.log("Verifying idToken:", idToken);
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log("Decoded token:", decodedToken);
    const email = decodedToken.email;
    const name = decodedToken.name || "GoogleUser";

    let user = await User.findOne({ email });
    console.log("User found:", user);

    if (!user) {
      user = new User({
        email,
        username: name,
        password: null, // سيبها null لأن تسجيل الدخول بجوجل مش بيستخدم كلمة مرور
      });
      await user.save();
      console.log("New user saved:", user);
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, username: user.username },
      process.env.JWT_SECRET || "supersecretkey123",
      { expiresIn: "1h" }
    );

    res.status(200).json({ message: "Google login successful", token });
  } catch (error) {
    console.error("Error in Google Auth:", error.message, error.stack);
    res.status(401).json({ 
      message: "Error in Google authentication", 
      error: error.message
    });
  }
});


module.exports = router;
