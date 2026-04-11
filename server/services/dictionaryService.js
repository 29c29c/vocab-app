import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';

import { projectRoot } from '../../src/config/env.js';
import { AppError } from '../../src/utils/http.js';

const ENGLISH_DICTIONARY_PATH = path.join(projectRoot, 'server', 'dictionaries', 'en', 'main.sqlite');
const JAPANESE_DICTIONARY_PATH = path.join(projectRoot, 'server', 'dictionaries', 'ja', 'main.sqlite');

const dictionaryDbCache = new Map();
const dictionaryResultCache = new Map();
const DICTIONARY_CACHE_TTL_MS = 10 * 60 * 1000;

function createEmptyDictionaryResult(language, source) {
    return {
        definitions: [],
        examples: [],
        fetchedAt: new Date().toISOString(),
        language,
        partsOfSpeech: [],
        phonetic: '',
        reading: '',
        source
    };
}

function uniqueNonEmpty(items, limit) {
    const result = [];
    const seen = new Set();

    for (const item of items) {
        const normalized = String(item || '').trim();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(normalized);

        if (result.length === limit) break;
    }

    return result;
}

function readResultCache(key) {
    const cached = dictionaryResultCache.get(key);
    if (!cached) return null;

    if (cached.expiresAt <= Date.now()) {
        dictionaryResultCache.delete(key);
        return null;
    }

    return cached.value;
}

function writeResultCache(key, value) {
    dictionaryResultCache.set(key, {
        expiresAt: Date.now() + DICTIONARY_CACHE_TTL_MS,
        value
    });
}

function detectDictionaryLanguage({ word, sentence, languageHint }) {
    if (languageHint) return languageHint;

    const sample = `${word || ''} ${sentence || ''}`;
    if (/[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f]/.test(sample)) {
        return 'ja';
    }

    return 'en';
}

function openReadOnlyDatabase(filePath) {
    return new Promise((resolve, reject) => {
        const database = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, error => {
            if (error) {
                reject(error);
                return;
            }

            resolve(database);
        });
    });
}

function queryAll(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.all(sql, params, (error, rows) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(rows);
        });
    });
}

async function getLocalDictionaryDb(filePath) {
    const existing = dictionaryDbCache.get(filePath);
    if (existing) {
        return existing;
    }

    const database = await openReadOnlyDatabase(filePath);
    dictionaryDbCache.set(filePath, database);
    return database;
}

async function ensureDictionaryFile(filePath, missingMessage) {
    try {
        await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
        throw new AppError(503, missingMessage);
    }
}

function normalizeEnglishDictionaryResult(rows) {
    const payload = createEmptyDictionaryResult('en', 'local-en-sqlite');

    if (!rows.length) {
        return payload;
    }

    return {
        ...payload,
        definitions: uniqueNonEmpty(rows.map(row => row?.gloss), 3),
        examples: uniqueNonEmpty(rows.map(row => row?.example), 2),
        partsOfSpeech: uniqueNonEmpty(rows.map(row => row?.pos), 3),
        phonetic: uniqueNonEmpty(rows.map(row => row?.phonetic), 1)[0] || '',
        reading: uniqueNonEmpty(rows.map(row => row?.reading), 1)[0] || ''
    };
}

function normalizeJapaneseDictionaryResult(rows) {
    const payload = createEmptyDictionaryResult('ja', 'local-ja-sqlite');

    if (!rows.length) {
        return payload;
    }

    return {
        ...payload,
        definitions: uniqueNonEmpty(rows.map(row => row?.gloss), 3),
        examples: uniqueNonEmpty(rows.map(row => row?.example), 2),
        partsOfSpeech: uniqueNonEmpty(rows.map(row => row?.pos), 3),
        phonetic: uniqueNonEmpty(rows.map(row => row?.phonetic), 1)[0] || '',
        reading: uniqueNonEmpty(rows.map(row => row?.reading), 1)[0] || ''
    };
}

async function lookupLocalEnglishDictionary(word) {
    const normalizedWord = word.trim().toLowerCase();
    const cacheKey = `en:${normalizedWord}`;
    const cached = readResultCache(cacheKey);
    if (cached) {
        return cached;
    }

    await ensureDictionaryFile(ENGLISH_DICTIONARY_PATH, '英语本地词典未配置');

    let database;
    try {
        database = await getLocalDictionaryDb(ENGLISH_DICTIONARY_PATH);
    } catch (error) {
        dictionaryDbCache.delete(ENGLISH_DICTIONARY_PATH);
        throw new AppError(500, `英语词典加载失败: ${error.message}`);
    }

    const rows = await queryAll(
        database,
        `SELECT surface, reading, gloss, pos, priority, phonetic, example
         FROM entries
         WHERE LOWER(surface) = ? OR LOWER(reading) = ?
         ORDER BY CASE WHEN LOWER(surface) = ? THEN 0 ELSE 1 END ASC,
                  COALESCE(priority, 999999) ASC,
                  rowid ASC
         LIMIT 5`,
        [normalizedWord, normalizedWord, normalizedWord]
    ).catch(error => {
        throw new AppError(500, `英语词典查询失败: ${error.message}`);
    });

    const result = normalizeEnglishDictionaryResult(rows);
    writeResultCache(cacheKey, result);
    return result;
}

async function lookupLocalJapaneseDictionary(word) {
    const normalizedWord = word.trim();
    const cacheKey = `ja:${normalizedWord}`;
    const cached = readResultCache(cacheKey);
    if (cached) {
        return cached;
    }

    await ensureDictionaryFile(JAPANESE_DICTIONARY_PATH, '日语本地词典未配置');

    let database;
    try {
        database = await getLocalDictionaryDb(JAPANESE_DICTIONARY_PATH);
    } catch (error) {
        dictionaryDbCache.delete(JAPANESE_DICTIONARY_PATH);
        throw new AppError(500, `日语词典加载失败: ${error.message}`);
    }

    const rows = await queryAll(
        database,
        `SELECT surface, reading, gloss, pos, priority, phonetic, example
         FROM entries
         WHERE surface = ? OR reading = ?
         ORDER BY CASE WHEN surface = ? THEN 0 ELSE 1 END ASC,
                  COALESCE(priority, 999999) ASC,
                  rowid ASC
         LIMIT 5`,
        [normalizedWord, normalizedWord, normalizedWord]
    ).catch(error => {
        throw new AppError(500, `日语词典查询失败: ${error.message}`);
    });

    const result = normalizeJapaneseDictionaryResult(rows);
    writeResultCache(cacheKey, result);
    return result;
}

export async function lookupDictionary({ word, sentence, languageHint }) {
    const language = detectDictionaryLanguage({ word, sentence, languageHint });

    if (language === 'ja') {
        return lookupLocalJapaneseDictionary(word);
    }

    return lookupLocalEnglishDictionary(word);
}
