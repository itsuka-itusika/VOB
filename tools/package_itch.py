#!/usr/bin/env python3
"""Create the itch.io HTML5 zip without portrait source images."""

from __future__ import annotations

import argparse
import zipfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = REPO_ROOT / "output" / "village-of-bacchus-itch.zip"
INCLUDED_ROOTS = ("index.html", "css", "js", "images")
STANDALONE_PORTRAITS = {
    Path("images/portraits/system/CHILD_SHADOW.svg"),
    Path("images/portraits/system/CHILD_SHADOW_BABY.svg"),
}
FILE_LIMIT = 1000


def should_include(relative_path: Path) -> bool:
    portrait_root = Path("images/portraits")
    if relative_path == portrait_root or portrait_root in relative_path.parents:
        return relative_path in STANDALONE_PORTRAITS
    return True


def collect_files() -> list[Path]:
    files: list[Path] = []
    for root_name in INCLUDED_ROOTS:
        root = REPO_ROOT / root_name
        candidates = [root] if root.is_file() else root.rglob("*")
        for path in candidates:
            if not path.is_file():
                continue
            relative_path = path.relative_to(REPO_ROOT)
            if should_include(relative_path):
                files.append(relative_path)
    return sorted(set(files), key=lambda path: path.as_posix())


def package(output_path: Path) -> None:
    files = collect_files()
    if len(files) >= FILE_LIMIT:
        raise RuntimeError(f"itch.io file limit exceeded: {len(files)} >= {FILE_LIMIT}")

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
            archive.write(REPO_ROOT / relative_path, relative_path.as_posix())

    source_bytes = sum((REPO_ROOT / path).stat().st_size for path in files)
    print(f"Output: {output_path}")
    print(f"Files: {len(files)} / {FILE_LIMIT - 1} max")
    print(f"Uncompressed: {source_bytes / 1024 / 1024:.2f} MiB")
    print(f"Zip: {output_path.stat().st_size / 1024 / 1024:.2f} MiB")


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
