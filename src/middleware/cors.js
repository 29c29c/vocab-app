import cors from 'cors';

export function createCorsMiddleware(config) {
    return cors((req, callback) => {
        const requestOrigin = req.headers.origin;

        if (!requestOrigin) {
            callback(null, { origin: false });
            return;
        }

        if (config.allowAllCors) {
            callback(null, {
                allowedHeaders: ['Authorization', 'Content-Type'],
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                origin: true
            });
            return;
        }

        const allowed = config.corsOrigins.includes(requestOrigin);
        callback(null, {
            allowedHeaders: ['Authorization', 'Content-Type'],
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            origin: allowed
        });
    });
}
