#!/usr/bin/env python3
"""
Convert local .mdx dictionary files into the SQLite shape used by the app.

This script is intentionally offline-only and is not used by the website runtime.

Dependencies:
  1. Python 3.9+
  2. pyglossary installed locally on the machine that runs this script

Example:
  python3 server/dictionaries/convert_mdx_to_sqlite.py \
    --source "server/dictionaries/[汉-英] ◆【简明汉英词典】【2011.8.12】【庆大运】.mdx" \
    --language en

  python3 server/dictionaries/convert_mdx_to_sqlite.py \
    --source "server/dictionaries/[1其他语种] 三合一日語辭典《新日汉大辞典》、《实用汉日辞典》、 《详解日本外来语辞典》[172761](090126).mdx" \
    --language ja
"""

from __future__ import annotations

import argparse
import html
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Callable, Iterable


ROOT_DIR = Path(__file__).resolve().parents[2]
DICTIONARIES_DIR = Path(__file__).resolve().parent
DEFAULT_TARGETS = {
    "en": DICTIONARIES_DIR / "en" / "main.sqlite",
    "ja": DICTIONARIES_DIR / "ja" / "main.sqlite",
}

EN_POS_PATTERN = re.compile(
    r"\b(noun|verb|adjective|adverb|pronoun|preposition|conjunction|interjection|article|determiner|auxiliary)\b",
    re.IGNORECASE,
)
JA_READING_PATTERN = re.compile(r"[ぁ-ゖァ-ヺー]+")
EN_PHONETIC_PATTERN = re.compile(r"(/[^/\n]+/|\[[^\]\n]+\])")
HTML_TAG_PATTERN = re.compile(r"<[^>]+>")
MULTI_SPACE_PATTERN = re.compile(r"[ \t]+")
ENTRY_SPLIT_PATTERN = re.compile(r"[\u3000;,/|]+")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert .mdx to app SQLite dictionary.")
    parser.add_argument("--source", required=True, help="Path to the source .mdx file.")
    parser.add_argument(
        "--language",
        required=True,
        choices=["en", "ja"],
        help="Dictionary language. Determines output path and parsing heuristics.",
    )
    parser.add_argument(
        "--target",
        help="Optional output SQLite path. Defaults to server/dictionaries/<lang>/main.sqlite",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Optional max number of entries to import. 0 means no limit.",
    )
    parser.add_argument(
        "--keep-tabfile",
        action="store_true",
        help="Keep the intermediate exported .txt tabfile for debugging.",
    )
    return parser.parse_args()


