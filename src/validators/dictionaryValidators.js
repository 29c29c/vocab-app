import { AppError } from '../utils/http.js';
import { pickAllowedKeys, readOptionalString, readRequiredString } from './helpers.js';

const ALLOWED_LANGUAGE_HINTS = new Set(['en', 'ja']);

export function validateDictionaryLookupPayload(body) {
    const input = pickAllowedKeys(body, ['languageHint', 'sentence', 'word']);
    const languageHint = input.languageHint === undefined || input.languageHint === null || input.languageHint === ''
        ? undefined
        : readRequiredString(input.languageHint, '语言提示', { maxLength: 8 }).toLowerCase();

    if (languageHint && !ALLOWED_LANGUAGE_HINTS.has(languageHint)) {
        throw new AppError(400, '语言提示格式错误');
    }

    return {
        languageHint,
        sentence: readOptionalString(input.sentence, '例句'),
        word: readRequiredString(input.word, '单词', { maxLength: 255 })
    };
}
