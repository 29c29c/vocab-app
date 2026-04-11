import { isAdminUsername } from '../utils/admin.js';

export function createRequireAdmin(config) {
    return (req, res, next) => {
        if (!isAdminUsername(req.user?.username, config)) {
            res.status(403).json({ error: '仅管理员可访问' });
            return;
        }

        next();
    };
}
