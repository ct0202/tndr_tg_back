import Chat from '../models/Chat.js';
import User from '../models/User.js';
import mongoose from "mongoose";

export const saveMessage = async (senderId, receiverId, message) => {
    try {
        const newMessage = new Chat({ senderId, receiverId, message });
        await newMessage.save();

        // Добавляем receiverId в chats у senderId
        await User.findByIdAndUpdate(senderId, { $addToSet: { chats: receiverId } });

        // Добавляем senderId в chats у receiverId
        await User.findByIdAndUpdate(receiverId, { $addToSet: { chats: senderId } });

        return newMessage;
    } catch (err) {
        console.error("Ошибка при сохранении сообщения:", err);
        return null;
    }
};

export const sendMessage = async (req, res) => {
    try {
        console.log(req.body);
        const { senderId, receiverId, message } = req.body;

        const newMessage = new Chat({
            senderId, receiverId, message
        });

        const [savedMessage] = await Promise.all([
            newMessage.save(),
            // User.findByIdAndUpdate(
            //     senderId,
            //     { $addToSet: { chats: receiverId } },
            //     { new: true }
            // ).exec(),
            User.findByIdAndUpdate(
                receiverId,
                { $addToSet: { chats: senderId } },
                { new: true }
            ).exec()
        ]);

        res.status(201).json({
            success: true,
            message: 'Сообщение успешно отправлено',
        });

    } catch (err) {
        console.error('Ошибка при отправке сообщения:', err);
        res.status(500).json({
            success: false,
            message: 'Внутренняя ошибка сервера',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};


export const getMessages = async (req, res) => {
    try {
        const { userId, receiverId } = req.body;

        if (!userId || !receiverId) {
            return res.status(400).json({ message: "Не указан userId или receiverId" });
        }

        console.log("Полученный userId:", userId);
        console.log("Полученный receiverId:", receiverId);

        await Chat.updateMany(
            { senderId: receiverId, receiverId: userId, status: "delivered" },
            { $set: { status: "read" } }
        );

        const messages = await Chat.find({
            $or: [
                { senderId: userId, receiverId: receiverId },
                { senderId: receiverId, receiverId: userId }
            ]
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) {
        console.error("Ошибка при получении сообщений:", err);
        res.status(500).json({ message: "Ошибка при загрузке чата" });
    }
};



export const getLastMessage = async (req, res) => {
    try {
        const { userId, receiverId } = req.body;

        if (!userId || !receiverId) {
            return res.status(400).json({ message: "Не указан userId или receiverId" });
        }

        // console.log("Полученный userId:", userId);
        // console.log("Полученный receiverId:", receiverId);

        const lastMessage = await Chat.findOne({
            $or: [
                { senderId: userId, receiverId: receiverId },
                { senderId: receiverId, receiverId: userId }
            ]
        }).sort({ createdAt: -1 });

        // console.log("Последнее сообщение:", lastMessage);

        res.json(lastMessage || { message: "Сообщений нет" });
    } catch (err) {
        console.error("Ошибка при получении последнего сообщения:", err);
        res.status(500).json({ message: "Ошибка при загрузке последнего сообщения" });
    }
};


