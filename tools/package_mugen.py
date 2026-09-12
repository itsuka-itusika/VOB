#!/usr/bin/env python3
"""Create the フリーゲーム夢現 zip. Shares the itch build, plus the player readme."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from package_itch import REPO_ROOT, build_zip, collect_files, print_summary  # noqa: E402


DEFAULT_OUTPUT = REPO_ROOT / "output" / "village-of-bacchus-mugen.zip"
NO_IMAGES_OUTPUT = REPO_ROOT / "output" / "village-of-bacchus-mugen-no-images.zip"
# 同梱するプレイヤー向けの説明。ゲーム内のメニューからは開けないため、zipへ入れる。
EXTRA_FILES = (Path("Readme.txt"),)


def package(output_path: Path, include_images: bool = True) -> None:
    files = collect_files(include_images)
    files += [path for path in EXTRA_FILES if (REPO_ROOT / path).is_file()]

    build_zip(files, output_path)
    print_summary(files, output_path, include_images)


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
