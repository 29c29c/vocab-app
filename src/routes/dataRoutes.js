import { Router } from 'express';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';

import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import * as dataService from '../services/dataService.js';
import { getTodayDateString } from '../client/reviewScheduler.js';
import { validateLegacyImportPayload } from '../validators/dataValidators.js';

const gzipAsync = promisify(gzip);

async function sendDataResponse(req, res, payload, queryDurationMs) {
    const serializeStartedAt = performance.now();
    const json = JSON.stringify(payload);
    const serializeDurationMs = performance.now() - serializeStartedAt;
    res.type('json');
    res.vary('Accept-Encoding');
    res.setHeader('Server-Timing', `query;dur=${queryDurationMs.toFixed(1)},serialize;dur=${serializeDurationMs.toFixed(1)}`);
    if (req.acceptsEncodings('gzip') && Buffer.byteLength(json) >= 4096) {
        res.setHeader('Content-Encoding', 'gzip');
        res.send(await gzipAsync(json));
    } else {
        res.send(json);
    }
}

export function createDataRouter({ authenticateToken, jsonParsers }) {
    const router = Router();

    router.get(
        '/data/bootstrap',
        authenticateToken,
        asyncHandler(async (req, res) => {
            const startedAt = performance.now();
            const bootstrap = await dataService.getReviewBootstrap(req.user.id, getTodayDateString());
            await sendDataResponse(req, res, bootstrap, performance.now() - startedAt);
        }, '获取复习数据失败')
    );

    router.get(
        '/data',
        authenticateToken,
        asyncHandler(async (req, res) => {
            const startedAt = performance.now();
            const records = await dataService.getUserData(req.user.id);
            res.setHeader('ETag', dataService.getDataEtag(records));
            await sendDataResponse(req, res, records, performance.now() - startedAt);
        }, '获取数据失败')
    );

    router.post(
        '/data',
        authenticateToken,
        jsonParsers.large,
        validateBody(validateLegacyImportPayload),
        asyncHandler(async (req, res) => {
            const result = await dataService.replaceUserData(req.user.id, req.validatedBody, req.get('If-Match'));
            res.json(result);
        }, '保存失败')
    );

    return router;
}
