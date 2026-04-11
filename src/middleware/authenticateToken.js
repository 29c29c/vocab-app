import jwt from 'jsonwebtoken';

export function createAuthenticateToken(config) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            res.status(401).json({ error: '未登录' });
            return;
        }

        try {
            const user = jwt.verify(token, config.jwtSecret);
            req.user = user;
            next();
        } catch {
            res.status(403).json({ error: 'Token 无效' });
        }
    };
}
