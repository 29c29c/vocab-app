#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if command -v python3 >/dev/null 2>&1; then
  exec python3 "$SCRIPT_DIR/convert_mdx_to_sqlite_gui.py"
fi

if command -v python >/dev/null 2>&1; then
  exec python "$SCRIPT_DIR/convert_mdx_to_sqlite_gui.py"
fi

osascript -e 'display dialog "未找到 Python，请先安装 Python 3 后再运行这个启动器。" buttons {"好"} default button "好"'
