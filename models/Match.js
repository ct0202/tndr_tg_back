import mongoose from "mongoose";

const matchSchema = new mongoose.Schema(
    {
        person1Id: { type: String, required: true }, // Строковый ID
        person2Id: { type: String, required: true }, // Строковый ID
        status: { type: String, enum: ["waiting", "match"], default: "waiting" },
    },
    { timestamps: true }
);

export default mongoose.model("Match", matchSchema);
