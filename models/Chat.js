import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
      senderId: { type: String, required: true }, // Строковый ID
      receiverId: { type: String, required: true }, // Строковый ID
      message: { type: String, required: true },
      status: { type: String, enum: ["delivered", "read"], default: "delivered" },
  },
  { timestamps: true }
);

export default mongoose.model("Chat", chatSchema);
