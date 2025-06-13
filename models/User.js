import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
    },
    birthDay: String,
    birthMonth: String,
    birthYear: String,
    gender: String,
    height: Number,
    location: String,
    wantToFind: String,
    goal: String,
    photo1: String,
    photo2: String,
    photo3: String,
    city: String,
    likedBy: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    superlikedBy: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    about: {
        type: String,
        default: ""
    },
    role: {
        type: String,
        default: "user"
    },
    photos: {
        type: [String],
        default: []
    },
    likes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    dislikes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    superlikes: {type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    telegramId: { type: Number, unique: true },
    likesReceived: { type: Number, default: 0 },
    dislikesReceived: { type: Number, default: 0 },
    profileViews: { type: Number, default: 0 },
    userActivity: { type: Number, default: 0 },
    likesGiven: { type: Number, default: 0 },
    dislikesGiven: { type: Number, default: 0 },
    activated: { type: Boolean, default: false},
    hidden: { type: Boolean, default: false },
    referal: { type: String, default: null },
    referalPremiumEnded: { type: Boolean, default: false },

    //активность юзера, данные из сокетов
    online: { type: Boolean, default: false },
    lastSeen: { type: Date, default: null },

    premium: {
        isActive: { type: Boolean, default: false },
        expiresAt: { type: Date, default: null },
    },

    //открытые чаты
    chats: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
}, {
    timestamps: true,
});

export default mongoose.model('User', UserSchema);