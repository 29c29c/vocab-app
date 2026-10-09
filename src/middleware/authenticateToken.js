import jwt from 'jsonwebtoken';
import * as revokedTokenRepository from '../repositories/revokedTokenRepository.js';

export function createAuthenticateToken(config) {
    return async (req, res, next) => {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            res.status(401).json({ error: '未登录' });
            return;
        }

        try {
            const user = jwt.verify(token, config.jwtSecret);
            if (!Number.isInteger(user.exp) || typeof user.jti !== 'string' || !user.jti) {
                throw new Error('令牌缺少有效期或操作 ID');
            }
            if (await revokedTokenRepository.isTokenRevoked(user.jti)) {
                throw new Error('令牌已注销');
            }
            req.user = user;
            next();
        } catch {
            res.status(401).json({ error: 'Token 无效' });
        }
    };
}
