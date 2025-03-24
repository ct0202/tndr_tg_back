import { Server } from "socket.io";
import User from "../models/User.js";
import * as ChatController from "../controllers/ChatController.js";

const users = {}; // Связь userId -> socketId

export default function setupSocket(server) {
    const io = new Server(server, { cors: { origin: "*" } });

    io.on("connection", (socket) => {
        console.log(`Пользователь подключен: ${socket.id}`);

        socket.on("joinChat", async (userId) => {
            users[userId] = { socketId: socket.id, online: true };

            // Обновляем в БД статус пользователя
            await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() });

            io.emit("userStatus", { userId, online: true, lastSeen: null });
        });

        socket.on("sendMessage", async ({ senderId, receiverId, message }) => {
            const receiverSocket = users[receiverId];

            // Сохранение в базу данных
            const savedMessage = await ChatController.saveMessage(senderId, receiverId, message);

            if (receiverSocket) {
                io.to(receiverSocket.socketId).emit("receiveMessage", savedMessage);
            }

            socket.emit("messageSent", savedMessage)

        });

        socket.on("disconnect", async () => {
            for (let userId in users) {
                if (users[userId].socketId === socket.id) {
                    delete users[userId];

                    // Сохраняем время выхода
                    const lastSeen = new Date();
                    await User.findByIdAndUpdate(userId, { online: false, lastSeen });

                    io.emit("userStatus", { userId, online: false, lastSeen });
                    break;
                }
            }
        });
    });

    return io;
}
