import express from 'express';
import mongoose from 'mongoose';
import chalk from 'chalk';
import dotenv from 'dotenv';
import multer from 'multer';
import cors from 'cors';
import { createServer } from 'http';
import setupSocket from "./utils/socket.js"

import * as UserController from './controllers/UserController.js';
import * as ChatController from './controllers/ChatController.js';

dotenv.config();

const errorMsg = chalk.bgWhite.redBright;
const successMsg = chalk.bgGreen.white;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log(successMsg("DB ok")))
  .catch((err) => console.log(errorMsg("DB error:", err)));

const app = express();
const server = createServer(app); // Создаем HTTP-сервер
// const io = new Server(server, { cors: { origin: "*" } });
const io = setupSocket(server);

app.use(cors({ origin: '*', methods: ['GET', 'PATCH', 'POST', 'PUT', 'DELETE'], credentials: true }));
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// 📌 Добавляем маршруты API
app.post('/register', UserController.register);
app.post('/users/givepremium', UserController.givePremium);
app.post('/login', UserController.login);
app.post('/updateUserInfo/:id', UserController.updateUserInfo);
app.post('/auth/getUserById', UserController.getUserById);
app.post('/users/getCandidates', UserController.getTopUsers);
app.post('/users/react', UserController.reactToUser);
app.post('/users/getMatches', UserController.getUserMatches);
app.get('/users/getChats/:id', UserController.getChats);
app.post('/users/uploadPhoto', upload.single("photo"), UserController.uploadPhoto);
app.delete('/users/deletePhoto', UserController.deletePhoto);
app.patch('/users/:userId/hide', UserController.changeVisibility);
app.get('/users/:userId/notifications', UserController.getNotifications);
app.post('/getMessages', ChatController.getMessages);
app.post('/getLastMessage', ChatController.getLastMessage);
app.post('/getTelegramId', UserController.getTelegramId)
app.post('/getLikedUsers', UserController.getLikedUsers)
app.post('/send', ChatController.sendMessage);
app.post('/createInvoiceLink', UserController.createInvoiceLink);
app.delete('/user', UserController.deleteUser);
app.get('/ispremium/:id', UserController.isPremium);

const users = {};

const port = process.env.PORT || 3001;
server.listen(port, () => console.log(successMsg(`Listening on port: ${port}`)));
