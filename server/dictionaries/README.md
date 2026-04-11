这里放两类东西：

- 原始离线词典源文件，例如 `.mdx`
- 本机运行的离线转换脚本

当前提供的转换脚本：

- [convert_mdx_to_sqlite.py](./convert_mdx_to_sqlite.py)
- [convert_mdx_to_sqlite_gui.py](./convert_mdx_to_sqlite_gui.py)
- [launch_converter_gui.bat](./launch_converter_gui.bat)
- [launch_converter_gui.command](./launch_converter_gui.command)

它不会参与网站运行时，只用于你在本机把 `.mdx` 转成网站会读取的 SQLite。

使用前需要先在本机安装 `pyglossary`：

```bash
python3 -m pip install pyglossary
```

如果你的某些 MDX 词典导出失败，可能还需要按 `pyglossary` 的提示补额外依赖。

示例：

```bash
python3 server/dictionaries/convert_mdx_to_sqlite.py \
  --source "server/dictionaries/[汉-英] ◆【简明汉英词典】【2011.8.12】【庆大运】.mdx" \
  --language en
```

```bash
python3 server/dictionaries/convert_mdx_to_sqlite.py \
  --source "server/dictionaries/[1其他语种] 三合一日語辭典《新日汉大辞典》、《实用汉日辞典》、 《详解日本外来语辞典》[172761](090126).mdx" \
  --language ja
```

默认输出：

- 英语：`server/dictionaries/en/main.sqlite`
- 日语：`server/dictionaries/ja/main.sqlite`

## GUI 使用

如果你是在本机上手动操作，推荐直接运行 GUI：

```bash
python3 server/dictionaries/convert_mdx_to_sqlite_gui.py
```

Windows 下也可以直接双击：

```text
server/dictionaries/launch_converter_gui.bat
```

macOS 下也可以直接双击：

```text
server/dictionaries/launch_converter_gui.command
```

GUI 支持：

- 选择 `.mdx` 源文件
- 选择英语 / 日语
- 自定义输出 SQLite 路径
- 限制导入条数
- 保留中间 `tabfile` 以便排查
