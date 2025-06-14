import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import User from '../models/User.js'; // Убедитесь, что путь правильный
import Match from "../models/Match.js";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import mongoose from 'mongoose';
import sharp from 'sharp';
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

const bucketName = process.env.BUCKET_NAME;
const bucketRegion = process.env.BUCKET_REGION;
const accessKey = process.env.ACCESS_KEY;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;

const s3 = new S3Client({
  credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretAccessKey,
  },
  region: bucketRegion,
});



export const createInvoiceLink = async (req, res) => {
  try {
    const { type } = req.body;

    const planMap = {
      "1_week": {
      title: "Подписка Премиум",
      description: "7 дней подписки Премиум",
      priceRub: 200,
      amount: 20000,
      label: "Подписка на неделю",
      start_parameter: "premium7days",
      subscription_period: (7*24*3600)
      },
      "1_month": {
      title: "Подписка Премиум",
      description: "1 месяц подписки Премиум",
      priceRub: 500,
      amount: 50000,
      label: "Подписка на 1 месяц",
      start_parameter: "premium1month",
      subscription_period: (30*24*3600)
      },
      "3_months": {
      title: "Подписка Премиум",
      description: "3 месяца подписки Премиум",
      priceRub: 1200,
      amount: 120000,
      label: "Подписка на 3 месяца",
      start_parameter: "premium3months",
      subscription_period: (90*24*3600)
      }
    };

    const plan = planMap[type];

    if (!plan) {
      return res.status(400).json({ message: "Invalid subscription type." });
    }

    const result = await axios.post(
      `https://api.telegram.org/bot8193869137:AAHPVzF7MoMnpXK73bYOptLZSUSKqPjiSZk/createInvoiceLink`,
      {
        title: plan.title,
        description: plan.description,
        payload: type,
        provider_token: "390540012:LIVE:70096",
        currency: "RUB",
        prices: [{ label: plan.label, amount: plan.amount }],
        need_email: true,
        send_email_to_provider: true,
        need_phone_number: true,
        send_phone_number_to_provider: true,
        // subscription_period: 30*24*60*60,
        // recurring: true,
        // test:true,
        start_parameter: plan.start_parameter,
        provider_data: JSON.stringify({
          receipt: {
          items: [
            {
            description: plan.label,
            quantity: 1,
            amount: {
              value: plan.priceRub,
              currency: "RUB"
            },
            vat_code: 1,
            payment_mode: "full_payment",
            payment_subject: "service"
            }
          ],
          tax_system_code: 1
          }
        })
      });

    res.status(200).json(result.data);
  } catch (error) {
    console.error("Failed to createInvoiceLink:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const changeVisibility = async (req, res) => {
  try {
    // 1. Получаем данные из запроса
    const { userId } = req.params; // Или из токена, если это текущий пользователь
    const { hidden } = req.body;

    // 2. Валидация входных данных
    if (typeof hidden !== 'boolean') {
      return res.status(400).json({
        message: 'Некорректное значение hidden - должно быть boolean'
      });
    }

    // 3. Поиск и обновление пользователя
    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { hidden },
        { new: true }
    );

    // 4. Проверка существования пользователя
    if (!updatedUser) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // 5. Отправка успешного ответа
    res.status(200).json({
      message: `Ваш аккаунт ${hidden ? 'скрыт' : 'активен'}`,
      user: updatedUser
    });

  } catch (error) {
    console.error('Ошибка при изменении статуса пользователя:', error);

    // Обработка ошибки валидации ID
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Некорректный ID пользователя' });
    }

    res.status(500).json({
      message: 'Произошла ошибка на сервере',
      error: error.message
    });
  }
};

