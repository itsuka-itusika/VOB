#!/usr/bin/env python3
"""Create the フリーゲーム夢現 zip. Shares the itch build, plus the player readme."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from package_itch import INDEX_PATH, REPO_ROOT, build_zip, collect_files, print_summary  # noqa: E402


# 配布ファイル名に入れる版は、本体のタイトル表記から読む。版を上げるときは index.html を直す。
VERSION_PATTERN = re.compile(r"ver\.\d+(?:\.\d+)*")
# 同梱するプレイヤー向けの説明。ゲーム内のメニューからは開けないため、zipへ入れる。
# 配布先では未プレイの人が先に読むため、終盤の内容を伏せた版を Readme.txt として入れる。
README_SOURCE = Path("Readme_mugen.txt")
README_IN_ZIP = "Readme.txt"


def read_display_version() -> str:
    found = VERSION_PATTERN.findall((REPO_ROOT / INDEX_PATH).read_text(encoding="utf-8"))
    if len(found) != 1:
        raise RuntimeError(f"バージョン表記の検出に失敗しました（一致 {len(found)} 件）")
    return found[0]


def default_output(include_images: bool) -> Path:
    slug = read_display_version().replace("ver.", "v")
    suffix = "" if include_images else "-no-images"
    return REPO_ROOT / "output" / f"village-of-bacchus-mugen-{slug}{suffix}.zip"


def package(output_path: Path, include_images: bool = True) -> None:
    readme_path = REPO_ROOT / README_SOURCE
    if not readme_path.is_file():
        raise RuntimeError(f"{README_SOURCE} が見つかりません")

    files = collect_files(include_images)
    build_zip(files, output_path, extra_texts={README_IN_ZIP: readme_path.read_text(encoding="utf-8")})
    print_summary(files, output_path, include_images, extra_count=1)
    print(f"Readme: {README_SOURCE} -> {README_IN_ZIP}")
    print(f"Version: {read_display_version()}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", nargs="?", type=Path)
    parser.add_argument(
        "--no-images",
        action="store_true",
        help="images/ を入れずに作る。あとで手で足す前提の軽い zip になる。",
    )
    args = parser.parse_args()
    output_path = args.output or default_output(include_images=not args.no_images)
    if not output_path.is_absolute():
        output_path = REPO_ROOT / output_path
    package(output_path.resolve(), include_images=not args.no_images)


if __name__ == "__main__":
    main()
