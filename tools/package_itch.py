#!/usr/bin/env python3
"""Create the itch.io HTML5 zip without portrait source images or analytics."""

from __future__ import annotations

import argparse
import re
import zipfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = REPO_ROOT / "output" / "village-of-bacchus-itch.zip"
NO_IMAGES_OUTPUT = REPO_ROOT / "output" / "village-of-bacchus-itch-no-images.zip"
INCLUDED_ROOTS = ("index.html", "css", "js", "images")
IMAGE_ROOT = "images"
INDEX_PATH = Path("index.html")
STANDALONE_PORTRAITS = {
    Path("images/portraits/system/CHILD_SHADOW.svg"),
    Path("images/portraits/system/CHILD_SHADOW_BABY.svg"),
}
FILE_LIMIT = 1000
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


def should_include(relative_path: Path) -> bool:
    portrait_root = Path("images/portraits")
    if relative_path == portrait_root or portrait_root in relative_path.parents:
        return relative_path in STANDALONE_PORTRAITS
    return True


def collect_files(include_images: bool = True) -> list[Path]:
    files: list[Path] = []
    roots = INCLUDED_ROOTS if include_images else tuple(n for n in INCLUDED_ROOTS if n != IMAGE_ROOT)
    for root_name in roots:
        root = REPO_ROOT / root_name
        candidates = [root] if root.is_file() else root.rglob("*")
        for path in candidates:
            if not path.is_file():
                continue
            relative_path = path.relative_to(REPO_ROOT)
            if should_include(relative_path):
                files.append(relative_path)
    return sorted(set(files), key=lambda path: path.as_posix())


def build_zip(files: list[Path], output_path: Path) -> None:
    """配布用zipを書き出す。index.html は計測タグを外したものを入れる。"""
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


def print_summary(files: list[Path], output_path: Path, include_images: bool, file_count_note: str = "") -> None:
    source_bytes = sum((REPO_ROOT / path).stat().st_size for path in files)
    print(f"Output: {output_path}")
    print(f"Files: {len(files)}{file_count_note}")
    print(f"Uncompressed: {source_bytes / 1024 / 1024:.2f} MiB")
    print(f"Zip: {output_path.stat().st_size / 1024 / 1024:.2f} MiB")
    print("Google Analytics: removed")
    if not include_images:
        print(f"Images: excluded (add the {IMAGE_ROOT}/ folder by hand)")


def package(output_path: Path, include_images: bool = True) -> None:
    files = collect_files(include_images)
    if len(files) >= FILE_LIMIT:
        raise RuntimeError(f"itch.io file limit exceeded: {len(files)} >= {FILE_LIMIT}")

    build_zip(files, output_path)
    print_summary(files, output_path, include_images, f" / {FILE_LIMIT - 1} max")


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
