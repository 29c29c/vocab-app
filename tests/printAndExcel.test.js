import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as XLSX from 'xlsx';
import { escapeHtml } from '../src/client/escapeHtml.js';

test('dictation text is escaped before inserting it into print markup', () => {
    assert.equal(escapeHtml('<img src="x" onerror=\'alert(1)\'>&'),
        '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;');
});

test('patched Excel library reads and writes a simple workbook', () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['单词', '释义'], ['hello', '你好']]), '词库');
    const bytes = XLSX.write(book, { bookType: 'xlsx', type: 'buffer' });
    const parsed = XLSX.read(bytes, { type: 'buffer' });
    assert.deepEqual(XLSX.utils.sheet_to_json(parsed.Sheets.词库), [{ 单词: 'hello', 释义: '你好' }]);
});