def ensure_pyglossary() -> str:
    pyglossary_bin = shutil.which("pyglossary")
    if pyglossary_bin:
        return pyglossary_bin

    try:
        result = subprocess.run(
            [sys.executable, "-m", "pyglossary", "--help"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    except OSError:
        result = None

    if result and result.returncode == 0:
        return f"{sys.executable} -m pyglossary"

    raise SystemExit(
        "未检测到 pyglossary。\n"
        "请先在本机安装，例如：python3 -m pip install pyglossary\n"
        "安装后重新运行本脚本。"
    )


def run_pyglossary_export(pyglossary_cmd: str, source: Path, output_txt: Path) -> None:
    if pyglossary_cmd.endswith(" -m pyglossary"):
        command = [sys.executable, "-m", "pyglossary"]
    else:
        command = [pyglossary_cmd]

    command.extend(
        [
            str(source),
            str(output_txt),
            "--read-format=OctopusMdict",
            "--write-format=Tabfile",
            "--remove-html-all",
        ]
    )

    completed = subprocess.run(command, cwd=str(ROOT_DIR), check=False)
    if completed.returncode != 0 or not output_txt.exists():
        raise SystemExit(
            "pyglossary 导出失败。\n"
            "如果你的 MDX 词典比较特殊，可能还需要额外依赖，例如某些词典需要 lzo 相关支持。"
        )


def ensure_parent_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def normalize_text(value: str) -> str:
    decoded = html.unescape(value or "")
    decoded = decoded.replace("\r\n", "\n").replace("\r", "\n")
    decoded = decoded.replace("<br/>", "\n").replace("<br />", "\n").replace("<br>", "\n")
    decoded = HTML_TAG_PATTERN.sub(" ", decoded)
    decoded = MULTI_SPACE_PATTERN.sub(" ", decoded)
    decoded = re.sub(r"\n{3,}", "\n\n", decoded)
    return decoded.strip()


def split_lines(value: str) -> list[str]:
    return [line.strip(" \t-•·") for line in normalize_text(value).split("\n") if line.strip(" \t-•·")]


def normalize_surface(word: str) -> str:
    cleaned = html.unescape(word or "").strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def choose_gloss(lines: list[str], language: str) -> str:
    if not lines:
        return ""

    if language == "en":
        for line in lines:
            if re.search(r"[\u4e00-\u9fff]", line):
                return line[:240]
        return lines[0][:240]

    for line in lines:
        if re.search(r"[\u4e00-\u9fff]", line):
            return line[:240]
    return lines[0][:240]


def choose_example(lines: list[str], gloss: str) -> str:
    for line in lines:
        normalized = line.strip()
        if not normalized or normalized == gloss:
            continue
        if len(normalized) >= 12:
            return normalized[:400]
    return ""


def choose_pos(lines: list[str], language: str) -> str:
    if language == "en":
        for line in lines[:8]:
            match = EN_POS_PATTERN.search(line)
            if match:
                return match.group(1).lower()
    else:
        for line in lines[:8]:
            if any(token in line for token in ["名词", "名詞", "动词", "動詞", "形容词", "形容詞", "副词", "副詞", "接续", "助词", "助詞"]):
                return line[:64]
    return ""


def choose_phonetic(word: str, lines: list[str], language: str) -> str:
    sample_text = "\n".join([word] + lines[:5])

    if language == "en":
        match = EN_PHONETIC_PATTERN.search(sample_text)
        return match.group(1) if match else ""

    return ""


def choose_reading(word: str, lines: list[str], language: str) -> str:
    if language == "ja":
        title_match = JA_READING_PATTERN.search(word)
        if title_match:
            return title_match.group(0)

        for line in lines[:6]:
            match = JA_READING_PATTERN.search(line)
            if match:
                return match.group(0)

        return ""

    return ""


def iter_tabfile_entries(tabfile_path: Path) -> Iterable[tuple[str, str]]:
    with tabfile_path.open("r", encoding="utf-8", errors="replace") as handle:
        for raw_line in handle:
            line = raw_line.rstrip("\n")
            if not line or "\t" not in line:
                continue

            headword, definition = line.split("\t", 1)
            headword = headword.strip()
            definition = definition.strip()
            if not headword or not definition:
                continue

            yield headword, definition


def extract_surfaces(headword: str) -> list[str]:
    normalized = normalize_surface(headword)
    if not normalized:
        return []

    surfaces = []
    seen = set()
    for part in ENTRY_SPLIT_PATTERN.split(normalized):
        cleaned = part.strip()
        if not cleaned:
            continue
        lowered = cleaned.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        surfaces.append(cleaned)

    if not surfaces:
        return [normalized]
    return surfaces[:5]


def init_sqlite(target: Path) -> sqlite3.Connection:
    ensure_parent_dir(target)
    if target.exists():
        target.unlink()

    connection = sqlite3.connect(str(target))
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA synchronous = NORMAL")
    connection.executescript(
        """
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
        """
    )
    return connection


def import_tabfile_to_sqlite(tabfile_path: Path, target: Path, language: str, limit: int) -> int:
    connection = init_sqlite(target)
    inserted = 0

    try:
        with connection:
            for headword, definition in iter_tabfile_entries(tabfile_path):
                lines = split_lines(definition)
                gloss = choose_gloss(lines, language)
                pos = choose_pos(lines, language)
                phonetic = choose_phonetic(headword, lines, language)
                reading = choose_reading(headword, lines, language)
                example = choose_example(lines, gloss)
                surfaces = extract_surfaces(headword)

                for surface in surfaces:
                    connection.execute(
                        """
                        INSERT INTO entries (
                            surface,
                            reading,
                            gloss,
                            pos,
                            priority,
                            phonetic,
                            example
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            surface,
                            reading,
                            gloss,
                            pos,
                            1000,
                            phonetic,
                            example,
                        ),
                    )
                    inserted += 1

                    if limit > 0 and inserted >= limit:
                        return inserted
    finally:
        connection.close()

    return inserted


def convert_mdx_to_sqlite(
    source: str | Path,
    language: str,
    target: str | Path | None = None,
    limit: int = 0,
    keep_tabfile: bool = False,
    logger: Callable[[str], None] | None = None,
) -> Path:
    log = logger or print
    source_path = Path(source).expanduser().resolve()
    if language not in DEFAULT_TARGETS:
        raise SystemExit(f"不支持的语言类型: {language}")
    if limit < 0:
        raise SystemExit("limit 不能小于 0")
    if not source_path.exists():
        raise SystemExit(f"源文件不存在: {source_path}")

    target_path = Path(target).expanduser().resolve() if target else DEFAULT_TARGETS[language]
    pyglossary_cmd = ensure_pyglossary()

    with tempfile.TemporaryDirectory(prefix="mdx-to-sqlite-") as temp_dir:
        temp_dir_path = Path(temp_dir)
        tabfile_path = temp_dir_path / f"{source_path.stem}.txt"

        log(f"[1/3] 导出 MDX -> Tabfile: {source_path}")
        run_pyglossary_export(pyglossary_cmd, source_path, tabfile_path)

        if keep_tabfile:
            debug_tabfile = target_path.with_suffix(".txt")
            ensure_parent_dir(debug_tabfile)
            shutil.copyfile(tabfile_path, debug_tabfile)
            log(f"已保留中间 tabfile: {debug_tabfile}")

        log(f"[2/3] 解析并写入 SQLite: {target_path}")
        inserted = import_tabfile_to_sqlite(tabfile_path, target_path, language, limit)

    log(f"[3/3] 完成，共写入 {inserted} 条记录 -> {target_path}")
    return target_path


def main() -> None:
    args = parse_args()
    source = Path(args.source).expanduser().resolve()
    if not source.exists():
        raise SystemExit(f"源文件不存在: {source}")
    convert_mdx_to_sqlite(
        source=source,
        language=args.language,
        target=args.target,
        limit=args.limit,
        keep_tabfile=args.keep_tabfile,
    )


if __name__ == "__main__":
    main()
