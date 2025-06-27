import User from "../models/User.js";
import Match from "../models/Match.js";
import mongoose from "mongoose";
import {getConnectedUsers, sendNotificationToUser} from "../utils/socket.js";

export const TestSocket = async (req, res) => {
    try {
        const userId = req.body.userId;
        sendNotificationToUser(userId, 'match!');
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};