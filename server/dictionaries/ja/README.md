将运行时日语词典 SQLite 文件放在这里，默认文件名为 `main.sqlite`。

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

本次只预留运行时查询接口，不包含 `.mdx -> sqlite` 转换脚本。
