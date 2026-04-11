import sqlite3 from 'sqlite3';

import { config } from '../config/env.js';

async function openDatabase(dbPath) {
    return new Promise((resolve, reject) => {
        const database = new sqlite3.Database(dbPath, error => {
            if (error) {
                reject(error);
                return;
            }

            resolve(database);
        });
    });
}

const db = await openDatabase(config.dbPath);

function rawRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(error) {
            if (error) {
                reject(error);
                return;
            }

            resolve(this);
        });
    });
}

function rawGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(row);
        });
    });
}

function rawAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(rows);
        });
    });
}

function rawExec(sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, error => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

async function ensureColumn(tableName, columnName, definition) {
    const columns = await rawAll(`PRAGMA table_info(${tableName})`);
    const hasColumn = columns.some(column => column.name === columnName);
    if (!hasColumn) {
        await rawRun(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
}

async function initializeDatabase() {
    await rawExec('PRAGMA foreign_keys = ON;');

    await rawExec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            settings TEXT
        );

        CREATE TABLE IF NOT EXISTS records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT,
            word TEXT,
            sentence TEXT,
            custom_meaning TEXT,
            ai_analysis TEXT,
            ai_image TEXT,
            reading TEXT,
            review_stage INTEGER DEFAULT 0,
            next_review_date TEXT,
            mastered INTEGER DEFAULT 0,
            mastered_date TEXT,
            needs_reading_practice INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        );

        CREATE TABLE IF NOT EXISTS invite_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            max_uses INTEGER NOT NULL,
            used_count INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_by_user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by_user_id) REFERENCES users (id)
        );
    `);

    await ensureColumn('users', 'settings', 'TEXT');
    await ensureColumn('records', 'custom_meaning', 'TEXT');
    await ensureColumn('invite_codes', 'used_count', 'INTEGER DEFAULT 0');
    await ensureColumn('invite_codes', 'is_active', 'INTEGER DEFAULT 1');
    await ensureColumn('invite_codes', 'created_by_user_id', 'INTEGER');

    await rawExec(`
        CREATE INDEX IF NOT EXISTS idx_records_user_id
        ON records(user_id);

        CREATE INDEX IF NOT EXISTS idx_records_user_next_review_date
        ON records(user_id, next_review_date);

        CREATE INDEX IF NOT EXISTS idx_invite_codes_code
        ON invite_codes(code);
    `);

    console.log('✅ 数据库表结构与索引已就绪');
}

const databaseReady = initializeDatabase();

export async function run(sql, params = []) {
    await databaseReady;
    return rawRun(sql, params);
}

export async function get(sql, params = []) {
    await databaseReady;
    return rawGet(sql, params);
}

export async function all(sql, params = []) {
    await databaseReady;
    return rawAll(sql, params);
}

export function prepare(sql) {
    return db.prepare(sql);
}

export function runStatement(statement, params = []) {
    return new Promise((resolve, reject) => {
        statement.run(params, function onStatementRun(error) {
            if (error) {
                reject(error);
                return;
            }

            resolve(this);
        });
    });
}

export function finalizeStatement(statement) {
    return new Promise((resolve, reject) => {
        statement.finalize(error => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

export async function withTransaction(callback) {
    await databaseReady;

    await rawRun('BEGIN TRANSACTION');
    try {
        const result = await callback({
            all: rawAll,
            finalizeStatement,
            get: rawGet,
            prepare,
            run: rawRun,
            runStatement
        });
        await rawRun('COMMIT');
        return result;
    } catch (error) {
        try {
            await rawRun('ROLLBACK');
        } catch (rollbackError) {
            console.error('事务回滚失败:', rollbackError);
        }
        throw error;
    }
}

export { databaseReady };
export default db;
