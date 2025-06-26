import { Server } from "socket.io";
import User from "../models/User.js";
import * as ChatController from "../controllers/ChatController.js";

const users = {}; // Связь userId -> socketId

let ioGlobal = null;

export function getConnectedUsers() {
    return users;
}

export function sendNotificationToUser(userId, payload) {
    console.log("sendNotificationToUser", userId, payload);
    console.log("все подключенные юзеры: ", users, " ; искомый юзер: ", userId);
    const user = users[userId];
    console.log("Проверка юзера перед отправкой = ", user);
    if (user && ioGlobal) {
        console.log("Отправляю уведомление: ", user);
        ioGlobal.to(user.socketId).emit("notification", payload);
        return true;
    }
    return false;
}

export default function setupSocket(server) {
    const io = new Server(server, { cors: { origin: "*" } });
    ioGlobal = io;

    io.on("connection", (socket) => {
        console.log(`Пользователь подключен: ${socket.id}`);

        socket.on("joinChat", async (userId) => {
            users[userId] = { socketId: socket.id, online: true };
            console.log("from joinChat, users: ", users);

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

        socket.on("notification", ({ receiverId, payload }) => {
            const receiverSocket = users[receiverId];

            if (receiverSocket) {
                io.to(receiverSocket.socketId).emit("notification", payload);
            }
        })
    });

    return io;
}