export const register = async (req, res) => {
  try {
    // const newUser = new User({
    //   name: req.body.name,
    //   birthDay: req.body.birthDay,
    //   birthMonth: req.body.birthMonth,
    //   birthYear: req.body.birthYear,
    //   gender: req.body.gender,
    //   height: req.body.height,
    //   location: req.body.location,
    //   wantToFind: req.body.wantToFind,
    //   goal: req.body.goal,
    //   telegramId: req.body.telegramId,
    //   city: req.body.city
    // });
    //
    // // Сохранение пользователя в базе данных
    // const savedUser = await newUser.save();
    //
    const savedUser = await User.findOneAndUpdate(
        { telegramId: req.body.telegramId}, // Поиск по telegramId
        {
          name: req.body.name,
          birthDay: req.body.birthDay,
          birthMonth: req.body.birthMonth,
          birthYear: req.body.birthYear,
          gender: req.body.gender,
          height: req.body.height,
          location: req.body.location,
          wantToFind: req.body.wantToFind,
          goal: req.body.goal,
          city: req.body.city,
          referal: req.body.referal || null,
        },
        { new: true, upsert: true } // new - возвращает обновленный объект, upsert - создает, если нет
    );
    console.log(savedUser);
    // Генерация токена
    const token = jwt.sign({ _id: savedUser._id }, 'secret123', { expiresIn: '30d' });

    // Ответ клиенту
    res.json({ token, ...savedUser._doc });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Не удалось зарегистрироваться' });
  }
};

export const login = async (req, res) => {
    try {
      // Поиск пользователя по email
      const user = await User.findOne({ email: req.body.email });
  
      if (!user) {
        return res.status(404).json({ message: 'Пользователь не найден' });
      }
  
      // Проверка пароля
      const isPasswordValid = await bcrypt.compare(req.body.password, user.password);
  
      if (!isPasswordValid) {
        return res.status(400).json({ message: 'Неверный логин или пароль' });
      }
  
      // Генерация JWT
      const token = jwt.sign({ _id: user._id }, 'secret123', { expiresIn: '30d' });
      

      // Возвращаем данные пользователя без пароля
      const { password, ...userData } = user._doc;
      res.json({ token, ...userData });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Не удалось войти в аккаунт' });
    }
  };

export const updateUserInfo = async (req, res) => {
    try {
      const userId = req.params.id;

      const activate =  req.body.activate;
      console.log(activate);

  
      // Получаем текущего пользователя
      const user = await User.findById(userId);
  
      if (!user) {
        return res.status(404).json({ message: 'Пользователь не найден' });
      }
  
      // Формируем данные для обновления или добавления
      const updateData = {};
      const updatableFields = ['name', 'gender', 'photo1', 'photo2', 'photo3', 'height', 'goal', 'location', 'about', 'city', 'birthDay', 'birthMonth', 'birthYear', 'referal'];
  
      updatableFields.forEach((field) => {
        // Если параметр передан, обновляем его
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
        // Если параметр не передан и его нет в документе, добавляем с пустым значением
        else if (user[field] === undefined) {
          updateData[field] = ''; // Или любое значение по умолчанию
        }
      });

      if (activate && activate === true) {
        updateData['activated'] = true;
        console.log('update data with activate field  === > ', updateData);
      }
  
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        updateData, // Обновляем/добавляем данные
        { new: true } // Возвращаем обновленный объект
      );
  
      res.json({ message: 'Информация обновлена', user: updatedUser });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Не удалось обновить информацию' });
    }
  };

// export const uploadPhoto = async (req, res) => {
//   const { userId } = req.query;
//   const index = parseInt(req.query.index, 10); // Determine which photo field to update
//
//   if (!mongoose.Types.ObjectId.isValid(userId) || isNaN(index) || index < 0 || index > 2) {
//     return res.status(400).json({ error: 'Некорректные параметры' });
//   }
//
//   try {
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ error: 'Пользователь не найден' });
//     }
//
//     // Upload file to S3
//     const buffer = await sharp(req.file.buffer).toBuffer();
//     const imageName = `${userId}_${Date.now()}_${index}`;
//
//     const params = {
//       Bucket: bucketName,
//       Key: imageName,
//       Body: buffer,
//       ContentType: req.file.mimetype,
//     };
//
//     const command = new PutObjectCommand(params);
//     await s3.send(command);
//
//     // Update the user's photo field
//     const photoField = `photo${index + 1}`; // photo1, photo2, photo3
//     user[photoField] = imageName;
//     await user.save();
//
//     res.json({ message: 'Фото успешно загружено', user });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Ошибка при загрузке фото' });
//   }
// };



