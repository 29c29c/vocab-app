export function createRateLimiter({ keyPrefix, maxRequests, message, windowMs }) {
    const hits = new Map();

    return (req, res, next) => {
        const now = Date.now();
        const key = `${keyPrefix}:${req.ip || 'unknown'}`;
        const entry = hits.get(key);

        if (!entry || entry.resetAt <= now) {
            hits.set(key, { count: 1, resetAt: now + windowMs });
            next();
            return;
        }

        if (entry.count >= maxRequests) {
            res.status(429).json({ error: message });
            return;
        }

        entry.count += 1;
        next();
    };
}
