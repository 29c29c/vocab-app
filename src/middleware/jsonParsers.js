import express from 'express';

export function createJsonParsers(config) {
    return {
        large: express.json({ limit: config.largeJsonLimit }),
        small: express.json({ limit: config.smallJsonLimit })
    };
}
