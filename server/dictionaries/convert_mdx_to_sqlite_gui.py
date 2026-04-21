#!/usr/bin/env python3
from __future__ import annotations

import queue
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from convert_mdx_to_sqlite import DEFAULT_TARGETS, DICTIONARIES_DIR, convert_mdx_to_sqlite


class ConverterGui:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("MDX -> SQLite 词典转换器")
        self.root.geometry("820x620")
        self.root.minsize(760, 560)

        self.log_queue: queue.Queue[tuple[str, str]] = queue.Queue()
        self.worker: threading.Thread | None = None

        self.source_var = tk.StringVar()
        self.language_var = tk.StringVar(value="en")
        self.target_var = tk.StringVar(value=str(DEFAULT_TARGETS["en"]))
        self.limit_var = tk.StringVar(value="0")
        self.keep_tabfile_var = tk.BooleanVar(value=False)
        self.append_var = tk.BooleanVar(value=False)
        self.status_var = tk.StringVar(value="准备就绪")

        self._build()
        self._load_default_source()
        self._poll_logs()

    def _build(self) -> None:
        container = ttk.Frame(self.root, padding=16)
        container.pack(fill="both", expand=True)

        title = ttk.Label(container, text="MDX -> SQLite 离线转换", font=("Arial", 16, "bold"))
        title.pack(anchor="w")

        subtitle = ttk.Label(
            container,
            text="这个工具只在本机运行，不参与网站运行时。先选 MDX，再输出到项目词典目录。",
        )
        subtitle.pack(anchor="w", pady=(6, 14))

        form = ttk.Frame(container)
        form.pack(fill="x")
        form.columnconfigure(1, weight=1)

        ttk.Label(form, text="源 MDX").grid(row=0, column=0, sticky="w", pady=6)
        ttk.Entry(form, textvariable=self.source_var).grid(row=0, column=1, sticky="ew", padx=(10, 8), pady=6)
        ttk.Button(form, text="选择文件", command=self._choose_source).grid(row=0, column=2, sticky="ew", pady=6)

        ttk.Label(form, text="语言").grid(row=1, column=0, sticky="w", pady=6)
        language_box = ttk.Combobox(form, textvariable=self.language_var, values=("en", "ja"), state="readonly", width=10)
        language_box.grid(row=1, column=1, sticky="w", padx=(10, 8), pady=6)
        language_box.bind("<<ComboboxSelected>>", self._handle_language_change)

        ttk.Label(form, text="输出 SQLite").grid(row=2, column=0, sticky="w", pady=6)
        ttk.Entry(form, textvariable=self.target_var).grid(row=2, column=1, sticky="ew", padx=(10, 8), pady=6)
        ttk.Button(form, text="选择位置", command=self._choose_target).grid(row=2, column=2, sticky="ew", pady=6)

        ttk.Label(form, text="导入上限").grid(row=3, column=0, sticky="w", pady=6)
        ttk.Entry(form, textvariable=self.limit_var, width=12).grid(row=3, column=1, sticky="w", padx=(10, 8), pady=6)
        ttk.Label(form, text="0 表示不限制").grid(row=3, column=2, sticky="w", pady=6)

        options = ttk.Frame(container)
        options.pack(fill="x", pady=(12, 8))
        ttk.Checkbutton(options, text="追加到已有 SQLite，不覆盖原词典", variable=self.append_var).pack(anchor="w")
        ttk.Checkbutton(options, text="保留中间 tabfile 调试文件", variable=self.keep_tabfile_var).pack(anchor="w")

        actions = ttk.Frame(container)
        actions.pack(fill="x", pady=(8, 10))
        self.run_button = ttk.Button(actions, text="开始转换", command=self._start_conversion)
        self.run_button.pack(side="left")
        ttk.Button(actions, text="打开词典目录", command=self._open_dictionary_dir).pack(side="left", padx=(8, 0))
        ttk.Label(actions, textvariable=self.status_var).pack(side="right")

        log_frame = ttk.LabelFrame(container, text="运行日志", padding=10)
        log_frame.pack(fill="both", expand=True, pady=(6, 0))
        self.log_text = tk.Text(log_frame, wrap="word", height=24)
        self.log_text.pack(fill="both", expand=True)
        self.log_text.configure(state="disabled")

    def _append_log(self, message: str) -> None:
        self.log_text.configure(state="normal")
        self.log_text.insert("end", f"{message}\n")
        self.log_text.see("end")
        self.log_text.configure(state="disabled")

    def _poll_logs(self) -> None:
        try:
            while True:
                kind, message = self.log_queue.get_nowait()
                if kind == "log":
                    self._append_log(message)
                elif kind == "done":
                    self._append_log(message)
                    self.status_var.set("转换完成")
                    self.run_button.configure(state="normal")
                    messagebox.showinfo("完成", message)
                elif kind == "error":
                    self._append_log(message)
                    self.status_var.set("转换失败")
                    self.run_button.configure(state="normal")
                    messagebox.showerror("失败", message)
        except queue.Empty:
            pass

        self.root.after(150, self._poll_logs)

    def _load_default_source(self) -> None:
        mdx_files = sorted(DICTIONARIES_DIR.glob("*.mdx"))
        if mdx_files:
            self.source_var.set(str(mdx_files[0]))

    def _choose_source(self) -> None:
        selected = filedialog.askopenfilename(
            title="选择 MDX 词典",
            initialdir=str(DICTIONARIES_DIR),
            filetypes=[("MDX Dictionary", "*.mdx"), ("All Files", "*.*")],
        )
        if selected:
            self.source_var.set(selected)

    def _choose_target(self) -> None:
        language = self.language_var.get().strip() or "en"
        selected = filedialog.asksaveasfilename(
            title="选择 SQLite 输出位置",
            initialdir=str(DEFAULT_TARGETS[language].parent),
            initialfile=DEFAULT_TARGETS[language].name,
            defaultextension=".sqlite",
            filetypes=[("SQLite", "*.sqlite"), ("All Files", "*.*")],
        )
        if selected:
            self.target_var.set(selected)

    def _handle_language_change(self, _event: object | None = None) -> None:
        language = self.language_var.get().strip() or "en"
        self.target_var.set(str(DEFAULT_TARGETS[language]))

    def _open_dictionary_dir(self) -> None:
        try:
            import subprocess
            import sys

            target_dir = str(DICTIONARIES_DIR)
            if sys.platform == "darwin":
                subprocess.Popen(["open", target_dir])
            elif sys.platform.startswith("win"):
                subprocess.Popen(["explorer", target_dir])
            else:
                subprocess.Popen(["xdg-open", target_dir])
        except Exception as error:
            messagebox.showerror("打开失败", f"无法打开目录：{error}")

    def _start_conversion(self) -> None:
        source = Path(self.source_var.get().strip()).expanduser()
        target = Path(self.target_var.get().strip()).expanduser()
        language = self.language_var.get().strip()
        limit_text = self.limit_var.get().strip() or "0"

        if not source.exists():
            messagebox.showerror("参数错误", "请选择存在的 MDX 文件。")
            return

        try:
            limit = int(limit_text)
            if limit < 0:
                raise ValueError
        except ValueError:
            messagebox.showerror("参数错误", "导入上限必须是大于等于 0 的整数。")
            return

        self.run_button.configure(state="disabled")
        self.status_var.set("转换中...")
        self._append_log("=" * 50)
        self._append_log(f"开始转换：{source}")

        def worker() -> None:
            try:
                result_path = convert_mdx_to_sqlite(
                    source=source,
                    language=language,
                    target=target,
                    limit=limit,
                    keep_tabfile=self.keep_tabfile_var.get(),
                    append=self.append_var.get(),
                    logger=lambda message: self.log_queue.put(("log", message)),
                )
                self.log_queue.put(("done", f"转换完成：{result_path}"))
            except SystemExit as error:
                self.log_queue.put(("error", str(error)))
            except Exception as error:
                self.log_queue.put(("error", f"出现未处理异常：{error}"))

        self.worker = threading.Thread(target=worker, daemon=True)
        self.worker.start()


def main() -> None:
    root = tk.Tk()
    style = ttk.Style()
    if "clam" in style.theme_names():
        style.theme_use("clam")
    ConverterGui(root)
    root.mainloop()


if __name__ == "__main__":
    main()
