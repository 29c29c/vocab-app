import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import * as inviteCodeRepository from '../repositories/inviteCodeRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import { isAdminUsername } from '../utils/admin.js';
import { AppError } from '../utils/http.js';

export async function registerUser({ inviteCode, password, username }, config) {
    const existingUser = await userRepository.findUserByUsername(username);
    if (existingUser) {
        throw new AppError(400, '用户名已存在');
    }

    const inviteCodeCount = await inviteCodeRepository.countInviteCodes();
    const isAdminBootstrap = inviteCodeCount === 0 && isAdminUsername(username, config);
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await inviteCodeRepository.createUserWithInviteCode({
        inviteCode,
        isAdminBootstrap,
        passwordHash,
        username
    });

    if (result?.failure === '用户名已存在') {
        throw new AppError(400, '用户名已存在');
    }

    if (result?.failure === '邀请码错误') {
        throw new AppError(403, '邀请码错误');
    }

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
