import { AppError } from '../utils/http.js';

export function errorHandler(error, _req, res, next) {
    if (res.headersSent) {
        next(error);
        return;
    }

    if (error?.type === 'entity.parse.failed') {
        res.status(400).json({ error: '请求体 JSON 格式错误' });
        return;
    }

    if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
    }

    console.error('未处理错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
}
