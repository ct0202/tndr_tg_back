import express from 'express';
import mongoose from 'mongoose';
import chalk from 'chalk';
import dotenv from 'dotenv';
import multer from 'multer';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

import * as UserController from './controllers/UserController.js';
import * as ChatController from './controllers/ChatController.js';
import User from './models/User.js';

dotenv.config();

const errorMsg = chalk.bgWhite.redBright;
const successMsg = chalk.bgGreen.white;

// Подключение к базе данных
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log(successMsg("DB ok")))
  .catch((err) => console.log(errorMsg("DB error:", err)));

const app = express();
const server = createServer(app); // Создаем HTTP-сервер
const io = new Server(server, { cors: { origin: "*" } }); // WebSocket сервер

app.use(cors({ origin: '*', methods: ['GET', 'PATCH', 'POST', 'PUT', 'DELETE'], credentials: true }));
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage });

// 📌 Добавляем маршруты API
app.post('/register', UserController.register);
app.post('/login', UserController.login);
app.post('/updateUserInfo/:id', UserController.updateUserInfo);
app.post('/auth/getUserById', UserController.getUserById);
app.post('/users/getCandidates', UserController.getTopUsers);
app.post('/users/react', UserController.reactToUser);
app.post('/users/getMatches', UserController.getUserMatches);
app.get('/users/getChats/:id', UserController.getChats);
app.post('/users/uploadPhoto', upload.single("photo"), UserController.uploadPhoto);

app.post('/getMessages', ChatController.getMessages);
app.post('/getLastMessage', ChatController.getLastMessage);

app.post('/getTelegramId', UserController.getTelegramId)
app.post('/getLikedUsers', UserController.getLikedUsers)

// 📌 WebSocket логика
const users = {}; // Связь userId -> { socketId, online }

io.on("connection", (socket) => {
    console.log(`Пользователь подключен: ${socket.id}`);

    socket.on("joinChat", async (userId) => {
        users[userId] = { socketId: socket.id, online: true };

        await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() });

        io.emit("userStatus", { userId, online: true, lastSeen: null });
    });

    socket.on("sendMessage", async ({ senderId, receiverId, message }) => {
        const receiverSocketId = users[receiverId]?.socketId; // Исправлено!

        const savedMessage = await ChatController.saveMessage(senderId, receiverId, message);

        if (receiverSocketId) {
            io.to(receiverSocketId).emit("receiveMessage", savedMessage);
        }
        io.to(users[senderId]?.socketId).emit("receiveMessage", savedMessage); // Теперь отправитель тоже получает сообщение
    });

    socket.on("disconnect", async () => {
        for (let userId in users) {
            if (users[userId].socketId === socket.id) {
                delete users[userId];

                const lastSeen = new Date();
                await User.findByIdAndUpdate(userId, { online: false, lastSeen });

                io.emit("userStatus", { userId, online: false, lastSeen });
                break;
            }
        }
    });
});


// Запуск сервера
const port = process.env.PORT || 3001;
server.listen(port, () => console.log(successMsg(`Listening on port: ${port}`)));
