import express from 'express';
import path from 'path';

import { createAuthenticateToken } from './middleware/authenticateToken.js';
import { createCorsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createJsonParsers } from './middleware/jsonParsers.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createAiRouter } from './routes/aiRoutes.js';
import { createDataRouter } from './routes/dataRoutes.js';
import { createRecordRouter } from './routes/recordRoutes.js';
import { createSettingsRouter } from './routes/settingsRoutes.js';

export function createApp({ config }) {
    const app = express();
    const authenticateToken = createAuthenticateToken(config);
    const jsonParsers = createJsonParsers(config);

    app.disable('x-powered-by');
    app.use(securityHeaders);
    app.use(createCorsMiddleware(config));

    const loginRateLimiter = createRateLimiter({
        keyPrefix: 'login',
        maxRequests: config.loginMaxAttempts,
        message: '登录过于频繁，请稍后再试',
        windowMs: config.authRateLimitWindowMs
    });

    const registerRateLimiter = createRateLimiter({
        keyPrefix: 'register',
        maxRequests: config.registerMaxAttempts,
        message: '注册过于频繁，请稍后再试',
        windowMs: config.authRateLimitWindowMs
    });

    app.use('/api', createAuthRouter({
        config,
        jsonParsers,
        loginRateLimiter,
        registerRateLimiter
    }));
    app.use('/api', createSettingsRouter({ authenticateToken, jsonParsers }));
    app.use('/api', createAiRouter({ authenticateToken, jsonParsers }));
    app.use('/api', createDataRouter({ authenticateToken, jsonParsers }));
    app.use('/api', createRecordRouter({ authenticateToken, jsonParsers }));

    app.use('/api', (_req, res) => {
        res.status(404).json({ error: '接口不存在' });
    });

    if (config.serveStatic) {
        app.use(express.static(config.staticDir));
        app.get(/(.*)/, (_req, res) => {
            res.sendFile(path.join(config.staticDir, 'index.html'));
        });
    } else {
        app.get(/(.*)/, (_req, res) => {
            res.status(404).json({
                error: '当前仅启动了 API 服务，未启用静态页面托管或 dist 不存在'
            });
        });
    }

    app.use(errorHandler);

    return app;
}