export const deletePhoto = async (req, res) => {
  try {
    const { userId } = req.query;
    const index = Number(req.query.index);

    if (!mongoose.Types.ObjectId.isValid(userId) || !Number.isInteger(index) || index < 0 || index > 2) {
      return res.status(400).json({ error: "Некорректные параметры" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    const photoField = `photo${index + 1}`;
    const imageName = user[photoField];

    if (!imageName) {
      return res.status(400).json({ error: "Фото не найдено" });
    }

    // Удаляем фото из S3
    const deleteParams = {
      Bucket: bucketName,
      Key: imageName,
    };

    await s3.send(new DeleteObjectCommand(deleteParams));

    // Обновляем пользователя, удаляя ссылку на фото
    await User.updateOne(
        { _id: userId },
        { $unset: { [photoField]: "" } }
    );

    return res.json({ message: "Фото успешно удалено" });
  } catch (error) {
    console.error("Ошибка в deletePhoto:", error);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
};

// export const uploadPhoto = async (req, res) => {
//   try {
//     const { userId } = req.query;
//     const index = Number(req.query.index);
//     console.log("Old Method: index =", index);

//     if (!req.file) {
//       return res.status(400).json({ error: "Файл не загружен" });
//     }

//     console.log("Old Method: original file size =", req.file.size);

//     const user = await User.findById(userId);
//     if (!user) {
//       console.error("пользователь не найден");
//       return res.status(404).json({ error: "Пользователь не найден" });
//     }

//     const buffer = await sharp(req.file.buffer).toFormat("png").toBuffer();
//     console.log("Old Method: optimized PNG buffer size =", buffer.length);

//     const imageName = `${userId}_${Date.now()}_${index}`;

//     const params = {
//       Bucket: bucketName,
//       Key: imageName,
//       Body: buffer,
//       ContentType: "image/png",
//     };

//     await s3.send(new PutObjectCommand(params));

//     const photoField = `photo${index + 1}`;
//     user[photoField] = imageName;
//     console.log('Old Method: saving photo for userId =', user._id);
//     console.log('Old Method: photo field name =>', photoField);

//     await User.updateOne(
//         { _id: userId },
//         { $set: { [photoField]: imageName } }
//     );

//     const getObjectParams = { Bucket: bucketName, Key: imageName };
//     const resPhotoUrl = await getSignedUrl(s3, new GetObjectCommand(getObjectParams), { expiresIn: 3600 });

//     return res.json({ message: "Фото успешно загружено", user, photoUrl: resPhotoUrl });
//   } catch (error) {
//     console.error("Ошибка в uploadPhoto:", error);
//     return res.status(500).json({ error: "Внутренняя ошибка сервера" });
//   }
// };


export const uploadPhoto = async (req, res) => {
  try {
    const { userId } = req.query;
    const index = Number(req.query.index);

    console.log("New Method: Received upload request for userId:", userId, "with index:", index);

    if (!req.file) {
      console.warn("New Method: No file received in request");
      return res.status(400).json({ error: "Файл не загружен" });
    }

    console.log("New Method: original file size =", req.file.size, "File name:", req.file.originalname);

    const user = await User.findById(userId);
    if (!user) {
      console.error("New Method: Пользователь не найден для userId:", userId);
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    console.log("New Method: Пользователь найден:", user._id);

    const buffer = await sharp(req.file.buffer)
      .resize({ width: 1080 })
      .webp({ quality: 50 })
      .toBuffer();

    console.log("New Method: optimized WebP buffer size =", buffer.length);

    const imageName = `${userId}_${Date.now()}_${index}.webp`;
    console.log("New Method: Generated image name:", imageName);

    const params = {
      Bucket: bucketName,
      Key: imageName,
      Body: buffer,
      ContentType: "image/webp",
    };

    console.log("New Method: Uploading to S3...");
    await s3.send(new PutObjectCommand(params));
    console.log("New Method: Upload successful");

    const photoField = `photo${index + 1}`;
    user[photoField] = imageName;

    console.log("New Method: Updating user document. Field:", photoField, "Value:", imageName);

    await User.updateOne(
      { _id: userId },
      { $set: { [photoField]: imageName } }
    );

    console.log("New Method: User document updated");

    const getObjectParams = { Bucket: bucketName, Key: imageName };
    const resPhotoUrl = await getSignedUrl(s3, new GetObjectCommand(getObjectParams), { expiresIn: 3600 });

    console.log("New Method: Generated signed URL for photo:", resPhotoUrl);

    return res.json({ message: "Фото успешно загружено", user, photoUrl: resPhotoUrl });
  } catch (error) {
    console.error("Ошибка в uploadPhoto:", error);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
};


export const getUserById = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.body.userId });

    if (!user) {
      return res.json({ message: "Пользователь не найден" });
    }

    // Генерация ссылок для каждого изображения в портфолио
    const portfolioUrls = await Promise.all(
      [user?.photo1, user?.photo2, user?.photo3]
        .filter((key) => !!key) // Фильтруем только не null/undefined значения
        .map(async (key) => {
          const getObjectParams = {
            Bucket: bucketName,
            Key: key,
          };
          const command = new GetObjectCommand(getObjectParams);
          const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // Можно сделать ссылки постоянными
          return url;
        })
    );

    const invitedCount = await User.countDocuments({ referal: req.body.userId });
    if (invitedCount == 3 && user.referalPremiumEnded !== true) {
      let durationMs = 2 * 7 * 24 * 60 * 60 * 1000;
      let expiresAt = new Date(Date.now() + durationMs);
      user.premium.isActive = true;
      user.premium.expiresAt = new Date(expiresAt.getTime() + durationMs);
      user.referalPremiumEnded = true;
      await user.save();
    }

    user.photos = portfolioUrls;
    // console.log(portfolioUrls);

    const token = jwt.sign(
      {
        _id: user._id,
      },
      'secret123',
      {
        expiresIn: "30d",
      }
    );

    const { ...userData } = user._doc;
    res.json({
      ...userData,
      token,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Ошибка при получении данных пользователя",
    });
  }
};

export const getTopUsers = async (req, res) => {
  try {
    const { userId, filters } = req.body;

    // Получаем текущего пользователя
    const currentUser = await User.findById(userId).select('likes dislikes birthYear location');

    if (!currentUser) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Собираем ID пользователей, которых он уже оценил
    const ratedUserIds = new Set([...currentUser.likes, ...currentUser.dislikes, userId]);

    // Текущий год для расчета возраста
    const currentYear = new Date().getFullYear();

    // Формируем запрос с учетом фильтров
    let query = {
      _id: { $nin: Array.from(ratedUserIds) },
      hidden: { $ne: true }
    };

    if (filters.age != null) {
      const minYear = currentYear - filters.age[1]; // Верхний возрастной порог (например, 38 → родился в 1986)
      const maxYear = currentYear - filters.age[0]; // Нижний возрастной порог (например, 18 → родился в 2006)
      query.birthYear = { $gte: minYear.toString(), $lte: maxYear.toString() };
    }

    if (filters.gender != null) {
      query.gender = filters.gender;
    }

    if (filters.status != null) {
      query.goal = filters.status;
    }

    // Получаем пользователей по отфильтрованному запросу
    
    let users = await User.find(query);

    // Фильтрация по расстоянию (если передан параметр distance)
    if (filters.distance != null && currentUser.location) {
      const [curLat, curLon] = currentUser.location.split(',').map(Number);
      // console.log("дошло")


      users = users.filter(user => {
        if (!user.location) return false;

        const [userLat, userLon] = user.location.split(',').map(Number);
        const distance = getDistance(curLat, curLon, userLat, userLon);

        return distance <= filters.distance;
      });
    }

    if (users.length === 0) {
      return res.json([]);
    }

    // Вычисляем рейтинг (лайки + дизлайки) / просмотры
    const usersWithEngagement = users.map(user => ({
      ...user._doc,
      engagement: (user.likesReceived + user.dislikesReceived) / (user.profileViews || 1),
    }));

    // Сортируем по engagement
    usersWithEngagement.sort((a, b) => b.engagement - a.engagement);

    // Оставляем только 10 пользователей
    // const finalUserList = usersWithEngagement.slice(0, 10);
    const finalUserList = usersWithEngagement;

    // Генерация ссылок для изображений пользователей
    const ratedUsers = await Promise.all(
      finalUserList.map(async (user) => {
        const portfolioUrls = await Promise.all(
          [user?.photo1, user?.photo2, user?.photo3]
            .filter((key) => !!key)
            .map(async (key) => {
              const getObjectParams = {
                Bucket: bucketName,
                Key: key,
              };
              const command = new GetObjectCommand(getObjectParams);
              const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
              return url;
            })
        );

        return { ...user, photos: portfolioUrls };
      })
    );

    res.json(ratedUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка при получении пользователей' });
  }
};
// Функция для расчета расстояния между двумя точками (Haversine Formula)
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Радиус Земли в км
  const toRad = (angle) => (angle * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Возвращает расстояние в км
};

export const getTelegramId = async (req, res) => {
  const initData = req.body.initData;
  // console.log(req.body.initData)

  try {
    let existingUser = await User.findOne({ telegramId: initData });

    if (existingUser) {
      return res.json({ status: 'Пользователь с таким Telegram ID уже существует.', user: existingUser });
    }

    // Создаем нового пользователя, если не найден
    const newUser = new User({
      telegramId: initData
    });

    await newUser.save();

    return res.json({ 
      status: 'Новый пользователь создан.', 
      user: newUser, 
      telegramId: newUser.telegramId 
    });

  } catch (error) {
    console.error('Ошибка при обработке данных:', error);
    return res.status(500).json({ error: 'Ошибка при обработке initData.' });
  }
};

export const reactToUser = async (req, res) => {
  try {
    const { userId, targetUserId, action } = req.body;

    if (!userId || !targetUserId || !['like', 'dislike', 'superlike'].includes(action)) {
      return res.status(400).json({ message: 'Некорректные данные' });
    }

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);
    const match = new Match({ person1Id: userId, person2Id: targetUserId });

    const targetUserIdObj = new mongoose.Types.ObjectId(targetUserId);
    const userIdObj = new mongoose.Types.ObjectId(userId);


    if (!user || !targetUser) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    let isMatch = false;

    if (action === 'superlike') {

      //open chats
      // await User.findByIdAndUpdate(userId, {$addToSet: {chats: targetUserId}});
      await User.findByIdAndUpdate(targetUserId, {$addToSet: {chats: userId}});

      if (!user.likes.includes(targetUserId)) {

        user.likes.push(targetUserId);
        user.superlikes.push(targetUserId);
        user.likesGiven += 1;
        targetUser.likesReceived += 1;

        // Добавляем userId в likedBy у targetUser
        if (!targetUser.likedBy.includes(userId)) {
          targetUser.likedBy.push(userId);
          targetUser.superlikedBy.push(userId);
        }

        // Проверяем, лайкал ли targetUser этого пользователя (мэтч)
        if (targetUser.likes.includes(userId)) {
          isMatch = true;

          const existingMatch = await Match.findOne({
            $or: [
              {person1Id: userId, person2Id: targetUserId},
              {person1Id: targetUserId, person2Id: userId}
            ]
          });

          await User.findByIdAndUpdate(userIdObj, {
            $pull: {
              likedBy: targetUserIdObj,
              superlikedBy: targetUserIdObj
            }
          });

          await User.findByIdAndUpdate(targetUserIdObj, {
            $pull: {
              likedBy: userIdObj,
              superlikedBy: userIdObj
            }
          });

          if (!existingMatch) {
            const match = new Match({person1Id: userId, person2Id: targetUserId, status: "match"});
            await match.save();



          }
        }

      }
    }

    if (action === 'like') {
      if (!user.likes.includes(targetUserId)) {

        user.likes.push(targetUserId);
        user.likesGiven += 1;
        targetUser.likesReceived += 1;

        // Добавляем userId в likedBy у targetUser
        if (!targetUser.likedBy.includes(userId)) {
          targetUser.likedBy.push(userId);
        }

        // Проверяем, лайкал ли targetUser этого пользователя (мэтч)
        if (targetUser.likes.includes(userId)) {
          isMatch = true;

          const existingMatch = await Match.findOne({
            $or: [
              { person1Id: userId, person2Id: targetUserId },
              { person1Id: targetUserId, person2Id: userId }
            ]
          });

          await User.findByIdAndUpdate(userIdObj, {
            $pull: {
              likedBy: targetUserIdObj,
              superlikedBy: targetUserIdObj
            }
          });

          await User.findByIdAndUpdate(targetUserIdObj, {
            $pull: {
              likedBy: userIdObj,
              superlikedBy: userIdObj
            }
          });

          if (!existingMatch) {
            const match = new Match({ person1Id: userId, person2Id: targetUserId, status: "match" });
            await match.save();


          }
        }

      }
    } else {
      if (!user.dislikes.includes(targetUserId)) {
        user.dislikes.push(targetUserId);
        user.dislikesGiven += 1;
        targetUser.dislikesReceived += 1;
      }
    }

    await user.save();
    await targetUser.save();


    res.json({
      message: `Вы ${action === 'like' ? 'лайкнули' : 'дизлайкнули'} пользователя`,
      isMatch,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const getLikedUsers = async (req, res) => {
  try {
    const { userIds, currentUserId } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(200).json({ message: "Некорректный список пользователей" });
    }

    // Получаем текущего пользователя для определения его местоположения
    const currentUser = await User.findById(currentUserId).select("location dislikes likes");
    if (!currentUser || !currentUser.location) {
      return res.status(404).json({ message: "Текущий пользователь не найден или без локации" });
    }

    const [curLat, curLon] = currentUser.location.split(",").map(Number);

    let users = await User.find({ _id: { $in: userIds } });


    if (users.length === 0) {
      return res.json([]);
    }

    // Фильтруем пользователей, которых текущий юзер дизлайкнул
    users = users.filter(user =>
        !(currentUser.dislikes || []).some(dislikeId =>
            dislikeId.equals(user._id)
        )
    );

    users = users.filter(user =>
        !(currentUser.likes || []).some(likeId =>
            likeId.equals(user._id)
        )
    );


    // Получаем пользователей по ID
    // let users = await User.find({ _id: { $in: userIds } });

    if (users.length === 0) {
      return res.json([]);
    }

    // Генерация ссылок на фото пользователей из AWS S3
    const usersWithPhotos = await Promise.all(
      users.map(async (user) => {
        const photoUrls = await Promise.all(
          [user.photo1, user.photo2, user.photo3]
            .filter(Boolean)
            .map(async (key) => {
              try {
                const getObjectParams = {
                  Bucket: bucketName,
                  Key: key,
                };
                const command = new GetObjectCommand(getObjectParams);
                return await getSignedUrl(s3, command, { expiresIn: 3600 });
              } catch (error) {
                console.error("Ошибка при генерации ссылки:", error);
                return null;
              }
            })
        );

        // Расчет расстояния до текущего пользователя
        let km = null;
        if (user.location) {
          const [userLat, userLon] = user.location.split(",").map(Number);
          km = getDistance(curLat, curLon, userLat, userLon);
        }

        return { ...user._doc, photos: photoUrls.filter(Boolean), km: km ? `${km} км` : "Неизвестно" };
      })
    );

    res.json(usersWithPhotos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Ошибка при получении списка пользователей" });
  }
};

export const getChats = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId)
        .populate("chats", "name") // Подгружаем только `name`
        .select("name chats");

    console.log(user);

    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    res.json(user.chats); // Отправляем список чатов
  } catch (err) {
    console.error("Ошибка при получении чатов:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
};

export const getUserMatches = async (req, res) => {
  try {
    const {userId} = req.body;
    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res.status(404).json({message: "Пользователь не найден"});
    }

    // Находим все мэтчи, где участвует текущий пользователь
    const matches = await Match.find({
      $or: [{person1Id: userId}, {person2Id: userId}],
    });

    // Извлекаем ID пользователей, с которыми есть мэтч
    const matchedUserIds = matches.map((match) =>
        match.person1Id === userId ? match.person2Id : match.person1Id
    );

    // Загружаем данные о пользователях
    const matchedUsers = await User.find({_id: {$in: matchedUserIds}});

    // Генерируем ссылки на фото из S3
    const usersWithPhotos = await Promise.all(
        matchedUsers.map(async (matchedUser) => {
          const photoUrls = await Promise.all(
              [matchedUser.photo1]
                  .filter(Boolean)
                  .map(async (photoKey) => {
                    try {
                      const getObjectParams = {
                        Bucket: bucketName,
                        Key: photoKey,
                      };
                      const command = new GetObjectCommand(getObjectParams);
                      return await getSignedUrl(s3, command, {expiresIn: 3600});
                    } catch (error) {
                      console.error("Ошибка при генерации ссылки:", error);
                      return null;
                    }
                  })
          );

          return {...matchedUser.toObject(), photos: photoUrls};
        })
    );

    res.json(usersWithPhotos);
  } catch (err) {
    console.error(err);
    res.status(500).json({message: "Ошибка при получении списка мэтчей"});
  }
};
// Multer Middleware Setup
// const upload = multer({ storage: multer.memoryStorage() });

export const getNotifications = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Получаем все relevant матчи
    const matches = await Match.find({
      $or: [
        { person1Id: userId, status: 'match' },
        { person2Id: userId, status: 'match' },
        { person2Id: userId, status: 'waiting' }
      ]
    })
        .sort({ createdAt: -1 })
        .populate({
          path: 'person1Id',
          select: 'name photo1 city',
          model: User
        })
        .populate({
          path: 'person2Id',
          select: 'name photo1 city',
          model: User
        });

    // Форматируем в unified notifications
    const notifications = await Promise.all(
        matches.map(async (match) => {
          const isLike = match.status === 'waiting';
          const otherUser = match.person1Id._id.equals(userId)
              ? match.person2Id
              : match.person1Id;

          // Получаем только первую фотографию
          const firstPhotoKey = otherUser.photo1
          console.log(firstPhotoKey);
          let firstPhotoUrl = null;

          if (firstPhotoKey) {
            try {
              const getObjectParams = {
                Bucket: bucketName,
                Key: firstPhotoKey,
              };
              const command = new GetObjectCommand(getObjectParams);
              firstPhotoUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
            } catch (error) {
              console.error("Ошибка при генерации ссылки:", error);
            }
          }

          return {
            type: isLike ? 'like' : 'match',
            user: {
              _id: otherUser._id,
              name: otherUser.name,
              photos: firstPhotoUrl ? [firstPhotoUrl] : [],
              city: otherUser.city
            },
            createdAt: match.createdAt,
            matchId: match._id,
            status: match.status
          };
        })
    );

    // Сортируем по времени (хотя уже отсортировано в запросе)
    notifications.sort((a, b) => b.createdAt - a.createdAt);

    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({
      message: error.message || 'Error fetching notifications'
    });
  }
};

export const givePremium = async (req, res) => {
  try {
    const { telegramId, duration } = req.body;
    console.log("GIVE PREMIUM");
    console.log(telegramId, duration);

    if (!telegramId || !duration) {
      return res.status(400).json({ message: "telegramId and duration are required." });
    }

    const user = await User.findOne({telegramId});
    console.log("found user:",user);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Calculate expiration based on current or existing expiry
    const now = new Date();
    const currentExpiry = user.premium.expiresAt && user.premium.expiresAt > now
      ? new Date(user.premium.expiresAt)
      : now;

    let durationMs;

    switch (duration) {
      case "1_week":
        durationMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case "1_month":
        durationMs = 30 * 24 * 60 * 60 * 1000;
        break;
      case "3_months":
        durationMs = 90 * 24 * 60 * 60 * 1000;
        break;
      default:
        return res.status(400).json({ message: "Invalid duration. Use 'week', 'month', or '3months'." });
    }

    console.log("duration cases passed", durationMs);

    user.premium.isActive = true;
    user.premium.expiresAt = new Date(currentExpiry.getTime() + durationMs);

    await user.save();

    console.log("user after save", user);

    res.json({
      message: `Premium activated for ${duration}`,
      premium: user.premium
    });

  } catch (error) {
    console.error("Failed to give premium:", error);
    res.status(500).json({ message: "Server error" });
  }
}



export const deleteUser = async (req, res) => {
  try {
    const { telegramId } = req.body;
    const db_res = await User.deleteOne({telegramId: telegramId});
    if (db_res.deletedCount != 1){
      res.status(404).json({message: "User not found."});
    }
    res.status(200).json({message: "User deleted successfully." });
  }
  catch (error) {
    console.error("Failed to delete user:", error);
    res.status(500).json({ message: "Server error. Failed to delete user:", error });
  }
}

export const isPremium = async (req, res) => {
  try {
    const id = req.params;
    console.log("isPremium id:", id);
    const user = await User.findById(id.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    const now = new Date();
    const isActive = user.premium.isActive;
    res.status(200).json({ isPremium: isActive, expiresAt: user.premium.expiresAt });
  }
  catch (error) {
    console.error("Failed to check premium status:", error);
    res.status(500).json({ message: "Server error. Failed to check premium status:", error });
  }
}

export const cancelPremium = async (req, res) => {
  try {
    const id = req.params;
    console.log("cancelPremium id:", id);
    const user = await User.findById(id.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    user.premium.isActive = false;
    user.premium.expiresAt = null;
    await user.save();
    res.status(200).json({ message: "Premium subscription cancelled successfully." });
  }
  catch (error) {
    console.error("Failed to cancel premium subscription:", error);
    res.status(500).json({ message: "Server error. Failed to cancel premium subscription:", error });
  }
}

export const getInvitedCount = async (req, res) => {
  try {
    const id = req.params;
    console.log("cancelPremium id:", id);
    const user = await User.findById(id.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    const invitedCount = await User.countDocuments({ referal: id.id });
    console.log("Invited count for user:", invitedCount, "userId:", id.id);
    res.status(200).json({ invitedCount: invitedCount });
  }
  catch (error) {
    console.error("Failed to get invited count:", error);
    res.status(500).json({ message: "Server error. Failed to get invited count:", error });
  }
}
// export const activateUser = async (req, res) => {
//   try {
//     const {telegramId} = req.body;
//     const db_res = await User.updateOne({telegramId: telegramId});
//     if (db_res.updatedCount != 1) {
//       console.error("Failed to activate user:", error);
//       res.status(500).json({message: "Server error. Failed to activate user:", error});
//     }
//     res.status(200).json({message: "User activated successfully." });
//   }
//   catch (error) {
//     console.error("Failed to activate user:", error);
//     res.status(500).json({message: "Server error. Failed to activate user:", error});
//   }
// }