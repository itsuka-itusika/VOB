#!/usr/bin/env python3
"""Create the フリーゲーム夢現 zip with the Google Analytics tag removed."""

from __future__ import annotations

import argparse
import re
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from package_itch import REPO_ROOT, collect_files  # noqa: E402


DEFAULT_OUTPUT = REPO_ROOT / "output" / "village-of-bacchus-mugen.zip"
# 同梱するプレイヤー向けの説明。ゲーム内のメニューからは開けないため、zipへ入れる。
EXTRA_FILES = (Path("Readme.txt"),)
INDEX_PATH = Path("index.html")
# 計測タグはコメント行から、設定を書いた script の終わりまでをひとかたまりで外す。
ANALYTICS_PATTERN = re.compile(
    r"[ \t]*<!-- Google tag \(gtag\.js\) -->\n"
    r".*?gtag\('config'.*?\n[ \t]*</script>\n",
    re.DOTALL,
)
ANALYTICS_MARKERS = ("gtag", "googletagmanager", "dataLayer")


def strip_analytics(html: str) -> str:
    stripped, count = ANALYTICS_PATTERN.subn("", html)
    if count != 1:
        raise RuntimeError(f"計測タグの検出に失敗しました（一致 {count} 件）")
    remaining = [marker for marker in ANALYTICS_MARKERS if marker in stripped]
    if remaining:
        raise RuntimeError(f"計測タグが残っています: {', '.join(remaining)}")
    return stripped


def package(output_path: Path) -> None:
    files = collect_files()
    files += [path for path in EXTRA_FILES if (REPO_ROOT / path).is_file()]
    if INDEX_PATH not in files:
        raise RuntimeError("index.html が対象に含まれていません")

    index_html = strip_analytics((REPO_ROOT / INDEX_PATH).read_text(encoding="utf-8"))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()

    with zipfile.ZipFile(
        output_path,
        "w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=9,
    ) as archive:
        for relative_path in files:
            if relative_path == INDEX_PATH:
                archive.writestr(INDEX_PATH.as_posix(), index_html)
            else:
                archive.write(REPO_ROOT / relative_path, relative_path.as_posix())

    source_bytes = sum((REPO_ROOT / path).stat().st_size for path in files)
    print(f"Output: {output_path}")
    print(f"Files: {len(files)}")
    print(f"Uncompressed: {source_bytes / 1024 / 1024:.2f} MiB")
    print(f"Zip: {output_path.stat().st_size / 1024 / 1024:.2f} MiB")
    print("Google Analytics: removed")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", nargs="?", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    output_path = args.output
    if not output_path.is_absolute():
        output_path = REPO_ROOT / output_path
    package(output_path.resolve())


if __name__ == "__main__":
    main()
