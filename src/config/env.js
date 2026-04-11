import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const DEFAULT_PORT = 3001;
const DEFAULT_DB_NAME = 'database.sqlite';
const DEFAULT_DEV_JWT_SECRET = 'dev-insecure-jwt-secret-change-me';
const DEFAULT_DEV_INVITE_CODE = 'tes369';

function parsePort(value) {
    if (!value) return DEFAULT_PORT;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`PORT 配置无效: ${value}`);
    }
    return parsed;
}

function parseBoolean(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }

    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseCorsOrigins(value) {
    if (!value) return [];
    return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

const isProduction = process.env.NODE_ENV === 'production';
const distDir = path.join(projectRoot, 'dist');
const distExists = fs.existsSync(distDir);

const config = {
    env: process.env.NODE_ENV || 'development',
    isProduction,
    port: parsePort(process.env.PORT),
    jwtSecret: process.env.JWT_SECRET || DEFAULT_DEV_JWT_SECRET,
    systemInviteCode: process.env.SYSTEM_INVITE_CODE || DEFAULT_DEV_INVITE_CODE,
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
    dbPath: process.env.DB_PATH || path.join(projectRoot, DEFAULT_DB_NAME),
    serveStatic: parseBoolean(process.env.SERVE_STATIC, distExists),
    staticDir: distDir,
    logLevel: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    allowAllCors: !isProduction && !process.env.CORS_ORIGIN,
    smallJsonLimit: '256kb',
    largeJsonLimit: '50mb',
    authRateLimitWindowMs: 15 * 60 * 1000,
    loginMaxAttempts: 10,
    registerMaxAttempts: 5
};

if (!process.env.JWT_SECRET) {
    const message = '未配置 JWT_SECRET。';
    if (isProduction) {
        throw new Error(`${message} 生产环境禁止使用默认密钥。`);
    }
    console.warn(`${message} 当前仅使用开发默认值，请勿直接对公网部署。`);
}

if (!process.env.SYSTEM_INVITE_CODE) {
    const message = '未配置 SYSTEM_INVITE_CODE。';
    if (isProduction) {
        throw new Error(`${message} 生产环境禁止使用默认邀请码。`);
    }
    console.warn(`${message} 当前仅使用开发默认值，请勿直接对公网部署。`);
}

if (config.allowAllCors) {
    console.warn('未配置 CORS_ORIGIN，开发环境将允许所有跨域请求。');
}

if (config.serveStatic && !distExists) {
    const message = `静态资源目录不存在: ${config.staticDir}`;
    if (isProduction) {
        throw new Error(message);
    }
    console.warn(`${message}，已自动关闭静态资源托管。`);
    config.serveStatic = false;
}

export { config, projectRoot };
