import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import * as userRepository from '../repositories/userRepository.js';
import { AppError } from '../utils/http.js';

export async function registerUser({ inviteCode, password, username }, config) {
    if (inviteCode !== config.systemInviteCode) {
        throw new AppError(403, '邀请码错误');
    }

    const existingUser = await userRepository.findUserByUsername(username);
    if (existingUser) {
        throw new AppError(400, '用户名已存在');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await userRepository.createUser({ passwordHash, username });

    return { message: '注册成功', success: true };
}

export async function loginUser({ password, username }, config) {
    const user = await userRepository.findUserByUsername(username);
    if (!user) {
        throw new AppError(400, '用户不存在');
    }

    const passwordMatched = await bcrypt.compare(password, user.password);
    if (!passwordMatched) {
        throw new AppError(400, '密码错误');
    }

    const token = jwt.sign({ id: user.id, username: user.username }, config.jwtSecret);
    return { success: true, token, username: user.username };
}
