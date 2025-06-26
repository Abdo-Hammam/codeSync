const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  owner: { type: String, required: true },
  password: { type: String, default: "" },
  language: { type: String, default: "javascript" },
  lastOpened: { type: Date, default: Date.now },
  participants: {
    type: [String],
    default: [],
  },
  versions: {
    type: [
      {
        versionNumber: Number,
        code: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    default: [],
  },
});

const Room = mongoose.model("Room", roomSchema);
module.exports = Room;