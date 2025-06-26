const express = require("express");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const router = express.Router();
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");

router.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    console.log("Signup request:", { username, email });

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("User already exists:", email);
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Hashed password:", hashedPassword);

    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();

    console.log("User saved:", newUser);

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email, username: newUser.username },
      process.env.JWT_SECRET || "supersecretkey123",
      { expiresIn: "3h" }
    );
    console.log("Generated token for signup:", token);

    res.status(201).json({ message: "User registered successfully", token });
  } catch (error) {
    console.error("Error in signup:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users", error });
  }
});

router.post("/login", async (req, res) => {
  try {
    console.log("Incoming login request:", req.body);

    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      console.log("User not found for email:", email);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("Found user:", user.email);
    console.log("Entered password:", password);
    console.log("Stored hashed password:", user.password);

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password match result:", isMatch);

    if (!isMatch) {
      console.log("Incorrect password for user:", email);
      return res.status(401).json({ message: "Incorrect password" });
    }

    console.log("Password matched, generating token...");

    const token = jwt.sign(
      { id: user._id, email: user.email, username: user.username },
      process.env.JWT_SECRET || "supersecretkey123",
      { expiresIn: "3h" }
    );
    console.log("Generated token for login:", token);

    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Error logging in", error });
  }
});

router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Error fetching user profile", error });
  }
});

const findUserByEmail = async (email) => {
  try {
    const user = await User.findOne({ email });
    return user;
  } catch (error) {
    console.error("Error finding user by email:", error);
    throw error;
  }
};

const resetUserPassword = async (email, newPassword) => {
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found for email:", email);
      return null;
    }
    console.log("Found user for password reset:", user.email);
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log("New hashed password:", hashedPassword);
    user.password = hashedPassword;
    user.markModified("password");
    await user.save();
    console.log("Password updated in database:", {
      email,
      newHashedPassword: user.password,
    });
    return user;
  } catch (error) {
    console.error("Error resetting password:", error);
    throw error;
  }
};

module.exports = {
  router,
  findUserByEmail,
  resetUserPassword,
};
