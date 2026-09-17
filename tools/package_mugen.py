#!/usr/bin/env python3
"""Create the フリーゲーム夢現 zip. Shares the itch build, plus the player readme."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from package_itch import REPO_ROOT, build_zip, collect_files, print_summary  # noqa: E402


# 配布先で名乗るバージョン。リポジトリの開発版とは別に、公開の版を数える。
DISPLAY_VERSION = "ver.1.0"
VERSION_SLUG = DISPLAY_VERSION.replace("ver.", "v")
VERSION_PATTERN = re.compile(r"ver\.\d+(?:\.\d+)*")

DEFAULT_OUTPUT = REPO_ROOT / "output" / f"village-of-bacchus-mugen-{VERSION_SLUG}.zip"
NO_IMAGES_OUTPUT = REPO_ROOT / "output" / f"village-of-bacchus-mugen-{VERSION_SLUG}-no-images.zip"
# 同梱するプレイヤー向けの説明。ゲーム内のメニューからは開けないため、zipへ入れる。
# 配布先では未プレイの人が先に読むため、終盤の内容を伏せた版を Readme.txt として入れる。
README_SOURCE = Path("Readme_mugen.txt")
README_IN_ZIP = "Readme.txt"


def set_display_version(html: str) -> str:
    replaced, count = VERSION_PATTERN.subn(DISPLAY_VERSION, html)
    if count != 1:
        raise RuntimeError(f"バージョン表記の検出に失敗しました（一致 {count} 件）")
    return replaced


def package(output_path: Path, include_images: bool = True) -> None:
    readme_path = REPO_ROOT / README_SOURCE
    if not readme_path.is_file():
        raise RuntimeError(f"{README_SOURCE} が見つかりません")

    files = collect_files(include_images)
    build_zip(
        files,
        output_path,
        extra_texts={README_IN_ZIP: readme_path.read_text(encoding="utf-8")},
        index_transform=set_display_version,
    )
    print_summary(files, output_path, include_images, extra_count=1)
    print(f"Readme: {README_SOURCE} -> {README_IN_ZIP}")
    print(f"Version: {DISPLAY_VERSION}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", nargs="?", type=Path)
    parser.add_argument(
        "--no-images",
        action="store_true",
        help="images/ を入れずに作る。あとで手で足す前提の軽い zip になる。",
    )
    args = parser.parse_args()
    output_path = args.output or (NO_IMAGES_OUTPUT if args.no_images else DEFAULT_OUTPUT)
    if not output_path.is_absolute():
        output_path = REPO_ROOT / output_path
    package(output_path.resolve(), include_images=not args.no_images)


if __name__ == "__main__":
    main()
