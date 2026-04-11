将运行时英语词典 SQLite 文件放在这里，默认文件名为 `main.sqlite`。

当前运行时约定的最小表结构如下：

```sql
CREATE TABLE entries (
    surface TEXT,
    reading TEXT,
    gloss TEXT,
    pos TEXT,
    priority INTEGER,
    phonetic TEXT,
    example TEXT
);

CREATE INDEX idx_entries_surface ON entries(surface);
CREATE INDEX idx_entries_reading ON entries(reading);
```

说明：

- `gloss` 建议直接存最简短的中文释义，这样前端可以直接展示。
- `phonetic` 建议存英语音标。
- `reading` 可留空，或用于你自己的发音文本字段。
