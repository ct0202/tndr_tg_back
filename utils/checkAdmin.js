import UserModel from '../models/User.js';
import jwt from 'jsonwebtoken'

export default async (req, res, next) => {
    const token = (req.headers.authorization || '').replace(/Bearer\s?/, '');
    if(token){
        try {
            const user = await UserModel.findOne({ role: "admin" });
            if(!user){
                return res.status(404).json({
                    message: "нет Доступа"
                })
            }
            const decoded = jwt.verify(token, 'secret123')
            if(decoded._id == user._id){
                next();
            }else{
                return res.status(404).json({
                    message: "нет Доступа"
                })
            }
        } catch (error) {
            console.log(error);
            return res.status(500).json({
                message: "Ошибка проверки роли",
            });
        }
    }else{
        return res.status(500).json({
            message: "Ошибка проверки роли",
        });
    }
};
